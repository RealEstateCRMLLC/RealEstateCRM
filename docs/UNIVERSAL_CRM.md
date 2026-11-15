# Universal CRM — One Harness, Every Business

**By United Beats LLC (Bob & Lum), driven by HyperNexus. Foundation: the Excel Legacy real estate CRM.**

## Principle
The real estate CRM already solves the universal problem: find people, move them through stages, communicate, automate, get paid, earn referrals. Every business on earth runs that same loop — only the words change. So we do not build N CRMs. We build **one core** plus **sector packs** (pure configuration), white-labeled per tenant.

## Architecture
- **Core (HyperNexus harness):** contacts, pipeline, inbox/campaigns, AI assistant + voice, automation/scheduler, documents/e-sign, payments intent, RAG memory (`src/lib/rag.ts`), RBAC, audit. Identical in every sector.
- **Sector pack** (`src/lib/universal/sectors.ts`): vocabulary (customer / work unit / offering), pipeline stages, templates, compliance notes, dashboard metrics. Pack #1 is Real Estate — the existing CRM expressed as data.
- **Tenant brand:** name, logo, colors, language, domain. Configured in minutes; the business sees only its own brand. "Customized by us" = United Beats LLC authors packs and add-ons.
- **Add-on registry** (`src/lib/universal/platform.ts`): optional capabilities (AI Receptionist, TSF Trust, Review Engine, Smart Scheduling, Commerce Sync, Compliance Vault) priced per month, enabled per tenant, sector-filtered.
- **Languages:** 16 at launch (en/es/fr/de/pt/it/nl/pl/ar-RTL/hi/zh/ja/ko/ru/tr/vi) via dictionary `t()`; every UI string resolves through it, so adding a language is adding a column, never a rewrite.

## The 8 launch sectors
Real Estate, Healthcare & Clinics, Legal Services, Finance & Insurance, Construction & Trades, Retail & E-commerce, Hospitality & Events, Home Services. Each ships with stages/templates/compliance in its pack (see `sectors.ts`). New sector = one pack object + templates; validated by `validateSectorPack`.

## Easiest experience for three generations
- **Gen X:** phone-first, human realtor/agent always one tap away, print-friendly documents.
- **Millennials:** self-serve onboarding in under 10 minutes, templates, transparent pricing.
- **Gen Z:** chat/voice-first (AI receptionist), mobile-only flows, instant language switch.
One rule for all: **three taps to any action**, plain words (the pack's own vocabulary, never "CRM words"), and a human on demand.

## Business model
Platform fee per tenant + add-ons. Sector customization and new packs are United Beats LLC services (Bob & Lum). The TSF trust system is the proof: a real-estate-born add-on now reusable by Legal and Finance packs.

## Rollout
1. ✅ Core extracted as packs + i18n + add-on registry + `/universal` showcase (`v0.64.0`).
2. ✅ Tenant provisioning: workspace → sector pack → brand → language + 3-generation UX + United Beats add-on configurator (`v0.65.0`: `src/lib/universal/tenant.ts`, `src/lib/universal/tenant-store.ts`, `GET/PUT /api/universal/tenant`, inline `/dashboard/settings?tab=sector-pack`, interactive `/universal` configurator + B2B pilot lead funnel, full 16-language UI dictionary incl. RTL Arabic).
3. ✅ Live Dashboard Shell Adaptation (`v0.66.0`): `DashboardLayout` resolves `WorkspaceBranding` + `UniversalTenantRecord` on every `/dashboard/*` route, rendering dynamic brand mark/title, `dir="rtl"` for RTL locales, and an interactive Sector & Locale header badge (`🌍 Sector • LANG`).
4. 🔒 Owner-Gated Billing & Webhook Plumbing (`v0.66.1`): `src/lib/billing/checkout.ts` (`isBillingCheckoutArmed`, `buildCustomBillingQuote`), `src/lib/billing/order-store.ts`, `GET/POST /api/billing/checkout` (disarmed by default unless `BILLING_CHECKOUT_ENABLED=true`; public forms capture leads only via `POST /api/leads/external`), and `POST /api/billing/webhook` (HMAC-SHA256 verified) stand ready until owner sets retail/SaaS prices and provides Stripe keys.
5. First non-real-estate pilot tenant onboarding; hard sector-template library & additional locales.
