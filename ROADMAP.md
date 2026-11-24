## v0.66.2 status (2026-11-15)
Shipped **Public SKU Sweep & Hank Pilot Demo Polish (`v0.66.2`)**: Cleared all remaining legacy `v0.63.0` static `$497 / $997 / $1,497` price tags across `/`, `/trust-services` (incl. JSON-LD), `/trust-course`, and dashboard funnel cards (verified `0` matches across `src/` and live HTML), polished `/dashboard/settings?tab=integrations` (`MlsConnectionForm.tsx`) with explicit **MLS Member ID**, **MLS Office ID / Organization ID (OUID)**, and **Broker / Server RESO Token (encrypted at rest)** fields, and added formula-injection-safe RFC-4180 workspace CSV exports (`GET /api/export?entity=foreclosures|deals|leads|contacts` + UI buttons on Deals, Workflows, and `WorkflowStudio`) plus searchable Foreclosure/Workflow sessions (`npm test`: `46 pass / 0 fail`).

## v0.66.1 status (2026-11-15)
Shipped **Pricing & Billing Governance Patch (`v0.66.1`)**: Disarmed unapproved self-serve checkout/invoicing (`$199/mo` Universal CRM and `$497/$997/$1,497` checkout SKUs, `INV-UB-*` invoices, and auto-created `PROPOSAL` deals) behind `BILLING_CHECKOUT_ENABLED=true` (default `false`; `GET /api/billing/checkout` -> `mode: 'lead_only'`, `POST` -> `403`), and reverted `TrustLeadForm.tsx` (`/trust-services`) and `UniversalProvisioner.tsx` (`/universal`) to lead-only capture via `POST /api/leads/external`. Confirmed `0` orders/invoices/deals were created on production during `v0.66.0`. Preserved live `DashboardLayout` brand/RTL/sector shell adaptation, `sync-scheduler.ts` `:3210` loopback fix, `assignedAgentEmail` guard, and HMAC-SHA256 Stripe webhook infrastructure. Only approved RealEstateCRM commercial terms on record: **Hank 60-day pilot (`$500` setup + `$500/mo`)**. Owner split: Hank-only = broker approval + MLS Member/Office ID + broker RESO token via secure CRM integrations UI; Robert/United Beats LLC-only = Twilio phone number, Resend, Stripe. Hetzner `.env` presence checks remain `lane-reported (key-name presence only, not end-to-end verified)`.

