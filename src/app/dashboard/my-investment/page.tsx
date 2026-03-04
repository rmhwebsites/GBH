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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-foreground">My Investment</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
                  Units Received
                </th>
              </tr>
            </thead>
            <tbody>
              {data.investments.map((inv) => (
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
                          }
                        )}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-right font-medium text-foreground">
                    {formatCurrency(inv.amount_invested)}
                  </td>
                  <td className="px-4 py-4 text-right text-sm text-muted">
                    {formatNumber(inv.units_owned, 4)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
