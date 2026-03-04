"use client";

import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  PieChart,
  Banknote,
} from "lucide-react";
import { formatCurrency, formatPercent } from "@/lib/calculations";

interface Props {
  totalValue: number;
  totalCost: number;
  totalGainLoss: number;
  totalGainLossPercent: number;
  holdingsCount: number;
  cashBalance?: number;
}

export function PortfolioSummary({
  totalValue,
  totalCost,
  totalGainLoss,
  totalGainLossPercent,
  holdingsCount,
  cashBalance = 0,
}: Props) {
  const isPositive = totalGainLoss >= 0;

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
      {/* Total Portfolio Value */}
      <div className="glass-card p-4 sm:p-5">
        <div className="mb-3 flex items-center gap-2">
          <div className="rounded-lg bg-gold/10 p-2">
            <DollarSign className="h-4 w-4 text-gold" />
          </div>
          <span className="text-xs text-muted sm:text-sm">Portfolio Value</span>
        </div>
        <p className="text-lg font-semibold text-foreground sm:text-2xl">
          {formatCurrency(totalValue)}
        </p>
      </div>

      {/* Total Cost Basis */}
      <div className="glass-card p-4 sm:p-5">
        <div className="mb-3 flex items-center gap-2">
          <div className="rounded-lg bg-navy/30 p-2">
            <PieChart className="h-4 w-4 text-gold-light" />
          </div>
          <span className="text-xs text-muted sm:text-sm">Cost Basis</span>
        </div>
        <p className="text-lg font-semibold text-foreground sm:text-2xl">
          {formatCurrency(totalCost)}
        </p>
      </div>

      {/* Total Gain/Loss */}
      <div className="glass-card p-4 sm:p-5">
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
          <span className="text-xs text-muted sm:text-sm">Total Gain/Loss</span>
        </div>
        <p
          className={`text-lg font-semibold sm:text-2xl ${
            isPositive ? "text-gain" : "text-loss"
          }`}
        >
          {formatCurrency(totalGainLoss)}
        </p>
        <p
          className={`mt-1 text-xs sm:text-sm ${
            isPositive ? "text-gain" : "text-loss"
          }`}
        >
          {formatPercent(totalGainLossPercent)}
        </p>
      </div>

      {/* Cash Balance */}
      <div className="glass-card p-4 sm:p-5">
        <div className="mb-3 flex items-center gap-2">
          <div className="rounded-lg bg-gold/10 p-2">
            <Banknote className="h-4 w-4 text-gold" />
          </div>
          <span className="text-xs text-muted sm:text-sm">Cash & Equivalents</span>
        </div>
        <p className="text-lg font-semibold text-foreground sm:text-2xl">
          {formatCurrency(cashBalance)}
        </p>
        {totalValue > 0 && (
          <p className="mt-1 text-xs text-muted sm:text-sm">
            {((cashBalance / totalValue) * 100).toFixed(1)}% of AUM
          </p>
        )}
      </div>

      {/* Holdings Count */}
      <div className="glass-card p-4 sm:p-5">
        <div className="mb-3 flex items-center gap-2">
          <div className="rounded-lg bg-gold/10 p-2">
            <TrendingUp className="h-4 w-4 text-gold" />
          </div>
          <span className="text-xs text-muted sm:text-sm">Active Holdings</span>
        </div>
        <p className="text-lg font-semibold text-foreground sm:text-2xl">
          {holdingsCount}
        </p>
        <p className="mt-1 text-xs text-muted sm:text-sm">stocks</p>
      </div>
    </div>
  );
}
