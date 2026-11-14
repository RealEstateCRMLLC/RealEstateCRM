"use client";

import { useState } from "react";
import type { TsfSku } from "@/lib/billing/checkout";

export type TrustIntent = "kit" | "course" | "assembly" | "concierge" | "consult";

interface InvoiceSummary {
  invoiceRef: string;
  oneTimeTotalUsd: number;
  summaryName: string;
  methods: string[];
  note: string;
}

const COPY: Record<
  TrustIntent,
  { source: string; notes: string; done: string; paidSku?: TsfSku["id"] }
> = {
  kit: {
    source: "Trust Document Kit",
    notes:
      "Free branded trust document kit download (Declaration, Appointment of Trustee, Affidavit/Certificate).",
    done: "Your kit is ready — use the download buttons above. We also emailed your link and the funding checklist.",
  },
  course: {
    source: "Trust Complete Course",
    notes:
      "TSF Master Bundle enrollment intent ($1,497 standalone / $997 Excel Legacy client). Send secure invoice and enrollment link.",
    done: "Reserved! Your official invoice and CRM enrollment record are active below.",
    paidSku: "tsf-bundle",
  },
  assembly: {
    source: "Trust Done-With-You Assembly",
    notes:
      "Done-With-You Personal Property Trust Assembly ($997): realtor/broker assembles Declaration, Appointment, Affidavit + Exhibit A from client facts. Attorney review required before signing.",
    done: "Reserved! An Excel Legacy Realty Team member will contact you within one business day to start your $997 assembly.",
    paidSku: "tsf-assembly",
  },
  concierge: {
    source: "Trust Concierge Funding",
    notes:
      "Concierge Trust & Funding ($1,497): assembly plus deed/LLC/account funding coordination and annual review.",
    done: "Reserved! Our team will contact you within one business day to plan your $1,497 concierge engagement.",
    paidSku: "tsf-concierge",
  },
  consult: {
    source: "Trust Consultation",
    notes: "Free 20-min trust services consultation with Excel Legacy Realty Team.",
    done: "Request received! We will reach out within one business day to confirm your consultation time.",
  },
};

export default function TrustLeadForm({
  intent,
  cta,
}: {
  intent: TrustIntent;
  cta: string;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [isActiveClient, setIsActiveClient] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [invoice, setInvoice] = useState<InvoiceSummary | null>(null);
  const [copiedRef, setCopiedRef] = useState(false);

  const copy = COPY[intent];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    setState("sending");

    try {
      // Paid TSF packages route through `/api/billing/checkout` (Stripe Checkout when
      // STRIPE_SECRET_KEY is set; itemized Mercury ACH / Check invoice + CRM Deal otherwise).
      if (copy.paidSku) {
        const effectiveSku: TsfSku["id"] =
          intent === "course" && isActiveClient ? "tsf-bundle-client" : copy.paidSku;

        const res = await fetch("/api/billing/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind: "tsf",
            tsfSkuId: effectiveSku,
            customerName: name.trim(),
            customerEmail: email.trim(),
            customerPhone: phone.trim() || undefined,
            notes: copy.notes,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data?.ok) {
          throw new Error(data?.error || "Checkout request failed");
        }

        if (data.mode === "stripe" && data.checkoutUrl) {
          window.location.href = data.checkoutUrl;
          return;
        }

        setInvoice({
          invoiceRef: data.order?.invoiceRef || "INV-PENDING",
          oneTimeTotalUsd: data.order?.oneTimeTotalUsd || 0,
          summaryName: data.order?.items?.[0]?.name || copy.source,
          methods: data.paymentInstructions?.methods || [],
          note: data.paymentInstructions?.note || copy.done,
        });
        setState("done");
        return;
      }

      const res = await fetch("/api/leads/external", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
          notes: copy.notes,
          source: copy.source,
        }),
      });
      if (!res.ok) throw new Error("request failed");
      setState("done");
    } catch {
      setState("error");
    }
  }

  async function copyInvoiceRef() {
    if (!invoice?.invoiceRef) return;
    try {
      await navigator.clipboard.writeText(invoice.invoiceRef);
      setCopiedRef(true);
      setTimeout(() => setCopiedRef(false), 2000);
    } catch {
      // Ignore clipboard failure
    }
  }

  if (state === "done") {
    if (invoice) {
      return (
        <div className="border border-secondary/50 bg-secondary/10 p-4 space-y-2 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="font-bold text-foreground">
              Invoice Reserved: {invoice.invoiceRef}
            </span>
            <button
              type="button"
              onClick={copyInvoiceRef}
              className="border border-border bg-background px-2.5 py-1 text-xs font-semibold hover:border-secondary"
              title="Copy your official invoice reference number for ACH or check memo"
            >
              {copiedRef ? "Copied!" : "Copy Ref"}
            </button>
          </div>
          <p className="text-xs font-semibold text-foreground">
            {invoice.summaryName} — ${invoice.oneTimeTotalUsd.toLocaleString()} flat
          </p>
          <p className="text-xs text-muted-foreground">{invoice.note}</p>
          {invoice.methods.length > 0 && (
            <ul className="list-disc pl-4 space-y-0.5 text-xs text-muted-foreground">
              {invoice.methods.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          )}
        </div>
      );
    }
    return (
      <p className="border border-secondary/40 bg-secondary/10 px-4 py-3 text-sm font-medium">
        {copy.done}
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Full name"
          required
          className="border border-border bg-background px-3 py-2 text-sm"
        />
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          placeholder="Email address"
          required
          className="border border-border bg-background px-3 py-2 text-sm"
        />
      </div>
      <input
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="Phone (optional)"
        className="border border-border bg-background px-3 py-2 text-sm"
      />
      {intent === "course" && (
        <label
          className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none py-0.5"
          title="Active Excel Legacy Realty buying or selling clients qualify for the $997 Master Bundle client rate instead of $1,497 standalone."
        >
          <input
            type="checkbox"
            checked={isActiveClient}
            onChange={(e) => setIsActiveClient(e.target.checked)}
            className="accent-amber-500"
          />
          <span>
            I am buying or selling with Excel Legacy ($997 client bundle rate)
          </span>
        </label>
      )}
      <button
        type="submit"
        disabled={state === "sending"}
        className="bg-secondary px-4 py-2 text-sm font-semibold text-black disabled:opacity-60"
      >
        {state === "sending"
          ? "Processing..."
          : intent === "course" && isActiveClient
            ? "Enroll at $997 Client Rate"
            : cta}
      </button>
      {state === "error" && (
        <p className="text-xs text-red-500">
          Something went wrong — please try again.
        </p>
      )}
    </form>
  );
}
