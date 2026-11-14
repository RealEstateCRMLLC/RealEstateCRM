/**
 * Unified Billing & Checkout Catalog (Pure Client-Safe Module).
 *
 * Powers two monetization lanes across Excel Legacy Realty Group & United Beats LLC:
 *   1. TSF Master Bundle & Trust Services (`/trust-services`, `/trust-course`):
 *      one-time flat-fee educational & done-with-you assembly packages.
 *   2. Universal CRM Subscriptions & Add-Ons (`/universal`, `/dashboard/settings?tab=sector-pack`):
 *      recurring monthly white-label workspace + United Beats LLC (Bob & Lum) add-on packs.
 *
 * Kept 100% free of `node:*` imports so client components can safely import SKU
 * definitions, pricing calculators, and types without affecting browser chunking.
 */

import { getSectorPack } from "../universal/sectors.ts";
import { calculateAddOnSelection } from "../universal/platform.ts";

export type BillingKind = "tsf" | "universal";

export interface TsfSku {
  id: "tsf-course" | "tsf-assembly" | "tsf-bundle" | "tsf-bundle-client" | "tsf-concierge";
  name: string;
  description: string;
  amountUsd: number;
  billingInterval: "one_time";
  payee: "Excel Legacy Realty Group / United Beats LLC";
}

export const TSF_SKUS: Record<TsfSku["id"], TsfSku> = {
  "tsf-course": {
    id: "tsf-course",
    name: "TSF Complete Trust Funding Course (Self-Paced + 1-on-1)",
    description:
      "8 modules / 24 lessons on Declaration of Trust, Appointment of Trustee, Affidavit & Certificate of Trust, and Exhibit A funding.",
    amountUsd: 497,
    billingInterval: "one_time",
    payee: "Excel Legacy Realty Group / United Beats LLC",
  },
  "tsf-assembly": {
    id: "tsf-assembly",
    name: "Done-With-You Personal Property Trust Assembly",
    description:
      "Fact-finding session, completed Declaration, Appointment & Affidavit drafts, Exhibit A schedule, attorney-review packet, and notary coordination.",
    amountUsd: 997,
    billingInterval: "one_time",
    payee: "Excel Legacy Realty Group / United Beats LLC",
  },
  "tsf-bundle-client": {
    id: "tsf-bundle-client",
    name: "TSF Master Bundle — Excel Legacy Client Rate",
    description:
      "Full 8-module realtor-taught course + workbook + Done-With-You Trust Assembly for active Excel Legacy buying/selling clients.",
    amountUsd: 997,
    billingInterval: "one_time",
    payee: "Excel Legacy Realty Group / United Beats LLC",
  },
  "tsf-bundle": {
    id: "tsf-bundle",
    name: "TSF Master Bundle — Standalone Course + Assembly",
    description:
      "All 8 live realtor-taught modules, instructor guide + student workbook, funding checklist, and Done-With-You Trust Assembly.",
    amountUsd: 1497,
    billingInterval: "one_time",
    payee: "Excel Legacy Realty Group / United Beats LLC",
  },
  "tsf-concierge": {
    id: "tsf-concierge",
    name: "TSF Concierge Trust Assembly & Annual Funding Coordination",
    description:
      "Everything in Done-With-You Assembly plus deed/LLC/account funding coordination and first annual trust funding review.",
    amountUsd: 1497,
    billingInterval: "one_time",
    payee: "Excel Legacy Realty Group / United Beats LLC",
  },
};

export const UNIVERSAL_PLATFORM_BASE_MONTHLY_USD = 199;

export interface BillingLineItem {
  id: string;
  name: string;
  description: string;
  amountUsd: number;
  interval: "one_time" | "month";
}

