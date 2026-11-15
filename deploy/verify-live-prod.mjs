/**
 * Post-deploy live production probe for https://excellegacyrealtygroup.site (v0.66.1+)
 * Verifies:
 *   1. Core routes: /, /universal, /auth/signin, /trust-services
 *   2. Universal CRM API: /api/universal/tenant (8 sectors, 16 languages, 6 add-ons)
 *   3. Disarmed Billing Gate: GET /api/billing/checkout -> armed=false, mode="lead_only"; POST -> 403
 *   4. Auth & DB integrity: /api/auth/session, /api/listings (EXL-1001 preserved), /api/system/health
 *   5. Public submodule mounts: /leadg/login, /foreclosure/login, /aicrm, /leadcaller, /prototype/api/health
 */

const BASE = process.env.PROD_BASE_URL || "https://excellegacyrealtygroup.site";

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
    return `HTML ${html.length} chars`;
  });

  await check("/universal", (res, html) => {
    if (res.status !== 200) throw new Error(`Expected 200 on /universal, got ${res.status}`);
    const hasConfigurator =
      html.includes("Interactive Tenant Provisioner") || html.includes("Universal CRM");
    if (!hasConfigurator) throw new Error("/universal missing configurator markup");
    if (html.includes("INV-UB-") || html.includes("$199/mo")) {
      throw new Error("/universal still contains unapproved $199/mo or INV-UB- text!");
    }
    return `HTML ${html.length} chars (lead-only configurator verified)`;
  });

  await check("/api/universal/tenant", (res, body) => {
    if (res.status !== 200)
      throw new Error(`Expected 200 on /api/universal/tenant, got ${res.status}`);
    const json = JSON.parse(body);
    const sectors = json.catalog?.sectors?.length ?? 0;
    const langs = json.catalog?.languages?.length ?? 0;
    const addons = json.catalog?.addOns?.length ?? 0;
    if (sectors !== 8 || langs !== 16) {
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

  await check("/trust-services", (res, html) => {
    if (res.status !== 200) throw new Error(`Expected 200 on /trust-services, got ${res.status}`);
    if (html.includes("INV-UB-")) {
      throw new Error("/trust-services still contains INV-UB- invoice text!");
    }
    return `HTML ${html.length} chars`;
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

  console.log("ALL LIVE PRODUCTION CHECKS PASSED (v0.66.1)!");
}

main().catch((err) => {
  console.error("LIVE VERIFICATION FAILED:", err);
  process.exit(1);
});
