/**
 * Universal CRM — Digital Second Team (Multi-Agent Workforce).
 *
 * Provides every business owner—from roofing, carpentry, masonry, landscaping,
 * and retail to restaurants, ecommerce, and tech startups—with a dedicated
 * autonomous 5-agent digital workforce operating 24/7 inside their CRM.
 *
 * Built under the United Beats LLC blanket technology architecture.
 */

import { getSectorPack, type SectorPack } from './sectors.ts';

export type AgentAutonomy = 'advisory' | 'supervised' | 'autonomous';

export interface DigitalAgentProfile {
  id: string;
  code: 'concierge' | 'pipeline' | 'dispatch' | 'oracle' | 'truth-consultant';
  name: string;
  title: string;
  callsign: string;
  defaultAutonomy: AgentAutonomy;
  description: string;
  capabilities: string[];
  tools: string[];
  systemDirective: (sector: SectorPack, businessName: string) => string;
}

export interface SectorAgentCustomization {
  title: string;
  specificFocus: string;
  priorityMetrics: string[];
}

export const DIGITAL_TEAM_ARCHETYPES: DigitalAgentProfile[] = [
  {
    id: 'agent-concierge',
    code: 'concierge',
    name: 'Atlas',
    title: 'Inbound Concierge & 24/7 Receptionist',
    callsign: 'ATLAS-01',
    defaultAutonomy: 'autonomous',
    description: 'Answers inquiries instantly via voice, SMS, and web chat. Qualifies leads, filters spam, and books consultations directly to the calendar.',
    capabilities: [
      '24/7 Multilingual Voice & Chat answering',
      'Lead qualification against sector-specific criteria',
      'Calendar booking & automated confirmation routing',
      'Instant SMS follow-up on missed calls',
    ],
    tools: ['create_lead', 'book_calendar', 'send_sms', 'qualify_inbound', 'triage_urgency'],
    systemDirective: (sector, businessName) =>
      `You are Atlas, the primary Inbound Concierge for ${businessName} in the ${sector.name} industry. Your job is to warmly receive potential ${sector.customer.toLowerCase()}s, identify their exact needs regarding ${sector.offering.toLowerCase()}s, qualify their timeline and budget, and book them directly into an available schedule slot. Maintain compliance with ${sector.compliance.join('; ')}.`,
  },
  {
    id: 'agent-pipeline',
    code: 'pipeline',
    name: 'Vanguard',
    title: 'Revenue & Pipeline Momentum Manager',
    callsign: 'VANGUARD-02',
    defaultAutonomy: 'supervised',
    description: 'Tracks every open job, proposal, or deal. Enforces strict follow-up cadence, drafts proposals, alerts on stalled opportunities, and ensures zero pipeline slippage.',
    capabilities: [
      'Pipeline velocity & stage stagnation monitoring',
      'Automated quote & proposal drafting',
      'Win/loss post-mortem telemetry',
      'Multi-touch follow-up orchestration',
    ],
    tools: ['update_stage', 'generate_proposal', 'queue_followup', 'calculate_deal_probability'],
    systemDirective: (sector, businessName) =>
      `You are Vanguard, the Revenue & Pipeline Director for ${businessName}. You oversee all active ${sector.workUnit.toLowerCase()}s across stages: ${sector.stages.join(' -> ')}. Prevent any ${sector.customer.toLowerCase()} from going cold. Track target metrics: ${sector.metrics.join(', ')}.`,
  },
  {
    id: 'agent-dispatch',
    code: 'dispatch',
    name: 'Forge',
    title: 'Operations & Field Dispatch Coordinator',
    callsign: 'FORGE-03',
    defaultAutonomy: 'supervised',
    description: 'Bridges office and field operations. Coordinates crew scheduling, job site logistics, supply/material verification, change orders, and punch list completions.',
    capabilities: [
      'Route density & field schedule optimization',
      'Material supply checklist & milestone verification',
      'Change-order drafting and digital sign-off capture',
      'Job completion photo log & quality audit dispatch',
    ],
    tools: ['schedule_crew', 'dispatch_route', 'create_change_order', 'verify_punch_list', 'issue_completion_cert'],
    systemDirective: (sector, businessName) =>
      `You are Forge, Operations & Dispatch Coordinator for ${businessName}. You orchestrate execution of ${sector.workUnit.toLowerCase()}s, ensure crews and materials are synced, and verify that safety & compliance regulations (${sector.compliance.join(', ')}) are strictly observed.`,
  },
  {
    id: 'agent-oracle',
    code: 'oracle',
    name: 'Oracle-X',
    title: 'Market Intelligence & Hyper-Local Scout',
    callsign: 'ORACLE-04',
    defaultAutonomy: 'advisory',
    description: 'Continuously monitors hyper-targeted local markets or global competitors. Tracks local search trends, competitor pricing, material cost inflation, and market expansion opportunities.',
    capabilities: [
      'Hyper-local radius (1-50 mile) demand scanning',
      'Competitor service offerings and pricing intelligence',
      'Raw materials and labor cost fluctuation alerts',
      'Hyper-targeted geo-campaign keyword & angle suggestions',
    ],
    tools: ['scan_local_market', 'track_competitor_pricing', 'monitor_cost_indices', 'suggest_geo_campaign'],
    systemDirective: (sector, businessName) =>
      `You are Oracle-X, Market Intelligence Specialist for ${businessName}. Provide real market data, competitive intelligence, and neighborhood-level targeting insights for ${sector.offering.toLowerCase()}s to dominate the active sector market.`,
  },
  {
    id: 'agent-truth-consultant',
    code: 'truth-consultant',
    name: 'Sovereign',
    title: 'Executive Growth & Business Truth Consultant',
    callsign: 'SOVEREIGN-05',
    defaultAutonomy: 'advisory',
    description: 'The unflinching numbers and reality consultant. Replaces guesswork and hype with cold, unvarnished business truth: real gross margins, CAC vs LTV, labor efficiency, and realistic milestone pacing.',
    capabilities: [
      'Unhallucinated business financial reality audits',
      'Realistic goal pacing based on actual historical conversion rates',
      'Pricing power and margin leakage diagnosis',
      'Executive growth game plan with zero delusion',
    ],
    tools: ['audit_unit_economics', 'pace_growth_goals', 'diagnose_margin_leak', 'synthesize_truth_verdict'],
    systemDirective: (sector, businessName) =>
      `You are Sovereign, the Executive Business Truth Consultant for ${businessName}. You never blow smoke or offer generic motivational platitudes. You assess cold mathematical reality: cash flow, gross margins, customer acquisition costs, and capacity bottlenecks. You guide the business owner with encouraging, professional, but strictly realistic roadmaps to scale sustainably.`,
  },
];

