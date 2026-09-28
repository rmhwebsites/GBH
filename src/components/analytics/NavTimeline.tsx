"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  createChart,
  createSeriesMarkers,
  ColorType,
  LineSeries,
  type IChartApi,
  type SeriesMarker,
  type Time,
} from "lightweight-charts";
import { ChartLine } from "lucide-react";
import type { NavPoint } from "@/lib/analytics";
import type { AnalyticsPayload } from "@/types/analytics";
import { useTheme, type ResolvedTheme } from "@/components/providers/ThemeProvider";
import { getChartTheme } from "@/lib/chartTheme";
import { Section, Stat } from "./Section";
import { money, pct, shortDate, signedPct } from "./format";

type PeriodKey = "3m" | "switch" | "all";

/** The fund's own line — always this gold. */
const GOLD = "#CE9C5C";

/**
 * Marker colours are data colours, picked per theme so the marker text stays
 * legible on both backgrounds. The drawdown is deliberately a calm grey, not
 * red: it is a past episode the fund came through, not an alarm.
 */
const MARKER_COLORS: Record<
  ResolvedTheme,
  { rebuild: string; contribution: string; drawdown: string }
> = {
  dark: { rebuild: GOLD, contribution: "#6FA0F0", drawdown: "#9AA6B8" },
  light: { rebuild: "#9A7434", contribution: "#2F6FD0", drawdown: "#5E6B7E" },
};

type MarkerKind = keyof (typeof MARKER_COLORS)["dark"];

interface MarkerSpec {
  date: string;
  kind: MarkerKind;
  text: string;
  position: "aboveBar" | "belowBar";
  shape: "arrowDown" | "arrowUp" | "circle";
}