## v0.66.0 status (2026-11-14)
Shipped **Dual-Mode Stripe / Mercury Billing Engine + Live Dashboard Sector Shell + Hetzner Scheduler Fix** (`docs/UNIVERSAL_CRM.md` Rollout #3 & #4 + TSF Checkout): `src/lib/billing/checkout.ts`, `src/lib/billing/order-store.ts`, `GET/POST /api/billing/checkout`, `POST /api/billing/webhook` (HMAC-SHA256 verified), interactive checkout/invoice generation in `TrustLeadForm.tsx` (`/trust-services`) and `UniversalProvisioner.tsx` (`/universal` + `/dashboard/settings?tab=sector-pack`), live white-label + RTL + sector badge resolution in `DashboardLayout`, and `resolveInternalAppUrl()` in `src/lib/sync-scheduler.ts` fixing Hetzner `:3210` self-probe error logs (`npm test`: 44 pass / 0 fail). Remaining external frontier: Hank pilot proposal wording approval + signature, `gh auth login`, and live provider keys (Stripe, RESO MLS, Twilio number, Resend).

## v0.65.0 status (2026-11-14)
Shipped **Universal CRM Phase 2 — Tenant Provisioning & 16-Language White-Label Configurator** (`workspace -> sector pack -> brand -> language + 3-generation UX + United Beats add-ons`): `src/lib/universal/tenant.ts`, `GET/PUT /api/universal/tenant`, inline `/dashboard/settings?tab=sector-pack`, interactive `/universal` configurator with live RTL preview + B2B pilot request funnel (`POST /api/leads/external`), full 16-locale UI dictionary in `src/lib/universal/platform.ts`, `SignInForm` autofill/headless `FormData` resilience fix, and offline-server-aware test suite (`39 pass / 0 fail`, plus automated 36/36 `CommandCenter` route coverage assertion). Next software/business frontier: first non-real-estate pilot tenant, Hank pilot proposal wording approval + signature, and Tier-1 owner keys (Stripe, RESO MLS token + Member ID, Twilio number, Resend).

## v0.64.14 status (2026-11-14)
Rebuild verified green. Frontier unchanged: owner-gated keys/signature only.

## v0.64.13 status (2026-11-14)
Steady state holds. Remaining frontier is owner-gated only: Hank pilot signature + proposal wording, RESO MLS token/Member ID, Stripe/Twilio/Resend keys, gh re-auth. No structural gaps: dashboard single-page consolidated (36/36), CI green streak, all mounts public.

## v0.64.9 status (2026-11-13)
Org transfer complete (RealEstateCRMLLC, 9 repos). Production live: main CRM v0.64.7 + 8 sub-services on Hetzner with Postgres/SQLite DBs provisioned and all nginx mounts public (incl. /aicrm/, /leadcaller/, /prototype/ added v0.64.2). CI fully green streak (8 runs). Dashboard: single Command Center, 36/36 pages, every card tooltip'd. Next functional frontier remains owner-gated: pilot Hank proposal signature, RESO MLS feed + pilot Member ID, Stripe/Twilio-number/Resend keys (see TODO Owner Keys).


## v0.62.3 repository sync (2026-11-06)
All submodule feature branches reconciled to main (zero unique commits found; reverse-merged by fast-forward). Next functional frontier is live MLS data: pilot agent Member ID / broker RESO feed, then provider keys (Twilio number, Resend, OpenAI). See SUBMODULE_MAP.md for the structural map.
# Roadmap

*Core Objective: Build a CRM with the technical depth of Lofty, simplified by an omnipresent AI Assistant (Agentic Co-Pilot).*

## Phase 1 — Foundation [ACCOMPLISHED]
- [x] TypeScript repo scaffold
- [x] Authentication and roles
- [x] Workspace model
- [x] CRM core
- [x] Base dashboard shell
- [x] Theme and branding system

## Phase 2 — Communication and workflow [COMPLETE]
- [x] Leads, contacts, deals, and tasks
- [x] Workspace as Segment / List model
- [x] Bulk Lead Management & Dynamic Pagination
- [x] Email / SMS / call logging (Forms and action infrastructure wired, timeline active)
- [x] Private and group chat
- [x] Workflow engine (Foundation and initial drafts)
- [x] Dashboard Workflow Performance Overview
- [x] Lead routing rules + AI qualification engine (round-robin, LLM scoring)
- [x] Client portal foundation

## Phase 3 — AI and voice [COMPLETE]
- [x] AI Assistant UI and Backend (AIChat)
- [x] RAG (Retrieval-Augmented Generation) foundation, vector sync, and unification
- [x] AI Assistant Sync (Gemini 2.0 Flash as default)
- [x] **AI Tool Calling (Agentic Co-Pilot Execution)**
- [x] AI lead qualification (LLM scoring with rule-based fallback)
- [x] AI Drip Campaign Execution (SMS/Email)
- [x] Voice assistant
- [x] Speech provider selection
- [x] Conversational mode
- [x] Learning and memory controls
- [x] CRM timeline writeback from voice sessions (Voice→CRM webhook)

## Phase 4 — Social and marketing [COMPLETE]
- [x] Social Connections + Unified Inbox
- [x] Unified Inbox (multi-channel message aggregation)
- [x] Publishing Calendar (monthly calendar view)
- [x] Marketing Studio (10 marketing channels)
- [x] Asset export flows
- [x] Approval workflows (AI brand compliance + auto-approval)

## Phase 5 — Media pipeline [COMPLETE]
- [x] Property photo import + S3 document upload
- [x] Storyboard generation + folder detection
- [x] AI promotional video pipeline (PromoVideoPipeline)
- [x] Draft review tools
- [x] Render/export jobs (FFmpeg integration)

## Phase 6 — Partner and scale [COMPLETE]
- [x] Mortgage / title / insurance modules (partner network UI)
- [x] Shared referrals
- [x] Partner permissions
- [x] Reporting and analytics dashboard
- [x] Advanced import/export
- [x] Performance hardening

## Phase 7 — Polish and reliability [COMPLETE]
- [x] Mobile offline support (offline sync)
- [x] Sync recovery
- [x] Audit improvements (audit trail)
- [x] Accessibility refinement
- [x] UI polish
- [x] Load testing and bug fixing (2026-10-31: scripts/load-test.js ALL PASS 350/350; e2e-smoke 21/22, sole fail = legacyleads /listings 500 with no local Postgres — backend returns honest error + code, covered by new regression test)

## Phase 8 — MLS / MiRealSource parity [COMPLETE]
- [x] Listing search parity (MLS search)
- [x] Client portal setup parity (portal listings)
- [x] Offer writing support
- [x] Listing entry support
- [x] Provider adapter layer
- [x] Workflow parity on web and mobile

## Phase 9 — Legacy MLS / Realist support [COMPLETE]
- [x] Historical listing search and import (Legacy MLS)
- [x] Realist property data support
- [x] Offer drafting from prior listings
- [x] Listing entry drafting
- [x] Review / approval controls
- [x] Audit and provenance tracking

## Phase 10 — BS&A and Realcomp data support [COMPLETE]
- [x] BS&A data integration (prefill)
- [x] Realcomp data integration (prefill)
- [x] Other approved property-data sources
- [x] Offer and listing draft prefill
- [x] Source provenance and review controls


## 0.46.5 Update
- **MyPlusLeads Scheduler:** Optimized MyPlusLeads cron sync frequency (every 15 mins morning drop, hourly check rest of the day).
- **Lead Detail Quick Edit:** Added visual sidebar quick-edit trigger for phone/email management.
- **Categorized Multi-Phone/Email:** Supported Cell Phone 1/2/3, Work, Home, and other types with primary auto-selection.

## 0.46.0 Update
- **Lead Intelligence Center:** Multi-tab layout for Lead profile detailing social and public record AI scraper results.
- **AI Tool Calling (Co-Pilot):** Integrated tool capabilities into the chatbot route using `gemini-2.0-flash-001`.
- **Omnichannel Forms:** Wired SMS and Showing forms with fully integrated server actions logging to the activity timeline.

## 0.45.0 Update
- **Segmentation & Bulk Actions:** Overhauled lead management with bulk selection, dynamic pagination, and the "Workspace as Segment" orchestration.
- **Workflow Visibility:** Added a workflow performance overview and AI assistant status to the main dashboard.
- **Onboarding:** Integrated an interactive tour for new feature discovery.

## Lofty.com Features
- Additional accessible documentation or structured exports are required from Lofty.com to perfectly duplicate every specific menu item, button, and page.

## Phase 11 — CRM Website Builder & Marketing Subsystems
- [x] Multi-tenant real estate website infrastructure.
- [x] RESO Web API integration for IDX / MLS data syncing.
- [x] Automated property page generation with SSR / ISR.
- [x] AI Chatbot Widget (WebSockets) embedded on agent websites for warm transfers.
- [x] RESO Web API integration for IDX / MLS data syncing.
- [x] Automated property page generation with SSR / ISR.
- [x] Comprehensive lead capture forms mapped directly to CRM Leads.
- [x] SEO, Schema.org (JSON-LD), and Dynamic Sitemap infrastructure.
- [x] Google Tag Manager, GA4, and Ads Conversion tracking support.
- [x] Social Media Open Graph integrations and dynamic share widgets.
- [x] Headless CMS connection for localized real estate blogs.

## Phase 12 — Lofty.com Website Builder Parity
- [x] Implement a full drag-and-drop WYSIWYG website builder replicating Lofty.com features.
- [x] Add pre-built responsive templates for Agent Sites, Single Property Sites, and Neighborhood Guides.
- [x] Develop Advanced IDX Search capabilities directly embeddable via the builder.
- [x] Incorporate Lead Capture popups (forced registration walls) based on viewing parameters.
- [x] Synchronize all landing page and form data automatically with the core CRM pipeline.
- [x] Migrate local vector synchronization fallback to a hosted Pinecone database before production launch.
- [x] Hosted Vector Migration completed. Pinecone auto-detection is active via env vars (`PINECONE_API_KEY`).
- [x] Speech provider selection (OpenAI / ElevenLabs) UI and config framework implemented via Voice Settings dashboard.


---

_Last synced 2026-10-06 (v0.57.6). Chat, learning/memory, SEO/sitemap, and OG share widgets completed. Remaining: load testing, API keys, E2E tests, production deploy._

## Phase 13 — Repository Synchronization [COMPLETE — v0.55.0]
- [x] Fetch all remotes + tags across main + 5 submodules
- [x] Fast-forward sync all repos to latest origin/main
- [x] Analyze 10 feature branches for unique content (all already merged)
- [x] Reverse-merge main into all 10 feature branches
- [x] Push all feature branches to prevent drift
- [x] Version bump 0.54.0 → 0.55.0
- [x] Generate submodule structural map (docs/SUBMODULE_MAP.md)
- [x] Update CHANGELOG, HANDOFF, ROADMAP, TODO

### Integrated Remote Changes (v0.55.0)
- Dashboard refactor: CommandCenter, SidebarNav, SettingsTabs, workspace libs
- leadG: NextAuth + auth middleware
- contentplanner: Social provider enhancements (LinkedIn/Meta/Twitter)
- legacyleads: New frontend pages (contacts, fsbo-expired, help, neighborhoods, settings)

## Phase 14 — Repository Synchronization v0.58.43 [COMPLETE]
- [x] Fetch all remotes + tags across main + 5 submodules (no nested submodules)
- [x] Upstream check: robertpelloni/realestatecrm and candlestixxx/realestatecrm resolve to identical `main` (62fbdc6) — no divergent upstream
- [x] Fast-forward submodule `main` branches to `origin/main`: foreclosureworkflow (+2), legacyleads (+1), media-workflow (+3); leadg gitlink advanced 2 commits
- [x] Verified all 10 feature branches across submodules are fully merged (ancestors of main, zero unique commits) — no cherry-pick required
- [x] Committed submodule launcher scripts (start-3002, start-3004) + gitignored transient logs
- [x] Fixed start-all.ps1 media-workflow start path (dist/index.js → dist/src/index.js)
- [x] Version bump 0.54.0 → 0.58.43 (VERSION.md, package.json, package-lock.json, CHANGELOG)
- [x] Regenerated structural maps (docs/SUBMODULE_MAP.md, docs/LIBRARIES.md)

## Phase 15 — Repository Synchronization v0.58.51 [COMPLETE]
- [x] Fetch all remotes + tags across main + 5 submodules (no nested submodules)
- [x] Upstream check: robertpelloni/realestatecrm and candlestixxx/realestatecrm resolve to identical `main` (6d6d1f3) — no divergent upstream
- [x] Verified all 5 submodules at `origin/main` with clean working trees — no fast-forward required
- [x] Re-verified all 10 feature branches fully merged (ancestors of main, zero unique commits) — no cherry-pick required
- [x] Reconciled start-all.ps1 with canonical 9-service definitions (added ContentPlanner API 3031, standalone Next.js server paths)
- [x] Version bump → 0.58.51 (VERSION.md, package.json, package-lock.json, CHANGELOG) — fixed package.json/package-lock drift (were 0.58.43)
- [x] Regenerated structural maps (docs/SUBMODULE_MAP.md, docs/LIBRARIES.md)

## Phase 5 - Repository Synchronization [v0.48.0 - ACCOMPLISHED]
- [x] Origin sync: local main fast-forwarded 4eaba9c -> e07aa1d
- [x] Forward-merge audit: 5 AI-generated feature branches fully contained in main (no unique work lost)
- [x] Reverse catch-up: all 5 feature branches fast-forwarded locally to e07aa1d (remote push pending credentials)
- [x] Submodule audit: no submodules present (no-op)
- [x] Push credentials: authenticated GitHub push restored (gh keyring robertpelloni; verified v0.66.7, CI green)

## v0.63.0 (2026-11-10)
Trust, Security & Future (TSF) Master Bundle live on /trust-services: realtor-teachable course + branded trust docs + gated lead magnet, deployed to Hetzner. Next: Stripe checkout, hard download gate, social launch kit.

## Phase 16 — RealEstateCRMLLC Sync, Inline UI Consolidation & 12-Service Orchestration [COMPLETE — v0.63.7, 2026-11-12]
- [x] Full `RealEstateCRMLLC/*` org submodule URL sync, `git fetch --all --tags`, and dual-direction branch reconciliation across root + all 8 submodules (23 feature branches audited and reverse-synced to `main` with 0 drift and 0 conflict markers).
- [x] True single-page inline **Settings Console** (`/dashboard/settings` rendering all 10 panels inline without stub hops) and unified **Marketing & Funnels Hub** (`/dashboard/marketing` uniting Studio, SMS Text Codes, and `/trust-services` + `/trust-course` funnels).
- [x] Redesigned **Command Center** (`/dashboard`) with All-in-One Page mode, instant tool search, live 6-KPI executive strip (`/api/reporting` extended with `Task`, `SmartPlan`, and `WorkflowSession` aggregates), TSF Master Bundle cards, and localhost-aware Sub-Project routing.
- [x] Added server-side 12-service TCP health probe (`/api/system/health`) + upgraded `ServiceHealthGrid`, `build-all.ps1` (10 targets), `start-all.ps1` / `start-all.bat` (12 services at `BelowNormal`), `watch-services.ps1`, and non-blocking `system-tray.ps1` (GDI handle leak fixed, single-pass `netstat`).
- [x] Fixed runtime Prisma/import bugs discovered during deep audit (`MyPlusImportModal` missing `importCsvAction`, `/api/posts` `isPublished` field mismatch, `myPlusLeadsIntegration.findFirst` unique-key fix, `tsconfig.json` submodule exclusion).

## Post-roast hardening (2026-11-17, from the ChatGPT/Gemini/Bobbi brutal-roast review)
The three-AI roast converged on systemic items beyond individual bugs. Standing decisions from it:
- [x] Cross-app auth smoke gate (`deploy/smoke-auth.mjs`): unauthenticated-write refusals + real test-identity sessions for all six mounted apps; run after every deploy. (v0.67.28)
- [x] MCP mutation integrity: every write tool validates its target exists and errors on no-ops; reads error on nonexistent ids instead of returning null or the wrong record. (v0.67.24-28)
- [ ] Deploy FOOM/universal merge with a dedicated auth regression pass (it touches `src/lib/auth.ts`); do not fold into routine swaps.
- [ ] FREEZE new sub-apps/features until first paying pilot closes. Consolidation candidates when unfrozen: CP nav/mount honesty, duplicate workflows already merged; sector arms stay PARKED until real-estate revenue (unchanged 90-day rule).
- [ ] Commercial validation before expansion: Hank signature, then exactly the Tier-1 integrations the pilot needs (Phase 17), in that order.

## Phase 18 — HyperNexus MCP Router + Sector Arms (BYO-AI) [IN PROGRESS]
Core (built once): HyperNexus as MCP router — drops the exact tool to whichever AI is talking, shifts gears between LLMs, cross-LLM memory (its brain in a sub-file/store), so swapping models loses nothing. CRM exposes functions as MCP tools; the realtor connects ANY LLM service (ChatGPT, Gemini, Claude, ...) and drives the CRM by voice/text — plug-and-play inference, no wiring ritual.
- [x] Provider switching v1 (v0.67.10): Settings → AI Model Keys "Active AI Provider" (OpenAI/Anthropic/Gemini/DeepSeek/Qwen) + one resolver (`lib/ai/active-provider.ts`) used by AgentCore + lead scoring; verified live with a real completion.
- [x] CRM MCP servers exist: main (9 tools), aicrm (12 tools), LeadCaller (SSE transport, nginx unbuffered).
- [ ] Voice control: expose LeadCaller call tools (start/monitor/end) as MCP tools with approval gates; voice → AI → MCP → CRM audit trail. Needs telephony number first (Phase 17 key).
- [ ] Per-user MCP connection (OAuth/token per realtor in Integrations settings) — today: session cookie (per-user) + workspace bearer token.
- [ ] HyperNexus tool-drop routing in front of CRM MCP (relevant-tools-only context) — accelerator, never a lock-in; direct MCP must keep working.
Arms (repeat sales, same core, new tool set + branding): #1 Real Estate (this CRM — must pay first, Hank pilot is the wedge). PARKED until real-estate revenue: dental (Roy's), medical billing, other verticals — revenue before expansion per 90-day rules. Tool-count honesty: ~2,000 is the owner's figure; counts on record are 12,158 catalog rows / 781 verified — quote neither publicly until the ordered stress test settles it.

## Phase 17 — Live External Provider Cutover & Monetization [NEXT]
- [ ] Stripe Checkout + webhook gating on `/trust-services` ($997 Done-With-You Assembly & $1,497 TSF Master Bundle) and `/trust-course` ($497 1-on-1 Package).
- [ ] Hetzner nginx reverse-proxy mounts for `/aicrm/` (`:3216`), `/leadcaller/` (`:3217`), and `/prototype/` (`:3218`).
- [ ] Pilot brokerage RESO MLS live token + Member ID activation for automated listing & comp ingestion.
- [ ] Dedicated Twilio SMS/WhatsApp phone number + SendGrid/Resend production sender domain verification for live Smart Plan dispatch.