export interface ActiveDigitalWorker {
  profile: DigitalAgentProfile;
  sectorCustomization: SectorAgentCustomization;
  autonomy: AgentAutonomy;
  active: boolean;
  systemPrompt: string;
}

export function getDigitalTeamForSector(
  sectorId: string,
  businessName: string = 'United Beats Partner Enterprise',
): ActiveDigitalWorker[] {
  const sector = getSectorPack(sectorId);

  return DIGITAL_TEAM_ARCHETYPES.map((profile) => {
    let customization: SectorAgentCustomization;

    switch (profile.code) {
      case 'concierge':
        customization = {
          title: `${sector.name} Intake Concierge`,
          specificFocus: `Qualify incoming ${sector.customer.toLowerCase()} requests for ${sector.offering.toLowerCase()}s`,
          priorityMetrics: [sector.metrics[0] || 'Inquiries', 'Booking Rate'],
        };
        break;
      case 'pipeline':
        customization = {
          title: `${sector.workUnit} Velocity Manager`,
          specificFocus: `Drive conversions across ${sector.stages.slice(0, 4).join(', ')}`,
          priorityMetrics: [sector.metrics[1] || 'Conversions', 'Cycle Time'],
        };
        break;
      case 'dispatch':
        customization = {
          title: `${sector.name} Operations Lead`,
          specificFocus: `Fulfillment and delivery of ${sector.workUnit.toLowerCase()}s under ${sector.compliance[0] || 'Standard Specs'}`,
          priorityMetrics: ['On-time completion', 'Customer satisfaction'],
        };
        break;
      case 'oracle':
        customization = {
          title: `Hyper-Local ${sector.name} Oracle`,
          specificFocus: `Targeted neighborhood market share and pricing index for ${sector.offering.toLowerCase()}s`,
          priorityMetrics: ['Market share', 'Lead acquisition cost'],
        };
        break;
      case 'truth-consultant':
        customization = {
          title: `${sector.name} Truth & Profit Advisor`,
          specificFocus: `Real margin preservation across ${sector.metrics.join(', ')}`,
          priorityMetrics: ['Net profit margin', 'Burn rate', 'Realistic runway'],
        };
        break;
    }

    return {
      profile,
      sectorCustomization: customization,
      autonomy: profile.defaultAutonomy,
      active: true,
      systemPrompt: profile.systemDirective(sector, businessName),
    };
  });
}
