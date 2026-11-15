/**
 * Billing & Custom Pilot Quote Primitives (Disarmed by Default — v0.66.1).
 *
 * Governance rule:
 *   Self-serve checkout, `INV-UB-*` invoice issuance, `PROPOSAL` deal creation,
 *   and Stripe Checkout session creation are DISARMED unless the owner explicitly
 *   sets `BILLING_CHECKOUT_ENABLED=true` after approving SKU pricing.
 *   Only set RealEstateCRM commercial terms on record: Hank 60-day pilot
 *   ($500 setup + $500/mo, handled by proposal, never auto-billed on public forms).
 *
 * Kept 100% free of `node:*` imports for safe isomorphic import.
 */

export type BillingKind = "pilot" | "custom";

export interface BillingLineItem {
  id: string;
  name: string;
  description: string;
  amountUsd: number;
  interval: "one_time" | "month";
}

export interface CustomQuoteInput {
  kind: BillingKind;
  payee?: string;
  summaryTitle: string;
  items: BillingLineItem[];
}

export interface BillingQuote {
  kind: BillingKind;
  payee: string;
  items: BillingLineItem[];
  oneTimeTotalUsd: number;
  monthlyTotalUsd: number;
  dealValueUsd: number;
  summaryTitle: string;
}

/**
 * Returns `true` ONLY when the owner has explicitly armed self-serve billing
 * (`BILLING_CHECKOUT_ENABLED=true`). Presence of `STRIPE_SECRET_KEY` alone is
 * intentionally insufficient so unapproved prices can never be charged or invoiced.
 */
export function isBillingCheckoutArmed(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.BILLING_CHECKOUT_ENABLED?.trim().toLowerCase() === "true";
}

/**
 * Pure calculator for explicit owner-authorized custom/pilot line items
 * (for example, $500 setup + $500/mo pilot proposals). Contains zero hardcoded
 * unapproved retail SKU prices.
 */
export function buildCustomBillingQuote(
  input: CustomQuoteInput,
): { ok: true; quote: BillingQuote } | { ok: false; error: string } {
  if (!input.summaryTitle?.trim()) {
    return { ok: false, error: "summaryTitle is required." };
  }
  if (!Array.isArray(input.items) || input.items.length === 0) {
    return { ok: false, error: "At least one explicit line item is required." };
  }

  let oneTimeTotalUsd = 0;
  let monthlyTotalUsd = 0;

  for (const item of input.items) {
    if (!Number.isFinite(item.amountUsd) || item.amountUsd < 0) {
      return { ok: false, error: `Invalid amountUsd on item "${item.id}"` };
    }
    if (item.interval === "one_time") {
      oneTimeTotalUsd += item.amountUsd;
    } else if (item.interval === "month") {
      monthlyTotalUsd += item.amountUsd;
    } else {
      return { ok: false, error: `Unsupported billing interval on "${item.id}"` };
    }
  }

  return {
    ok: true,
    quote: {
      kind: input.kind,
      payee: input.payee?.trim() || "United Beats LLC",
      items: input.items,
      oneTimeTotalUsd,
      monthlyTotalUsd,
      dealValueUsd: oneTimeTotalUsd + monthlyTotalUsd * 12,
      summaryTitle: input.summaryTitle.trim(),
    },
  };
}
