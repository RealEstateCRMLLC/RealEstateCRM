/**
 * Universal CRM — Tenant Provisioning Engine (Rollout Step 2).
 *
 * Why a hybrid Prisma WorkspaceBranding + JSON store (`data/universal-tenants.json`)?
 *   1. Production on Hetzner (`excellegacyrealtygroup.site`) runs against a live
 *      SQLite database (`prisma/dev.db`) that is intentionally preserved across
 *      tarball backup-and-swap deployments (`deploy/package-v3.py` never touches
 *      `prisma/dev.db` or `data/`).
 *   2. Brand identity fields (`name`, `logoUrl`, `primaryColor`, `accentColor`,
 *      `portalSlug`, `brokeragePhone`, `brokerageAddress`, `emailFooter`) already
 *      live on the Prisma `Workspace` model and power `/portal` and `/sign/*`.
 *   3. Storing Universal CRM sector configuration (`sectorId`, `language`,
 *      `generationMode`, `enabledAddOnIds`, optional custom vocabulary overrides)
 *      in `data/universal-tenants.json` keyed by `workspaceId` delivers 100%
 *      zero-migration safety on SQLite while keeping workspace branding unified.
 */

import { SECTOR_PACKS, getSectorPack, type SectorPack } from "./sectors.ts";
import {
  LANGUAGES,
  getLanguage,
  addOnsForSector,
  calculateAddOnSelection,
  t,
  type AddOn,
  type Language,
} from "./platform.ts";

export type GenerationExperience =
  | "all-generations"
  | "gen-x"
  | "millennial"
  | "gen-z";

export const GENERATION_EXPERIENCES: {
  id: GenerationExperience;
  label: string;
  summary: string;
}[] = [
  {
    id: "all-generations",
    label: "Universal Three-Tap Default (All Generations)",
    summary: "Balanced phone, self-serve templates, and instant AI chat/voice with plain sector words.",
  },
  {
    id: "gen-x",
    label: "Gen X — Phone & Print-Ready First",
    summary: "Human advisor one tap away, high-contrast call actions, and print-friendly PDF packets.",
  },
  {
    id: "millennial",
    label: "Millennials — 10-Minute Self-Serve & Transparent Pricing",
    summary: "Guided onboarding checklists, prebuilt stage automations, and clear itemized pricing.",
  },
  {
    id: "gen-z",
    label: "Gen Z — AI Voice/Chat-First & Instant Locale Switch",
    summary: "24/7 HyperNexus AI receptionist lead intake, mobile-first cards, and one-tap language toggle.",
  },
];

export interface CustomVocabulary {
  customer?: string;
  workUnit?: string;
  offering?: string;
}

export interface UniversalTenantRecord {
  workspaceId: string;
  sectorId: string;
  language: string;
  generationMode: GenerationExperience;
  enabledAddOnIds: string[];
  customVocabulary?: CustomVocabulary;
  updatedAt: string;
  updatedBy?: string;
}

export interface TenantBrandSnapshot {
  name: string;
  logoUrl: string | null;
  primaryColor: string;
  accentColor: string;
  portalSlug: string | null;
  emailFooter: string | null;
  brokeragePhone: string | null;
  brokerageAddress: string | null;
}

export interface ResolvedUniversalTenant {
  workspaceId: string;
  brand: TenantBrandSnapshot;
  sector: SectorPack;
  vocabulary: {
    customer: string;
    workUnit: string;
    offering: string;
  };
  language: Language;
  generationMode: GenerationExperience;
  enabledAddOns: AddOn[];
  availableAddOns: AddOn[];
  monthlyAddOnTotal: number;
  localized: {
    welcome: string;
    customers: string;
    pipeline: string;
    getStarted: string;
    tagline: string;
    provisionWorkspace: string;
    activeSector: string;
    complianceGuardrails: string;
    templatesReady: string;
    monthlyAddOns: string;
  };
  poweredBy: "United Beats LLC (Bob & Lum) — Universal CRM on HyperNexus";
  updatedAt: string | null;
}

const VALID_GENERATION_MODES = new Set<GenerationExperience>([
  "all-generations",
  "gen-x",
  "millennial",
  "gen-z",
]);

export function defaultTenantRecord(workspaceId: string): UniversalTenantRecord {
  return {
    workspaceId,
    sectorId: "real-estate",
    language: "en",
    generationMode: "all-generations",
    enabledAddOnIds: ["trust-tsf"],
    updatedAt: new Date(0).toISOString(),
  };
}

