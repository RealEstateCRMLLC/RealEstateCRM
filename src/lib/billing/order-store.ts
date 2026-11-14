/**
 * Server-Only Billing Order Ledger & Stripe Webhook Verifier.
 *
 * Persists checkout & invoice orders to `data/billing-orders.json` (preserved
 * across Hetzner standalone tarball swaps without SQLite schema migrations) and
 * provides zero-dependency RFC-compliant Stripe `Stripe-Signature` HMAC-SHA256
 * verification (`t=...,v1=...`).
 */

import crypto from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { BillingKind, BillingLineItem } from "./checkout.ts";

export type BillingOrderStatus = "INVOICED" | "STRIPE_PENDING" | "PAID" | "CANCELED";

export interface BillingOrderRecord {
  id: string;
  invoiceRef: string;
  kind: BillingKind;
  mode: "stripe" | "invoice";
  status: BillingOrderStatus;
  payee: string;
  workspaceId: string;
  sectorId?: string;
  language?: string;
  customer: {
    name: string;
    email: string;
    phone?: string;
    companyName?: string;
  };
  items: BillingLineItem[];
  oneTimeTotalUsd: number;
  monthlyTotalUsd: number;
  dealValueUsd: number;
  dealId?: string;
  leadId?: string;
  stripeSessionId?: string;
  stripeCheckoutUrl?: string;
  notes?: string;
  createdAt: string;
  paidAt?: string;
}

const DEFAULT_ORDERS_PATH = path.join(process.cwd(), "data", "billing-orders.json");

export async function listBillingOrders(
  storePath: string = DEFAULT_ORDERS_PATH,
): Promise<BillingOrderRecord[]> {
  try {
    const raw = await readFile(storePath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as BillingOrderRecord[]) : [];
  } catch {
    return [];
  }
}

export async function appendBillingOrder(
  order: BillingOrderRecord,
  storePath: string = DEFAULT_ORDERS_PATH,
): Promise<BillingOrderRecord> {
  const existing = await listBillingOrders(storePath);
  existing.unshift(order);
  await mkdir(path.dirname(storePath), { recursive: true });
  await writeFile(storePath, JSON.stringify(existing, null, 2), "utf8");
  return order;
}

export async function markBillingOrderPaid(
  matcher: { invoiceRef?: string; stripeSessionId?: string },
  storePath: string = DEFAULT_ORDERS_PATH,
): Promise<BillingOrderRecord | null> {
  const existing = await listBillingOrders(storePath);
  const idx = existing.findIndex(
    (o) =>
      (matcher.invoiceRef && o.invoiceRef === matcher.invoiceRef) ||
      (matcher.stripeSessionId && o.stripeSessionId === matcher.stripeSessionId),
  );
  if (idx === -1) return null;

  existing[idx] = {
    ...existing[idx],
    status: "PAID",
    paidAt: new Date().toISOString(),
  };
  await mkdir(path.dirname(storePath), { recursive: true });
  await writeFile(storePath, JSON.stringify(existing, null, 2), "utf8");
  return existing[idx];
}

/**
 * Verify a Stripe `Stripe-Signature` header (`t=<unix>,v1=<hex>`) using HMAC-SHA256
 * and constant-time digest comparison, enforcing a replay window (`toleranceSec`).
 */
export function verifyStripeWebhookSignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  webhookSecret: string,
  toleranceSec: number = 300,
  nowUnixSec: number = Math.floor(Date.now() / 1000),
): { valid: true; timestamp: number } | { valid: false; reason: string } {
  if (!signatureHeader || !webhookSecret) {
    return { valid: false, reason: "Missing signature header or webhook secret" };
  }

  const parts = signatureHeader.split(",").map((p) => p.trim());
  let timestampStr = "";
  const v1Signatures: string[] = [];

  for (const part of parts) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const k = part.slice(0, eq);
    const v = part.slice(eq + 1);
    if (k === "t") timestampStr = v;
    if (k === "v1" && v) v1Signatures.push(v);
  }

  const timestamp = Number(timestampStr);
  if (!Number.isFinite(timestamp) || timestamp <= 0 || v1Signatures.length === 0) {
    return { valid: false, reason: "Malformed Stripe-Signature header" };
  }

  if (Math.abs(nowUnixSec - timestamp) > toleranceSec) {
    return { valid: false, reason: "Timestamp outside replay tolerance window" };
  }

  const signedPayload = `${timestamp}.${rawBody}`;
  const expectedHex = crypto
    .createHmac("sha256", webhookSecret)
    .update(signedPayload, "utf8")
    .digest("hex");
  const expectedBuf = Buffer.from(expectedHex, "hex");

  for (const candidateHex of v1Signatures) {
    if (candidateHex.length !== expectedHex.length) continue;
    try {
      const candidateBuf = Buffer.from(candidateHex, "hex");
      if (
        candidateBuf.length === expectedBuf.length &&
        crypto.timingSafeEqual(candidateBuf, expectedBuf)
      ) {
        return { valid: true, timestamp };
      }
    } catch {
      // Ignore non-hex candidate
    }
  }

  return { valid: false, reason: "No matching v1 HMAC signature" };
}
