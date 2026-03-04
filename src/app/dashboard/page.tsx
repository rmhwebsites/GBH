"use client";

import useSWR from "swr";
import { PortfolioSummary } from "@/components/dashboard/PortfolioSummary";
import { HoldingsTable } from "@/components/dashboard/HoldingsTable";
import { AllocationChart } from "@/components/charts/AllocationChart";
import { Loader2, RefreshCw } from "lucide-react";
import type { PortfolioSummary as PortfolioSummaryType } from "@/types/database";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function DashboardPage() {
  const {
    data: portfolio,
    isLoading,
    mutate,
  } = useSWR<PortfolioSummaryType>("/api/portfolio", fetcher, {
    refreshInterval: 5 * 60 * 1000, // Refresh every 5 minutes
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-gold" />
          <p className="text-muted">Loading portfolio...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Portfolio</h1>
          <p className="mt-1 text-sm text-muted">
            Live market data refreshes every 5 minutes
          </p>
        </div>
        <button
          onClick={() => mutate()}
          className="flex items-center gap-2 rounded-lg border border-card-border bg-card-glass px-4 py-2 text-sm text-muted transition-colors hover:border-gold/30 hover:text-gold"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      {portfolio && (
        <PortfolioSummary
          totalValue={portfolio.totalValue}
          totalCost={portfolio.totalCost}
          totalGainLoss={portfolio.totalGainLoss}
          totalGainLossPercent={portfolio.totalGainLossPercent}
          holdingsCount={portfolio.holdings?.length || 0}
        />
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Holdings Table - 2/3 width */}
        <div className="xl:col-span-2">
          <HoldingsTable holdings={portfolio?.holdings || []} />
        </div>

        {/* Allocation Chart - 1/3 width */}
        <div>
          <AllocationChart holdings={portfolio?.holdings || []} />
        </div>
      </div>
    </div>
  );
}
