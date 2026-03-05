"use client";

import {
  TrendingUp,
  TrendingDown,
  Banknote,
  BarChart3,
  Briefcase,
} from "lucide-react";
import { formatCurrency, formatPercent } from "@/lib/calculations";

interface Props {
  totalValue: number;
  totalCost: number;
  totalGainLoss: number;
  totalGainLossPercent: number;
  totalDayChange: number;
  totalDayChangePercent: number;
  holdingsCount: number;
  cashBalance?: number;
}

export function PortfolioSummary({
  totalValue,
  totalCost,
  totalGainLoss,
  totalGainLossPercent,
  totalDayChange,
  totalDayChangePercent,
  holdingsCount,
  cashBalance = 0,
}: Props) {
  const isPositive = totalGainLoss >= 0;
  const isDayPositive = totalDayChange >= 0;
  const investmentsValue = totalValue - cashBalance;

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Account Overview Card */}
      <div className="glass-card p-4 sm:p-6">
        <div className="mb-4 flex items-center gap-2 sm:mb-5">
          <Briefcase className="h-4 w-4 text-gold sm:h-5 sm:w-5" />
          <h2 className="text-sm font-semibold text-foreground sm:text-base">
            Account Overview
          </h2>
        </div>

        {/* Total Value - Hero */}
        <div className="mb-4 sm:mb-5">
          <p className="text-xs text-muted sm:text-sm">Total Account Value</p>
          <p className="text-2xl font-bold text-foreground sm:text-3xl">
            {formatCurrency(totalValue)}
          </p>
          <div className="mt-1 flex items-center gap-2">
            {isDayPositive ? (
              <TrendingUp className="h-3 w-3 text-gain sm:h-3.5 sm:w-3.5" />
            ) : (
              <TrendingDown className="h-3 w-3 text-loss sm:h-3.5 sm:w-3.5" />
            )}
            <span
              className={`text-xs font-medium sm:text-sm ${
                isDayPositive ? "text-gain" : "text-loss"
              }`}
            >
              {formatCurrency(totalDayChange)}
            </span>
            <span
              className={`text-xs sm:text-sm ${
                isDayPositive ? "text-gain" : "text-loss"
              }`}
            >
              ({formatPercent(totalDayChangePercent)}) Today
            </span>
          </div>
        </div>

        {/* Breakdown Table */}
        <div className="space-y-0 divide-y divide-card-border/40">
          {/* Investments */}
          <div className="flex items-center justify-between py-2.5 sm:py-3">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gold/10 sm:h-8 sm:w-8">
                <BarChart3 className="h-3.5 w-3.5 text-gold sm:h-4 sm:w-4" />
              </div>
              <span className="text-xs text-muted sm:text-sm">Investments</span>
            </div>
            <span className="text-sm font-medium text-foreground sm:text-base">
              {formatCurrency(investmentsValue)}
            </span>
          </div>

          {/* Cash & Equivalents */}
          <div className="flex items-center justify-between py-2.5 sm:py-3">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gold/10 sm:h-8 sm:w-8">
                <Banknote className="h-3.5 w-3.5 text-gold sm:h-4 sm:w-4" />
              </div>
              <span className="text-xs text-muted sm:text-sm">Cash &amp; Equivalents</span>
            </div>
            <span className="text-sm font-medium text-foreground sm:text-base">
              {formatCurrency(cashBalance)}
            </span>
          </div>

          {/* Cost Basis */}
          <div className="flex items-center justify-between py-2.5 sm:py-3">
            <span className="text-xs text-muted sm:text-sm">Cost Basis</span>
            <span className="text-sm font-medium text-foreground sm:text-base">
              {formatCurrency(totalCost)}
            </span>
          </div>

          {/* Total Gain/Loss */}
          <div className="flex items-center justify-between py-2.5 sm:py-3">
            <div className="flex items-center gap-2 sm:gap-3">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-md sm:h-8 sm:w-8 ${
                  isPositive ? "bg-gain/10" : "bg-loss/10"
                }`}
              >
                {isPositive ? (
                  <TrendingUp className="h-3.5 w-3.5 text-gain sm:h-4 sm:w-4" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5 text-loss sm:h-4 sm:w-4" />
                )}
              </div>
              <span className="text-xs text-muted sm:text-sm">
                Total Gain/Loss
              </span>
            </div>
            <div className="text-right">
              <span
                className={`text-sm font-semibold sm:text-base ${
                  isPositive ? "text-gain" : "text-loss"
                }`}
              >
                {formatCurrency(totalGainLoss)}
              </span>
              <span
                className={`ml-2 text-xs sm:text-sm ${
                  isPositive ? "text-gain" : "text-loss"
                }`}
              >
                ({formatPercent(totalGainLossPercent)})
              </span>
            </div>
          </div>

          {/* Holdings Count */}
          <div className="flex items-center justify-between py-2.5 sm:py-3">
            <span className="text-xs text-muted sm:text-sm">
              Active Holdings
            </span>
            <span className="text-sm font-medium text-foreground sm:text-base">
              {holdingsCount} stocks
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
