"use client";

import useSWR from "swr";
import { useAuth } from "@memberstack/react";
import { Loader2, AlertCircle } from "lucide-react";
import type { AnalyticsPayload } from "@/types/analytics";
import type { MemberDashboardData } from "@/types/database";
import { YourMoney } from "@/components/analytics/YourMoney";
import { CashWaiting } from "@/components/analytics/CashWaiting";
import { NavTimeline } from "@/components/analytics/NavTimeline";
import { FundRoles } from "@/components/analytics/FundRoles";
import { NormalYear } from "@/components/analytics/NormalYear";
import { CostAndIncome } from "@/components/analytics/CostAndIncome";
import { WhatYouOwn } from "@/components/analytics/WhatYouOwn";
import { ComparedToWhat } from "@/components/analytics/ComparedToWhat";
import { VolatilityCard } from "@/components/analytics/VolatilityCard";
import { AdminStrip } from "@/components/analytics/AdminStrip";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`Request failed: ${r.status}`);
    return r.json();
  });

/**
 * Portfolio analytics, designed for a passive index-fund portfolio.
 *
 * Ordered for a phone: the member's own money first, then the one actionable
 * fact (cash waiting to be invested), then context. There is deliberately no
 * leaderboard of holdings, no alpha figure and no Sharpe ratio — see the
 * design notes in the commit that introduced this page.
 */
export default function AnalyticsPage() {
  const { userId } = useAuth();

  const { data, error, isLoading } = useSWR<AnalyticsPayload>(
    "/api/portfolio/analytics",
    fetcher,
    { refreshInterval: 5 * 60 * 1000 }
  );
  const { data: member } = useSWR<MemberDashboardData>(
    userId ? `/api/member/${userId}` : null,
    fetcher
  );

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-gold" />
          <p className="text-muted">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="glass-card flex items-center gap-3 p-6">
        <AlertCircle className="h-5 w-5 flex-shrink-0 text-loss" />
        <p className="text-sm text-foreground">
          Analytics couldn&apos;t be loaded right now. Please refresh in a moment.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Analytics</h1>
        <p className="mt-1 text-sm text-muted">
          How the fund is built, what it costs, and what it&apos;s doing with
          your money.
        </p>
      </div>

      <YourMoney member={member} fund={data.fund} />
      <CashWaiting cash={data.cashWaiting} />
      <NavTimeline
        navSeries={data.navSeries}
        rebuildDate={data.rebuildDate}
        contributionDates={data.contributionDates}
        drawdown={data.drawdown}
      />
      <FundRoles positions={data.positions} />
      <NormalYear drawdown={data.drawdown} downside={data.downside} />
      <CostAndIncome costs={data.costs} income={data.income} />
      <WhatYouOwn
        sectors={data.sectors}
        geography={data.geography}
        globalRegionWeights={data.globalRegionWeights}
        concentration={data.concentration}
        positions={data.positions}
      />
      <ComparedToWhat benchmark={data.benchmark} cashPct={data.fund.cashPct} />
      <VolatilityCard volatility={data.volatility} rebuildDate={data.rebuildDate} />
      <AdminStrip admin={data.admin} />
    </div>
  );
}
