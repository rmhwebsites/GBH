"use client";

import Link from "next/link";
import { TrendingUp, TrendingDown } from "lucide-react";
import { StockLogo } from "@/components/ui/StockLogo";
import type { HoldingWithQuote } from "@/types/database";
import {
  formatCurrency,
  formatPercent,
  formatNumber,
} from "@/lib/calculations";

interface Props {
  holdings: HoldingWithQuote[];
}

export function HoldingsTable({ holdings }: Props) {
  if (holdings.length === 0) {
    return (
      <div className="glass-card p-8 text-center">
        <p className="text-muted">No holdings yet. Add stocks in the admin panel.</p>
      </div>
    );
  }

  return (
    <div className="glass-card overflow-hidden">
      <div className="border-b border-card-border px-6 py-4">
        <h2 className="text-lg font-semibold text-foreground">Holdings</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full" style={{ minWidth: "800px" }}>
          <thead>
            <tr className="border-b border-card-border text-left text-xs uppercase tracking-wider text-muted">
              <th className="sticky left-0 z-10 bg-card-glass px-6 py-3 font-medium backdrop-blur-md">
                Stock
              </th>
              <th className="px-4 py-3 font-medium text-right">Price</th>
              <th className="px-4 py-3 font-medium text-right">Day Change</th>
              <th className="px-4 py-3 font-medium text-right">Shares</th>
              <th className="px-4 py-3 font-medium text-right">Value</th>
              <th className="px-4 py-3 font-medium text-right">Total Return</th>
              <th className="px-4 py-3 font-medium text-right">Weight</th>
            </tr>
          </thead>
          <tbody>
            {holdings.map((holding) => {
              const isDayPositive = holding.quote.changePercent >= 0;
              const isTotalPositive = holding.gainLoss >= 0;
              return (
                <tr
                  key={holding.id}
                  className="group cursor-pointer border-b border-card-border/50 transition-all hover:bg-white/[0.06]"
                >
                  {/* Stock — sticky on scroll */}
                  <td className="sticky left-0 z-10 bg-card-glass px-6 py-4 backdrop-blur-md">
                    <Link
                      href={`/dashboard/stock/${holding.ticker}`}
                      className="block"
                    >
                      <div className="flex items-center gap-3">
                        <StockLogo ticker={holding.ticker} size={36} />
                        <div>
                          <p className="font-medium text-foreground transition-colors group-hover:text-white">
                            {holding.ticker}
                          </p>
                          <p className="max-w-[140px] truncate text-xs text-muted transition-colors group-hover:text-white/60">
                            {holding.company_name}
                          </p>
                        </div>
                      </div>
                    </Link>
                  </td>
                  {/* Current stock price */}
                  <td className="px-4 py-4 text-right font-medium text-foreground transition-colors group-hover:text-white">
                    {formatCurrency(holding.quote.price)}
                  </td>
                  {/* Day Change — per-share $ and % */}
                  <td className="px-4 py-4 text-right">
                    <div className="flex flex-col items-end">
                      <div className="flex items-center gap-1">
                        {isDayPositive ? (
                          <TrendingUp className="h-3 w-3 text-gain" />
                        ) : (
                          <TrendingDown className="h-3 w-3 text-loss" />
                        )}
                        <span
                          className={`text-sm font-medium ${
                            isDayPositive ? "text-gain" : "text-loss"
                          }`}
                        >
                          {formatCurrency(holding.quote.change)}
                        </span>
                      </div>
                      <span
                        className={`text-xs ${
                          isDayPositive ? "text-gain" : "text-loss"
                        }`}
                      >
                        {formatPercent(holding.quote.changePercent)}
                      </span>
                    </div>
                  </td>
                  {/* Shares */}
                  <td className="px-4 py-4 text-right text-sm text-muted transition-colors group-hover:text-white/60">
                    {formatNumber(holding.shares)}
                  </td>
                  {/* Position Value */}
                  <td className="px-4 py-4 text-right font-medium text-foreground transition-colors group-hover:text-white">
                    {formatCurrency(holding.currentValue)}
                  </td>
                  {/* Total Return — all-time position $ and % */}
                  <td className="px-4 py-4 text-right">
                    <div className="flex flex-col items-end">
                      <span
                        className={`text-sm font-medium ${
                          isTotalPositive ? "text-gain" : "text-loss"
                        }`}
                      >
                        {formatCurrency(holding.gainLoss)}
                      </span>
                      <span
                        className={`text-xs ${
                          isTotalPositive ? "text-gain" : "text-loss"
                        }`}
                      >
                        {formatPercent(holding.gainLossPercent)}
                      </span>
                    </div>
                  </td>
                  {/* Weight */}
                  <td className="px-4 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-card-border">
                        <div
                          className="h-full rounded-full bg-gold"
                          style={{ width: `${Math.min(holding.weight, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted">
                        {formatNumber(holding.weight, 1)}%
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
