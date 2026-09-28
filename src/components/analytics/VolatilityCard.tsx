"use client";

import { useId, useState } from "react";
import { Activity, ChevronDown, History, Scale } from "lucide-react";
import type { AnalyticsPayload } from "@/types/analytics";
import { Section, Stat } from "./Section";
import { pct, money, shortDate } from "./format";

/** Local-date parse, matching shortDate, so no UTC shift moves a day. */
function dayMs(iso: string): number {
  return new Date(`${iso.slice(0, 10)}T00:00:00`).getTime();
}

/**
 * Share of the measurement window (by calendar time) that falls BEFORE the
 * switch to index funds, or null when the switch isn't inside the window.
 */
function shareBeforeRebuild(
  from: string,
  to: string,
  rebuildDate: string | null
): number | null {
  if (!rebuildDate) return null;
  const start = dayMs(from);
  const end = dayMs(to);
  const rebuild = dayMs(rebuildDate);
  if (!(end > start) || rebuild <= start || rebuild > end) return null;
  return (rebuild - start) / (end - start);
}

/**
 * Annualised volatility — the only risk statistic the page keeps, because it
 * is the only one with a tolerable error bar at this length of history.
 * Collapsed by default: it's context, not a scorecard.
 */
export function VolatilityCard({
  volatility,
  rebuildDate,
}: {
  volatility: AnalyticsPayload["volatility"];
  rebuildDate: string | null;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  const before = volatility
    ? shareBeforeRebuild(volatility.from, volatility.to, rebuildDate)
    : null;

  return (
    <Section
      icon={Activity}
      title="Volatility"
      subtitle="How much the fund's value swings — context, not a score."
      info="volatility"
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg bg-highlight px-4 py-3 text-left text-sm font-medium text-foreground transition-colors hover:text-gold"
      >
        <span>How bumpy is the ride?</span>
        <ChevronDown
          aria-hidden
          className={`h-4 w-4 flex-shrink-0 text-muted transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      <div id={panelId} hidden={!open} className="mt-4 space-y-4">
        {volatility ? (
          <>
            <Stat
              label="Annualised volatility"
              value={`${pct(volatility.annualized)} a year`}
              sub={
                <span className="tabular-nums">
                  measured over {volatility.observations.toLocaleString("en-US")} trading
                  days ({shortDate(volatility.from)} – {shortDate(volatility.to)})
                </span>
              }
            />

            <p className="text-sm leading-relaxed text-muted">
              Rough guide: on every $1,000 invested, a typical year&apos;s swing
              works out to about{" "}
              <span className="tabular-nums text-foreground">
                ±{money(1000 * volatility.annualized, 0)}
              </span>
              . That&apos;s an estimate from how the fund has moved so far, not a
              forecast — and a bumpier ride doesn&apos;t mean a worse result.
            </p>

            {before !== null && rebuildDate && (
              <div className="flex gap-3 rounded-lg border border-card-border p-3">
                <History aria-hidden className="mt-0.5 h-4 w-4 flex-shrink-0 text-gold" />
                <p className="text-xs leading-relaxed text-muted">
                  The fund switched from picking individual stocks to index funds
                  on{" "}
                  <span className="tabular-nums text-foreground">
                    {shortDate(rebuildDate)}
                  </span>
                  .{" "}
                  {before >= 0.5 ? (
                    <>
                      Most of this window (about{" "}
                      <span className="tabular-nums">{pct(before, 0)}</span> of it)
                      describes the old stock-picking portfolio
                    </>
                  ) : (
                    <>
                      Part of this window (about{" "}
                      <span className="tabular-nums">{pct(before, 0)}</span> of it)
                      still describes the old stock-picking portfolio
                    </>
                  )}
                  , so this figure likely overstates how bumpy the fund&apos;s
                  current holdings are. It becomes a meaningful measure of the
                  index portfolio after several more months of data.
                </p>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm leading-relaxed text-muted">
            There isn&apos;t enough daily price history yet to measure this
            reliably. It will appear once the fund has a few more weeks of
            daily values.
          </p>
        )}

        <div className="flex gap-3 rounded-lg bg-highlight p-3">
          <Scale aria-hidden className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted" />
          <p className="text-xs leading-relaxed text-muted">
            <span className="font-medium text-foreground">
              Why no other risk ratios?
            </span>{" "}
            Ratios like Sharpe try to score return against risk, but{" "}
            {volatility ? (
              <>
                <span className="tabular-nums">
                  {volatility.observations.toLocaleString("en-US")}
                </span>{" "}
                days of history
              </>
            ) : (
              "this little history"
            )}{" "}
            is far too little to pin them down — the margin of error would be
            bigger than the number itself. So they&apos;re left out on purpose.
          </p>
        </div>
      </div>
    </Section>
  );
}
