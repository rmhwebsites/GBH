import type { Region } from "@/lib/fundProfiles";
import type { PositionWeight, CostBreakdown, Concentration, NavPoint } from "@/lib/analytics";
import type { IncomeSummary } from "@/lib/dividends";

export interface ComparisonSeries {
  startDate: string;
  fund: { date: string; value: number }[];
  benchmark: { date: string; value: number }[];
  fundReturn: number;
  benchmarkReturn: number;
}

/** Response of GET /api/portfolio/analytics */
export interface AnalyticsPayload {
  asOf: string;
  fund: {
    value: number;
    equities: number;
    cash: number;
    cashPct: number;
    units: number;
    nav: number;
    memberCount: number;
    contributed: number;
    /** fund value vs everything members paid in */
    gainOnContributions: number;
    /** NAV change since the first stored snapshot */
    navSinceFirstSnapshot: number;
    firstSnapshotDate: string | null;
  };
  cashWaiting: {
    amount: number;
    pctOfFund: number;
    lastContributionDate: string | null;
    lastContributionAmount: number;
    daysSince: number | null;
  };
  positions: PositionWeight[];
  costs: CostBreakdown;
  sectors: { sector: string; weight: number }[];
  geography: { region: Region | "Unclassified"; weight: number }[];
  globalRegionWeights: Record<Region, number>;
  concentration: Concentration;
  downside: {
    equityWeight: number;
    scenarios: { marketFall: number; fundFall: number; per1000: number }[];
  };
  drawdown: {
    maxDrawdown: number;
    peakDate: string;
    troughDate: string;
    peakNav: number;
    troughNav: number;
    recovered: number;
    belowHigh: number;
    allTimeHighDate: string;
  } | null;
  volatility: { annualized: number; observations: number; from: string; to: string } | null;
  navSeries: NavPoint[];
  rebuildDate: string | null;
  contributionDates: string[];
  benchmark: {
    ticker: string;
    comparison: {
      "3m"?: ComparisonSeries | null;
      rebuild?: ComparisonSeries | null;
      all?: ComparisonSeries | null;
    };
  };
  income: IncomeSummary;
  admin: {
    unitsInLedger: number;
    unitsInMetadata: number;
    unitsReconcile: boolean;
    lastSnapshotDate: string | null;
    pendingSubmissions: number;
    failedProfiles: string[];
    unpriced: string[];
  } | null;
}
