import type { NavSnapshot } from "@/types/database";

export interface RiskMetrics {
  sharpeRatio: number;
  sortinoRatio: number;
  maxDrawdown: number;
  maxDrawdownDate: string;
  volatility: number;
  annualizedReturn: number;
  bestDay: { date: string; return: number };
  worstDay: { date: string; return: number };
  winRate: number;
  totalDays: number;
}

const TRADING_DAYS_PER_YEAR = 252;

/**
 * Calculate comprehensive risk metrics from NAV snapshots.
 * Requires at least 20 snapshots for meaningful results.
 */
export function calculateRiskMetrics(
  snapshots: NavSnapshot[],
  riskFreeRate: number = 0.05
): RiskMetrics | null {
  if (snapshots.length < 20) return null;

  // Sort by date ascending
  const sorted = [...snapshots].sort(
    (a, b) =>
      new Date(a.snapshot_date).getTime() - new Date(b.snapshot_date).getTime()
  );

  // Calculate daily returns
  const dailyReturns: { date: string; return: number }[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1].nav_per_unit;
    const curr = sorted[i].nav_per_unit;
    if (prev > 0) {
      dailyReturns.push({
        date: sorted[i].snapshot_date,
        return: (curr - prev) / prev,
      });
    }
  }

  if (dailyReturns.length < 10) return null;

  const returns = dailyReturns.map((r) => r.return);

  // Mean daily return
  const meanReturn = returns.reduce((s, r) => s + r, 0) / returns.length;

  // Annualized return (compound)
  const firstNav = sorted[0].nav_per_unit;
  const lastNav = sorted[sorted.length - 1].nav_per_unit;
  const totalDays = Math.max(
    1,
    (new Date(sorted[sorted.length - 1].snapshot_date).getTime() -
      new Date(sorted[0].snapshot_date).getTime()) /
      (1000 * 60 * 60 * 24)
  );
  const annualizedReturn =
    Math.pow(lastNav / firstNav, 365 / totalDays) - 1;

  // Volatility (annualized standard deviation)
  const variance =
    returns.reduce((s, r) => s + Math.pow(r - meanReturn, 2), 0) /
    (returns.length - 1);
  const dailyStdDev = Math.sqrt(variance);
  const volatility = dailyStdDev * Math.sqrt(TRADING_DAYS_PER_YEAR);

  // Sharpe Ratio
  const dailyRiskFree = riskFreeRate / TRADING_DAYS_PER_YEAR;
  const excessReturn = meanReturn - dailyRiskFree;
  const sharpeRatio =
    dailyStdDev > 0
      ? (excessReturn / dailyStdDev) * Math.sqrt(TRADING_DAYS_PER_YEAR)
      : 0;

  // Sortino Ratio (uses downside deviation)
  const negativeReturns = returns.filter((r) => r < dailyRiskFree);
  const downsideVariance =
    negativeReturns.length > 0
      ? negativeReturns.reduce(
          (s, r) => s + Math.pow(r - dailyRiskFree, 2),
          0
        ) / negativeReturns.length
      : 0;
  const downsideDeviation = Math.sqrt(downsideVariance);
  const sortinoRatio =
    downsideDeviation > 0
      ? (excessReturn / downsideDeviation) * Math.sqrt(TRADING_DAYS_PER_YEAR)
      : 0;

  // Max Drawdown
  let peak = sorted[0].nav_per_unit;
  let maxDrawdown = 0;
  let maxDrawdownDate = sorted[0].snapshot_date;

  for (const snap of sorted) {
    if (snap.nav_per_unit > peak) {
      peak = snap.nav_per_unit;
    }
    const drawdown = (peak - snap.nav_per_unit) / peak;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
      maxDrawdownDate = snap.snapshot_date;
    }
  }

  // Best and worst day
  let bestDay = dailyReturns[0];
  let worstDay = dailyReturns[0];
  for (const dr of dailyReturns) {
    if (dr.return > bestDay.return) bestDay = dr;
    if (dr.return < worstDay.return) worstDay = dr;
  }

  // Win rate
  const positiveDays = returns.filter((r) => r > 0).length;
  const winRate = (positiveDays / returns.length) * 100;

  return {
    sharpeRatio,
    sortinoRatio,
    maxDrawdown: maxDrawdown * 100,
    maxDrawdownDate,
    volatility: volatility * 100,
    annualizedReturn: annualizedReturn * 100,
    bestDay: { date: bestDay.date, return: bestDay.return * 100 },
    worstDay: { date: worstDay.date, return: worstDay.return * 100 },
    winRate,
    totalDays: dailyReturns.length,
  };
}
