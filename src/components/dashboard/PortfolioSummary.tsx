"use client";

import { useState, useCallback } from "react";
import useSWR from "swr";
import { TrendingUp, TrendingDown } from "lucide-react";
import { formatCurrency, formatPercent } from "@/lib/calculations";
import { FundValueChart } from "@/components/charts/FundValueChart";
import { GBHIcon } from "@/components/icons/GBHIcon";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const PERIODS = [
  { label: "1M", value: "1mo" },
  { label: "3M", value: "3mo" },
  { label: "1Y", value: "1y" },
  { label: "All", value: "max" },
] as const;

interface Props {
  totalValue: number;
  totalCost: number;
  totalGainLoss: number;
  totalGainLossPercent: number;
  totalDayChange: number;
  totalDayChangePercent: number;
  holdingsCount: number;
  cashBalance?: number;
}

export function PortfolioSummary({
  totalValue,
  totalCost,
  totalGainLoss,
  totalGainLossPercent,
  totalDayChange,
  totalDayChangePercent,
  holdingsCount,
  cashBalance = 0,
}: Props) {
  const [period, setPeriod] = useState("max");
  const [hoveredValue, setHoveredValue] = useState<number | null>(null);
  const [hoveredTime, setHoveredTime] = useState<string | null>(null);

  const { data: chartData } = useSWR(
    `/api/portfolio/value-history?period=${period}`,
    fetcher,
    { refreshInterval: 5 * 60 * 1000 }
  );

  const { data: navData } = useSWR("/api/portfolio/nav", fetcher, {
    refreshInterval: 5 * 60 * 1000,
  });

  const isPositive = totalGainLoss >= 0;
  const isDayPositive = totalDayChange >= 0;
  const investmentsValue = totalValue - cashBalance;

  // Chart data
  const points = chartData?.points || [];
  const firstValue = points.length > 0 ? points[0].value : totalValue;
  const chartIsPositive = totalValue >= firstValue;

  // Handle crosshair hover
  const handleCrosshairMove = useCallback(
    (value: number | null, time: string | null) => {
      setHoveredValue(value);
      setHoveredTime(time);
    },
    []
  );

  // When hovering: show change from first value in period to hovered point
  // When not hovering: show today's day change
  const isHovering = hoveredValue !== null;

  const displayValue = hoveredValue ?? totalValue;

  const displayChange = isHovering
    ? (hoveredValue as number) - firstValue
    : totalDayChange;

  const displayChangePercent = isHovering
    ? firstValue > 0
      ? (((hoveredValue as number) - firstValue) / firstValue) * 100
      : 0
    : totalDayChangePercent;

  const displayIsPositive = isHovering
    ? (hoveredValue as number) >= firstValue
    : isDayPositive;

  const displayLabel = isHovering
    ? formatDateLabel(hoveredTime)
    : "Today";

  const nav = navData?.nav || 0;

  return (
    <div className="glass-card overflow-hidden">
      {/* Card Header */}
      <div className="flex items-center gap-2 border-b border-card-border/40 px-5 py-3 sm:px-6">
        <GBHIcon className="h-4 w-4 text-gold" />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted">
          Account Overview
        </span>
      </div>

      {/* Hero Section */}
      <div className="px-5 pt-4 sm:px-6 sm:pt-5">
        <p className="text-xs tracking-wide text-muted sm:text-sm">
          Total Account Value
        </p>
        <p className="mt-0.5 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {formatCurrency(displayValue)}
        </p>
        <div className="mt-1.5 flex items-center gap-1.5">
          {displayIsPositive ? (
            <TrendingUp className="h-3.5 w-3.5 text-gain" />
          ) : (
            <TrendingDown className="h-3.5 w-3.5 text-loss" />
          )}
          <span
            className={`text-sm font-medium ${
              displayIsPositive ? "text-gain" : "text-loss"
            }`}
          >
            {displayChange >= 0 ? "+" : ""}
            {formatCurrency(displayChange)} (
            {formatPercent(displayChangePercent)})
          </span>
          <span className="text-sm text-muted">{displayLabel}</span>
        </div>
      </div>

      {/* Chart — edge-to-edge */}
      <div className="mt-3 px-1">
        <FundValueChart
          data={points}
          isPositive={chartIsPositive}
          onCrosshairMove={handleCrosshairMove}
        />
      </div>

      {/* Period Selector */}
      <div className="flex items-center gap-1.5 px-5 pb-1 pt-1 sm:gap-2 sm:px-6">
        {PERIODS.map((p) => (
          <button
            key={p.value}
            onClick={() => setPeriod(p.value)}
            className={`rounded-full px-3.5 py-1 text-xs font-medium transition-all sm:px-4 sm:py-1.5 sm:text-sm ${
              period === p.value
                ? "bg-gold/20 text-gold"
                : "text-muted hover:text-foreground"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Stats Row 1 */}
      <div className="mt-2 border-t border-card-border/40 px-5 py-3.5 sm:px-6 sm:py-4">
        <div className="grid grid-cols-4 gap-3 sm:gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted sm:text-xs">
              NAV/Unit
            </p>
            <p className="mt-0.5 text-sm font-semibold text-foreground sm:text-base">
              {nav > 0 ? `$${nav.toFixed(2)}` : "—"}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted sm:text-xs">
              Investments
            </p>
            <p className="mt-0.5 text-sm font-semibold text-foreground sm:text-base">
              {formatCurrency(investmentsValue)}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted sm:text-xs">
              Cost Basis
            </p>
            <p className="mt-0.5 text-sm font-semibold text-foreground sm:text-base">
              {formatCurrency(totalCost)}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted sm:text-xs">
              Total Return
            </p>
            <p
              className={`mt-0.5 text-sm font-semibold sm:text-base ${
                isPositive ? "text-gain" : "text-loss"
              }`}
            >
              {formatPercent(totalGainLossPercent)}
            </p>
          </div>
        </div>
      </div>

      {/* Stats Row 2 */}
      <div className="border-t border-card-border/20 px-5 py-3.5 sm:px-6 sm:py-4">
        <div className="grid grid-cols-4 gap-3 sm:gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted sm:text-xs">
              Cash
            </p>
            <p className="mt-0.5 text-sm font-semibold text-foreground sm:text-base">
              {formatCurrency(cashBalance)}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted sm:text-xs">
              Total Gain/Loss
            </p>
            <p
              className={`mt-0.5 text-sm font-semibold sm:text-base ${
                isPositive ? "text-gain" : "text-loss"
              }`}
            >
              {totalGainLoss >= 0 ? "+" : ""}
              {formatCurrency(totalGainLoss)}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted sm:text-xs">
              Day Change
            </p>
            <p
              className={`mt-0.5 text-sm font-semibold sm:text-base ${
                isDayPositive ? "text-gain" : "text-loss"
              }`}
            >
              {totalDayChange >= 0 ? "+" : ""}
              {formatCurrency(totalDayChange)}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted sm:text-xs">
              Holdings
            </p>
            <p className="mt-0.5 text-sm font-semibold text-foreground sm:text-base">
              {holdingsCount}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatDateLabel(timeStr: string | null): string {
  if (!timeStr) return "Today";

  // Check if this is today's date in EST
  const todayEST = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/New_York",
  });
  if (timeStr === todayEST) return "Today";

  // Parse YYYY-MM-DD components directly to avoid timezone shifting
  const [yearStr, monthStr, dayStr] = timeStr.split("-");
  const year = parseInt(yearStr);
  const month = parseInt(monthStr) - 1; // JS months are 0-indexed
  const day = parseInt(dayStr);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return "Today";

  // Construct as UTC to avoid any local timezone offset shifting the day
  const date = new Date(Date.UTC(year, month, day));
  if (isNaN(date.getTime())) return "Today";

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC", // Display in UTC since we constructed in UTC
  });
}
