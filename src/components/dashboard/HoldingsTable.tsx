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
        <table className="w-full">
          <thead>
            <tr className="border-b border-card-border text-left text-xs uppercase tracking-wider text-muted">
              <th className="px-6 py-3 font-medium">Stock</th>
              <th className="px-4 py-3 font-medium text-right">Price</th>
              <th className="px-4 py-3 font-medium text-right">Change</th>
              <th className="hidden px-4 py-3 font-medium text-right md:table-cell">
                Shares
              </th>
              <th className="px-4 py-3 font-medium text-right">Value</th>
              <th className="hidden px-4 py-3 font-medium text-right lg:table-cell">
                Gain/Loss
              </th>
              <th className="hidden px-4 py-3 font-medium text-right sm:table-cell">
                Weight
              </th>
            </tr>
          </thead>
          <tbody>
            {holdings.map((holding) => {
              const isPositive = holding.quote.changePercent >= 0;
              const gainPositive = holding.gainLoss >= 0;
              return (
                <tr
                  key={holding.id}
                  className="group cursor-pointer border-b border-card-border/50 transition-all hover:bg-white/[0.06]"
                >
                  <td className="px-6 py-4">
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
                  <td className="px-4 py-4 text-right font-medium text-foreground transition-colors group-hover:text-white">
                    {formatCurrency(holding.quote.price)}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {isPositive ? (
                        <TrendingUp className="h-3 w-3 text-gain" />
                      ) : (
                        <TrendingDown className="h-3 w-3 text-loss" />
                      )}
                      <span
                        className={`text-sm font-medium ${
                          isPositive ? "text-gain" : "text-loss"
                        }`}
                      >
                        {formatPercent(holding.quote.changePercent)}
                      </span>
                    </div>
                  </td>
                  <td className="hidden px-4 py-4 text-right text-sm text-muted transition-colors group-hover:text-white/60 md:table-cell">
                    {formatNumber(holding.shares)}
                  </td>
                  <td className="px-4 py-4 text-right font-medium text-foreground transition-colors group-hover:text-white">
                    {formatCurrency(holding.currentValue)}
                  </td>
                  <td className="hidden px-4 py-4 text-right lg:table-cell">
                    <span
                      className={`text-sm font-medium ${
                        gainPositive ? "text-gain" : "text-loss"
                      }`}
                    >
                      {formatCurrency(holding.gainLoss)}
                    </span>
                    <span
                      className={`ml-1 text-xs ${
                        gainPositive ? "text-gain" : "text-loss"
                      }`}
                    >
                      ({formatPercent(holding.gainLossPercent)})
                    </span>
                  </td>
                  <td className="hidden px-4 py-4 text-right sm:table-cell">
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
