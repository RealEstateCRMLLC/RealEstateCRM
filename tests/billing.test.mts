import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { resolveInternalAppUrl } from "../src/lib/sync-scheduler.ts";
import {
  buildCustomBillingQuote,
  isBillingCheckoutArmed,
} from "../src/lib/billing/checkout.ts";
import {
  appendBillingOrder,
  listBillingOrders,
  markBillingOrderPaid,
  verifyStripeWebhookSignature,
} from "../src/lib/billing/order-store.ts";
import { escapeCsvCell, objectsToCsv, sanitizeCsvValue } from "../src/lib/csv-export.ts";

test("sync-scheduler resolveInternalAppUrl honors PORT=3210 on Hetzner and INTERNAL_APP_URL", () => {
  assert.equal(resolveInternalAppUrl({ NODE_ENV: "production" }), "http://127.0.0.1:3000");
  assert.equal(
    resolveInternalAppUrl({ NODE_ENV: "production", PORT: "3210" }),
    "http://127.0.0.1:3210",
  );
  assert.equal(
    resolveInternalAppUrl({
      NODE_ENV: "production",
      PORT: "3210",
      INTERNAL_APP_URL: "http://127.0.0.1:3999/",
    }),
    "http://127.0.0.1:3999",
  );
});

test("isBillingCheckoutArmed stays disarmed by default even if STRIPE_SECRET_KEY is present", () => {
  assert.equal(isBillingCheckoutArmed({}), false);
  assert.equal(isBillingCheckoutArmed({ STRIPE_SECRET_KEY: "sk_live_example" }), false);
  assert.equal(
    isBillingCheckoutArmed({
      STRIPE_SECRET_KEY: "sk_live_example",
      BILLING_CHECKOUT_ENABLED: "false",
    }),
    false,
  );
  assert.equal(
    isBillingCheckoutArmed({
      BILLING_CHECKOUT_ENABLED: "true",
    }),
    true,
  );
});

test("buildCustomBillingQuote totals explicit custom pilot items (e.g. $500 setup + $500/mo) and rejects invalid items", () => {
  const pilot = buildCustomBillingQuote({
    kind: "pilot",
    summaryTitle: "60-Day Brokerage CRM Pilot",
    items: [
      {
        id: "pilot-setup",
        name: "Brokerage Pilot Setup",
        description: "One-time onboarding & MLS integration setup",
        amountUsd: 500,
        interval: "one_time",
      },
      {
        id: "pilot-monthly",
        name: "Brokerage Pilot Monthly",
        description: "60-day pilot monthly service",
        amountUsd: 500,
        interval: "month",
      },
    ],
  });
  assert.equal(pilot.ok, true);
  if (pilot.ok) {
    assert.equal(pilot.quote.oneTimeTotalUsd, 500);
    assert.equal(pilot.quote.monthlyTotalUsd, 500);
    assert.equal(pilot.quote.dealValueUsd, 500 + 500 * 12);
    assert.equal(pilot.quote.payee, "United Beats LLC");
  }

  const empty = buildCustomBillingQuote({
    kind: "custom",
    summaryTitle: "Empty",
    items: [],
  });
  assert.equal(empty.ok, false);

  const negative = buildCustomBillingQuote({
    kind: "custom",
    summaryTitle: "Invalid",
    items: [
      {
        id: "bad",
        name: "Bad",
        description: "Negative",
        amountUsd: -1,
        interval: "one_time",
      },
    ],
  });
  assert.equal(negative.ok, false);
});

