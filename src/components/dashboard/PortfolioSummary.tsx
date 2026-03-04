"use client";

import { TrendingUp, TrendingDown, DollarSign, PieChart } from "lucide-react";
import { formatCurrency, formatPercent } from "@/lib/calculations";

interface Props {
  totalValue: number;
  totalCost: number;
  totalGainLoss: number;
  totalGainLossPercent: number;
  holdingsCount: number;
}

export function PortfolioSummary({
  totalValue,
  totalCost,
  totalGainLoss,
  totalGainLossPercent,
  holdingsCount,
}: Props) {
  const isPositive = totalGainLoss >= 0;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* Total Portfolio Value */}
      <div className="glass-card p-5">
        <div className="mb-3 flex items-center gap-2">
          <div className="rounded-lg bg-gold/10 p-2">
            <DollarSign className="h-4 w-4 text-gold" />
          </div>
          <span className="text-sm text-muted">Portfolio Value</span>
        </div>
        <p className="text-2xl font-semibold text-foreground">
          {formatCurrency(totalValue)}
        </p>
      </div>

      {/* Total Cost Basis */}
      <div className="glass-card p-5">
        <div className="mb-3 flex items-center gap-2">
          <div className="rounded-lg bg-navy/30 p-2">
            <PieChart className="h-4 w-4 text-gold-light" />
          </div>
          <span className="text-sm text-muted">Cost Basis</span>
        </div>
        <p className="text-2xl font-semibold text-foreground">
          {formatCurrency(totalCost)}
        </p>
      </div>

      {/* Total Gain/Loss */}
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
          <span className="text-sm text-muted">Total Gain/Loss</span>
        </div>
        <p
          className={`text-2xl font-semibold ${
            isPositive ? "text-gain" : "text-loss"
          }`}
        >
          {formatCurrency(totalGainLoss)}
        </p>
        <p
          className={`mt-1 text-sm ${
            isPositive ? "text-gain" : "text-loss"
          }`}
        >
          {formatPercent(totalGainLossPercent)}
        </p>
      </div>

      {/* Holdings Count */}
      <div className="glass-card p-5">
        <div className="mb-3 flex items-center gap-2">
          <div className="rounded-lg bg-gold/10 p-2">
            <TrendingUp className="h-4 w-4 text-gold" />
          </div>
          <span className="text-sm text-muted">Active Holdings</span>
        </div>
        <p className="text-2xl font-semibold text-foreground">
          {holdingsCount}
        </p>
        <p className="mt-1 text-sm text-muted">stocks</p>
      </div>
    </div>
  );
}
