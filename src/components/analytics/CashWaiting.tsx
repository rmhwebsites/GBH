"use client";

import { Hourglass, ArrowRight } from "lucide-react";
import type { AnalyticsPayload } from "@/types/analytics";
import { Section } from "./Section";
import { money, pct, shortDate } from "./format";

/** Below this share of the fund, cash is a normal working balance, not a story */
const SMALL_CASH = 0.05;

function daysAgo(days: number): string {
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days.toLocaleString("en-US")} days ago`;
}

/** Invested vs cash share of the fund as one horizontal bar */
function SplitBar({ cashShare, thin = false }: { cashShare: number; thin?: boolean }) {
  const investedShare = 1 - cashShare;
  return (
    <div>
      <div
        role="img"
        aria-label={`${pct(investedShare)} of the fund is invested, ${pct(cashShare)} is cash waiting`}
        className={`flex w-full overflow-hidden rounded-full bg-card-border ${thin ? "h-1.5" : "h-3"}`}
      >
        <div className="h-full bg-gold" style={{ width: `${investedShare * 100}%` }} />
      </div>
      {!thin && (
        <div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-gold" aria-hidden />
            Invested <span className="tabular-nums text-foreground">{pct(investedShare)}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-card-border" aria-hidden />
            Cash waiting <span className="tabular-nums text-foreground">{pct(cashShare)}</span>
          </span>
        </div>
      )}
    </div>
  );
}

/** Paid in → Waiting → Invested: cash is a step in a queue, not a destination */
function QueueSteps() {
  const steps = [
    { label: "Paid in", state: "done" },
    { label: "Waiting in cash", state: "current" },
    { label: "Invested", state: "next" },
  ] as const;
  return (
    <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs" aria-label="Where this money is">
      {steps.map((s, i) => (
        <li key={s.label} className="flex items-center gap-1.5">
          {i > 0 && <ArrowRight className="h-3 w-3 text-muted" aria-hidden />}
          <span
            className={
              s.state === "current"
                ? "rounded-full bg-highlight px-2 py-0.5 font-semibold text-gold"
                : "text-muted"
            }
            aria-current={s.state === "current" ? "step" : undefined}
          >
            {s.label}
          </span>
        </li>
      ))}
    </ol>
  );
}

/**
 * Cash that has arrived but hasn't been invested yet — right now the largest
 * real fact about the portfolio. Framed as a queue waiting to be invested,
 * not as a strategy, and with no dollar forecasts of what it "costs".
 */
export function CashWaiting({ cash }: { cash: AnalyticsPayload["cashWaiting"] }) {
  const share = Math.min(1, Math.max(0, cash.pctOfFund));

  const origin =
    cash.lastContributionDate && cash.lastContributionAmount > 0 ? (
      <>
        <span className="tabular-nums">{money(cash.lastContributionAmount)}</span> arrived with the
        latest contributions on{" "}
        <span className="tabular-nums">{shortDate(cash.lastContributionDate)}</span>
        {cash.daysSince !== null && (
          <>
            , <span className="tabular-nums">{daysAgo(cash.daysSince)}</span>
          </>
        )}
        .
      </>
    ) : null;

  // ── Calm, compact version when cash is a normal working balance
  if (share < SMALL_CASH) {
    return (
      <Section icon={Hourglass} title="Cash waiting" info="cashWaiting">
        <p className="text-sm leading-relaxed text-foreground">
          {cash.amount > 0 ? (
            <>
              Almost everything is invested.{" "}
              <span className="font-semibold tabular-nums">{money(cash.amount)}</span> (
              <span className="tabular-nums">{pct(share)}</span> of the fund) is in cash, a normal
              working balance.
            </>
          ) : (
            <>Everything is invested — no cash is waiting.</>
          )}
        </p>
        <div className="mt-3">
          <SplitBar cashShare={share} thin />
        </div>
      </Section>
    );
  }

  // ── Full version: cash is a big share of the fund right now
  return (
    <Section
      icon={Hourglass}
      title="Cash waiting to be invested"
      subtitle="Money that has arrived but hasn't been put into the funds yet"
      info="cashWaiting"
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="text-3xl font-bold tracking-tight tabular-nums text-gold sm:text-4xl">
          {money(cash.amount)}
        </p>
        <p className="text-sm text-muted">
          <span className="font-semibold tabular-nums text-foreground">{pct(share)}</span> of the
          fund
        </p>
      </div>

      <div className="mt-4">
        <SplitBar cashShare={share} />
      </div>

      <div className="mt-4">
        <QueueSteps />
      </div>

      <div className="mt-4 space-y-2 text-sm leading-relaxed text-foreground">
        {origin && <p>{origin}</p>}
        <p>
          Cash is safe — it doesn&rsquo;t fall when the market falls — but it doesn&rsquo;t grow
          when the market rises either. Until it&rsquo;s invested, it holds the fund&rsquo;s return
          back.
        </p>
        <p className="text-muted">
          This is money in line to be invested, not a decision to sit in cash. Once it&rsquo;s put
          into the funds, it starts moving with the market like the rest.
        </p>
      </div>
    </Section>
  );
}
