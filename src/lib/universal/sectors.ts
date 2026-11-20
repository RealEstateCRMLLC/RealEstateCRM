/**
 * Universal CRM — sector packs.
 *
 * One HyperNexus-driven core (contacts, pipeline, comms, AI, automation);
 * a sector pack is pure configuration: vocabulary, pipeline stages,
 * templates, and compliance notes. Real Estate is Pack #1 — the original
 * CRM, expressed as data. New business = new pack, never a new app.
 * Customization & add-ons by United Beats LLC (Bob & Lum).
 *
 * Expanded to cover trades (Roofing, Carpentry, Masonry, Landscaping),
 * food service, discount retail, e-commerce, and tech startups.
 */
export interface SectorPack {
  id: string;
  name: string;
  tagline: string;
  /** What a "customer" is called in this sector. */
  customer: string;
  /** What a "deal / job / case" is called. */
  workUnit: string;
  /** What is sold / served. */
  offering: string;
  stages: string[];
  templates: string[];
  compliance: string[];
  metrics: string[];
}

export const SECTOR_PACKS: SectorPack[] = [
  {
    id: "real-estate", name: "Real Estate", tagline: "The original Excel Legacy engine.",
    customer: "Client", workUnit: "Deal", offering: "Listing",
    stages: ["Lead", "Qualified", "Showing", "Offer", "Under Contract", "Closed", "Past Client"],
    templates: ["Buyer consultation", "Listing presentation", "Offer draft", "Trust funding (TSF)"],
    compliance: ["Fair Housing", "State license disclosure", "Trust documents need attorney review"],
    metrics: ["Listings", "Closings", "Commission", "Pipeline value"],
  },
  {
    id: "healthcare", name: "Healthcare & Clinics", tagline: "Patients in, care delivered, nobody lost to follow-up.",
    customer: "Patient", workUnit: "Case", offering: "Appointment",
    stages: ["Inquiry", "Intake", "Scheduled", "In Care", "Follow-Up", "Discharged", "Recall"],
    templates: ["Intake form", "Appointment reminder", "Care-plan follow-up", "Recall campaign"],
    compliance: ["HIPAA — never store PHI in free-text notes", "Consent before messaging", "Data retention policy"],
    metrics: ["Appointments", "No-show rate", "Recalls due", "Patient satisfaction"],
  },
  {
    id: "legal", name: "Legal Services", tagline: "From first call to signed matter, with deadlines that never slip.",
    customer: "Client", workUnit: "Matter", offering: "Consultation",
    stages: ["Lead", "Conflict Check", "Consultation", "Retained", "Active Matter", "Settled/Closed", "Referral Source"],
    templates: ["Intake questionnaire", "Engagement letter", "Deadline tracker", "Status update"],
    compliance: ["Attorney-client privilege", "Conflict check before intake", "Trust-account (IOLTA) separation"],
    metrics: ["Open matters", "Billable pipeline", "Deadlines this week", "Referrals"],
  },
  {
    id: "finance", name: "Finance & Insurance", tagline: "Prospects become policyholders, renewals never surprise you.",
    customer: "Policyholder", workUnit: "Policy", offering: "Quote",
    stages: ["Lead", "Discovery", "Quoted", "Bound/Bound Policy", "Onboarding", "Renewal Due", "Renewed"],
    templates: ["Needs analysis", "Quote follow-up", "Renewal reminder", "Annual review invite"],
    compliance: ["Licensed-producer disclosure", "Suitability notes", "No guaranteed-return language"],
    metrics: ["Quotes", "Bind rate", "Renewals due", "Book value"],
  },
  {
    id: "construction", name: "Construction & General Contracting", tagline: "Bids, jobs, and change orders — visible from field to office.",
    customer: "Customer", workUnit: "Job", offering: "Bid",
    stages: ["Lead", "Site Visit", "Bid Sent", "Won", "In Progress", "Punch List", "Complete & Paid"],
    templates: ["Bid proposal", "Change order", "Progress update photo log", "Final invoice"],
    compliance: ["License & insurance on file", "Written change orders only", "Lien-waiver tracking"],
    metrics: ["Open bids", "Jobs in progress", "Win rate", "Receivables"],
  },
  {
    id: "roofing", name: "Roofing & Siding Specialists", tagline: "From storm claim inspection to completed roof and final draw.",
    customer: "Homeowner", workUnit: "Roofing Project", offering: "Estimate",
    stages: ["Lead", "Inspection Scheduled", "Damage Report Sent", "Insurance Claim / Contract", "Material Ordered", "Installation", "Final Inspection & Paid"],
    templates: ["Roof inspection report", "Insurance contingency agreement", "Shingle selection guide", "Certificate of completion"],
    compliance: ["OSHA fall protection verification", "Local building permit pulled", "Manufacturer warranty registry"],
    metrics: ["Inspection close rate", "Squares installed", "Insurance approvals", "Avg job margin"],
  },
  {
    id: "carpentry", name: "Carpentry & Custom Woodwork", tagline: "Precision bids, architectural specs, and custom installs delivered on time.",
    customer: "Client", workUnit: "Custom Build", offering: "Spec & Estimate",
    stages: ["Inquiry", "Design Consultation", "Render / Quote Approved", "Deposit Paid", "Shop Fabrication", "On-Site Install", "Delivered & Signed"],
    templates: ["Design intake spec", "Material markup breakdown", "Deposit schedule", "Care & warranty handbook"],
    compliance: ["Lumber grade certification", "Signed shop drawing approval", "Liability & dust control agreement"],
    metrics: ["Shop utilization", "Material yield", "Backlog weeks", "Gross profit per labor hour"],
  },
  {
    id: "masonry", name: "Masonry, Brickwork & Stone", tagline: "Durable estimates, yard supply logistics, and structural excellence.",
    customer: "Property Owner", workUnit: "Masonry Job", offering: "Estimate",
    stages: ["Lead", "Site Measurement", "Quote Delivered", "Contract Signed", "Material Staged", "Laying / Curing", "Walkthrough & Paid"],
    templates: ["Linear foot / square foot estimate", "Mortar & stone sample approval", "Weather delay notice", "Structural warranty"],
    compliance: ["Silica dust safety protocol", "Local structural code compliance", "Utility mark-out before digging"],
    metrics: ["Square footage laid", "Material cost variance", "Labor hours vs bid", "Review generation rate"],
  },
  {
    id: "landscaping", name: "Landscaping & Grounds Care", tagline: "Recurring maintenance and high-ticket design installs seamlessly scheduled.",
    customer: "Client", workUnit: "Service Route / Project", offering: "Proposal",
    stages: ["Lead", "Site Walk", "Proposal Sent", "Approved", "Scheduled on Route", "Service Completed", "Renewal / Up-sell"],
    templates: ["Seasonal maintenance agreement", "Hardscape design proposal", "Route dispatch alert", "Winterization checklist"],
    compliance: ["Pesticide/fertilizer applicator licensing", "HOA guideline adherence", "Water runoff / grading compliance"],
    metrics: ["Route density", "Recurring monthly revenue (RMR)", "Crew productivity", "Equipment downtime"],
  },
  {
    id: "restaurant", name: "Restaurants & Hospitality Food", tagline: "Private dining, catering bookings, vendor supply, and VIP guests.",
    customer: "Guest / Host", workUnit: "Event / Reservation", offering: "Menu & Package",
    stages: ["Inquiry", "Tasting / Quote", "Contract Sent", "Deposit Locked", "BEO Finalized", "Event Execution", "Post-Event Review & Rebook"],
    templates: ["Banquet event order (BEO)", "Private dining agreement", "Dietary & allergy intake", "Catering invoice"],
    compliance: ["Health department food handler records", "Liquor license event permits", "Clear cancellation & headcount terms"],
    metrics: ["Food cost percentage", "Private dining covers", "Average guest spend", "Repeat booking rate"],
  },
  {
    id: "discount-retail", name: "Dollar Stores & Neighborhood Retail", tagline: "Foot traffic, high-velocity stock, local distributor relationships, and margins.",
    customer: "Shopper / Account", workUnit: "Purchase / Purchase Order", offering: "Merchandise",
    stages: ["Foot Traffic / Lead", "Basket Built", "Point of Sale", "Receipt & Loyalty", "Inventory Replenish", "VIP Shopper", "Inactive Re-engage"],
    templates: ["Wholesale distributor order", "Weekly circular ad promo", "Loyalty sign-up form", "Loss prevention checklist"],
    compliance: ["Sales tax compliance by jurisdiction", "SNAP / EBT compliance where applicable", "Manufacturer expiry monitoring"],
    metrics: ["Basket size", "Foot traffic count", "Inventory turn rate", "Gross margin return on investment (GMROI)"],
  },
  {
    id: "ecommerce", name: "E-Commerce & DTC Brands", tagline: "High-converting funnels, cart recovery, influencer outreach, and lifetime value.",
    customer: "Customer", workUnit: "Order", offering: "Product",
    stages: ["Ad Impression / Visit", "Added to Cart", "Checkout Started", "Order Paid", "Fulfilled & Shipped", "Delivered", "Brand Advocate"],
    templates: ["Abandoned checkout sequence", "Order delivery tracker", "UGC review request", "VIP launch VIP early drop"],
    compliance: ["CAN-SPAM / TCPA compliance", "Clear refund & return policy", "PCI-DSS tokenized payment security"],
    metrics: ["Customer acquisition cost (CAC)", "Return on ad spend (ROAS)", "Customer lifetime value (LTV)", "Refund rate"],
  },
  {
    id: "tech-saas", name: "Tech Startups & B2B Software", tagline: "Demos booked, trials activated, contracts signed, and net revenue retention.",
    customer: "Account", workUnit: "Opportunity", offering: "Subscription / License",
    stages: ["Inbound / Prospect", "Discovery Call", "Demo Completed", "Pilot / Trial", "Security & Legal Review", "Closed Won", "Active & Expanding"],
    templates: ["Demo follow-up deck", "Master services agreement (MSA)", "SOC2 security pack link", "Quarterly business review (QBR)"],
    compliance: ["GDPR / CCPA data privacy", "SLA uptime commitments", "SOC2 security audit compliance"],
    metrics: ["Monthly recurring revenue (MRR)", "Sales cycle length", "Net retention rate (NRR)", "Demo to close conversion"],
  },
  {
    id: "retail", name: "Retail & Showrooms", tagline: "One view of every shopper, showroom visit, and repeat buyer.",
    customer: "Shopper", workUnit: "Order", offering: "Product",
    stages: ["Visitor", "Cart / Consultation", "Checkout", "Fulfilled", "Repeat Buyer", "VIP", "Win-Back"],
    templates: ["Abandoned cart", "Order updates", "Review request", "VIP early access"],
    compliance: ["CAN-SPAM / consent for marketing", "Clear pricing & returns", "Payment data stays with processor"],
    metrics: ["Orders", "Repeat rate", "Average order value", "Win-backs"],
  },
  {
    id: "hospitality", name: "Hospitality & Venues", tagline: "Bookings, guests, and events run like clockwork.",
    customer: "Guest", workUnit: "Booking", offering: "Reservation",
    stages: ["Inquiry", "Quoted", "Booked", "Confirmed", "In-House/Event Day", "Checked Out", "Loyalty"],
    templates: ["Booking confirmation", "Pre-arrival guide", "Event run sheet", "Review & rebook offer"],
    compliance: ["Deposit & cancellation terms in writing", "Accessibility requests honored", "ID/payment verification"],
    metrics: ["Bookings", "Occupancy", "Repeat guests", "Review score"],
  },
  {
    id: "home-services", name: "Home Services (HVAC, Plumbing, Electric)", tagline: "Calls become routes, routes become reviews.",
    customer: "Homeowner", workUnit: "Service Call", offering: "Service Plan",
    stages: ["Lead", "Booked", "Dispatched", "On Site", "Completed", "Maintenance Plan", "Seasonal Recall"],
    templates: ["Booking confirmation", "Tech en route", "Service summary", "Seasonal tune-up offer"],
    compliance: ["License disclosure", "Upfront pricing before work", "Warranty terms in writing"],
    metrics: ["Calls booked", "Jobs per tech", "Plan members", "Review score"],
  },
  {
    id: "manufacturing", name: "Factories & Industrial Manufacturing", tagline: "Work orders, shop floor throughput, supply chain, and quality assurance.",
    customer: "Client / OEM Account", workUnit: "Production Run / Work Order", offering: "Manufactured Unit / Contract Run",
    stages: ["Quote / RFQ", "Engineering Review", "Tooling / Staging", "In Production", "QA & Inspection", "Packaging & Logistics", "Delivered & Billed"],
    templates: ["RFQ specification intake", "Bill of materials (BOM) breakdown", "Certificate of conformance (CoC)", "Quality incident / corrective action (CAPA)"],
    compliance: ["ISO 9001 / OSHA workplace standards", "Material test report (MTR) verification", "Hazardous materials / safety data sheets (SDS)"],
    metrics: ["Overall equipment effectiveness (OEE)", "Scrap / defect rate", "On-time delivery (OTD)", "Direct labor cost per unit"],
  },
];

export function getSectorPack(id: string): SectorPack {
  return SECTOR_PACKS.find((s) => s.id === id) ?? SECTOR_PACKS[0];
}

export function validateSectorPack(pack: SectorPack): string[] {
  const errors: string[] = [];
  if (!pack.id || !/^[a-z0-9-]+$/.test(pack.id)) errors.push("id must be kebab-case");
  if (pack.stages.length < 3) errors.push("needs at least 3 stages");
  if (!pack.name) errors.push("missing name");
  if (!pack.customer) errors.push("missing customer");
  if (!pack.workUnit) errors.push("missing workUnit");
  if (!pack.offering) errors.push("missing offering");
  return errors;
}
