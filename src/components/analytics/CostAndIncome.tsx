"use client";

import { Receipt } from "lucide-react";
import type { CostBreakdown } from "@/lib/analytics";
import type { IncomeSummary } from "@/lib/dividends";
import { IncomeChart } from "@/components/charts/IncomeChart";
import { Section, Stat } from "./Section";
import { pct, money } from "./format";

/** Bar width as a CSS percentage, clamped, with a sliver kept for tiny non-zero values. */
function barWidth(share: number): string {
  if (!(share > 0)) return "0%";
  return `${Math.min(100, Math.max(1, share * 100))}%`;
}

/**
 * One thin labelled bar. Colour tells the two measures apart (money vs fees);
 * it never says whether a fund is good or bad.
 */
function ShareBar({
  label,
  share,
  barClass,
}: {
  label: string;
  share: number;
  barClass: string;
}) {
  return (
    <div className="grid grid-cols-[2.75rem_minmax(0,1fr)_3.25rem] items-center gap-2">
      <span className="text-[11px] text-muted">{label}</span>
      <div className="h-1.5 overflow-hidden rounded-full bg-card-border" aria-hidden="true">
        <div className={`h-full rounded-full ${barClass}`} style={{ width: barWidth(share) }} />
      </div>
      <span className="text-right text-xs tabular-nums text-foreground">{pct(share)}</span>
    </div>
  );
}

/**
 * What the fund pays to own its investments, and the income those
 * investments are expected to pay back. Both are exact or clearly-labelled
 * estimates that don't depend on how long the fund has existed.
 */
