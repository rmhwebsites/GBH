"use client";

import { useState } from "react";
import useSWR from "swr";
import {
  Loader2,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Target,
  Activity,
  Zap,
  Banknote,
  Briefcase,
  Scale,
  Layers,
  Shield,
  ArrowDown,
  Percent,
  Calendar,
} from "lucide-react";
import type { RiskMetrics } from "@/lib/risk";
import { PerformanceChart } from "@/components/charts/PerformanceChart";
import { SectorChart } from "@/components/charts/SectorChart";
import type { PortfolioSummary } from "@/types/database";
import {
  formatCurrency,
  formatPercent,
  formatNumber,
  formatLargeNumber,
} from "@/lib/calculations";
import {
  calculateSectorAllocations,
  SECTOR_COLORS,
  type GICSSector,
} from "@/lib/sectors";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const PERIODS = [
  { label: "1M", value: "1mo" },
  { label: "3M", value: "3mo" },
  { label: "1Y", value: "1y" },
  { label: "5Y", value: "5y" },
  { label: "All", value: "max" },
] as const;

export default function AnalyticsPage() {
  const [period, setPeriod] = useState("1y");

  const { data: portfolio, isLoading: portfolioLoading } =
    useSWR<PortfolioSummary>("/api/portfolio", fetcher, {
      refreshInterval: 5 * 60 * 1000,
    });

  const { data: performance, isLoading: perfLoading } = useSWR(
    `/api/portfolio/performance?period=${period}`,
    fetcher,
    { refreshInterval: 60 * 60 * 1000 } // refresh every hour
  );

  const { data: riskData } = useSWR<{ metrics: RiskMetrics | null }>(
    "/api/portfolio/risk-metrics",
    fetcher,
    { refreshInterval: 60 * 60 * 1000 }
  );

  const isLoading = portfolioLoading || perfLoading;

  if (isLoading && !portfolio) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-gold" />
          <p className="text-muted">Loading analytics...</p>
        </div>
      </div>
    );
  }

  const holdings = portfolio?.holdings || [];
  const stats = performance?.stats;
  const portfolioReturn = stats?.portfolioReturn || 0;
  const sp500Return = stats?.sp500Return || 0;
  const alpha = stats?.alpha || 0;

  // Calculate top and bottom performers
  const sortedByGain = [...holdings].sort(
    (a, b) => b.gainLossPercent - a.gainLossPercent
  );
  const topPerformers = sortedByGain.slice(0, 5);
  const bottomPerformers = sortedByGain.slice(-5).reverse();

  // Calculate sector allocations for the bar chart
  const sectorAllocations = calculateSectorAllocations(holdings);

  // Concentration metrics
  const top5Weight = holdings
    .slice(0, 5)
    .reduce((sum, h) => sum + h.weight, 0);
  const avgPosition = holdings.length > 0 ? 100 / holdings.length : 0;

  // Portfolio detail values
  const cashBalance = portfolio?.cashBalance || 0;
  const totalValue = portfolio?.totalValue || 0;
  const investmentsValue = totalValue - cashBalance;
  const totalCost = portfolio?.totalCost || 0;
  const totalGainLoss = portfolio?.totalGainLoss || 0;
  const totalDayChange = portfolio?.totalDayChange || 0;
  const totalDayChangePercent = portfolio?.totalDayChangePercent || 0;
  const isPositive = totalGainLoss >= 0;
  const isDayPositive = totalDayChange >= 0;
  const cashWeight = totalValue > 0 ? (cashBalance / totalValue) * 100 : 0;
  const investmentsWeight = totalValue > 0 ? (investmentsValue / totalValue) * 100 : 0;
  const smallestPosition = holdings.length > 0
    ? holdings[holdings.length - 1]
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          Portfolio Analytics
        </h1>
        <p className="mt-1 text-sm text-muted">
          Performance analysis and comparison to S&amp;P 500
        </p>
      </div>

      {/* Portfolio Overview — Two column: Account Summary + Performance */}
      <div className="grid grid-cols-1 gap-3 sm:gap-4 xl:grid-cols-2">
        {/* Account Summary Card */}
        <div className="glass-card p-4 sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-gold sm:h-5 sm:w-5" />
            <h2 className="text-sm font-semibold text-foreground sm:text-base">
              Account Summary
            </h2>
          </div>

          {/* Total Value Hero */}
          <div className="mb-3 sm:mb-4">
            <p className="text-xs text-muted">Total Account Value</p>
            <p className="text-2xl font-bold text-foreground sm:text-3xl">
              {formatCurrency(totalValue)}
            </p>
            <div className="mt-1 flex items-center gap-2">
              {isDayPositive ? (
                <TrendingUp className="h-3 w-3 text-gain" />
              ) : (
                <TrendingDown className="h-3 w-3 text-loss" />
              )}
              <span
                className={`text-xs font-medium ${
                  isDayPositive ? "text-gain" : "text-loss"
                }`}
              >
                {formatCurrency(totalDayChange)}
              </span>
              <span
                className={`text-xs ${
                  isDayPositive ? "text-gain" : "text-loss"
                }`}
              >
                ({formatPercent(totalDayChangePercent)}) Today
              </span>
            </div>
          </div>

          {/* Breakdown */}
          <div className="space-y-0 divide-y divide-card-border/40">
            <div className="flex items-center justify-between py-2 sm:py-2.5">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-3.5 w-3.5 text-gold" />
                <span className="text-xs text-muted sm:text-sm">Investments</span>
              </div>
              <div className="text-right">
                <span className="text-xs font-medium text-foreground sm:text-sm">
                  {formatCurrency(investmentsValue)}
                </span>
                <span className="ml-1.5 text-[10px] text-muted sm:text-xs">
                  {investmentsWeight.toFixed(1)}%
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between py-2 sm:py-2.5">
              <div className="flex items-center gap-2">
                <Banknote className="h-3.5 w-3.5 text-gold" />
                <span className="text-xs text-muted sm:text-sm">Cash &amp; Equivalents</span>
              </div>
              <div className="text-right">
                <span className="text-xs font-medium text-foreground sm:text-sm">
                  {formatCurrency(cashBalance)}
                </span>
                <span className="ml-1.5 text-[10px] text-muted sm:text-xs">
                  {cashWeight.toFixed(1)}%
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between py-2 sm:py-2.5">
              <div className="flex items-center gap-2">
                <Layers className="h-3.5 w-3.5 text-gold" />
                <span className="text-xs text-muted sm:text-sm">Cost Basis</span>
              </div>
              <span className="text-xs font-medium text-foreground sm:text-sm">
                {formatCurrency(totalCost)}
              </span>
            </div>
            <div className="flex items-center justify-between py-2 sm:py-2.5">
              <div className="flex items-center gap-2">
                {isPositive ? (
                  <TrendingUp className="h-3.5 w-3.5 text-gain" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5 text-loss" />
                )}
                <span className="text-xs text-muted sm:text-sm">Total Gain/Loss</span>
              </div>
              <div className="text-right">
                <span
                  className={`text-xs font-semibold sm:text-sm ${
                    isPositive ? "text-gain" : "text-loss"
                  }`}
                >
                  {formatCurrency(totalGainLoss)}
                </span>
                <span
                  className={`ml-1.5 text-[10px] sm:text-xs ${
                    isPositive ? "text-gain" : "text-loss"
                  }`}
                >
                  ({formatPercent(portfolio?.totalGainLossPercent || 0)})
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Performance Cards — 2x2 grid */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <div className="glass-card p-4 sm:p-5">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gold/10 sm:h-10 sm:w-10">
                <BarChart3 className="h-4 w-4 text-gold sm:h-5 sm:w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted">Fund Return</p>
                <p
                  className={`text-lg font-semibold sm:text-xl ${
                    portfolioReturn >= 0 ? "text-gain" : "text-loss"
                  }`}
                >
                  {portfolioReturn >= 0 ? "+" : ""}
                  {portfolioReturn.toFixed(2)}%
                </p>
              </div>
            </div>
          </div>

          <div className="glass-card p-4 sm:p-5">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#5CA0CE]/10 sm:h-10 sm:w-10">
                <Activity className="h-4 w-4 text-[#5CA0CE] sm:h-5 sm:w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted">S&amp;P 500</p>
                <p
                  className={`text-lg font-semibold sm:text-xl ${
                    sp500Return >= 0 ? "text-gain" : "text-loss"
                  }`}
                >
                  {sp500Return >= 0 ? "+" : ""}
                  {sp500Return.toFixed(2)}%
                </p>
              </div>
            </div>
          </div>

          <div className="glass-card p-4 sm:p-5">
            <div className="flex items-center gap-2 sm:gap-3">
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg sm:h-10 sm:w-10 ${
                  alpha >= 0 ? "bg-gain/10" : "bg-loss/10"
                }`}
              >
                <Target
                  className={`h-4 w-4 sm:h-5 sm:w-5 ${alpha >= 0 ? "text-gain" : "text-loss"}`}
                />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted">Alpha vs S&amp;P</p>
                <p
                  className={`text-lg font-semibold sm:text-xl ${
                    alpha >= 0 ? "text-gain" : "text-loss"
                  }`}
                >
                  {alpha >= 0 ? "+" : ""}
                  {alpha.toFixed(2)}%
                </p>
              </div>
            </div>
          </div>

          <div className="glass-card p-4 sm:p-5">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gold/10 sm:h-10 sm:w-10">
                <Layers className="h-4 w-4 text-gold sm:h-5 sm:w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted">Holdings</p>
                <p className="text-lg font-semibold text-foreground sm:text-xl">
                  {holdings.length} stocks
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Performance Comparison Chart */}
      <div className="glass-card p-4 sm:p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Performance vs S&amp;P 500
            </h2>
            <p className="text-xs text-muted">
              Indexed to 100 at start of period
            </p>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors sm:px-3 ${
                  period === p.value
                    ? "bg-gold/20 text-gold"
                    : "text-muted hover:bg-card-glass hover:text-foreground"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="mb-4 flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="h-0.5 w-6 bg-gold" />
            <span className="text-xs text-muted">GBH Fund</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-0.5 w-6 bg-[#5CA0CE]" />
            <span className="text-xs text-muted">S&amp;P 500</span>
          </div>
        </div>

        <div className="relative">
          {perfLoading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-gold border-t-transparent" />
            </div>
          )}
          <PerformanceChart
            portfolio={performance?.portfolio || []}
            sp500={performance?.sp500 || []}
            period={period}
          />
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Sector Allocation */}
        <SectorChart holdings={holdings} />

        {/* Concentration & Risk Metrics */}
        <div className="glass-card p-4 sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <Scale className="h-4 w-4 text-gold sm:h-5 sm:w-5" />
            <h2 className="text-lg font-semibold text-foreground">
              Concentration & Risk
            </h2>
          </div>
          <div className="space-y-0 divide-y divide-card-border/40">
            {[
              {
                label: "Largest Position",
                value: holdings.length > 0
                  ? `${holdings[0].ticker} (${holdings[0].weight.toFixed(1)}%)`
                  : "N/A",
              },
              {
                label: "Smallest Position",
                value: smallestPosition
                  ? `${smallestPosition.ticker} (${smallestPosition.weight.toFixed(1)}%)`
                  : "N/A",
              },
              {
                label: "Top 5 Concentration",
                value: `${top5Weight.toFixed(1)}%`,
              },
              {
                label: "Avg Position Size",
                value: `${avgPosition.toFixed(1)}%`,
              },
              {
                label: "Sectors Represented",
                value: `${sectorAllocations.length} of 11`,
              },
              {
                label: "Cash Allocation",
                value: `${cashWeight.toFixed(1)}%`,
              },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="flex items-center justify-between py-2.5 sm:py-3"
              >
                <span className="text-xs text-muted sm:text-sm">{label}</span>
                <span className="text-xs font-medium text-foreground sm:text-sm">
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Risk Metrics */}
      {riskData?.metrics && (
        <div className="glass-card p-4 sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <Shield className="h-4 w-4 text-gold sm:h-5 sm:w-5" />
            <h2 className="text-lg font-semibold text-foreground">
              Risk Metrics
            </h2>
          </div>
          <p className="mb-4 text-xs text-muted">
            Based on {riskData.metrics.totalDays} daily NAV observations. Risk-free rate: 5%.
          </p>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {/* Sharpe Ratio */}
            <div className="rounded-lg bg-card-glass/50 p-3 sm:p-4">
              <div className="mb-1 flex items-center gap-1.5">
                <Target className="h-3.5 w-3.5 text-muted" />
                <p className="text-[10px] uppercase tracking-wider text-muted">
                  Sharpe Ratio
                </p>
              </div>
              <p
                className={`text-lg font-semibold sm:text-xl ${
                  riskData.metrics.sharpeRatio > 1
                    ? "text-gain"
                    : riskData.metrics.sharpeRatio >= 0
                      ? "text-gold"
                      : "text-loss"
                }`}
              >
                {riskData.metrics.sharpeRatio.toFixed(2)}
              </p>
            </div>

            {/* Sortino Ratio */}
            <div className="rounded-lg bg-card-glass/50 p-3 sm:p-4">
              <div className="mb-1 flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-muted" />
                <p className="text-[10px] uppercase tracking-wider text-muted">
                  Sortino Ratio
                </p>
              </div>
              <p
                className={`text-lg font-semibold sm:text-xl ${
                  riskData.metrics.sortinoRatio > 1
                    ? "text-gain"
                    : riskData.metrics.sortinoRatio >= 0
                      ? "text-gold"
                      : "text-loss"
                }`}
              >
                {riskData.metrics.sortinoRatio.toFixed(2)}
              </p>
            </div>

            {/* Volatility */}
            <div className="rounded-lg bg-card-glass/50 p-3 sm:p-4">
              <div className="mb-1 flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5 text-muted" />
                <p className="text-[10px] uppercase tracking-wider text-muted">
                  Volatility (Ann.)
                </p>
              </div>
              <p className="text-lg font-semibold text-foreground sm:text-xl">
                {riskData.metrics.volatility.toFixed(1)}%
              </p>
            </div>

            {/* Max Drawdown */}
            <div className="rounded-lg bg-card-glass/50 p-3 sm:p-4">
              <div className="mb-1 flex items-center gap-1.5">
                <ArrowDown className="h-3.5 w-3.5 text-loss" />
                <p className="text-[10px] uppercase tracking-wider text-muted">
                  Max Drawdown
                </p>
              </div>
              <p className="text-lg font-semibold text-loss sm:text-xl">
                -{riskData.metrics.maxDrawdown.toFixed(1)}%
              </p>
            </div>

            {/* Win Rate */}
            <div className="rounded-lg bg-card-glass/50 p-3 sm:p-4">
              <div className="mb-1 flex items-center gap-1.5">
                <Percent className="h-3.5 w-3.5 text-muted" />
                <p className="text-[10px] uppercase tracking-wider text-muted">
                  Win Rate
                </p>
              </div>
              <p
                className={`text-lg font-semibold sm:text-xl ${
                  riskData.metrics.winRate >= 50 ? "text-gain" : "text-loss"
                }`}
              >
                {riskData.metrics.winRate.toFixed(1)}%
              </p>
            </div>

            {/* Annualized Return */}
            <div className="rounded-lg bg-card-glass/50 p-3 sm:p-4">
              <div className="mb-1 flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-muted" />
                <p className="text-[10px] uppercase tracking-wider text-muted">
                  Ann. Return
                </p>
              </div>
              <p
                className={`text-lg font-semibold sm:text-xl ${
                  riskData.metrics.annualizedReturn >= 0
                    ? "text-gain"
                    : "text-loss"
                }`}
              >
                {riskData.metrics.annualizedReturn >= 0 ? "+" : ""}
                {riskData.metrics.annualizedReturn.toFixed(1)}%
              </p>
            </div>
          </div>

          {/* Best / Worst Day Details */}
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex items-center justify-between rounded-lg bg-gain/5 px-4 py-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-gain" />
                <div>
                  <p className="text-xs font-medium text-gain">Best Day</p>
                  <p className="flex items-center gap-1 text-[10px] text-muted">
                    <Calendar className="h-2.5 w-2.5" />
                    {new Date(riskData.metrics.bestDay.date + "T00:00:00").toLocaleDateString(
                      "en-US",
                      { month: "short", day: "numeric", year: "numeric" }
                    )}
                  </p>
                </div>
              </div>
              <p className="text-sm font-semibold text-gain">
                +{riskData.metrics.bestDay.return.toFixed(2)}%
              </p>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-loss/5 px-4 py-3">
              <div className="flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-loss" />
                <div>
                  <p className="text-xs font-medium text-loss">Worst Day</p>
                  <p className="flex items-center gap-1 text-[10px] text-muted">
                    <Calendar className="h-2.5 w-2.5" />
                    {new Date(riskData.metrics.worstDay.date + "T00:00:00").toLocaleDateString(
                      "en-US",
                      { month: "short", day: "numeric", year: "numeric" }
                    )}
                  </p>
                </div>
              </div>
              <p className="text-sm font-semibold text-loss">
                {riskData.metrics.worstDay.return.toFixed(2)}%
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Top & Bottom Performers */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Top Performers */}
        <div className="glass-card p-4 sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-gain" />
            <h2 className="text-lg font-semibold text-foreground">
              Top Performers
            </h2>
          </div>
          <div className="space-y-2 sm:space-y-3">
            {topPerformers.map((h, i) => (
              <div
                key={h.ticker}
                className="flex items-center justify-between rounded-lg bg-card-glass/50 px-3 py-2.5 sm:px-4 sm:py-3"
              >
                <div className="flex items-center gap-2 sm:gap-3">
                  <span className="text-xs font-bold text-muted">
                    #{i + 1}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {h.ticker}
                    </p>
                    <p className="max-w-[100px] truncate text-xs text-muted sm:max-w-[120px]">
                      {h.company_name}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gain">
                    {formatPercent(h.gainLossPercent)}
                  </p>
                  <p className="text-xs text-gain">
                    {formatCurrency(h.gainLoss)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Performers */}
        <div className="glass-card p-4 sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-loss" />
            <h2 className="text-lg font-semibold text-foreground">
              Bottom Performers
            </h2>
          </div>
          <div className="space-y-2 sm:space-y-3">
            {bottomPerformers.map((h, i) => (
              <div
                key={h.ticker}
                className="flex items-center justify-between rounded-lg bg-card-glass/50 px-3 py-2.5 sm:px-4 sm:py-3"
              >
                <div className="flex items-center gap-2 sm:gap-3">
                  <span className="text-xs font-bold text-muted">
                    #{holdings.length - i}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {h.ticker}
                    </p>
                    <p className="max-w-[100px] truncate text-xs text-muted sm:max-w-[120px]">
                      {h.company_name}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p
                    className={`text-sm font-medium ${
                      h.gainLossPercent >= 0 ? "text-gain" : "text-loss"
                    }`}
                  >
                    {formatPercent(h.gainLossPercent)}
                  </p>
                  <p
                    className={`text-xs ${
                      h.gainLoss >= 0 ? "text-gain" : "text-loss"
                    }`}
                  >
                    {formatCurrency(h.gainLoss)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sector Breakdown Table */}
      <div className="glass-card overflow-hidden">
        <div className="border-b border-card-border px-4 py-4 sm:px-6">
          <h2 className="text-lg font-semibold text-foreground">
            Sector Breakdown
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-card-border text-left text-xs uppercase tracking-wider text-muted">
                <th className="px-4 py-3 font-medium sm:px-6">Sector</th>
                <th className="px-3 py-3 font-medium text-right sm:px-4">Weight</th>
                <th className="hidden px-3 py-3 font-medium text-right sm:table-cell sm:px-4">Value</th>
                <th className="hidden px-3 py-3 font-medium text-right md:table-cell sm:px-4">
                  # Holdings
                </th>
                <th className="hidden px-3 py-3 font-medium lg:table-cell sm:px-4">
                  Tickers
                </th>
              </tr>
            </thead>
            <tbody>
              {sectorAllocations.map((sector) => (
                <tr
                  key={sector.sector}
                  className="border-b border-card-border/50 transition-colors hover:bg-card-glass"
                >
                  <td className="px-4 py-3 sm:px-6 sm:py-4">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div
                        className="h-3 w-3 shrink-0 rounded-sm"
                        style={{
                          backgroundColor:
                            SECTOR_COLORS[sector.sector as GICSSector] || "#666",
                        }}
                      />
                      <span className="text-xs font-medium text-foreground sm:text-sm">
                        {sector.sector}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right sm:px-4 sm:py-4">
                    <div className="flex items-center justify-end gap-2">
                      <div className="hidden h-1.5 w-12 overflow-hidden rounded-full bg-card-border sm:block sm:w-16">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(sector.weight, 100)}%`,
                            backgroundColor:
                              SECTOR_COLORS[sector.sector as GICSSector] ||
                              "#666",
                          }}
                        />
                      </div>
                      <span className="text-xs font-medium text-foreground sm:text-sm">
                        {sector.weight.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  <td className="hidden px-3 py-3 text-right text-xs text-muted sm:table-cell sm:px-4 sm:py-4 sm:text-sm">
                    {formatCurrency(sector.value)}
                  </td>
                  <td className="hidden px-3 py-3 text-right text-xs text-muted md:table-cell sm:px-4 sm:py-4 sm:text-sm">
                    {sector.holdingsCount}
                  </td>
                  <td className="hidden max-w-[250px] truncate px-3 py-3 text-xs text-muted lg:table-cell sm:px-4 sm:py-4 sm:text-sm">
                    {sector.tickers.join(", ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
