import type { FundProfile, Region } from "@/lib/fundProfiles";

/**
 * Portfolio analytics for a passive, fund-based portfolio.
 *
 * Every function here is pure and deterministic so each figure on the
 * analytics page can be reproduced by hand. One denominator rule applies
 * throughout: "% of fund" includes cash; "% of equities" excludes it and is
 * used only inside the look-through, where it is labelled as such.
 */

export interface Position {
  ticker: string;
  shares: number;
  price: number;
  value: number;
}

export interface PositionWeight extends Position {
  name: string;
  isFund: boolean;
  pctOfFund: number;
  pctOfEquities: number;
  expenseRatio: number | null;
  yield: number | null;
  category: string | null;
  region: Region | null;
}

export function computeWeights(
  positions: Position[],
  cash: number,
  profiles: Map<string, FundProfile>
): { rows: PositionWeight[]; equities: number; fundValue: number } {
  const equities = positions.reduce((s, p) => s + p.value, 0);
  const fundValue = equities + cash;
  const rows = positions
    .map((p) => {
      const prof = profiles.get(p.ticker);
      return {
        ...p,
        name: prof?.name || p.ticker,
        isFund: prof?.isFund ?? false,
        pctOfFund: fundValue > 0 ? p.value / fundValue : 0,
        pctOfEquities: equities > 0 ? p.value / equities : 0,
        expenseRatio: prof?.expenseRatio ?? null,
        yield: prof?.yield ?? null,
        category: prof?.category ?? null,
        region: prof?.region ?? null,
      };
    })
    // Fixed order by size — never by return
    .sort((a, b) => b.value - a.value);
  return { rows, equities, fundValue };
}

export interface CostBreakdown {
  annualCost: number;
  /** weighted expense ratio as a share of equities */
  ratioOfEquities: number;
  ratioOfFund: number;
  perMember: number;
  /** what the same equities would cost in a typical 1% active fund */
  activeFundComparison: number;
  byFund: { ticker: string; annualCost: number; shareOfCost: number; shareOfEquities: number }[];
}

export function computeCosts(
  rows: PositionWeight[],
  equities: number,
  fundValue: number,
  memberCount: number
): CostBreakdown {
  const byFund = rows
    .filter((r) => r.expenseRatio != null)
    .map((r) => ({
      ticker: r.ticker,
      annualCost: r.value * (r.expenseRatio as number),
      shareOfEquities: r.pctOfEquities,
      shareOfCost: 0,
    }));
  const annualCost = byFund.reduce((s, f) => s + f.annualCost, 0);
  for (const f of byFund) f.shareOfCost = annualCost > 0 ? f.annualCost / annualCost : 0;
  byFund.sort((a, b) => b.annualCost - a.annualCost);
  return {
    annualCost,
    ratioOfEquities: equities > 0 ? annualCost / equities : 0,
    ratioOfFund: fundValue > 0 ? annualCost / fundValue : 0,
    perMember: memberCount > 0 ? annualCost / memberCount : 0,
    activeFundComparison: equities * 0.01,
    byFund,
  };
}

/**
 * Sector exposure seen THROUGH the funds: each fund's own sector split,
 * weighted by that fund's share of equities. A holding with no sector data is
 * reported as Unclassified — never guessed.
 */
export function computeLookThroughSectors(
  rows: PositionWeight[],
  profiles: Map<string, FundProfile>
): { sector: string; weight: number }[] {
  const acc: Record<string, number> = {};
  for (const r of rows) {
    const sectors = profiles.get(r.ticker)?.sectors;
    if (!sectors || Object.keys(sectors).length === 0) {
      acc.Unclassified = (acc.Unclassified || 0) + r.pctOfEquities;
      continue;
    }
    for (const [s, w] of Object.entries(sectors)) {
      acc[s] = (acc[s] || 0) + w * r.pctOfEquities;
    }
  }
  return Object.entries(acc)
    .map(([sector, weight]) => ({ sector, weight }))
    .sort((a, b) => b.weight - a.weight);
}

/** Approximate global market-cap weights, for context only. */
export const GLOBAL_REGION_WEIGHTS: Record<Region, number> = {
  US: 0.63,
  "Developed ex-US": 0.26,
  Emerging: 0.11,
};

export function computeGeography(
  rows: PositionWeight[]
): { region: Region | "Unclassified"; weight: number }[] {
  const acc: Record<string, number> = {};
  for (const r of rows) {
    const key = r.region || "Unclassified";
    acc[key] = (acc[key] || 0) + r.pctOfEquities;
  }
  const order = ["US", "Developed ex-US", "Emerging", "Unclassified"];
  return order
    .filter((k) => acc[k] > 0)
    .map((k) => ({ region: k as Region | "Unclassified", weight: acc[k] }));
}

// The same company listed twice (share classes, ADR vs home listing)
const LISTING_ALIASES: Record<string, string> = {
  GOOG: "GOOGL",
  "2330.TW": "TSM",
  "005930.KS": "SMSN",
};

