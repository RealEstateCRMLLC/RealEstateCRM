/**
 * Universal CRM — Market Oracle & Business Truth Engine.
 *
 * Combines real ground-truth market telemetry (hyper-local neighborhood
 * targeting up to global reach) with cold, unvarnished business mathematics.
 *
 * Eliminates AI hallucinations in business growth: calculates exact lead
 * volume, conversion rates, labor capacity, and unit economics required to
 * reach target milestones realistically.
 *
 * Built under the United Beats LLC Universal Architecture.
 */

export type MarketGeoScope =
  | 'hyper-local'  // 1-5 mile neighborhood radius
  | 'metro'        // City or County-wide
  | 'regional'     // Multi-county or State-wide
  | 'national'     // Country-wide
  | 'global';      // International

export interface LocalMarketTelemetry {
  targetAreaName: string;
  scope: MarketGeoScope;
  zipCodes?: string[];
  demandIndex: number;            // 0 - 100
  competitorDensity: 'low' | 'moderate' | 'high' | 'saturated';
  estimatedMedianPrice: number;   // In USD
  marketCACBenchmark: number;     // Typical Customer Acquisition Cost in USD
  searchVolumeGrowthYoY: number;  // Percentage (-100 to +500)
  primaryLocalChannels: string[]; // e.g., ["Google Local Services", "Facebook Geotargeting", "Door-to-Door / Yard Signs"]
}

export interface BusinessGroundTruthInputs {
  businessName: string;
  sectorId: string;
  currentMonthlyRevenue: number;
  targetMonthlyRevenue: number;
  timeframeMonths: number;
  averageDealValue: number;
  historicalCloseRate: number;    // e.g. 0.25 for 25%
  monthlyAdSpend: number;
  activeLaborCapacityUnits: number; // e.g. number of roofing crews, stylists, developers, or sales reps
  maxDealsPerUnitMonthly: number; // Max deals 1 labor unit can fulfill per month without quality drop
}

export interface PacedMilestone {
  month: number;
  projectedRevenue: number;
  leadsRequired: number;
  dealsRequired: number;
  laborUnitsNeeded: number;
}

export interface BusinessTruthVerdict {
  isViableWithCurrentCapacity: boolean;
  requiredMonthlyLeadVolume: number;
  requiredMonthlyDeals: number;
  maxFulfillableDealsMonthly: number;
  capacityUtilizationPct: number;
  recommendedMonthlyAdSpend: number;
  bottlenecksIdentified: string[];
  unvarnishedTruthSummary: string;
  encouragingExecutiveGuidance: string;
  roadmap: PacedMilestone[];
}

/**
 * Calculates cold, mathematical business reality.
 * Never hallucinated; strictly verified against capacity and conversion math.
 */
export function calculateBusinessTruth(
  inputs: BusinessGroundTruthInputs,
  oracleData?: Partial<LocalMarketTelemetry>,
): BusinessTruthVerdict {
  const avgDeal = Math.max(inputs.averageDealValue, 1);
  const closeRate = Math.min(Math.max(inputs.historicalCloseRate, 0.01), 0.95);
  const targetRevenue = Math.max(inputs.targetMonthlyRevenue, inputs.currentMonthlyRevenue);
  const timeframe = Math.max(inputs.timeframeMonths, 1);

  // Required deals to hit target revenue
  const requiredDeals = Math.ceil(targetRevenue / avgDeal);
  const requiredLeads = Math.ceil(requiredDeals / closeRate);

  // Fulfillment capacity check
  const maxFulfillable = inputs.activeLaborCapacityUnits * inputs.maxDealsPerUnitMonthly;
  const isViableWithCurrentCapacity = maxFulfillable >= requiredDeals;
  const capacityUtilizationPct = maxFulfillable > 0 ? Math.round((requiredDeals / maxFulfillable) * 100) : 999;

  // Ad spend recommendation based on oracle CAC benchmark or standard ratios
  const cacBenchmark = oracleData?.marketCACBenchmark ?? Math.max(avgDeal * 0.12, 50);
  const recommendedAdSpend = Math.round(requiredDeals * cacBenchmark);

  const bottlenecks: string[] = [];
  if (!isViableWithCurrentCapacity) {
    const additionalUnitsNeeded = Math.ceil((requiredDeals - maxFulfillable) / Math.max(inputs.maxDealsPerUnitMonthly, 1));
    bottlenecks.push(`Labor Fulfillment Bottleneck: Your ${inputs.activeLaborCapacityUnits} current crew/staff units can fulfill at most ${maxFulfillable} jobs/month. You need ${additionalUnitsNeeded} more unit(s) to hit $${targetRevenue.toLocaleString()}/mo.`);
  }

  if (inputs.monthlyAdSpend < recommendedAdSpend * 0.5) {
    bottlenecks.push(`Lead Acquisition Under-funding: Current ad budget of $${inputs.monthlyAdSpend.toLocaleString()} is below the $${recommendedAdSpend.toLocaleString()} needed to purchase ${requiredLeads} qualified leads at standard local CAC ($${cacBenchmark}).`);
  }

  if (closeRate < 0.15) {
    bottlenecks.push(`Sales Conversion Leak: Current close rate (${Math.round(closeRate * 100)}%) is soft. Lifting conversion to 25% would reduce required leads from ${requiredLeads} down to ${Math.ceil(requiredDeals / 0.25)}.`);
  }

  // Monthly pacing roadmap
  const monthlyRevenueGrowthStep = (targetRevenue - inputs.currentMonthlyRevenue) / timeframe;
  const roadmap: PacedMilestone[] = [];

  for (let m = 1; m <= timeframe; m++) {
    const projRev = Math.round(inputs.currentMonthlyRevenue + monthlyRevenueGrowthStep * m);
    const deals = Math.ceil(projRev / avgDeal);
    const leads = Math.ceil(deals / closeRate);
    const units = Math.ceil(deals / Math.max(inputs.maxDealsPerUnitMonthly, 1));

    roadmap.push({
      month: m,
      projectedRevenue: projRev,
      leadsRequired: leads,
      dealsRequired: deals,
      laborUnitsNeeded: units,
    });
  }

  const unvarnishedTruthSummary = isViableWithCurrentCapacity
    ? `The goal of reaching $${targetRevenue.toLocaleString()}/month is mathematically reachable within ${timeframe} months. You need ${requiredDeals} closed deals/month (${requiredLeads} qualified leads at your ${Math.round(closeRate * 100)}% conversion rate). Your operations can handle this volume.`
    : `The goal cannot be reached with your current operational setup alone. Even if you generated all ${requiredLeads} leads, your operations max out at ${maxFulfillable} jobs ($${(maxFulfillable * avgDeal).toLocaleString()}/month). You must expand fulfillment capacity or raise prices by ${Math.round(((targetRevenue / (maxFulfillable * avgDeal)) - 1) * 100)}% before scaling ad spend.`;

  const encouragingExecutiveGuidance = `You now have the true numbers. Growth isn't magic—it's matching lead volume to qualified sales and fulfillment capacity. United Beats LLC's Digital Team (Atlas on intake, Vanguard on deals, and Forge on operations) will systematically execute these milestones month by month.`;

  return {
    isViableWithCurrentCapacity,
    requiredMonthlyLeadVolume: requiredLeads,
    requiredMonthlyDeals: requiredDeals,
    maxFulfillableDealsMonthly: maxFulfillable,
    capacityUtilizationPct,
    recommendedMonthlyAdSpend: recommendedAdSpend,
    bottlenecksIdentified: bottlenecks,
    unvarnishedTruthSummary,
    encouragingExecutiveGuidance,
    roadmap,
  };
}
