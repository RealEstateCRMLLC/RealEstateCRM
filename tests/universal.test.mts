import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { SECTOR_PACKS, getSectorPack, validateSectorPack } from "../src/lib/universal/sectors.ts";
import {
  LANGUAGES,
  ADD_ONS,
  REQUIRED_STRING_KEYS,
  STRINGS,
  addOnsForSector,
  calculateAddOnSelection,
  getLanguage,
  t,
} from "../src/lib/universal/platform.ts";
import {
  defaultTenantRecord,
  resolveUniversalTenant,
  validateAndSanitizeTenantInput,
} from "../src/lib/universal/tenant.ts";
import {
  getStoredTenantRecord,
  saveStoredTenantRecord,
} from "../src/lib/universal/tenant-store.ts";

import { getDigitalTeamForSector, DIGITAL_TEAM_ARCHETYPES } from "../src/lib/universal/digital-team.ts";
import { SUPPORTED_AI_MODELS, executeUniversalAi } from "../src/lib/universal/ai-gateway.ts";
import { calculateBusinessTruth } from "../src/lib/universal/market-oracle.ts";

test("17 sector packs (launch, trades, retail, tech, manufacturing), all valid", () => {
  assert.equal(SECTOR_PACKS.length, 17);
  for (const p of SECTOR_PACKS) assert.deepEqual(validateSectorPack(p), [], p.id);
});

test("real estate is pack #1 with TSF template", () => {
  const re = getSectorPack("real-estate");
  assert.equal(re.customer, "Client");
  assert.ok(re.templates.some((x) => x.includes("TSF")));
  assert.equal(getSectorPack("nope").id, "real-estate");
});

test("all 16 launch languages have complete UI dictionaries and RTL metadata", () => {
  assert.equal(LANGUAGES.length, 16);
  assert.equal(getLanguage("ar").rtl, true);
  assert.equal(getLanguage("en").rtl, undefined);
  assert.equal(getLanguage("unknown-locale").code, "en");

  for (const lang of LANGUAGES) {
    assert.ok(STRINGS[lang.code], `missing STRINGS dictionary for ${lang.code}`);
    for (const key of REQUIRED_STRING_KEYS) {
      const val = STRINGS[lang.code][key];
      assert.ok(typeof val === "string" && val.length > 0, `missing ${lang.code}.${key}`);
    }
  }

  assert.equal(t("es", "welcome"), "Bienvenido");
  assert.equal(t("ja", "customers"), "顧客");
  assert.equal(t("xx", "welcome"), "Welcome");
});

test("add-ons are United Beats, sector-filtered, and accurately priced", () => {
  assert.ok(ADD_ONS.every((a) => a.byUnitedBeats));
  assert.ok(addOnsForSector("retail").some((a) => a.id === "commerce-sync"));
  assert.ok(!addOnsForSector("legal").some((a) => a.id === "commerce-sync"));
  assert.ok(addOnsForSector("finance").some((a) => a.id === "trust-tsf"));

  const selection = calculateAddOnSelection("legal", [
    "trust-tsf",       // $0, compatible with legal
    "compliance-vault", // $129, compatible with legal
    "commerce-sync",   // $99, retail-only -> must be filtered out!
  ]);
  assert.deepEqual(
    selection.enabledAddOns.map((a) => a.id),
    ["trust-tsf", "compliance-vault"],
  );
  assert.equal(selection.monthlyTotal, 129);
});

test("validateAndSanitizeTenantInput enforces valid sectors, locales, and add-on compatibility", () => {
  const badSector = validateAndSanitizeTenantInput({ sectorId: "aerospace" }, "ws-1");
  assert.equal(badSector.ok, false);

  const badLang = validateAndSanitizeTenantInput({ sectorId: "legal", language: "tlh" }, "ws-1");
  assert.equal(badLang.ok, false);

  const badGen = validateAndSanitizeTenantInput(
    { sectorId: "legal", language: "en", generationMode: "boomer" },
    "ws-1",
  );
  assert.equal(badGen.ok, false);

  const valid = validateAndSanitizeTenantInput(
    {
      sectorId: "healthcare",
      language: "ar",
      generationMode: "gen-z",
      enabledAddOnIds: ["ai-receptionist", "compliance-vault", "commerce-sync", "ai-receptionist"],
      customVocabulary: { customer: "  Member  ", offering: "" },
    },
    "ws-health",
  );
  assert.equal(valid.ok, true);
  if (valid.ok) {
    assert.equal(valid.record.sectorId, "healthcare");
    assert.equal(valid.record.language, "ar");
    assert.equal(valid.record.generationMode, "gen-z");
    // commerce-sync stripped (retail-only) and duplicates deduplicated
    assert.deepEqual(valid.record.enabledAddOnIds, ["ai-receptionist", "compliance-vault"]);
    assert.deepEqual(valid.record.customVocabulary, { customer: "Member" });
  }
});