test("order-store persists orders and marks matching records PAID", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "billing-orders-"));
  const storePath = path.join(dir, "orders.json");
  try {
    await appendBillingOrder(
      {
        id: "ord-1",
        invoiceRef: "PILOT-TEST-001",
        kind: "pilot",
        mode: "invoice",
        status: "INVOICED",
        payee: "United Beats LLC",
        workspaceId: "ws-1",
        sectorId: "real-estate",
        language: "en",
        customer: { name: "Test Broker", email: "broker@example.com" },
        items: [
          {
            id: "pilot-setup",
            name: "Pilot Setup",
            description: "Setup",
            amountUsd: 500,
            interval: "one_time",
          },
        ],
        oneTimeTotalUsd: 500,
        monthlyTotalUsd: 500,
        dealValueUsd: 6500,
        dealId: "deal-123",
        createdAt: "2026-11-15T04:00:00.000Z",
      },
      storePath,
    );

    const listed = await listBillingOrders(storePath);
    assert.equal(listed.length, 1);
    assert.equal(listed[0].status, "INVOICED");

    const paid = await markBillingOrderPaid(
      { invoiceRef: "PILOT-TEST-001" },
      storePath,
    );
    assert.ok(paid);
    assert.equal(paid.status, "PAID");
    assert.ok(paid.paidAt);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("verifyStripeWebhookSignature validates authentic HMAC-SHA256 signatures and blocks replays/tampering", () => {
  const secret = "whsec_test_secret_12345";
  const nowSec = 1_794_697_000;
  const payload = JSON.stringify({
    type: "checkout.session.completed",
    data: { object: { id: "cs_test_1", client_reference_id: "PILOT-TEST-001" } },
  });
  const sig = crypto
    .createHmac("sha256", secret)
    .update(`${nowSec}.${payload}`, "utf8")
    .digest("hex");

  const ok = verifyStripeWebhookSignature(
    payload,
    `t=${nowSec},v1=${sig}`,
    secret,
    300,
    nowSec + 15,
  );
  assert.deepEqual(ok, { valid: true, timestamp: nowSec });

  const tampered = verifyStripeWebhookSignature(
    payload + " ",
    `t=${nowSec},v1=${sig}`,
    secret,
    300,
    nowSec + 15,
  );
  assert.equal(tampered.valid, false);

  const replay = verifyStripeWebhookSignature(
    payload,
    `t=${nowSec - 999},v1=${sig}`,
    secret,
    300,
    nowSec,
  );
  assert.equal(replay.valid, false);
});

test("csv-export serializes RFC-4180 rows, preserves phone/negative numbers, and neutralizes formula injection", () => {
  assert.equal(sanitizeCsvValue("+15865550100"), "+15865550100");
  assert.equal(sanitizeCsvValue(-500.25), "-500.25");
  assert.equal(sanitizeCsvValue("=CMD()"), "'=CMD()");
  assert.equal(sanitizeCsvValue("+HYPERLINK(\"http://evil\")"), "'+HYPERLINK(\"http://evil\")");
  assert.equal(escapeCsvCell('Macomb, "East"'), '"Macomb, ""East"""');

  const emptyWithHeaders = objectsToCsv([], ["id", "county", "mortgagor_name"]);
  assert.equal(emptyWithHeaders, "id,county,mortgagor_name\r\n");

  const populated = objectsToCsv(
    [
      {
        id: "fc-1",
        county: "Macomb",
        mortgagor_name: 'Doe, "Jane"',
        phone: "+15865550100",
      },
    ],
    ["id", "county", "mortgagor_name", "phone"],
  );
  assert.equal(
    populated,
    'id,county,mortgagor_name,phone\r\nfc-1,Macomb,"Doe, ""Jane""",+15865550100\r\n',
  );
});

test("public funnel pages contain zero unapproved $199, $497, $997, or $1,497 SKU prices", async () => {
  const files = [
    "src/app/page.tsx",
    "src/app/trust-services/page.tsx",
    "src/app/trust-course/page.tsx",
    "src/app/universal/page.tsx",
    "src/components/trust/TrustLeadForm.tsx",
    "src/components/universal/UniversalProvisioner.tsx",
  ];
  const forbidden = /\$199|\$497|\$997|\$1,497|"497"|"997"|"1497"|INV-UB-/;
  for (const rel of files) {
    const content = await readFile(path.join(process.cwd(), rel), "utf8");
    assert.equal(
      forbidden.test(content),
      false,
      `Expected ${rel} to contain zero unapproved SKU prices or INV-UB- strings`,
    );
  }
});
