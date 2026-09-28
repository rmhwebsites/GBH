"use client";

import { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { Globe } from "lucide-react";
import { useTheme } from "@/components/providers/ThemeProvider";
import { getChartTheme } from "@/lib/chartTheme";
import type { AnalyticsPayload, ComparisonSeries } from "@/types/analytics";
import { Section } from "./Section";
import { pct, signedPct, shortDate } from "./format";

type PeriodKey = "3m" | "rebuild" | "all";

/** The fund's own line is always gold. */
const FUND_COLOR = "#CE9C5C";
/** The yardstick is a neutral slate — present, but never the hero. */
const BENCH_COLOR = { light: "#6B7A90", dark: "#A3AFC2" } as const;

/** Periods shorter than this are called out as too short to judge anything. */
const SHORT_PERIOD_DAYS = 120;

/** "Sep 18, 2026" -> "Sep 18" for axis ticks */
function tickDate(iso: string): string {
  return shortDate(iso).replace(/, \d{4}$/, "");
}

/** "Mar 5, 2026" -> "Mar 2026" for the tab label */
function monthYear(iso: string): string {
  return shortDate(iso).replace(/ \d{1,2},/, "");
}

function daysBetween(a: string, b: string): number {
  return Math.round(
    (new Date(`${b.slice(0, 10)}T00:00:00`).getTime() -
      new Date(`${a.slice(0, 10)}T00:00:00`).getTime()) /
      86400000
  );
}

/**
 * The fund's unit price (NAV) next to the whole world stock market, both
 * indexed to 100 on the same day. Replaces the old "vs S&P 500" chart and the
 * alpha tile: the result is stated in words, with no "beat the market" number
 * and no winner colouring — the point is context, not a scoreboard.
 */
export function ComparedToWhat({
  benchmark,
  cashPct,
}: {
  benchmark: AnalyticsPayload["benchmark"];
  cashPct: number;
}) {
  const { resolvedTheme } = useTheme();
  const colors = getChartTheme(resolvedTheme);
  const benchColor = BENCH_COLOR[resolvedTheme];
  const ticker = benchmark.ticker;

  const { comparison } = benchmark;
  const periods: { key: PeriodKey; label: string; series: ComparisonSeries }[] = [];
  if (comparison["3m"]) periods.push({ key: "3m", label: "3M", series: comparison["3m"] });
  if (comparison.rebuild)
    periods.push({ key: "rebuild", label: "Since switch", series: comparison.rebuild });
  if (comparison.all)
    periods.push({
      key: "all",
      label: `Since ${monthYear(comparison.all.startDate)}`,
      series: comparison.all,
    });

  const defaultKey: PeriodKey | null = comparison.rebuild
    ? "rebuild"
    : (periods[0]?.key ?? null);
  const [selected, setSelected] = useState<PeriodKey | null>(defaultKey);

  const title = "Compared with the world market";

  if (periods.length === 0 || !defaultKey) {
    return (
      <Section icon={Globe} title={title} info="benchmark">
        <p className="text-sm text-muted">
          There isn&apos;t enough price history yet to line the fund up against
          the world stock market. This comparison will appear once the fund has
          a few days of recorded unit prices.
        </p>
      </Section>
    );
  }

  const active =
    periods.find((p) => p.key === selected) ??
    periods.find((p) => p.key === defaultKey) ??
    periods[0];
  const s = active.series;

  // Both series are already indexed to 100 on s.startDate and share NAV dates
  const benchByDate = new Map(s.benchmark.map((p) => [p.date, p.value]));
  const data = s.fund.map((p) => ({
    date: p.date,
    fund: p.value,
    bench: benchByDate.get(p.date) ?? null,
  }));

  const values = data.flatMap((d) => (d.bench == null ? [d.fund] : [d.fund, d.bench]));
  const lo = Math.min(100, ...values);
  const hi = Math.max(100, ...values);
  const pad = Math.max(1, (hi - lo) * 0.1);
  const domain: [number, number] = [Math.floor(lo - pad), Math.ceil(hi + pad)];

  const lastDate = s.fund[s.fund.length - 1]?.date ?? s.startDate;
  const isShort = daysBetween(s.startDate, lastDate) < SHORT_PERIOD_DAYS;
  const showDots = data.length <= 20;

  return (
    <Section
      icon={Globe}
      title={title}
      info="benchmark"
      subtitle={`The fund's unit price (NAV) next to ${ticker}, one fund that holds the whole world's stock market.`}
    >
      {/* Period selector — full width on phones, compact on larger screens */}
      <div
        className="mb-4 grid gap-1 rounded-xl bg-highlight p-1 sm:inline-grid"
        style={{ gridTemplateColumns: `repeat(${periods.length}, minmax(0, 1fr))` }}
        role="group"
        aria-label="Comparison period"
      >
        {periods.map((p) => {
          const on = p.key === active.key;
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => setSelected(p.key)}
              aria-pressed={on}
              className={`min-h-11 rounded-lg px-2 text-xs font-medium leading-tight transition-colors sm:min-h-9 sm:px-3 ${
                on ? "bg-gold/15 text-gold" : "text-muted hover:text-foreground"
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-1.5">
        <div className="flex items-center gap-2">
          <span className="h-0.5 w-6 rounded-full bg-gold" />
          <span className="text-xs text-foreground">GBH Fund</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-0.5 w-6 rounded-full" style={{ backgroundColor: benchColor }} />
          <span className="text-xs text-foreground">
            {ticker} <span className="text-muted">· whole world market</span>
          </span>
        </div>
      </div>

      <div className="h-56 sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 6, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={colors.gridColor} vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={(v) => tickDate(String(v))}
              tick={{ fill: colors.textColorSubtle, fontSize: 11 }}
              axisLine={{ stroke: colors.borderColor }}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={28}
            />
            <YAxis
              domain={domain}
              allowDecimals={false}
              tickFormatter={(v) => Number(v).toFixed(0)}
              tick={{ fill: colors.textColorSubtle, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={44}
            />
            <ReferenceLine y={100} stroke={colors.borderColor} strokeDasharray="4 4" />
            <Tooltip
              contentStyle={{
                backgroundColor: colors.tooltipBg,
                border: `1px solid ${colors.tooltipBorder}`,
                borderRadius: "8px",
                fontSize: "12px",
                fontVariantNumeric: "tabular-nums",
              }}
              itemStyle={{ color: colors.tooltipText }}
              labelStyle={{ color: colors.tooltipText, fontWeight: 600 }}
              cursor={{ stroke: colors.crosshairColor }}
              labelFormatter={(label) => shortDate(String(label))}
              formatter={(value, name) => {
                const v = Number(value);
                return [`${v.toFixed(1)} (${signedPct(v / 100 - 1)})`, String(name)];
              }}
            />
            <Line
              type="monotone"
              dataKey="bench"
              name={ticker}
              stroke={benchColor}
              strokeWidth={1.75}
              dot={showDots ? { r: 2, strokeWidth: 0, fill: benchColor } : false}
              activeDot={{ r: 4 }}
              connectNulls
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="fund"
              name="GBH Fund"
              stroke={FUND_COLOR}
              strokeWidth={2.25}
              dot={showDots ? { r: 2, strokeWidth: 0, fill: FUND_COLOR } : false}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* The result, in words — no gap number, no winner */}
      <p className="mt-4 text-sm leading-relaxed text-foreground">
        Since {shortDate(s.startDate)} the fund returned{" "}
        <span className="font-semibold tabular-nums">{signedPct(s.fundReturn)}</span> and the
        world market returned{" "}
        <span className="font-semibold tabular-nums">{signedPct(s.benchmarkReturn)}</span>.
      </p>

      {cashPct > 0.1 && (
        <p className="mt-2 text-sm leading-relaxed text-muted">
          <span className="tabular-nums">{pct(cashPct, 0)}</span> of the fund is currently cash
          waiting to be invested, which pulls the fund&apos;s line toward flat — a timing effect,
          not a strategy result.
        </p>
      )}

      {isShort && (
        <p className="mt-2 text-sm leading-relaxed text-muted">
          A few weeks or months is far too short to judge an investing approach — over short
          spans, day-to-day market swings decide the result.
        </p>
      )}

      <p className="mt-3 text-xs leading-relaxed text-muted">
        Both lines start at 100 on the same day, {shortDate(s.startDate)}, so they can be read
        side by side. {ticker}&apos;s line includes its dividends reinvested, just as the
        fund&apos;s NAV includes the dividends the fund receives.
      </p>
    </Section>
  );
}
