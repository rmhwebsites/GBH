"use client";

import useSWR from "swr";
import { useAuth } from "@memberstack/react";
import {
  Loader2,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Coins,
  Calendar,
  Activity,
} from "lucide-react";
import {
  formatCurrency,
  formatPercent,
  formatNumber,
} from "@/lib/calculations";
import type { MemberDashboardData } from "@/types/database";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function MyInvestmentPage() {
  const { userId } = useAuth();
  const memberId = userId || "";

  const { data, isLoading } = useSWR<MemberDashboardData>(
    memberId ? `/api/member/${memberId}` : null,
    fetcher,
    { refreshInterval: 5 * 60 * 1000 }
  );

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
      </div>
    );
  }

  if (!data || data.investments.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-foreground">
          My Investment
        </h1>
        <div className="glass-card p-12 text-center">
          <DollarSign className="mx-auto h-12 w-12 text-muted" />
          <p className="mt-4 text-lg text-muted">No investment records found</p>
          <p className="mt-2 text-sm text-muted">
            Contact your fund administrator to set up your account.
          </p>
        </div>
      </div>
    );
  }

  const isPositive = data.totalGainLoss >= 0;

  // NAV-based return: (currentNAV / avgEntryNAV - 1) * 100
  const navReturn =
    data.avgEntryNav > 0
      ? ((data.navPerUnit / data.avgEntryNav) - 1) * 100
      : 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-foreground">My Investment</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="glass-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <div className="rounded-lg bg-gold/10 p-2">
              <DollarSign className="h-4 w-4 text-gold" />
            </div>
            <span className="text-sm text-muted">Current Value</span>
          </div>
          <p className="text-2xl font-semibold text-foreground">
            {formatCurrency(data.currentValue)}
          </p>
        </div>

        <div className="glass-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <div className="rounded-lg bg-navy/30 p-2">
              <Coins className="h-4 w-4 text-gold-light" />
            </div>
            <span className="text-sm text-muted">Total Invested</span>
          </div>
          <p className="text-2xl font-semibold text-foreground">
            {formatCurrency(data.totalInvested)}
          </p>
        </div>

        <div className="glass-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <div
              className={`rounded-lg p-2 ${
                isPositive ? "bg-gain/10" : "bg-loss/10"
              }`}
            >
              {isPositive ? (
                <TrendingUp className="h-4 w-4 text-gain" />
              ) : (
                <TrendingDown className="h-4 w-4 text-loss" />
              )}
            </div>
            <span className="text-sm text-muted">Total Return</span>
          </div>
          <p
            className={`text-2xl font-semibold ${
              isPositive ? "text-gain" : "text-loss"
            }`}
          >
            {formatCurrency(data.totalGainLoss)}
          </p>
          <p
            className={`mt-1 text-sm ${
              isPositive ? "text-gain" : "text-loss"
            }`}
          >
            {formatPercent(data.totalGainLossPercent)}
          </p>
        </div>
      </div>

      {/* NAV Details */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="glass-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <div className="rounded-lg bg-gold/10 p-2">
              <Activity className="h-4 w-4 text-gold" />
            </div>
            <span className="text-sm text-muted">Current NAV</span>
          </div>
          <p className="text-2xl font-semibold text-foreground">
            {formatCurrency(data.navPerUnit)}
          </p>
          <p className="mt-1 text-xs text-muted">Per unit (live)</p>
        </div>

        <div className="glass-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <div className="rounded-lg bg-navy/30 p-2">
              <Activity className="h-4 w-4 text-gold-light" />
            </div>
            <span className="text-sm text-muted">Avg Entry NAV</span>
          </div>
          <p className="text-2xl font-semibold text-foreground">
            {formatCurrency(data.avgEntryNav)}
          </p>
          <p className="mt-1 text-xs text-muted">Weighted average</p>
        </div>

        <div className="glass-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <div className="rounded-lg bg-gold/10 p-2">
              <Coins className="h-4 w-4 text-gold" />
            </div>
            <span className="text-sm text-muted">Units Owned</span>
          </div>
          <p className="text-2xl font-semibold text-foreground">
            {formatNumber(data.totalUnits, 4)}
          </p>
          <p
            className={`mt-1 text-xs ${
              navReturn >= 0 ? "text-gain" : "text-loss"
            }`}
          >
            NAV {navReturn >= 0 ? "+" : ""}
            {navReturn.toFixed(2)}% since entry
          </p>
        </div>
      </div>

      {/* Investment History */}
      <div className="glass-card overflow-hidden">
        <div className="border-b border-card-border px-6 py-4">
          <h2 className="text-lg font-semibold text-foreground">
            Investment History
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-card-border text-left text-xs uppercase tracking-wider text-muted">
                <th className="px-6 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium text-right">
                  Amount Invested
                </th>
                <th className="px-4 py-3 font-medium text-right">
                  NAV at Entry
                </th>
                <th className="px-4 py-3 font-medium text-right">
                  Units Received
                </th>
                <th className="px-4 py-3 font-medium text-right">
                  Current Value
                </th>
              </tr>
            </thead>
            <tbody>
              {data.investments.map((inv) => {
                const entryNav =
                  inv.units_owned > 0
                    ? inv.amount_invested / inv.units_owned
                    : 0;
                const currentInvValue = inv.units_owned * data.navPerUnit;
                const invGain = currentInvValue - inv.amount_invested;
                const invIsPositive = invGain >= 0;

                return (
                  <tr
                    key={inv.id}
                    className="border-b border-card-border/50 transition-colors hover:bg-card-glass"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <Calendar className="h-4 w-4 text-muted" />
                        <span className="text-sm text-foreground">
                          {new Date(inv.investment_date).toLocaleDateString(
                            "en-US",
                            {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                              timeZone: "UTC",
                            }
                          )}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right font-medium text-foreground">
                      {formatCurrency(inv.amount_invested)}
                    </td>
                    <td className="px-4 py-4 text-right text-sm text-muted">
                      {entryNav > 0 ? formatCurrency(entryNav) : "—"}
                    </td>
                    <td className="px-4 py-4 text-right text-sm text-muted">
                      {formatNumber(inv.units_owned, 4)}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <p className="text-sm font-medium text-foreground">
                        {formatCurrency(currentInvValue)}
                      </p>
                      <p
                        className={`text-xs ${
                          invIsPositive ? "text-gain" : "text-loss"
                        }`}
                      >
                        {invIsPositive ? "+" : ""}
                        {formatCurrency(invGain)}
                      </p>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