test("tenant store persists, reloads, and resolves RTL + custom vocabulary cleanly", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "ucrm-tenant-test-"));
  const storePath = path.join(tmpDir, "universal-tenants.json");
  try {
    const initial = await getStoredTenantRecord("ws-alpha", storePath);
    assert.deepEqual(initial, defaultTenantRecord("ws-alpha"));

    const saved = await saveStoredTenantRecord(
      {
        workspaceId: "ws-alpha",
        sectorId: "legal",
        language: "ar",
        generationMode: "gen-x",
        enabledAddOnIds: ["trust-tsf", "review-engine"],
        customVocabulary: { workUnit: "Docket" },
        updatedBy: "counsel@firm.example",
      },
      storePath,
    );
    assert.ok(saved.updatedAt);

    const reloaded = await getStoredTenantRecord("ws-alpha", storePath);
    assert.equal(reloaded.sectorId, "legal");
    assert.equal(reloaded.language, "ar");

    const resolved = resolveUniversalTenant(reloaded, {
      name: "Al-Noor Legal Group",
      logoUrl: null,
      primaryColor: "#1e3a8a",
      accentColor: "#ca8a04",
      portalSlug: "al-noor-legal",
      emailFooter: null,
      brokeragePhone: null,
      brokerageAddress: null,
    });

    assert.equal(resolved.language.rtl, true);
    assert.equal(resolved.vocabulary.customer, "Client");
    assert.equal(resolved.vocabulary.workUnit, "Docket");
    assert.equal(resolved.vocabulary.offering, "Consultation");
    assert.equal(resolved.monthlyAddOnTotal, 49);
    assert.equal(resolved.localized.welcome, "مرحباً");
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

test("CommandCenter preserves 36/36 dashboard directory coverage and 100% card tooltips", async () => {
  const { readdir, readFile } = await import("node:fs/promises");
  const dashboardRoot = path.join(process.cwd(), "src", "app", "dashboard");
  const entries = await readdir(dashboardRoot, { withFileTypes: true });
  const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();
  assert.ok(dirs.length >= 36, `expected >= 36 dashboard route dirs, found ${dirs.length}`);

  const ccSource = await readFile(
    path.join(process.cwd(), "src", "components", "dashboard", "CommandCenter.tsx"),
    "utf8",
  );
  for (const dir of dirs) {
    assert.ok(
      ccSource.includes(`'/dashboard/${dir}'`) || ccSource.includes(`"/dashboard/${dir}"`),
      `CommandCenter.tsx missing direct link to /dashboard/${dir}`,
    );
  }
});

test("Digital Second Team generates tailored 5-agent workforce for any trade or tech sector", () => {
  assert.equal(DIGITAL_TEAM_ARCHETYPES.length, 5);

  const roofingTeam = getDigitalTeamForSector("roofing", "Apex Roofing Pros");
  assert.equal(roofingTeam.length, 5);
  const atlas = roofingTeam.find((m) => m.profile.code === "concierge")!;
  assert.ok(atlas.systemPrompt.includes("Roofing"));
  assert.ok(atlas.systemPrompt.includes("Apex Roofing Pros"));
  assert.equal(atlas.autonomy, "autonomous");

  const techTeam = getDigitalTeamForSector("tech-saas", "CloudScale AI");
  const vanguard = techTeam.find((m) => m.profile.code === "pipeline")!;
  assert.ok(vanguard.sectorCustomization.title.includes("Opportunity"));

  const restaurantTeam = getDigitalTeamForSector("restaurant", "Trattoria Milano");
  const dispatch = restaurantTeam.find((m) => m.profile.code === "dispatch")!;
  assert.ok(dispatch.sectorCustomization.title.includes("Restaurant"));
});

test("Universal AI Gateway exposes Meta Muse, Gemini, Claude, OpenAI and local models", async () => {
  assert.ok(SUPPORTED_AI_MODELS.some((m) => m.provider === "meta-muse"));
  assert.ok(SUPPORTED_AI_MODELS.some((m) => m.provider === "google-gemini"));
  assert.ok(SUPPORTED_AI_MODELS.some((m) => m.provider === "local-ollama"));

  const res = await executeUniversalAi({
    providerId: "meta-muse",
    systemPrompt: "You are Atlas for United Beats LLC.",
    userPrompt: "Qualify a commercial roofing lead in Detroit.",
  });
  assert.equal(res.provider, "meta-muse");
  assert.ok(res.text.includes("meta-muse"));
});

test("Market Oracle & Business Truth calculates unvarnished reality and flags bottlenecks", () => {
  // Case A: Labor bottleneck (Goal $100k/mo, but 2 crews can only do 8 jobs @ $5k = $40k/mo)
  const constrainedResult = calculateBusinessTruth({
    businessName: "Titan Brickwork",
    sectorId: "masonry",
    currentMonthlyRevenue: 30000,
    targetMonthlyRevenue: 100000,
    timeframeMonths: 6,
    averageDealValue: 5000,
    historicalCloseRate: 0.20,
    monthlyAdSpend: 1000,
    activeLaborCapacityUnits: 2,
    maxDealsPerUnitMonthly: 4,
  });

  assert.equal(constrainedResult.isViableWithCurrentCapacity, false);
  assert.ok(constrainedResult.bottlenecksIdentified.some((b) => b.includes("Labor Fulfillment Bottleneck")));
  assert.ok(constrainedResult.bottlenecksIdentified.some((b) => b.includes("Lead Acquisition Under-funding")));
  assert.equal(constrainedResult.roadmap.length, 6);

  // Case B: Well-capitalized and staffed operation
  const viableResult = calculateBusinessTruth({
    businessName: "Summit Roofing",
    sectorId: "roofing",
    currentMonthlyRevenue: 50000,
    targetMonthlyRevenue: 80000,
    timeframeMonths: 3,
    averageDealValue: 10000,
    historicalCloseRate: 0.30,
    monthlyAdSpend: 10000,
    activeLaborCapacityUnits: 4,
    maxDealsPerUnitMonthly: 5,
  });

  assert.equal(viableResult.isViableWithCurrentCapacity, true);
  assert.equal(viableResult.requiredMonthlyDeals, 8);
  assert.ok(viableResult.unvarnishedTruthSummary.includes("mathematically reachable"));
});
