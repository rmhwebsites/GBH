"use client";

import { useParams } from "next/navigation";
import useSWR from "swr";
import { StockChart } from "@/components/charts/StockChart";
import {
  formatCurrency,
  formatPercent,
  formatLargeNumber,
  formatNumber,
} from "@/lib/calculations";
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { StockLogo } from "@/components/ui/StockLogo";
import type { PortfolioSummary } from "@/types/database";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function StockDetailPage() {
  const params = useParams();
  const ticker = (params.ticker as string).toUpperCase();

  const { data: portfolio, isLoading } = useSWR<PortfolioSummary>(
    "/api/portfolio",
    fetcher,
    { refreshInterval: 5 * 60 * 1000 }
  );

  const holding = portfolio?.holdings?.find((h) => h.ticker === ticker);

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
      </div>
    );
  }

  const quote = holding?.quote;

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div>
        <Link
          href="/dashboard"
          className="mb-4 inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-gold"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Portfolio
        </Link>

        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <StockLogo ticker={ticker} size={48} className="rounded-xl" />
              <div>
                <h1 className="text-2xl font-semibold text-foreground">
                  {ticker}
                </h1>
                <p className="text-sm text-muted">
                  {quote?.name || holding?.company_name || ticker}
                </p>
              </div>
            </div>
          </div>
          {quote && (
            <div className="text-right">
              <p className="text-3xl font-semibold text-foreground">
                {formatCurrency(quote.price)}
              </p>
              <div className="mt-1 flex items-center justify-end gap-1">
                {quote.changePercent >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-gain" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-loss" />
                )}
                <span
                  className={`font-medium ${
                    quote.changePercent >= 0 ? "text-gain" : "text-loss"
                  }`}
                >
                  {formatCurrency(Math.abs(quote.change))}{" "}
                  ({formatPercent(quote.changePercent)})
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Chart */}
      <StockChart ticker={ticker} />

      {/* Info Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Key Stats */}
        {quote && (
          <div className="glass-card p-6">
            <h2 className="mb-4 text-lg font-semibold text-foreground">
              Key Statistics
            </h2>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "Open", value: formatCurrency(quote.open) },
                {
                  label: "Previous Close",
                  value: formatCurrency(quote.previousClose),
                },
                { label: "Day High", value: formatCurrency(quote.dayHigh) },
                { label: "Day Low", value: formatCurrency(quote.dayLow) },
                {
                  label: "52W High",
                  value: formatCurrency(quote.week52High),
                },
                { label: "52W Low", value: formatCurrency(quote.week52Low) },
                {
                  label: "Market Cap",
                  value: formatLargeNumber(quote.marketCap),
                },
                {
                  label: "P/E Ratio",
                  value: quote.peRatio
                    ? formatNumber(quote.peRatio, 2)
                    : "N/A",
                },
                {
                  label: "Volume",
                  value: new Intl.NumberFormat("en-US").format(quote.volume),
                },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  className="flex items-center justify-between border-b border-card-border/30 py-2"
                >
                  <span className="text-sm text-muted">{label}</span>
                  <span className="text-sm font-medium text-foreground">
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Fund Position */}
        {holding && (
          <div className="glass-card p-6">
            <h2 className="mb-4 text-lg font-semibold text-foreground">
              Fund Position
            </h2>
            <div className="space-y-4">
              {[
                {
                  label: "Shares Held",
                  value: formatNumber(holding.shares),
                },
                {
                  label: "Avg Cost Basis",
                  value: formatCurrency(holding.avg_cost_basis),
                },
                {
                  label: "Current Value",
                  value: formatCurrency(holding.currentValue),
                },
                {
                  label: "Total Cost",
                  value: formatCurrency(
                    holding.shares * holding.avg_cost_basis
                  ),
                },
                {
                  label: "Gain/Loss",
                  value: formatCurrency(holding.gainLoss),
                  color: holding.gainLoss >= 0 ? "text-gain" : "text-loss",
                },
                {
                  label: "Return",
                  value: formatPercent(holding.gainLossPercent),
                  color:
                    holding.gainLossPercent >= 0 ? "text-gain" : "text-loss",
                },
                {
                  label: "Portfolio Weight",
                  value: `${formatNumber(holding.weight, 1)}%`,
                },
              ].map(({ label, value, color }) => (
                <div
                  key={label}
                  className="flex items-center justify-between border-b border-card-border/30 py-2"
                >
                  <span className="text-sm text-muted">{label}</span>
                  <span
                    className={`text-sm font-medium ${
                      color || "text-foreground"
                    }`}
                  >
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