/** "YYYY-MM-DD" three calendar months before `iso`, computed as a local date */
function monthsBefore(iso: string, months: number): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const dt = new Date(y, m - 1 - months, d);
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${dt.getFullYear()}-${mm}-${dd}`;
}

/** "2026-03-12" -> "Mar 2026" */
function monthYear(iso: string): string {
  return new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
}

/**
 * First date in `dates` (sorted ascending) that is on or after `target`.
 * Returns null when the target falls outside the visible range, so markers
 * for events before or after the window are skipped rather than piled up at
 * an edge.
 */
function snapToSeries(dates: string[], target: string): string | null {
  if (dates.length === 0) return null;
  const t = target.slice(0, 10);
  if (t < dates[0] || t > dates[dates.length - 1]) return null;
  let lo = 0;
  let hi = dates.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (dates[mid] < t) lo = mid + 1;
    else hi = mid;
  }
  return dates[lo];
}

export function NavTimeline({
  navSeries,
  rebuildDate,
  contributionDates,
  drawdown,
}: {
  navSeries: NavPoint[];
  rebuildDate: string | null;
  contributionDates: string[];
  drawdown: AnalyticsPayload["drawdown"];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const { resolvedTheme } = useTheme();
  const [selected, setSelected] = useState<PeriodKey>("all");

  // Sorted, one point per date, dates normalised to YYYY-MM-DD
  const series = useMemo(() => {
    const byDate = new Map<string, number>();
    for (const p of navSeries) {
      if (Number.isFinite(p.nav) && p.nav > 0) byDate.set(p.date.slice(0, 10), p.nav);
    }
    return [...byDate.entries()]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([date, nav]) => ({ date, nav }));
  }, [navSeries]);

  const firstDate = series[0]?.date ?? null;
  const lastDate = series[series.length - 1]?.date ?? null;

  // Only offer periods that have at least two points and differ from "all"
  const periods = useMemo(() => {
    if (!firstDate || !lastDate) return [];
    const list: { key: PeriodKey; label: string; start: string }[] = [];
    const threeMonthStart = monthsBefore(lastDate, 3);
    if (
      threeMonthStart > firstDate &&
      series.filter((p) => p.date >= threeMonthStart).length >= 2
    ) {
      list.push({ key: "3m", label: "3M", start: threeMonthStart });
    }
    if (rebuildDate) {
      const start = rebuildDate.slice(0, 10);
      if (series.filter((p) => p.date >= start).length >= 2) {
        list.push({ key: "switch", label: "Since switch", start });
      }
    }
    list.push({ key: "all", label: `Since ${monthYear(firstDate)}`, start: firstDate });
    return list;
  }, [series, firstDate, lastDate, rebuildDate]);

  const active = periods.find((p) => p.key === selected) ?? periods[periods.length - 1];

  const visible = useMemo(
    () => (active ? series.filter((p) => p.date >= active.start) : []),
    [series, active]
  );

  // Annotations, snapped onto dates that exist in the visible window
  const markerSpecs = useMemo<MarkerSpec[]>(() => {
    const dates = visible.map((p) => p.date);
    const specs: MarkerSpec[] = [];

    if (drawdown && drawdown.maxDrawdown < 0) {
      const peak = snapToSeries(dates, drawdown.peakDate);
      if (peak) {
        specs.push({
          date: peak,
          kind: "drawdown",
          text: `High before a ${signedPct(drawdown.maxDrawdown)} dip`,
          position: "aboveBar",
          shape: "circle",
        });
      }
      const trough = snapToSeries(dates, drawdown.troughDate);
      if (trough) {
        specs.push({
          date: trough,
          kind: "drawdown",
          text:
            drawdown.recovered >= 0.995
              ? "Low point, fully recovered since"
              : `Low point, ${pct(Math.max(0, drawdown.recovered), 0)} recovered since`,
          position: "belowBar",
          shape: "circle",
        });
      }
    }

    const seenContribution = new Set<string>();
    for (const d of contributionDates) {
      const at = snapToSeries(dates, d);
      if (!at || seenContribution.has(at)) continue;
      seenContribution.add(at);
      specs.push({
        date: at,
        kind: "contribution",
        text: "New contributions",
        position: "belowBar",
        shape: "arrowUp",
      });
    }

    if (rebuildDate) {
      const at = snapToSeries(dates, rebuildDate);
      if (at) {
        specs.push({
          date: at,
          kind: "rebuild",
          text: "Switched to index funds",
          position: "aboveBar",
          shape: "arrowDown",
        });
      }
    }

    return specs.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  }, [visible, drawdown, contributionDates, rebuildDate]);

  useEffect(() => {
    if (!containerRef.current || visible.length < 2) return;

    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const isMobile = window.innerWidth < 640;
    const colors = getChartTheme(resolvedTheme);
    const markerColors = MARKER_COLORS[resolvedTheme];

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: colors.textColorSubtle,
        fontFamily: "'Inter', 'Roboto', sans-serif",
        fontSize: isMobile ? 9 : 11,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: colors.gridColor, style: 1 },
      },
      crosshair: {
        vertLine: {
          color: colors.crosshairColor,
          width: 1,
          style: 0,
          labelVisible: false,
        },
        horzLine: {
          color: colors.crosshairColor,
          width: 1,
          style: 2,
          labelVisible: true,
          labelBackgroundColor: GOLD,
        },
      },
      rightPriceScale: {
        visible: true,
        borderVisible: false,
        scaleMargins: { top: 0.15, bottom: 0.15 },
      },
      timeScale: {
        borderVisible: false,
        fixLeftEdge: true,
        fixRightEdge: true,
        timeVisible: false,
      },
      handleScroll: { mouseWheel: false, pressedMouseMove: true },
      handleScale: false,
      width: containerRef.current.clientWidth,
      height: isMobile ? 280 : 360,
    });

    chartRef.current = chart;

    const line = chart.addSeries(LineSeries, {
      color: GOLD,
      lineWidth: 2,
      lineType: 2,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 5,
      crosshairMarkerBorderColor: GOLD,
      crosshairMarkerBackgroundColor: colors.tooltipBg,
      crosshairMarkerBorderWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
      priceFormat: { type: "price", precision: 3, minMove: 0.001 },
    });

    line.setData(visible.map((p) => ({ time: p.date, value: p.nav })));

    // On phones the labels clip at the chart edges and run into each other, so
    // markers are shape + colour only there; the legend below carries the words.
    const markers: SeriesMarker<Time>[] = markerSpecs.map((m) => ({
      time: m.date,
      position: m.position,
      shape: m.shape,
      color: markerColors[m.kind],
      text: isMobile ? "" : m.text,
    }));
    createSeriesMarkers(line, markers);

    chart.timeScale().fitContent();

    const handleResize = () => {
      if (containerRef.current && chartRef.current) {
        const newIsMobile = window.innerWidth < 640;
        chartRef.current.applyOptions({
          width: containerRef.current.clientWidth,
          height: newIsMobile ? 280 : 360,
        });
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [visible, markerSpecs, resolvedTheme]);

  const title = "Price of one unit";
  const subtitle =
    "What one unit of the fund is worth over time. The markers show when the fund changed and when members added money.";

  if (series.length < 2 || !active || !firstDate) {
    return (
      <Section icon={ChartLine} title={title} subtitle={subtitle} info="nav">
        <div className="flex h-[280px] items-center justify-center sm:h-[360px]">
          <p className="text-xs text-muted">Not enough unit-price history to draw a chart yet.</p>
        </div>
      </Section>
    );
  }

  const markerColors = MARKER_COLORS[resolvedTheme];
  const shownKinds = new Set(markerSpecs.map((m) => m.kind));

  const start = visible[0];
  const latest = visible[visible.length - 1];
  const change = start && latest && start.nav > 0 ? latest.nav / start.nav - 1 : 0;
  const changeLabel =
    active.key === "3m"
      ? "Change over 3 months"
      : active.key === "switch"
        ? "Change since the switch"
        : `Change since ${monthYear(firstDate)}`;

  return (
    <Section icon={ChartLine} title={title} subtitle={subtitle} info="nav">
      <div className="grid grid-cols-2 gap-4">
        <Stat
          label="Latest unit price"
          value={money(latest.nav, 3)}
          sub={<span className="tabular-nums">as of {shortDate(latest.date)}</span>}
        />
        <Stat
          label={changeLabel}
          value={signedPct(change)}
          sub={
            <span className="tabular-nums">
              from {money(start.nav, 3)} on {shortDate(start.date)}
            </span>
          }
          info="navReturn"
        />
      </div>

      {/* Period selector — full width on phones, compact on larger screens */}
      {periods.length > 1 && (
        <div
          className="mt-4 grid gap-1 rounded-xl bg-highlight p-1 sm:inline-grid"
          style={{ gridTemplateColumns: `repeat(${periods.length}, minmax(0, 1fr))` }}
          role="group"
          aria-label="Chart period"
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
      )}

      <div
        ref={containerRef}
        className="mt-4 w-full"
        style={{ touchAction: "pan-y" }}
        role="img"
        aria-label={`Line chart of the price of one unit from ${shortDate(start.date)} to ${shortDate(latest.date)}, ${signedPct(change)} over the period.`}
      />

      {markerSpecs.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted" aria-label="Chart markers">
          {shownKinds.has("rebuild") && (
            <li className="flex items-center gap-1.5">
              <span aria-hidden style={{ color: markerColors.rebuild }}>▼</span>
              Switched to index funds
            </li>
          )}
          {shownKinds.has("contribution") && (
            <li className="flex items-center gap-1.5">
              <span aria-hidden style={{ color: markerColors.contribution }}>▲</span>
              New contributions
            </li>
          )}
          {shownKinds.has("drawdown") && drawdown && (
            <li className="flex items-center gap-1.5">
              <span aria-hidden style={{ color: markerColors.drawdown }}>●</span>
              <span>
                Biggest dip, high and low (
                <span className="tabular-nums">{signedPct(drawdown.maxDrawdown)}</span>
                {drawdown.recovered >= 0.995 ? (
                  ", fully recovered"
                ) : (
                  <>
                    , <span className="tabular-nums">{pct(Math.max(0, drawdown.recovered), 0)}</span>{" "}
                    recovered
                  </>
                )}
                )
              </span>
            </li>
          )}
        </ul>
      )}

      <p className="mt-2 text-xs text-muted">
        History begins <span className="tabular-nums">{shortDate(firstDate)}</span>. The fund
        started earlier, but its unit prices from before then aren&apos;t recorded here.
      </p>
    </Section>
  );
}