export function CostAndIncome({
  costs,
  income,
}: {
  costs: CostBreakdown;
  income: IncomeSummary;
}) {
  // Same order as the rest of the page: by how much money is in each fund.
  const funds = [...costs.byFund].sort((a, b) => b.shareOfEquities - a.shareOfEquities);

  // Each fund's own yearly rate, recovered exactly from the shares:
  // rate = fundCost / fundValue = shareOfCost * ratioOfEquities / shareOfEquities
  const rateOf = (f: CostBreakdown["byFund"][number]) =>
    f.shareOfEquities > 0 ? (f.shareOfCost * costs.ratioOfEquities) / f.shareOfEquities : null;

  // Money held outside fee-charging funds (e.g. individual company shares)
  const inFunds = funds.reduce((s, f) => s + f.shareOfEquities, 0);
  const noFeeShare = Math.max(0, 1 - inFunds);

  // Teaching sentence: the biggest holding vs the fund whose fee share most
  // outweighs its money share.
  const biggest = funds[0] ?? null;
  const outsized =
    funds.length > 0
      ? funds.reduce((best, f) =>
          f.shareOfCost - f.shareOfEquities > best.shareOfCost - best.shareOfEquities ? f : best
        )
      : null;
  const showOutsized =
    outsized != null &&
    outsized.shareOfCost > outsized.shareOfEquities + 0.005 &&
    outsized.ticker !== biggest?.ticker;

  const compareMax = Math.max(costs.annualCost, costs.activeFundComparison);
  const saving = costs.activeFundComparison - costs.annualCost;

  const coverage =
    costs.annualCost > 0 && income.annualTotal > 0 ? income.annualTotal / costs.annualCost : null;

  return (
    <div className="space-y-6">
      <Section
        icon={Receipt}
        title="What it costs to own"
        subtitle="Every fund charges a small yearly fee, taken out automatically. These are exact figures from each fund's published fee rate."
      >
        {/* Part 1: the headline cost */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div className="col-span-2 sm:col-span-1">
            <Stat
              label="Fees per year"
              value={money(costs.annualCost)}
              sub={`${pct(costs.ratioOfEquities, 2)} of what's invested`}
              info="expenseRatio"
              tone="gold"
            />
          </div>
          <Stat label="Per member" value={money(costs.perMember)} sub="each year" />
          <Stat
            label="Typical 1% fund"
            value={money(costs.activeFundComparison)}
            sub="same money, actively managed"
          />
        </div>

        {compareMax > 0 && (
          <div className="mt-5 space-y-2">
            <div className="grid grid-cols-[6.5rem_minmax(0,1fr)_4.5rem] items-center gap-2">
              <span className="text-xs text-foreground">Our funds</span>
              <div className="h-2 overflow-hidden rounded-full bg-card-border" aria-hidden="true">
                <div
                  className="h-full rounded-full bg-gold"
                  style={{ width: barWidth(costs.annualCost / compareMax) }}
                />
              </div>
              <span className="text-right text-xs tabular-nums text-foreground">
                {money(costs.annualCost)}
              </span>
            </div>
            <div className="grid grid-cols-[6.5rem_minmax(0,1fr)_4.5rem] items-center gap-2">
              <span className="text-xs text-muted">Typical 1% fund</span>
              <div className="h-2 overflow-hidden rounded-full bg-card-border" aria-hidden="true">
                <div
                  className="h-full rounded-full bg-muted"
                  style={{ width: barWidth(costs.activeFundComparison / compareMax) }}
                />
              </div>
              <span className="text-right text-xs tabular-nums text-muted">
                {money(costs.activeFundComparison)}
              </span>
            </div>
            {saving > 0 && (
              <p className="pt-1 text-xs leading-relaxed text-muted">
                That&apos;s{" "}
                <span className="tabular-nums text-foreground">{money(saving)}</span> a year less
                than a typical actively managed fund would charge on the same money.
              </p>
            )}
          </div>
        )}

        {/* Teaching table: share of the money beside share of the fee bill */}
        <div className="mt-6 border-t border-card-border pt-5">
          <h3 className="text-sm font-semibold text-foreground">Where the fee bill comes from</h3>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            Each fund charges its own rate. Compare how much of the invested money (cash left
            out) sits in each fund with how much of the yearly fee bill it makes up.
          </p>

          {funds.length === 0 ? (
            <p className="mt-4 text-sm text-muted">None of the current holdings charge a fund fee.</p>
          ) : (
            <>
              <ul className="mt-4 space-y-4">
                {funds.map((f) => {
                  const rate = rateOf(f);
                  return (
                    <li key={f.ticker}>
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="min-w-0 truncate">
                          <span className="text-sm font-semibold text-foreground">{f.ticker}</span>
                          {rate != null && (
                            <span className="ml-2 text-xs tabular-nums text-muted">
                              {pct(rate, 2)} fee
                            </span>
                          )}
                        </p>
                        <p className="flex-shrink-0 text-sm tabular-nums text-foreground">
                          {money(f.annualCost)}
                          <span className="text-xs text-muted">/yr</span>
                        </p>
                      </div>
                      <div className="mt-1.5 space-y-1">
                        <ShareBar label="Money" share={f.shareOfEquities} barClass="bg-muted" />
                        <ShareBar label="Fees" share={f.shareOfCost} barClass="bg-gold" />
                      </div>
                    </li>
                  );
                })}
              </ul>

              {(showOutsized || biggest) && (
                <p className="mt-5 rounded-lg bg-highlight px-3 py-2 text-xs leading-relaxed text-muted">
                  {showOutsized && outsized && (
                    <>
                      <span className="font-semibold text-foreground">{outsized.ticker}</span> is{" "}
                      <span className="tabular-nums text-foreground">
                        {pct(outsized.shareOfEquities)}
                      </span>{" "}
                      of the invested money but{" "}
                      <span className="tabular-nums text-foreground">
                        {pct(outsized.shareOfCost)}
                      </span>{" "}
                      of the fees.{" "}
                    </>
                  )}
                  {biggest && (
                    <>
                      <span className="font-semibold text-foreground">{biggest.ticker}</span>, the
                      biggest holding, is{" "}
                      <span className="tabular-nums text-foreground">
                        {pct(biggest.shareOfEquities)}
                      </span>{" "}
                      of the invested money and{" "}
                      {biggest.shareOfCost < biggest.shareOfEquities ? "only " : ""}
                      <span className="tabular-nums text-foreground">
                        {pct(biggest.shareOfCost)}
                      </span>{" "}
                      of the fees.{" "}
                    </>
                  )}
                  Where the fee bill comes from depends on each fund&apos;s rate, not just how much
                  is in it.
                </p>
              )}

              {noFeeShare >= 0.001 && (
                <p className="mt-3 text-xs leading-relaxed text-muted">
                  The other <span className="tabular-nums">{pct(noFeeShare)}</span> of the invested
                  money isn&apos;t in a fee-charging fund (for example, individual company shares), so it
                  adds nothing to the bill.
                </p>
              )}
            </>
          )}
        </div>

        {/* Part 2: income, set against the fees — the chart below shows when it arrives */}
        {coverage != null && (
          <p className="mt-5 rounded-lg bg-highlight px-3 py-2.5 text-sm leading-relaxed text-muted">
            Estimated income over the next 12 months (
            <span className="tabular-nums text-foreground">{money(income.annualTotal)}</span>)
            covers the fees{" "}
            <span className="font-semibold tabular-nums text-gold">
              {coverage.toLocaleString("en-US", {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              })}
              ×
            </span>{" "}
            over.
          </p>
        )}
        {coverage == null && costs.annualCost <= 0 && income.annualTotal > 0 && (
          <p className="mt-5 rounded-lg bg-highlight px-3 py-2.5 text-sm leading-relaxed text-muted">
            The current holdings charge no fund fees, so all of the estimated income is kept.
          </p>
        )}
      </Section>

      <IncomeChart
        months={income.months}
        annualTotal={income.annualTotal}
        yieldPercent={income.yieldPercent}
        nonPaying={income.nonPaying}
        nextPayment={income.nextPayment}
      />
    </div>
  );
}
