"use client";

import { useState } from "react";
import { Wallet } from "lucide-react";
import type { AnalyticsPayload } from "@/types/analytics";
import type { MemberDashboardData } from "@/types/database";
import { Section, Stat, InfoButton, Explainer } from "./Section";
import { money, signedPct, shortDate } from "./format";

/** "+$1,234.56" / "−$12.00" (true minus sign), built on the shared money() helper */
function signedMoney(x: number): string {
  return x > 0 ? `+${money(x)}` : x < 0 ? `−${money(-x)}` : money(0);
}

/** Units are a count, not money — up to 2 decimals, grouped like other figures */
function units(x: number): string {
  return x.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

/** NAV per unit is around $1, so show a third decimal or every change looks flat */
function navPrice(x: number): string {
  return money(x, 3);
}

/**
 * "Is my money OK?" — the first thing a member sees on the analytics page.
 * The member's own balance, then a quiet club line, then the fund's two
 * different (and both correct) returns, each labelled so they aren't confused.
 */
export function YourMoney({
  member,
  fund,
}: {
  member: MemberDashboardData | undefined;
  fund: AnalyticsPayload["fund"];
}) {
  const [navOpen, setNavOpen] = useState(false);

  // An admin with no investment may still get a zero-filled record — treat it as
  // "no balance" so we never present $0 as if it were their money.
  const hasBalance =
    member !== undefined && (member.totalUnits > 0 || member.totalInvested > 0);

  // calculateMemberData returns totalGainLossPercent already multiplied by 100
  // (e.g. 10.8 for 10.8%); the format helpers expect a decimal (0.108).
  const memberGainDecimal = hasBalance ? member.totalGainLossPercent / 100 : 0;

  const navSinceLabel = fund.firstSnapshotDate
    ? `NAV change since ${shortDate(fund.firstSnapshotDate)}`
    : "NAV change";

  return (
    <Section
      icon={Wallet}
      title="Your money"
      subtitle={
        hasBalance
          ? "What your share of the club is worth today"
          : "How the club's money is doing today"
      }
    >
      {hasBalance && (
        <>
          <div>
            <p className="text-xs text-muted">Your value today</p>
            <p className="mt-0.5 text-3xl font-bold tracking-tight tabular-nums text-foreground sm:text-4xl">
              {money(member.currentValue)}
            </p>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
            <Stat label="You paid in" value={money(member.totalInvested)} />
            <Stat
              label={member.totalGainLoss < 0 ? "Loss so far" : "Gain so far"}
              value={signedMoney(member.totalGainLoss)}
              sub={<span className="tabular-nums">{signedPct(memberGainDecimal)} on what you paid in</span>}
            />
            <Stat
              label="Units you own"
              value={units(member.totalUnits)}
              info="units"
            />
          </div>

          <div className="mt-4 rounded-lg bg-highlight px-3 py-2.5">
            <div className="flex items-start justify-between gap-1">
              <p className="text-sm leading-relaxed text-foreground">
                Each unit is worth{" "}
                <span className="font-semibold tabular-nums">{navPrice(member.navPerUnit)}</span>{" "}
                today — that price is the fund&rsquo;s NAV. Your{" "}
                <span className="tabular-nums">{units(member.totalUnits)}</span> units ×{" "}
                <span className="tabular-nums">{navPrice(member.navPerUnit)}</span> ={" "}
                <span className="font-semibold tabular-nums">{money(member.currentValue)}</span>.
              </p>
              <InfoButton open={navOpen} onToggle={() => setNavOpen(!navOpen)} label="NAV" />
            </div>
            {navOpen && <Explainer term="nav" />}
          </div>
        </>
      )}

      {!hasBalance && (
        <div className="rounded-lg bg-highlight px-3 py-2.5">
          <div className="flex items-start justify-between gap-1">
            <p className="text-sm leading-relaxed text-foreground">
              One unit of the fund is worth{" "}
              <span className="font-semibold tabular-nums">{navPrice(fund.nav)}</span> today —
              that price is the fund&rsquo;s NAV. A member&rsquo;s balance is the units they own
              times this price.
            </p>
            <InfoButton open={navOpen} onToggle={() => setNavOpen(!navOpen)} label="NAV" />
          </div>
          {navOpen && <Explainer term="nav" />}
        </div>
      )}

      {/* Understated club line */}
      <p className={`${hasBalance ? "mt-4" : "mt-3"} text-xs text-muted`}>
        Club: <span className="tabular-nums">{money(fund.value)}</span> across{" "}
        <span className="tabular-nums">{fund.memberCount}</span>{" "}
        {fund.memberCount === 1 ? "member" : "members"}
        {fund.contributed > 0 && (
          <>
            {" "}
            · <span className="tabular-nums">{money(fund.contributed)}</span> paid in
          </>
        )}
      </p>

      {/* Two different fund-level returns, both correct */}
      <div className="mt-4 border-t border-card-border pt-4">
        <p className="text-xs font-medium uppercase tracking-wider text-muted">
          How the club is doing — two ways to measure it
        </p>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Stat
            label="Value vs money paid in"
            value={signedPct(fund.gainOnContributions)}
            sub={
              <span className="tabular-nums">
                {money(fund.value)} now vs {money(fund.contributed)} paid in
              </span>
            }
            info="gainOnContributions"
          />
          <Stat
            label={navSinceLabel}
            value={fund.firstSnapshotDate ? signedPct(fund.navSinceFirstSnapshot) : "—"}
            sub={
              fund.firstSnapshotDate
                ? "Change in the price of one unit"
                : "Not enough price history yet"
            }
            info="navReturn"
          />
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted">
          These two numbers are different on purpose, and both are right. The first compares
          today&rsquo;s value with every dollar paid in, whenever it arrived. The second follows
          the price of one unit, so it isn&rsquo;t affected by when members added money.
        </p>
      </div>
    </Section>
  );
}