export interface BillingQuote {
  kind: BillingKind;
  payee: string;
  sectorId?: string;
  sectorName?: string;
  items: BillingLineItem[];
  oneTimeTotalUsd: number;
  monthlyTotalUsd: number;
  /** Canonical CRM Deal value (one-time total + annualized MRR or 12-month contract value). */
  dealValueUsd: number;
  summaryTitle: string;
}

export interface BillingCheckoutInput {
  kind: BillingKind;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  companyName?: string;
  /** Required when `kind === "tsf"` */
  tsfSkuId?: string;
  /** Used when `kind === "universal"` */
  sectorId?: string;
  language?: string;
  addOnIds?: string[];
  includePlatformBase?: boolean;
  notes?: string;
}

export function generateInvoiceRef(now: Date = new Date(), suffixSeed?: string): string {
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  const raw =
    suffixSeed && suffixSeed.trim()
      ? suffixSeed.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 4).padEnd(4, "X")
      : Math.random().toString(36).substring(2, 6).toUpperCase();
  return `INV-UB-${yyyy}${mm}${dd}-${raw}`;
}

export function buildBillingQuote(
  input: Omit<BillingCheckoutInput, "customerName" | "customerEmail">,
): { ok: true; quote: BillingQuote } | { ok: false; error: string } {
  if (input.kind === "tsf") {
    const skuId = (input.tsfSkuId || "") as TsfSku["id"];
    const sku = TSF_SKUS[skuId];
    if (!sku) {
      return { ok: false, error: `Unknown TSF SKU "${String(input.tsfSkuId)}"` };
    }
    return {
      ok: true,
      quote: {
        kind: "tsf",
        payee: sku.payee,
        sectorId: "real-estate",
        sectorName: "Real Estate",
        items: [
          {
            id: sku.id,
            name: sku.name,
            description: sku.description,
            amountUsd: sku.amountUsd,
            interval: "one_time",
          },
        ],
        oneTimeTotalUsd: sku.amountUsd,
        monthlyTotalUsd: 0,
        dealValueUsd: sku.amountUsd,
        summaryTitle: sku.name,
      },
    };
  }

  if (input.kind === "universal") {
    const sector = getSectorPack(input.sectorId || "real-estate");
    const includeBase = input.includePlatformBase !== false;
    const { enabledAddOns, monthlyTotal: addOnMonthly } = calculateAddOnSelection(
      sector.id,
      input.addOnIds || [],
    );

    const items: BillingLineItem[] = [];
    if (includeBase) {
      items.push({
        id: "universal-platform-core",
        name: `Universal CRM Core Workspace (${sector.name} Pack)`,
        description: `White-label ${sector.name} CRM harness, 16-language UI dictionary, pipeline stages, RBAC, and e-sign portal.`,
        amountUsd: UNIVERSAL_PLATFORM_BASE_MONTHLY_USD,
        interval: "month",
      });
    }

    for (const addon of enabledAddOns) {
      items.push({
        id: addon.id,
        name: `${addon.name} (Add-On)`,
        description: `${addon.blurb} — United Beats LLC (Bob & Lum)`,
        amountUsd: addon.priceMonthly,
        interval: "month",
      });
    }

    if (items.length === 0) {
      return {
        ok: false,
        error: "Select at least the core Universal CRM workspace or one compatible add-on.",
      };
    }

    const monthlyTotalUsd =
      (includeBase ? UNIVERSAL_PLATFORM_BASE_MONTHLY_USD : 0) + addOnMonthly;

    return {
      ok: true,
      quote: {
        kind: "universal",
        payee: "United Beats LLC",
        sectorId: sector.id,
        sectorName: sector.name,
        items,
        oneTimeTotalUsd: 0,
        monthlyTotalUsd,
        dealValueUsd: monthlyTotalUsd * 12,
        summaryTitle: `Universal CRM — ${sector.name} (${items.length} line item${items.length === 1 ? "" : "s"})`,
      },
    };
  }

  return { ok: false, error: `Unsupported billing kind "${String(input.kind)}"` };
}