export interface Concentration {
  /** equities held through diversified funds vs individual companies */
  inFunds: number;
  inSingleStocks: number;
  singleStocks: { ticker: string; name: string; pctOfEquities: number; value: number }[];
  /** largest company exposures seen through the funds */
  topNames: { symbol: string; name: string; pctOfEquities: number; value: number; via: string[] }[];
  /** share of equities the named exposures above actually account for */
  coverage: number;
}

export function computeConcentration(
  rows: PositionWeight[],
  profiles: Map<string, FundProfile>,
  equities: number
): Concentration {
  const names = new Map<string, { name: string; pct: number; via: Set<string> }>();
  let covered = 0;

  for (const r of rows) {
    const prof = profiles.get(r.ticker);
    if (!r.isFund) {
      const key = LISTING_ALIASES[r.ticker] || r.ticker;
      const e = names.get(key) || { name: r.name, pct: 0, via: new Set<string>() };
      e.pct += r.pctOfEquities;
      e.via.add("held directly");
      names.set(key, e);
      covered += r.pctOfEquities;
      continue;
    }
    for (const h of prof?.topHoldings || []) {
      const key = LISTING_ALIASES[h.symbol] || h.symbol;
      const pct = h.weight * r.pctOfEquities;
      const e = names.get(key) || { name: h.name, pct: 0, via: new Set<string>() };
      e.pct += pct;
      e.via.add(r.ticker);
      names.set(key, e);
      covered += pct;
    }
  }

  const single = rows.filter((r) => !r.isFund);
  const inSingleStocks = single.reduce((s, r) => s + r.pctOfEquities, 0);

  return {
    inFunds: 1 - inSingleStocks,
    inSingleStocks,
    singleStocks: single.map((r) => ({
      ticker: r.ticker,
      name: r.name,
      pctOfEquities: r.pctOfEquities,
      value: r.value,
    })),
    topNames: [...names.entries()]
      .map(([symbol, e]) => ({
        symbol,
        name: e.name,
        pctOfEquities: e.pct,
        value: e.pct * equities,
        via: [...e.via],
      }))
      .sort((a, b) => b.pctOfEquities - a.pctOfEquities)
      .slice(0, 10),
    coverage: covered,
  };
}

/**
 * What a market fall does to the fund. Cash does not fall with the market, so
 * the fund moves by the shock times its equity weight. Exact arithmetic — no
 * beta estimate.
 */
export function computeDownside(equities: number, fundValue: number) {
  const equityWeight = fundValue > 0 ? equities / fundValue : 0;
  return {
    equityWeight,
    scenarios: [0.1, 0.2, 0.3].map((shock) => ({
      marketFall: shock,
      fundFall: shock * equityWeight,
      /** loss on a $1,000 stake */
      per1000: 1000 * shock * equityWeight,
    })),
  };
}

export interface NavPoint {
  date: string;
  nav: number;
}

/** Largest peak-to-trough fall in NAV, and how much of it has been recovered. */
export function computeDrawdown(series: NavPoint[]) {
  if (series.length < 2) return null;
  let peak = series[0];
  let worst = { depth: 0, peak: series[0], trough: series[0] };
  for (const p of series) {
    if (p.nav > peak.nav) peak = p;
    const depth = p.nav / peak.nav - 1;
    if (depth < worst.depth) worst = { depth, peak, trough: p };
  }
  const allTimeHigh = series.reduce((a, b) => (b.nav > a.nav ? b : a));
  const current = series[series.length - 1];
  const fallSize = worst.peak.nav - worst.trough.nav;
  return {
    maxDrawdown: worst.depth,
    peakDate: worst.peak.date,
    troughDate: worst.trough.date,
    peakNav: worst.peak.nav,
    troughNav: worst.trough.nav,
    recovered: fallSize > 0 ? (current.nav - worst.trough.nav) / fallSize : 1,
    belowHigh: current.nav / allTimeHigh.nav - 1,
    allTimeHighDate: allTimeHigh.date,
  };
}

/**
 * Annualised volatility of daily NAV changes. Reported with its sample size
 * and window because it is the only risk statistic with a tolerable error bar
 * at this length of history — ratios like Sharpe are omitted deliberately.
 */
export function computeVolatility(series: NavPoint[]) {
  const returns: number[] = [];
  for (let i = 1; i < series.length; i++) {
    if (series[i - 1].nav > 0) returns.push(series[i].nav / series[i - 1].nav - 1);
  }
  if (returns.length < 20) return null;
  const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
  const variance =
    returns.reduce((s, r) => s + (r - mean) ** 2, 0) / (returns.length - 1);
  return {
    annualized: Math.sqrt(variance) * Math.sqrt(252),
    observations: returns.length,
    from: series[0].date,
    to: series[series.length - 1].date,
  };
}
