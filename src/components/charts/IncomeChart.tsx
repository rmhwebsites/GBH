"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { Coins } from "lucide-react";
import { useTheme } from "@/components/providers/ThemeProvider";
import { getChartTheme } from "@/lib/chartTheme";
import { formatCurrency } from "@/lib/calculations";
import type { MonthlyIncome } from "@/lib/dividends";

// Distinct enough to tell apart in a stack, and stable per fund
const SERIES_COLORS = [
  "#CE9C5C", "#5CA0CE", "#7FB069", "#C97B84", "#9B8AC4", "#8C9BB0", "#6BAFA0",
];

interface Props {
  months: MonthlyIncome[];
  annualTotal: number;
  yieldPercent: number;
  nonPaying: string[];
  nextPayment: { month: string; label: string; amount: number } | null;
}

/**
 * Projected dividend income for the next 12 months.
 *
 * Forward-looking rather than historical: these positions were bought
 * recently, so past receipts describe a portfolio the fund did not own.
 *
 * Deliberately a monthly bar chart rather than an average — distributions are
 * quarterly and seasonal, and that shape is the useful information.
 */
export function IncomeChart({
  months,
  annualTotal,
  yieldPercent,
  nonPaying,
  nextPayment,
}: Props) {
  const { resolvedTheme } = useTheme();
  const colors = getChartTheme(resolvedTheme);

  // Every ticker that paid anything in the window, biggest contributor first
  const totals = new Map<string, number>();
  for (const m of months) {
    for (const [t, v] of Object.entries(m.byTicker)) {
      totals.set(t, (totals.get(t) || 0) + v);
    }
  }
  const tickers = [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([t]) => t);

  const data = months.map((m) => ({
    label: m.label,
    ...Object.fromEntries(tickers.map((t) => [t, m.byTicker[t] || 0])),
    __total: m.total,
  }));

  if (annualTotal <= 0) {
    return (
      <div className="glass-card p-5 sm:p-6">
        <div className="mb-2 flex items-center gap-2">
          <Coins className="h-4 w-4 text-gold" />
          <h2 className="text-lg font-semibold text-foreground">
            Income over the next 12 months
          </h2>
        </div>
        <p className="text-sm text-muted">
          None of the current holdings pay a distribution.
        </p>
      </div>
    );
  }

  return (
    <div className="glass-card p-5 sm:p-6">
      <div className="mb-1 flex items-center gap-2">
        <Coins className="h-4 w-4 text-gold" />
        <h2 className="text-lg font-semibold text-foreground">
          Income over the next 12 months
        </h2>
      </div>
      <p className="mb-4 text-xs text-muted">
        What today&apos;s holdings are expected to pay over the coming year.
        Funds distribute quarterly, so income arrives in steps rather than
        evenly.
      </p>

      <div className="mb-5 grid grid-cols-3 gap-3">
        <div>
          <p className="text-xs text-muted">Next 12 months</p>
          <p className="text-lg font-semibold tabular-nums text-foreground">
            {formatCurrency(annualTotal)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted">Yield on investments</p>
          <p className="text-lg font-semibold tabular-nums text-gold">
            {yieldPercent.toFixed(2)}%
          </p>
        </div>
        <div>
          <p className="text-xs text-muted">Next payment</p>
          <p className="text-lg font-semibold tabular-nums text-foreground">
            {nextPayment ? formatCurrency(nextPayment.amount) : "\u2014"}
            {nextPayment && (
              <span className="block text-xs font-normal text-muted sm:ml-1 sm:inline">
                {nextPayment.label}
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="h-56 sm:h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={colors.gridColor} vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: colors.textColorSubtle, fontSize: 11 }}
              axisLine={{ stroke: colors.borderColor }}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fill: colors.textColorSubtle, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `$${v}`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: colors.tooltipBg,
                border: `1px solid ${colors.tooltipBorder}`,
                borderRadius: "8px",
                fontSize: "12px",
              }}
              itemStyle={{ color: colors.tooltipText }}
              labelStyle={{ color: colors.tooltipText, fontWeight: 600 }}
              cursor={{ fill: "rgba(206, 156, 92, 0.08)" }}
              formatter={(value, name) => [
                formatCurrency(Number(value) || 0),
                String(name),
              ]}
            />
            {tickers.map((t, i) => (
              <Bar
                key={t}
                dataKey={t}
                stackId="income"
                fill={SERIES_COLORS[i % SERIES_COLORS.length]}
                radius={i === tickers.length - 1 ? [4, 4, 0, 0] : undefined}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5">
        {tickers.map((t, i) => (
          <div key={t} className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: SERIES_COLORS[i % SERIES_COLORS.length] }}
            />
            <span className="text-xs text-foreground">{t}</span>
            <span className="text-xs text-muted">
              {formatCurrency(totals.get(t) || 0)}
            </span>
          </div>
        ))}
      </div>

      {nonPaying.length > 0 && (
        <p className="mt-3 text-xs text-muted">
          No distribution from {nonPaying.join(", ")}.
        </p>
      )}
      <p className="mt-2 text-xs text-muted/70">
        Each month is projected from that fund&apos;s most recent distribution
        for the same month of the year, at current share counts &mdash; so
        seasonal differences are preserved. Distributions are not guaranteed
        and actual amounts will differ.
      </p>
    </div>
  );
}
