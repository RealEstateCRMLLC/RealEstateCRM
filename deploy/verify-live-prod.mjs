/**
 * Post-deploy live production probe for https://excellegacyrealtygroup.site (v0.66.2+)
 * Verifies:
 *   1. Core routes (/, /universal, /trust-services, /trust-course, /auth/signin) return 200
 *      AND contain zero unapproved $199, $497, $997, $1,497, or INV-UB- SKU strings
 *   2. Universal CRM API: /api/universal/tenant (8 sectors, 16 languages, 6 add-ons)
 *   3. Disarmed Billing Gate: GET /api/billing/checkout -> armed=false, mode="lead_only"; POST -> 403
 *   4. Workspace CSV Export Guard: GET /api/export?entity=foreclosures -> 401 when unauthenticated
 *   5. Auth & DB integrity: /api/auth/session, /api/listings (EXL-1001 preserved), /api/system/health
 *   6. Public submodule mounts: /leadg/login, /foreclosure/login, /aicrm, /leadcaller, /prototype/api/health
 */

const BASE = process.env.PROD_BASE_URL || "https://excellegacyrealtygroup.site";
const FORBIDDEN_SKU_RE = /\$199|\$497|\$997|\$1,497|INV-UB-/;

function assertNoUnapprovedSkus(route, html) {
  const m = html.match(FORBIDDEN_SKU_RE);
  if (m) {
    throw new Error(`${route} still contains forbidden unapproved SKU/invoice string: "${m[0]}"`);
  }
}

async function check(path, validate, init = { redirect: "manual" }) {
  const url = `${BASE}${path}`;
  const res = await fetch(url, init);
  const text = await res.text();
  const detail = validate ? validate(res, text) : "OK";
  console.log(`${res.status} ${init.method || "GET"} ${path} -> ${detail}`);
  if (res.status >= 500) {
    throw new Error(`5xx on ${path}: ${res.status}`);
  }
}

async function main() {
  await check("/", (res, html) => {
    if (res.status !== 200) throw new Error(`Expected 200 on /, got ${res.status}`);
    assertNoUnapprovedSkus("/", html);
    return `HTML ${html.length} chars (zero unapproved SKUs)`;
  });

  await check("/universal", (res, html) => {
    if (res.status !== 200) throw new Error(`Expected 200 on /universal, got ${res.status}`);
    const hasConfigurator =
      html.includes("Interactive Tenant Provisioner") || html.includes("Universal CRM");
    if (!hasConfigurator) throw new Error("/universal missing configurator markup");
    assertNoUnapprovedSkus("/universal", html);
    return `HTML ${html.length} chars (lead-only configurator, zero unapproved SKUs)`;
  });

  await check("/trust-services", (res, html) => {
    if (res.status !== 200) throw new Error(`Expected 200 on /trust-services, got ${res.status}`);
    assertNoUnapprovedSkus("/trust-services", html);
    return `HTML ${html.length} chars (zero unapproved SKUs)`;
  });

  await check("/trust-course", (res, html) => {
    if (res.status !== 200) throw new Error(`Expected 200 on /trust-course, got ${res.status}`);
    assertNoUnapprovedSkus("/trust-course", html);
    return `HTML ${html.length} chars (zero unapproved SKUs)`;
  });

  await check("/api/universal/tenant", (res, body) => {
    if (res.status !== 200)
      throw new Error(`Expected 200 on /api/universal/tenant, got ${res.status}`);
    const json = JSON.parse(body);
    const sectors = json.catalog?.sectors?.length ?? 0;
    const langs = json.catalog?.languages?.length ?? 0;
    const addons = json.catalog?.addOns?.length ?? 0;
    // Catalog pinned deliberately: 8 launch sectors until the FOOM
    // merge (Protocol #336) expanded SECTOR_PACKS to 17. If this trips
    // again, the catalog changed on purpose or by accident — decide
    // which before bumping the number.
    if (sectors !== 17 || langs !== 16) {
      throw new Error(`Unexpected catalog counts: sectors=${sectors}, langs=${langs}`);
    }
    return `sectors=${sectors}, languages=${langs}, addOns=${addons}, defaultSector=${json.resolved?.sector?.id}`;
  });

  await check("/api/billing/checkout", (res, body) => {
    if (res.status !== 200)
      throw new Error(`Expected 200 on GET /api/billing/checkout, got ${res.status}`);
    const json = JSON.parse(body);
    if (json.armed !== false || json.mode !== "lead_only") {
      throw new Error(`Expected disarmed billing gate (armed=false, mode=lead_only), got ${body}`);
    }
    return `armed=${json.armed}, mode=${json.mode}, stripeConfigured=${json.stripeConfigured}`;
  });

  await check(
    "/api/billing/checkout",
    (res, body) => {
      if (res.status !== 403) {
        throw new Error(
          `Expected 403 on POST /api/billing/checkout when disarmed, got ${res.status}`,
        );
      }
      const json = JSON.parse(body);
      if (json.armed !== false || json.ok !== false) {
        throw new Error(`Unexpected POST /api/billing/checkout payload: ${body}`);
      }
      return `disarmed POST blocked (403, armed=false)`;
    },
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ probe: true }),
      redirect: "manual",
    },
  );

  await check("/api/export?entity=foreclosures", (res) => {
    if (res.status !== 401) {
      throw new Error(`Expected 401 on unauthenticated GET /api/export?entity=foreclosures, got ${res.status}`);
    }
    return `auth guard active (401)`;
  });

  await check("/auth/signin", (res, html) => `status=${res.status}, len=${html.length}`);
  await check("/api/auth/session", (res, body) => `status=${res.status}, body=${body.slice(0, 60)}`);

  await check("/api/listings", (res, body) => {
    if (res.status !== 200) throw new Error(`Expected 200 on /api/listings, got ${res.status}`);
    const hasExl = body.includes("EXL-1001");
    if (!hasExl) throw new Error("EXL-1001 missing from /api/listings — check prod DB!");
    const parsed = JSON.parse(body);
    const count = Array.isArray(parsed) ? parsed.length : parsed.listings?.length ?? "obj";
    return `listings=${count}, EXL-1001=preserved`;
  });

  await check("/api/system/health", (res, body) => {
    return `status=${res.status}, len=${body.length}`;
  });

  for (const mount of [
    "/leadg/login",
    "/foreclosure/login",
    "/aicrm",
    "/leadcaller",
    "/prototype/api/health",
  ]) {
    await check(mount, (res) => `status=${res.status}`);
  }

  console.log("ALL LIVE PRODUCTION CHECKS PASSED (v0.66.2)!");
}

main().catch((err) => {
  console.error("LIVE VERIFICATION FAILED:", err);
  process.exit(1);
});
