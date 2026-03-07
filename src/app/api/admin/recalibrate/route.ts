import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { getQuotes } from "@/lib/yahoo";
import { calculatePortfolioSummary } from "@/lib/calculations";
import { requireAdmin, isAuthError } from "@/lib/auth";
import { syncTotalUnits } from "@/lib/units";

/**
 * Recalibrate fund units so NAV accurately reflects portfolio performance.
 *
 * total_units_outstanding MUST always equal the sum of member_investments.units_owned.
 * This endpoint syncs fund_metadata to match the actual member units.
 *
 * NAV = portfolio_value / total_member_units
 * This gives each member their correct proportional share of the fund.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (isAuthError(auth)) return auth;

  try {
    const supabase = createServerClient();

    // Get current metadata (before fix)
    const { data: metadata } = await supabase
      .from("fund_metadata")
      .select("*")
      .limit(1)
      .single();

    const oldTotalUnits = metadata?.total_units_outstanding || 0;

    // Sync total_units_outstanding to actual member units (the source of truth)
    const newTotalUnits = await syncTotalUnits(supabase);

    // Get portfolio value for NAV calculation
    const { data: holdings } = await supabase
      .from("portfolio_holdings")
      .select("*")
      .eq("is_active", true);

    let portfolioValue = 0;
    let portfolioCostBasis = 0;

    if (holdings && holdings.length > 0) {
      const cashHolding = holdings.find((h) => h.ticker === "CASH");
      const stockHoldings = holdings.filter((h) => h.ticker !== "CASH");
      const cashBalance = cashHolding?.shares || 0;

      const tickers = stockHoldings.map((h) => h.ticker);
      const quotes = tickers.length > 0 ? await getQuotes(tickers) : [];
      const summary = calculatePortfolioSummary(
        stockHoldings,
        quotes,
        cashBalance
      );
      portfolioValue = summary.totalValue;
      portfolioCostBasis = summary.totalCost;
    }

    const newNAV = newTotalUnits > 0 ? portfolioValue / newTotalUnits : 0;
    const unitsDiff = oldTotalUnits - newTotalUnits;

    return NextResponse.json({
      success: true,
      oldTotalUnits,
      newTotalUnits,
      unitsCorrected: Math.abs(unitsDiff) > 0.01 ? unitsDiff.toFixed(6) : "0 (already correct)",
      portfolioValue,
      portfolioCostBasis,
      newNAV,
      message:
        Math.abs(unitsDiff) > 0.01
          ? `Units recalibrated. Corrected by ${unitsDiff.toFixed(6)} units. NAV is now ${newNAV.toFixed(6)}.`
          : `Units already correct (${newTotalUnits.toFixed(6)}). NAV = ${newNAV.toFixed(6)}.`,
    });
  } catch (err) {
    console.error("Error recalibrating:", err);
    return NextResponse.json(
      { error: "Failed to recalibrate" },
      { status: 500 }
    );
  }
}