/**
 * Pure validator/sanitizer for incoming tenant provisioning payloads.
 * Rejects unknown sectors or languages with explicit errors when strict, or
 * normalizes optional fields safely. Exported for fast unit testing.
 */
export function validateAndSanitizeTenantInput(
  input: Record<string, unknown>,
  workspaceId: string,
): { ok: true; record: Omit<UniversalTenantRecord, "updatedAt"> } | { ok: false; error: string } {
  const rawSector = typeof input.sectorId === "string" ? input.sectorId.trim() : "real-estate";
  const sectorExists = SECTOR_PACKS.some((s) => s.id === rawSector);
  if (!sectorExists) {
    return { ok: false, error: `Unknown sector pack "${rawSector}"` };
  }

  const rawLang = typeof input.language === "string" ? input.language.trim() : "en";
  const langExists = LANGUAGES.some((l) => l.code === rawLang);
  if (!langExists) {
    return { ok: false, error: `Unsupported language code "${rawLang}"` };
  }

  const rawGen =
    typeof input.generationMode === "string"
      ? (input.generationMode.trim() as GenerationExperience)
      : "all-generations";
  if (!VALID_GENERATION_MODES.has(rawGen)) {
    return { ok: false, error: `Invalid generation experience "${String(input.generationMode)}"` };
  }

  const rawAddOns = Array.isArray(input.enabledAddOnIds)
    ? input.enabledAddOnIds.filter((x): x is string => typeof x === "string")
    : [];
  const compatibleIds = new Set(addOnsForSector(rawSector).map((a) => a.id));
  const enabledAddOnIds = Array.from(new Set(rawAddOns.filter((id) => compatibleIds.has(id))));

  let customVocabulary: CustomVocabulary | undefined;
  if (input.customVocabulary && typeof input.customVocabulary === "object") {
    const cv = input.customVocabulary as Record<string, unknown>;
    const customer = typeof cv.customer === "string" ? cv.customer.trim().slice(0, 40) : "";
    const workUnit = typeof cv.workUnit === "string" ? cv.workUnit.trim().slice(0, 40) : "";
    const offering = typeof cv.offering === "string" ? cv.offering.trim().slice(0, 40) : "";
    if (customer || workUnit || offering) {
      customVocabulary = {
        ...(customer ? { customer } : {}),
        ...(workUnit ? { workUnit } : {}),
        ...(offering ? { offering } : {}),
      };
    }
  }

  return {
    ok: true,
    record: {
      workspaceId,
      sectorId: rawSector,
      language: rawLang,
      generationMode: rawGen,
      enabledAddOnIds,
      ...(customVocabulary ? { customVocabulary } : {}),
    },
  };
}

export function resolveUniversalTenant(
  record: UniversalTenantRecord,
  brand: TenantBrandSnapshot,
): ResolvedUniversalTenant {
  const sector = getSectorPack(record.sectorId);
  const language = getLanguage(record.language);
  const availableAddOns = addOnsForSector(sector.id);
  const { enabledAddOns, monthlyTotal } = calculateAddOnSelection(
    sector.id,
    record.enabledAddOnIds,
  );

  return {
    workspaceId: record.workspaceId,
    brand,
    sector,
    vocabulary: {
      customer: record.customVocabulary?.customer || sector.customer,
      workUnit: record.customVocabulary?.workUnit || sector.workUnit,
      offering: record.customVocabulary?.offering || sector.offering,
    },
    language,
    generationMode: record.generationMode,
    enabledAddOns,
    availableAddOns,
    monthlyAddOnTotal: monthlyTotal,
    localized: {
      welcome: t(language.code, "welcome"),
      customers: t(language.code, "customers"),
      pipeline: t(language.code, "pipeline"),
      getStarted: t(language.code, "getStarted"),
      tagline: t(language.code, "tagline"),
      provisionWorkspace: t(language.code, "provisionWorkspace"),
      activeSector: t(language.code, "activeSector"),
      complianceGuardrails: t(language.code, "complianceGuardrails"),
      templatesReady: t(language.code, "templatesReady"),
      monthlyAddOns: t(language.code, "monthlyAddOns"),
    },
    poweredBy: "United Beats LLC (Bob & Lum) — Universal CRM on HyperNexus",
    updatedAt: record.updatedAt === new Date(0).toISOString() ? null : record.updatedAt,
  };
}
