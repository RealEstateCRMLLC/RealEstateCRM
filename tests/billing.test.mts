import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { resolveInternalAppUrl } from "../src/lib/sync-scheduler.ts";
import {
  TSF_SKUS,
  UNIVERSAL_PLATFORM_BASE_MONTHLY_USD,
  buildBillingQuote,
  generateInvoiceRef,
} from "../src/lib/billing/checkout.ts";
import {
  appendBillingOrder,
  listBillingOrders,
  markBillingOrderPaid,
  verifyStripeWebhookSignature,
} from "../src/lib/billing/order-store.ts";

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

test("buildBillingQuote prices all TSF SKUs and rejects unknown SKUs", () => {
  assert.equal(Object.keys(TSF_SKUS).length, 5);

  const clientBundle = buildBillingQuote({ kind: "tsf", tsfSkuId: "tsf-bundle-client" });
  assert.equal(clientBundle.ok, true);
  if (clientBundle.ok) {
    assert.equal(clientBundle.quote.oneTimeTotalUsd, 997);
    assert.equal(clientBundle.quote.monthlyTotalUsd, 0);
    assert.equal(clientBundle.quote.dealValueUsd, 997);
  }

  const standaloneBundle = buildBillingQuote({ kind: "tsf", tsfSkuId: "tsf-bundle" });
  assert.equal(standaloneBundle.ok, true);
  if (standaloneBundle.ok) {
    assert.equal(standaloneBundle.quote.oneTimeTotalUsd, 1497);
  }

  const bad = buildBillingQuote({ kind: "tsf", tsfSkuId: "non-existent" });
  assert.equal(bad.ok, false);
});

test("buildBillingQuote computes Universal CRM monthly subscription and filters incompatible add-ons", () => {
  const res = buildBillingQuote({
    kind: "universal",
    sectorId: "healthcare",
    addOnIds: ["ai-receptionist", "compliance-vault", "commerce-sync"], // commerce-sync is retail-only
    includePlatformBase: true,
  });
  assert.equal(res.ok, true);
  if (res.ok) {
    // 199 base + 149 ai-receptionist + 129 compliance-vault = 477/mo
    assert.equal(res.quote.monthlyTotalUsd, UNIVERSAL_PLATFORM_BASE_MONTHLY_USD + 149 + 129);
    assert.equal(res.quote.dealValueUsd, (UNIVERSAL_PLATFORM_BASE_MONTHLY_USD + 149 + 129) * 12);
    assert.equal(res.quote.items.length, 3);
    assert.equal(res.quote.payee, "United Beats LLC");
  }

  const ref = generateInvoiceRef(new Date("2026-11-14T12:00:00Z"), "a1b2");
  assert.equal(ref, "INV-UB-20261114-A1B2");
});

test("order-store persists orders and marks matching Stripe/invoice orders PAID", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "billing-orders-"));
  const storePath = path.join(dir, "orders.json");
  try {
    await appendBillingOrder(
      {
        id: "ord-1",
        invoiceRef: "INV-UB-20261114-TEST",
        kind: "universal",
        mode: "invoice",
        status: "INVOICED",
        payee: "United Beats LLC",
        workspaceId: "ws-1",
        sectorId: "legal",
        language: "en",
        customer: { name: "Jane Counsel", email: "jane@law.example" },
        items: [
          {
            id: "universal-platform-core",
            name: "Universal CRM Core",
            description: "Core",
            amountUsd: 199,
            interval: "month",
          },
        ],
        oneTimeTotalUsd: 0,
        monthlyTotalUsd: 199,
        dealValueUsd: 2388,
        dealId: "deal-123",
        createdAt: "2026-11-14T22:00:00.000Z",
      },
      storePath,
    );

    const listed = await listBillingOrders(storePath);
    assert.equal(listed.length, 1);
    assert.equal(listed[0].status, "INVOICED");

    const paid = await markBillingOrderPaid(
      { invoiceRef: "INV-UB-20261114-TEST" },
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
    data: { object: { id: "cs_test_1", client_reference_id: "INV-UB-20261114-TEST" } },
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
