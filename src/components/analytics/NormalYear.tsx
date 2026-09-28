"use client";

import { useState, type ReactNode } from "react";
import { Waves } from "lucide-react";
import type { AnalyticsPayload } from "@/types/analytics";
import { Section, InfoButton, Explainer } from "@/components/analytics/Section";
import { pct, money, shortDate } from "@/components/analytics/format";

type Drawdown = AnalyticsPayload["drawdown"];
type Downside = AnalyticsPayload["downside"];

/**
 * "What a normal year looks like" — frames swings before members meet them.
 * First the fall the fund has already lived through, then what a market fall
 * would mean at today's mix of cash and investments. Everything here is read
 * straight from the props; no historical statistics are invented.
 */

function Figure({ children }: { children: ReactNode }) {
  return <span className="font-semibold tabular-nums">{children}</span>;
}

function SurvivedFall({ drawdown: d }: { drawdown: Drawdown }) {
  const [open, setOpen] = useState(false);

  let body: ReactNode;
  if (d === null) {
    body = (
      <p className="mt-1 text-sm leading-relaxed text-muted">
        There isn&apos;t enough price history yet to measure the fund&apos;s biggest fall. It
        will show here once the fund has a few days of unit prices.
      </p>
    );
  } else if (Math.abs(d.maxDrawdown) < 0.0005) {
    body = (
      <p className="mt-1 text-sm leading-relaxed text-foreground">
        The fund hasn&apos;t had a fall from a high point yet in its recorded history. Every
        investment that grows has them, so expect one.
      </p>
    );
  } else {
    const rec = Math.max(0, d.recovered);
    const tail: ReactNode =
      rec >= 0.995 ? (
        <>and has since recovered all of it.</>
      ) : rec < 0.005 ? (
        <>and is still close to that low today.</>
      ) : (
        <>
          and has since recovered <Figure>{pct(rec, 0)}</Figure> of that fall.
        </>
      );
    const atHigh = d.belowHigh > -0.0005;

    body = (
      <>
        <p className="mt-1 text-sm leading-relaxed text-foreground">
          The fund fell <Figure>{pct(Math.abs(d.maxDrawdown))}</Figure> between{" "}
          <span className="tabular-nums">{shortDate(d.peakDate)}</span> and{" "}
          <span className="tabular-nums">{shortDate(d.troughDate)}</span> — {tail}
        </p>

        <div className="mt-4" aria-hidden="true">
          <div className="h-2 overflow-hidden rounded-full bg-card-border">
            <div
              className="h-full rounded-full bg-gold"
              style={{ width: `${Math.min(1, rec) * 100}%` }}
            />
          </div>
          <div className="mt-1.5 flex justify-between gap-3 text-[11px] text-muted">
            <span>The low</span>
            <span className="text-right">Back to the old high</span>
          </div>
        </div>

        <p className="mt-3 text-xs leading-relaxed text-muted">
          {atHigh ? (
            <>
              Today the fund is at its highest point so far, set on{" "}
              <span className="tabular-nums">{shortDate(d.allTimeHighDate)}</span>.
            </>
          ) : (
            <>
              Today the fund is{" "}
              <span className="tabular-nums">{pct(Math.abs(d.belowHigh))}</span> below its
              highest point, set on{" "}
              <span className="tabular-nums">{shortDate(d.allTimeHighDate)}</span>.
            </>
          )}
        </p>
      </>
    );
  }

  return (
    <div className="rounded-xl border border-card-border bg-highlight p-4">
      <div className="flex items-center gap-0.5">
        <h3 className="text-sm font-semibold text-foreground">The biggest fall so far</h3>
        <InfoButton open={open} onToggle={() => setOpen(!open)} label="biggest fall" />
      </div>
      {open && <Explainer term="drawdown" />}
      {body}
    </div>
  );
}

function DownsideTable({ downside }: { downside: Downside }) {
  const { equityWeight, scenarios } = downside;
  if (scenarios.length === 0) return null;
  const cashShare = Math.max(0, 1 - equityWeight);
  const hasCash = cashShare >= 0.0005;

  return (
    <div className="mt-6">
      <h3 className="text-sm font-semibold text-foreground">
        What a market fall would mean today
      </h3>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-card-border text-xs text-muted">
              <th scope="col" className="pb-2 pr-3 text-left align-bottom font-medium">
                If the stock market falls
              </th>
              <th scope="col" className="pb-2 pr-3 text-right align-bottom font-medium">
                The fund would fall
              </th>
              <th scope="col" className="pb-2 text-right align-bottom font-medium">
                On a {money(1000, 0)} stake
              </th>
            </tr>
          </thead>
          <tbody>
            {scenarios.map((s) => (
              <tr key={s.marketFall} className="border-b border-card-border last:border-0">
                <th
                  scope="row"
                  className="py-2.5 pr-3 text-left font-medium tabular-nums text-foreground"
                >
                  {pct(s.marketFall, 0)}
                </th>
                <td className="py-2.5 pr-3 text-right tabular-nums text-foreground">
                  {pct(s.fundFall)}
                </td>
                <td className="py-2.5 text-right tabular-nums text-foreground">
                  {s.per1000 >= 0.5 ? `−${money(s.per1000, 0)}` : money(0, 0)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-muted">
        {hasCash ? (
          <>
            Why less than the market?{" "}
            <span className="font-semibold tabular-nums text-foreground">{pct(cashShare)}</span>{" "}
            of the fund is cash, which doesn&apos;t fall — only the other{" "}
            <span className="tabular-nums">{pct(equityWeight)}</span> is invested. Once the cash
            is invested, the fund will move much closer to the market.
          </>
        ) : (
          <>The fund is fully invested, so it moves much like the market does.</>
        )}{" "}
        This is exact arithmetic on today&apos;s mix of cash and investments, not a forecast: it
        treats the invested part as moving in step with the market.
      </p>
    </div>
  );
}

export function NormalYear({
  drawdown,
  downside,
}: {
  drawdown: AnalyticsPayload["drawdown"];
  downside: AnalyticsPayload["downside"];
}) {
  const hasSurvivedFall = drawdown !== null && Math.abs(drawdown.maxDrawdown) >= 0.0005;
  return (
    <Section
      icon={Waves}
      title="What a normal year looks like"
      subtitle={
        hasSurvivedFall
          ? "Falls are a normal part of owning stocks. Here is one the fund has already been through, and what a market fall would mean at today's mix."
          : "Falls are a normal part of owning stocks. Here is what a market fall would mean at today's mix."
      }
    >
      <SurvivedFall drawdown={drawdown} />
      <DownsideTable downside={downside} />
    </Section>
  );
}
