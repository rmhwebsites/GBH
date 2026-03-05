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
      <div className="border-b border-card-border px-4 py-3 sm:px-6 sm:py-4">
        <h2 className="text-lg font-semibold text-foreground">Holdings</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full" style={{ minWidth: "480px" }}>
          <thead>
            <tr className="border-b border-card-border text-left text-[10px] uppercase tracking-wider text-muted sm:text-xs">
              <th className="sticky left-0 z-10 bg-[rgba(0,13,26,0.85)] px-3 py-2.5 font-medium backdrop-blur-xl sm:px-6 sm:py-3">
                Stock
              </th>
              <th className="px-2 py-2.5 font-medium text-right sm:px-4 sm:py-3">Price</th>
              <th className="px-2 py-2.5 font-medium text-right sm:px-4 sm:py-3">Day Chg</th>
              <th className="hidden px-2 py-2.5 font-medium text-right sm:table-cell sm:px-4 sm:py-3">Shares</th>
              <th className="px-2 py-2.5 font-medium text-right sm:px-4 sm:py-3">Value</th>
              <th className="px-2 py-2.5 font-medium text-right sm:px-4 sm:py-3">Return</th>
              <th className="hidden px-2 py-2.5 font-medium text-right md:table-cell sm:px-4 sm:py-3">Weight</th>
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
                  <td className="sticky left-0 z-10 bg-[rgba(0,13,26,0.85)] px-3 py-3 backdrop-blur-xl sm:px-6 sm:py-4">
                    <Link
                      href={`/dashboard/stock/${holding.ticker}`}
                      className="block"
                    >
                      <div className="flex items-center gap-2 sm:gap-3">
                        <StockLogo ticker={holding.ticker} size={28} />
                        <div>
                          <p className="text-xs font-medium text-foreground transition-colors group-hover:text-white sm:text-sm">
                            {holding.ticker}
                          </p>
                          <p className="hidden max-w-[100px] truncate text-[10px] text-muted transition-colors group-hover:text-white/60 sm:block sm:max-w-[140px] sm:text-xs">
                            {holding.company_name}
                          </p>
                        </div>
                      </div>
                    </Link>
                  </td>
                  {/* Current stock price */}
                  <td className="px-2 py-3 text-right text-xs font-medium text-foreground transition-colors group-hover:text-white sm:px-4 sm:py-4 sm:text-sm">
                    {formatCurrency(holding.quote.price)}
                  </td>
                  {/* Day Change — per-share $ and % */}
                  <td className="px-2 py-3 text-right sm:px-4 sm:py-4">
                    <div className="flex flex-col items-end">
                      <div className="flex items-center gap-0.5 sm:gap-1">
                        {isDayPositive ? (
                          <TrendingUp className="hidden h-3 w-3 text-gain sm:block" />
                        ) : (
                          <TrendingDown className="hidden h-3 w-3 text-loss sm:block" />
                        )}
                        <span
                          className={`text-[11px] font-medium sm:text-sm ${
                            isDayPositive ? "text-gain" : "text-loss"
                          }`}
                        >
                          {formatPercent(holding.quote.changePercent)}
                        </span>
                      </div>
                      <span
                        className={`hidden text-xs sm:block ${
                          isDayPositive ? "text-gain" : "text-loss"
                        }`}
                      >
                        {formatCurrency(holding.quote.change)}
                      </span>
                    </div>
                  </td>
                  {/* Shares — hidden on mobile */}
                  <td className="hidden px-2 py-3 text-right text-sm text-muted transition-colors group-hover:text-white/60 sm:table-cell sm:px-4 sm:py-4">
                    {formatNumber(holding.shares)}
                  </td>
                  {/* Position Value */}
                  <td className="px-2 py-3 text-right text-xs font-medium text-foreground transition-colors group-hover:text-white sm:px-4 sm:py-4 sm:text-sm">
                    {formatCurrency(holding.currentValue)}
                  </td>
                  {/* Total Return — all-time position % ($ hidden on mobile) */}
                  <td className="px-2 py-3 text-right sm:px-4 sm:py-4">
                    <div className="flex flex-col items-end">
                      <span
                        className={`text-[11px] font-medium sm:text-sm ${
                          isTotalPositive ? "text-gain" : "text-loss"
                        }`}
                      >
                        {formatPercent(holding.gainLossPercent)}
                      </span>
                      <span
                        className={`hidden text-xs sm:block ${
                          isTotalPositive ? "text-gain" : "text-loss"
                        }`}
                      >
                        {formatCurrency(holding.gainLoss)}
                      </span>
                    </div>
                  </td>
                  {/* Weight — hidden on mobile */}
                  <td className="hidden px-2 py-3 text-right md:table-cell sm:px-4 sm:py-4">
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
