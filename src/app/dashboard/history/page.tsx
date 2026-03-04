"use client";

import useSWR from "swr";
import { Loader2, ArrowUpRight, ArrowDownRight, Filter } from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/calculations";
import type { TradeRecord } from "@/types/database";
import { useState } from "react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function TradeHistoryPage() {
  const { data, isLoading } = useSWR<{ trades: TradeRecord[] }>(
    "/api/admin/trades",
    fetcher
  );
  const [filterAction, setFilterAction] = useState<"ALL" | "BUY" | "SELL">(
    "ALL"
  );
  const [filterTicker, setFilterTicker] = useState("");

  const trades = data?.trades || [];
  const filtered = trades.filter((t) => {
    if (filterAction !== "ALL" && t.action !== filterAction) return false;
    if (
      filterTicker &&
      !t.ticker.toLowerCase().includes(filterTicker.toLowerCase())
    )
      return false;
    return true;
  });

  // Get unique tickers for filter
  const tickers = [...new Set(trades.map((t) => t.ticker))].sort();

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          Trade History
        </h1>
        <p className="mt-1 text-sm text-muted">
          Record of all fund buy and sell transactions
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted" />
          <span className="text-sm text-muted">Filter:</span>
        </div>
        <div className="flex gap-1">
          {(["ALL", "BUY", "SELL"] as const).map((action) => (
            <button
              key={action}
              onClick={() => setFilterAction(action)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                filterAction === action
                  ? action === "BUY"
                    ? "bg-gain/20 text-gain"
                    : action === "SELL"
                    ? "bg-loss/20 text-loss"
                    : "bg-gold/20 text-gold"
                  : "text-muted hover:bg-card-glass hover:text-foreground"
              }`}
            >
              {action}
            </button>
          ))}
        </div>
        {tickers.length > 0 && (
          <select
            value={filterTicker}
            onChange={(e) => setFilterTicker(e.target.value)}
            className="rounded-lg border border-input-border bg-input-bg px-3 py-1.5 text-xs text-foreground"
          >
            <option value="">All Stocks</option>
            {tickers.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Trades List */}
      {filtered.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <p className="text-muted">No trades found.</p>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-card-border text-left text-xs uppercase tracking-wider text-muted">
                  <th className="px-6 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                  <th className="px-4 py-3 font-medium">Stock</th>
                  <th className="px-4 py-3 font-medium text-right">Shares</th>
                  <th className="px-4 py-3 font-medium text-right">Price</th>
                  <th className="px-4 py-3 font-medium text-right">Total</th>
                  <th className="hidden px-4 py-3 font-medium md:table-cell">
                    Notes
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((trade) => {
                  const isBuy = trade.action === "BUY";
                  return (
                    <tr
                      key={trade.id}
                      className="border-b border-card-border/50 transition-colors hover:bg-card-glass"
                    >
                      <td className="px-6 py-4 text-sm text-foreground">
                        {new Date(trade.trade_date).toLocaleDateString(
                          "en-US",
                          { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          {isBuy ? (
                            <div className="rounded-md bg-gain/10 p-1">
                              <ArrowUpRight className="h-3.5 w-3.5 text-gain" />
                            </div>
                          ) : (
                            <div className="rounded-md bg-loss/10 p-1">
                              <ArrowDownRight className="h-3.5 w-3.5 text-loss" />
                            </div>
                          )}
                          <span
                            className={`text-xs font-semibold ${
                              isBuy ? "text-gain" : "text-loss"
                            }`}
                          >
                            {trade.action}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className="font-medium text-foreground">
                          {trade.ticker}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right text-sm text-foreground">
                        {formatNumber(trade.shares)}
                      </td>
                      <td className="px-4 py-4 text-right text-sm text-foreground">
                        {formatCurrency(trade.price_per_share)}
                      </td>
                      <td className="px-4 py-4 text-right font-medium text-foreground">
                        {formatCurrency(trade.total_amount)}
                      </td>
                      <td className="hidden max-w-[200px] truncate px-4 py-4 text-sm text-muted md:table-cell">
                        {trade.notes || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
