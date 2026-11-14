"use client";

/**
 * UniversalProvisioner — interactive Universal CRM Workspace Configurator & Live Preview.
 *
 * Powers two surfaces from one unified component (`mode`):
 *   1. `mode="public"` on `/universal`: lets prospective business owners across all
 *      8 launch sectors pick their sector pack, brand palette, primary language
 *      (16 locales including RTL Arabic), generational UX mode, and United Beats LLC
 *      add-ons — previewing their white-label CRM live in real time, exporting a JSON
 *      manifest, or submitting a B2B Pilot Request directly into CRM Leads. If the
 *      viewer is already signed in as a workspace admin, they can also apply the
 *      configuration to their live workspace in one click.
 *   2. `mode="workspace"` inside `/dashboard/settings?tab=sector-pack`: loads the
 *      authenticated workspace's live Universal CRM profile + Prisma `WorkspaceBranding`
 *      and saves updates directly via `PUT /api/universal/tenant`.
 */

import React, { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { SECTOR_PACKS, getSectorPack } from "@/lib/universal/sectors";
import {
  LANGUAGES,
  addOnsForSector,
  calculateAddOnSelection,
  getLanguage,
  t,
} from "@/lib/universal/platform";
import {
  GENERATION_EXPERIENCES,
  type GenerationExperience,
} from "@/lib/universal/tenant";
import { UNIVERSAL_PLATFORM_BASE_MONTHLY_USD } from "@/lib/billing/checkout";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface UniversalProvisionerProps {
  mode?: "public" | "workspace";
}

const COLOR_PRESETS: { label: string; primary: string; accent: string }[] = [
  { label: "Excel Luxury (Blue & Gold)", primary: "#2563eb", accent: "#d4af37" },
  { label: "Clinical Trust (Teal & Silver)", primary: "#0f766e", accent: "#38bdf8" },
  { label: "Counsel & Legal (Navy & Brass)", primary: "#1e3a8a", accent: "#ca8a04" },
  { label: "Modern Commerce (Emerald & Amber)", primary: "#047857", accent: "#f59e0b" },
];

function InfoTip({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label="More information"
          className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-border text-[9px] font-bold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          i
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <p className="text-xs leading-relaxed">{text}</p>
      </TooltipContent>
    </Tooltip>
  );
}

export default function UniversalProvisioner({
  mode = "public",
}: UniversalProvisionerProps) {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [saving, setSaving] = useState(false);

  // Core tenant configuration state
  const [businessName, setBusinessName] = useState("Excel Legacy Realty");
  const [sectorId, setSectorId] = useState("real-estate");
  const [languageCode, setLanguageCode] = useState("en");
  const [generationMode, setGenerationMode] =
    useState<GenerationExperience>("all-generations");
  const [primaryColor, setPrimaryColor] = useState("#2563eb");
  const [accentColor, setAccentColor] = useState("#d4af37");
  const [enabledAddOnIds, setEnabledAddOnIds] = useState<string[]>(["trust-tsf"]);
  const [customCustomer, setCustomCustomer] = useState("");
  const [customWorkUnit, setCustomWorkUnit] = useState("");
  const [customOffering, setCustomOffering] = useState("");

  // Public B2B pilot request & subscription checkout state
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [leadStatus, setLeadStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [invoiceResult, setInvoiceResult] = useState<{
    invoiceRef: string;
    monthlyTotalUsd: number;
    methods: string[];
    note: string;
  } | null>(null);
  const [copiedInvoiceRef, setCopiedInvoiceRef] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/universal/tenant");
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setAuthenticated(Boolean(data.authenticated));
        setCanManage(Boolean(data.canManage));
        if (data.resolved) {
          setBusinessName(data.resolved.brand?.name || "Excel Legacy Realty");
          setPrimaryColor(data.resolved.brand?.primaryColor || "#2563eb");
          setAccentColor(data.resolved.brand?.accentColor || "#d4af37");
          setSectorId(data.resolved.sector?.id || "real-estate");
          setLanguageCode(data.resolved.language?.code || "en");
          setGenerationMode(data.resolved.generationMode || "all-generations");
          setEnabledAddOnIds(
            Array.isArray(data.tenant?.enabledAddOnIds)
              ? data.tenant.enabledAddOnIds
              : (data.resolved.enabledAddOns || []).map((a: { id: string }) => a.id),
          );
          setCustomCustomer(data.tenant?.customVocabulary?.customer || "");
          setCustomWorkUnit(data.tenant?.customVocabulary?.workUnit || "");
          setCustomOffering(data.tenant?.customVocabulary?.offering || "");
        }
      } catch {
        // Keep clean defaults if offline
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const sector = useMemo(() => getSectorPack(sectorId), [sectorId]);
  const language = useMemo(() => getLanguage(languageCode), [languageCode]);
  const availableAddOns = useMemo(() => addOnsForSector(sector.id), [sector.id]);
  const { enabledAddOns, monthlyTotal } = useMemo(
    () => calculateAddOnSelection(sector.id, enabledAddOnIds),
    [sector.id, enabledAddOnIds],
  );

  const effectiveVocab = {
    customer: customCustomer.trim() || sector.customer,
    workUnit: customWorkUnit.trim() || sector.workUnit,
    offering: customOffering.trim() || sector.offering,
  };

  function handleSectorChange(nextSectorId: string) {
    setSectorId(nextSectorId);
    const nextCompatible = new Set(addOnsForSector(nextSectorId).map((a) => a.id));
    setEnabledAddOnIds((prev) => {
      const filtered = prev.filter((id) => nextCompatible.has(id));
      // Auto-include $0 included sector add-ons (such as TSF in real-estate/legal/finance)
      for (const addon of addOnsForSector(nextSectorId)) {
        if (addon.priceMonthly === 0 && !filtered.includes(addon.id)) {
          filtered.push(addon.id);
        }
      }
      return filtered;
    });
  }

  function toggleAddOn(id: string) {
    setEnabledAddOnIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function saveToWorkspace(e: React.FormEvent) {
    e.preventDefault();
    if (!canManage) {
      toast.error("Owner, Broker, or Admin role required to update workspace provisioning.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/universal/tenant", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sectorId,
          language: languageCode,
          generationMode,
          enabledAddOnIds: enabledAddOns.map((a) => a.id),
          customVocabulary: {
            customer: customCustomer.trim() || undefined,
            workUnit: customWorkUnit.trim() || undefined,
            offering: customOffering.trim() || undefined,
          },
          brand: {
            name: businessName.trim() || "Excel Legacy Realty",
            primaryColor,
            accentColor,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to provision workspace");
      toast.success(
        `Provisioned ${sector.name} (${language.label}) for ${businessName.trim() || "workspace"}`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save configuration");
    } finally {
      setSaving(false);
    }
  }

  async function submitPilotRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!contactName.trim() || !contactEmail.trim()) return;
    setLeadStatus("sending");
    try {
      const blueprintNotes = [
        `Universal CRM Tenant Provisioning & Subscription`,
        `Business: ${businessName.trim() || "Unspecified"}`,
        `Sector Pack: ${sector.name} (${sector.id})`,
        `Vocabulary: ${effectiveVocab.customer} -> ${effectiveVocab.workUnit} -> ${effectiveVocab.offering}`,
        `Primary Language: ${language.label} (${language.code}${language.rtl ? ", RTL" : ""})`,
        `Generation UX: ${generationMode}`,
        `Brand Colors: primary ${primaryColor}, accent ${accentColor}`,
      ].join(" | ");

      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "universal",
          customerName: contactName.trim(),
          customerEmail: contactEmail.trim(),
          customerPhone: contactPhone.trim() || undefined,
          companyName: businessName.trim() || undefined,
          sectorId: sector.id,
          language: language.code,
          addOnIds: enabledAddOns.map((a) => a.id),
          includePlatformBase: true,
          notes: blueprintNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Request failed");

      if (data.mode === "stripe" && data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }

      setInvoiceResult({
        invoiceRef: data.order?.invoiceRef || "INV-PENDING",
        monthlyTotalUsd:
          data.order?.monthlyTotalUsd ??
          UNIVERSAL_PLATFORM_BASE_MONTHLY_USD + monthlyTotal,
        methods: data.paymentInstructions?.methods || [],
        note:
          data.paymentInstructions?.note ||
          "Official United Beats LLC invoice and CRM proposal created.",
      });
      setLeadStatus("done");
    } catch {
      setLeadStatus("error");
    }
  }

  async function copyInvoiceNumber() {
    if (!invoiceResult?.invoiceRef) return;
    try {
      await navigator.clipboard.writeText(invoiceResult.invoiceRef);
      setCopiedInvoiceRef(true);
      setTimeout(() => setCopiedInvoiceRef(false), 2000);
    } catch {
      // Ignore clipboard failure
    }
  }

  async function copyManifest() {
    const manifest = {
      businessName: businessName.trim() || "Your Business",
      sectorId: sector.id,
      sectorName: sector.name,
      language: language.code,
      rtl: Boolean(language.rtl),
      generationMode,
      vocabulary: effectiveVocab,
      stages: sector.stages,
      enabledAddOns: enabledAddOns.map((a) => ({
        id: a.id,
        name: a.name,
        priceMonthly: a.priceMonthly,
      })),
      monthlyAddOnTotal: monthlyTotal,
      brand: { primaryColor, accentColor },
      poweredBy: "United Beats LLC (Bob & Lum) — Universal CRM on HyperNexus",
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(manifest, null, 2));
      setCopiedJson(true);
      setTimeout(() => setCopiedJson(false), 2500);
    } catch {
      toast.error("Clipboard copy unavailable in this browser context");
    }
  }

  if (loading && mode === "workspace") {
    return (
      <p className="text-sm text-muted-foreground py-6">
        Loading Universal CRM sector &amp; localization settings...
      </p>
    );
  }

  const editable = mode === "public" || canManage;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left column: 3-step interactive provisioning form */}
        <form
          onSubmit={saveToWorkspace}
          className="space-y-6 rounded-2xl border border-border bg-card p-5 md:p-6 lg:col-span-7"
        >
          {/* Step 1: Sector Pack */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="ucrm-sector"
                className="text-xs font-bold uppercase tracking-wider text-secondary flex items-center gap-1.5"
              >
                1. Sector Pack &amp; Vocabulary
                <InfoTip text="Selects your industry's pipeline stages, starter templates, compliance guardrails, and plain-language nouns (Customer, Work Unit, Offering). Switching packs never deletes existing records." />
              </label>
              <span className="text-[11px] text-muted-foreground">
                8 launch packs • validated schema
              </span>
            </div>

            <select
              id="ucrm-sector"
              value={sectorId}
              disabled={!editable}
              onChange={(e) => handleSectorChange(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm font-semibold text-foreground disabled:opacity-60"
            >
              {SECTOR_PACKS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} — ({s.customer} → {s.workUnit} → {s.offering})
                </option>
              ))}
            </select>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1 mb-1">
                  Customer Noun
                  <InfoTip text="Optional override for what your team calls a person or account (e.g. Client, Patient, Homeowner, Member)." />
                </label>
                <input
                  type="text"
                  value={customCustomer}
                  disabled={!editable}
                  onChange={(e) => setCustomCustomer(e.target.value)}
                  placeholder={sector.customer}
                  className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs disabled:opacity-60"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1 mb-1">
                  Work Unit Noun
                  <InfoTip text="Optional override for your pipeline transaction unit (e.g. Deal, Matter, Case, Job, Booking)." />
                </label>
                <input
                  type="text"
                  value={customWorkUnit}
                  disabled={!editable}
                  onChange={(e) => setCustomWorkUnit(e.target.value)}
                  placeholder={sector.workUnit}
                  className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs disabled:opacity-60"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1 mb-1">
                  Offering Noun
                  <InfoTip text="Optional override for what your business sells or schedules (e.g. Listing, Consultation, Bid, Service Plan)." />
                </label>
                <input
                  type="text"
                  value={customOffering}
                  disabled={!editable}
                  onChange={(e) => setCustomOffering(e.target.value)}
                  placeholder={sector.offering}
                  className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs disabled:opacity-60"
                />
              </div>
            </div>
          </div>

          {/* Step 2: Brand, Language & Generation UX */}
          <div className="space-y-4 border-t border-border/60 pt-5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-secondary flex items-center gap-1.5">
                2. White-Label Brand, Language &amp; Generation UX
                <InfoTip text="Configures your workspace display name, portal/e-sign palette, primary locale across 16 languages (including automatic right-to-left layout for Arabic), and operator UX profile." />
              </span>
              {language.rtl && (
                <span className="rounded bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-400">
                  RTL Layout Active
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="ucrm-biz-name"
                  className="text-[10px] font-bold uppercase text-muted-foreground block mb-1"
                >
                  Business / Workspace Name
                </label>
                <input
                  id="ucrm-biz-name"
                  type="text"
                  value={businessName}
                  disabled={!editable}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="Your Business Name"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm disabled:opacity-60"
                />
              </div>

              <div>
                <label
                  htmlFor="ucrm-language"
                  className="text-[10px] font-bold uppercase text-muted-foreground block mb-1"
                >
                  Primary Language (16 Launch Locales)
                </label>
                <select
                  id="ucrm-language"
                  value={languageCode}
                  disabled={!editable}
                  onChange={(e) => setLanguageCode(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm disabled:opacity-60"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.label} — {l.native}
                      {l.rtl ? " (RTL)" : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label
                htmlFor="ucrm-gen-ux"
                className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1 mb-1"
              >
                Three-Generation Operator &amp; Client Experience
                <InfoTip text="Tunes action prominence: Phone & Print-First (Gen X), 10-Minute Self-Serve Checklists (Millennials), AI Voice/Chat-First (Gen Z), or the balanced Universal Three-Tap default." />
              </label>
              <select
                id="ucrm-gen-ux"
                value={generationMode}
                disabled={!editable}
                onChange={(e) =>
                  setGenerationMode(e.target.value as GenerationExperience)
                }
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium disabled:opacity-60"
              >
                {GENERATION_EXPERIENCES.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {GENERATION_EXPERIENCES.find((g) => g.id === generationMode)?.summary}
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase text-muted-foreground">
                  Brand Palette
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {COLOR_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      disabled={!editable}
                      onClick={() => {
                        setPrimaryColor(preset.primary);
                        setAccentColor(preset.accent);
                      }}
                      className="rounded-md border border-border px-2 py-0.5 text-[10px] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50"
                    >
                      {preset.label.split(" (")[0]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    aria-label="Primary brand color"
                    value={primaryColor}
                    disabled={!editable}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="h-9 w-9 cursor-pointer rounded border border-border bg-background"
                  />
                  <input
                    type="text"
                    value={primaryColor}
                    disabled={!editable}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 font-mono text-xs"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    aria-label="Accent brand color"
                    value={accentColor}
                    disabled={!editable}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="h-9 w-9 cursor-pointer rounded border border-border bg-background"
                  />
                  <input
                    type="text"
                    value={accentColor}
                    disabled={!editable}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 font-mono text-xs"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Step 3: Sector-Filtered United Beats LLC Add-Ons */}
          <div className="space-y-3 border-t border-border/60 pt-5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-secondary flex items-center gap-1.5">
                3. United Beats LLC Add-Ons ({availableAddOns.length} Compatible)
                <InfoTip text="Modular capabilities authored by United Beats LLC (Bob & Lum). Automatically filtered to add-ons relevant to the selected sector pack." />
              </span>
              <span className="text-xs font-bold text-primary">
                Add-ons: ${monthlyTotal}/mo
              </span>
            </div>

            <div className="space-y-2">
              {availableAddOns.map((addon) => {
                const checked = enabledAddOns.some((a) => a.id === addon.id);
                return (
                  <label
                    key={addon.id}
                    className={
                      "flex cursor-pointer items-start justify-between gap-3 rounded-xl border p-3 transition-colors " +
                      (checked
                        ? "border-primary/50 bg-primary/10"
                        : "border-border/60 bg-background/60 hover:bg-muted/40")
                    }
                  >
                    <div className="flex items-start gap-2.5">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={!editable}
                        onChange={() => toggleAddOn(addon.id)}
                        className="mt-1 h-4 w-4 accent-primary"
                      />
                      <div>
                        <p className="text-xs font-bold text-foreground">
                          {addon.name}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {addon.blurb}
                        </p>
                      </div>
                    </div>
                    <span className="whitespace-nowrap text-xs font-bold text-foreground">
                      {addon.priceMonthly === 0
                        ? "Included"
                        : `$${addon.priceMonthly}/mo`}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Action bar */}
          <div className="flex flex-wrap items-center gap-2.5 border-t border-border/60 pt-4">
            {(mode === "workspace" || (authenticated && canManage)) && (
              <button
                type="submit"
                disabled={saving || !canManage}
                className="rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
              >
                {saving
                  ? "Provisioning..."
                  : mode === "workspace"
                    ? "Save Workspace Sector & Locale"
                    : "Apply Directly to Active Workspace"}
              </button>
            )}

            <button
              type="button"
              onClick={copyManifest}
              className="rounded-xl border border-border px-3.5 py-2.5 text-xs font-semibold text-foreground hover:bg-muted transition-colors"
            >
              {copiedJson ? "Copied Pack Manifest ✓" : "Copy JSON Pack Manifest"}
            </button>

            {mode === "workspace" && !canManage && (
              <p className="text-xs text-muted-foreground">
                Owner, Broker, or Admin role is required to modify workspace provisioning.
              </p>
            )}
          </div>
        </form>

        {/* Right column: Live White-Label Preview + B2B Pilot Lead Capture */}
        <div className="space-y-5 lg:col-span-5">
          <div
            dir={language.rtl ? "rtl" : "ltr"}
            className="overflow-hidden rounded-2xl border border-border bg-card shadow-lg"
          >
            {/* Branded tenant header */}
            <div
              className="p-5 text-white"
              style={{ backgroundColor: primaryColor }}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-xl text-sm font-black"
                    style={{ backgroundColor: accentColor, color: "#111827" }}
                  >
                    {(businessName.trim() || "U").slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-extrabold leading-tight">
                      {businessName.trim() || "Your Business"}
                    </p>
                    <p className="text-[11px] text-white/85">
                      {t(language.code, "welcome")} • {sector.name} ({language.native})
                    </p>
                  </div>
                </div>
                <span
                  className="rounded-full px-2.5 py-1 text-[10px] font-extrabold"
                  style={{ backgroundColor: accentColor, color: "#111827" }}
                >
                  {t(language.code, "getStarted")}
                </span>
              </div>
              <p className="mt-3 text-xs text-white/90">
                {t(language.code, "tagline")}
              </p>
            </div>

            {/* Live vocabulary, pipeline stages, templates & compliance */}
            <div className="space-y-4 p-5 text-xs">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl border border-border/60 bg-muted/30 p-2.5">
                  <p className="text-[10px] uppercase text-muted-foreground">
                    {t(language.code, "customers")}
                  </p>
                  <p className="mt-0.5 font-bold text-foreground">
                    {effectiveVocab.customer}s
                  </p>
                </div>
                <div className="rounded-xl border border-border/60 bg-muted/30 p-2.5">
                  <p className="text-[10px] uppercase text-muted-foreground">
                    {t(language.code, "pipeline")}
                  </p>
                  <p className="mt-0.5 font-bold text-foreground">
                    {effectiveVocab.workUnit}s
                  </p>
                </div>
                <div className="rounded-xl border border-border/60 bg-muted/30 p-2.5">
                  <p className="text-[10px] uppercase text-muted-foreground">
                    Catalog
                  </p>
                  <p className="mt-0.5 font-bold text-foreground">
                    {effectiveVocab.offering}s
                  </p>
                </div>
              </div>

              <div>
                <p className="font-bold text-foreground mb-1.5">
                  {t(language.code, "pipeline")} ({sector.stages.length} stages)
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {sector.stages.map((stage, idx) => (
                    <span
                      key={stage}
                      className="rounded-md border border-border bg-background px-2 py-1 text-[11px] font-medium"
                    >
                      {idx + 1}. {stage}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <p className="font-bold text-foreground mb-1">
                  {t(language.code, "templatesReady")}
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  {sector.templates.join(" • ")}
                </p>
              </div>

              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
                <p className="font-bold text-amber-300 mb-1">
                  {t(language.code, "complianceGuardrails")}
                </p>
                <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-muted-foreground">
                  {sector.compliance.map((rule) => (
                    <li key={rule}>{rule}</li>
                  ))}
                </ul>
              </div>

              <div className="flex items-center justify-between border-t border-border/60 pt-3 text-[11px] text-muted-foreground">
                <span>
                  Core (${UNIVERSAL_PLATFORM_BASE_MONTHLY_USD}/mo) + {t(language.code, "monthlyAddOns")} ({enabledAddOns.length})
                </span>
                <span className="font-bold text-foreground">
                  ${UNIVERSAL_PLATFORM_BASE_MONTHLY_USD + monthlyTotal}/mo total
                </span>
              </div>
            </div>
          </div>

          {/* Subscription Checkout / Official United Beats LLC Invoice Card */}
          {editable && (
            <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-foreground">
                  {mode === "public"
                    ? "Launch & Subscribe with United Beats LLC"
                    : "Subscription & Add-On Checkout (United Beats LLC)"}
                </h3>
                <InfoTip text="Creates a live Stripe Checkout subscription when STRIPE_SECRET_KEY is configured, or generates an official itemized United Beats LLC invoice (Mercury ACH / Wire or Check) and tracks the proposal in CRM Deals." />
              </div>
              <p className="text-xs text-muted-foreground">
                Provision your branded <strong>{sector.name}</strong> workspace in{" "}
                <strong>{language.label}</strong> (${UNIVERSAL_PLATFORM_BASE_MONTHLY_USD + monthlyTotal}/mo
                including {enabledAddOns.length} add-on{enabledAddOns.length === 1 ? "" : "s"}).
              </p>

              {leadStatus === "done" ? (
                <div className="rounded-xl border border-secondary/50 bg-secondary/10 p-4 space-y-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-foreground">
                      Invoice Issued: {invoiceResult?.invoiceRef || "INV-ACTIVE"}
                    </span>
                    <button
                      type="button"
                      onClick={copyInvoiceNumber}
                      className="rounded-md border border-border bg-background px-2.5 py-1 text-[11px] font-semibold hover:border-secondary"
                    >
                      {copiedInvoiceRef ? "Copied!" : "Copy Ref"}
                    </button>
                  </div>
                  <p className="font-semibold text-foreground">
                    {sector.name} Workspace + {enabledAddOns.length} Add-On{enabledAddOns.length === 1 ? "" : "s"} — $
                    {invoiceResult?.monthlyTotalUsd ?? UNIVERSAL_PLATFORM_BASE_MONTHLY_USD + monthlyTotal}/mo
                  </p>
                  <p className="text-muted-foreground">
                    {invoiceResult?.note ||
                      `United Beats LLC (Bob & Lum) saved your ${sector.name} (${language.label}) blueprint and created your proposal.`}
                  </p>
                  {invoiceResult && invoiceResult.methods.length > 0 && (
                    <ul className="list-disc pl-4 space-y-0.5 text-muted-foreground">
                      {invoiceResult.methods.map((m) => (
                        <li key={m}>{m}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                <form onSubmit={submitPilotRequest} className="space-y-2.5">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <input
                      type="text"
                      required
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      placeholder="Billing contact full name"
                      className="rounded-lg border border-border bg-background px-3 py-2 text-xs"
                    />
                    <input
                      type="email"
                      required
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      placeholder="Billing email"
                      className="rounded-lg border border-border bg-background px-3 py-2 text-xs"
                    />
                  </div>
                  <input
                    type="tel"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="Phone (optional — for 15-min onboarding call)"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs"
                  />
                  <button
                    type="submit"
                    disabled={leadStatus === "sending"}
                    className="w-full rounded-xl bg-secondary px-4 py-2.5 text-xs font-bold text-black hover:opacity-95 disabled:opacity-60"
                  >
                    {leadStatus === "sending"
                      ? "Generating Checkout / Invoice..."
                      : `Start ${sector.name} Subscription ($${UNIVERSAL_PLATFORM_BASE_MONTHLY_USD + monthlyTotal}/mo)`}
                  </button>
                  {leadStatus === "error" && (
                    <p className="text-xs text-red-500">
                      Could not create checkout right now — please copy the JSON manifest or try again.
                    </p>
                  )}
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
