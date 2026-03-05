import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { getQuotes } from "@/lib/yahoo";
import { calculatePortfolioSummary } from "@/lib/calculations";
import { requireAdmin, isAuthError } from "@/lib/auth";

/**
 * Recalibrate fund units so NAV accurately reflects portfolio performance.
 *
 * The issue: If total_units_outstanding doesn't match the portfolio's cost basis,
 * the NAV will be wrong and member returns will be inflated/deflated.
 *
 * The fix: Set total_units_outstanding = portfolio cost basis.
 * Each member keeps their units (1 unit per $1 invested).
 * The "untracked" units (cost_basis - member_units) represent seed capital.
 *
 * After recalibration:
 *   NAV = portfolio_value / portfolio_cost_basis
 *   Member return % = portfolio return % (correct!)
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (isAuthError(auth)) return auth;

  try {
    const supabase = createServerClient();

    // Get all active holdings
    const { data: holdings, error: holdingsError } = await supabase
      .from("portfolio_holdings")
      .select("*")
      .eq("is_active", true);

    if (holdingsError || !holdings || holdings.length === 0) {
      return NextResponse.json(
        { error: "No active holdings found" },
        { status: 400 }
      );
    }

    // Separate cash from stock holdings
    const cashHolding = holdings.find((h) => h.ticker === "CASH");
    const stockHoldings = holdings.filter((h) => h.ticker !== "CASH");
    const cashBalance = cashHolding?.shares || 0;

    // Calculate the portfolio cost basis (what was actually spent to buy stocks)
    const tickers = stockHoldings.map((h) => h.ticker);
    const quotes = tickers.length > 0 ? await getQuotes(tickers) : [];
    const summary = calculatePortfolioSummary(
      stockHoldings,
      quotes,
      cashBalance
    );
    const portfolioCostBasis = summary.totalCost; // shares × avg_cost_basis for each stock + cash

    // Get current member total units
    const { data: members } = await supabase
      .from("member_investments")
      .select("units_owned");

    const totalMemberUnits =
      members?.reduce((sum, m) => sum + m.units_owned, 0) || 0;

    // Get current metadata
    const { data: metadata } = await supabase
      .from("fund_metadata")
      .select("*")
      .limit(1)
      .single();

    const oldTotalUnits = metadata?.total_units_outstanding || 0;
    const newTotalUnits = portfolioCostBasis;
    const newNAV = summary.totalValue / newTotalUnits;

    // Update total units outstanding to match portfolio cost basis
    if (metadata) {
      await supabase
        .from("fund_metadata")
        .update({ total_units_outstanding: newTotalUnits })
        .eq("id", metadata.id);
    } else {
      await supabase.from("fund_metadata").insert({
        total_units_outstanding: newTotalUnits,
        fund_inception_date: new Date().toISOString().split("T")[0],
      });
    }

    return NextResponse.json({
      success: true,
      portfolioCostBasis,
      portfolioValue: summary.totalValue,
      portfolioReturn: ((summary.totalValue - portfolioCostBasis) / portfolioCostBasis * 100).toFixed(2) + "%",
      oldTotalUnits,
      newTotalUnits,
      totalMemberUnits,
      untrackedUnits: newTotalUnits - totalMemberUnits,
      newNAV,
      message: `Units recalibrated. NAV now reflects actual portfolio performance. ${(newTotalUnits - totalMemberUnits).toFixed(2)} untracked units represent seed capital not assigned to any member.`,
    });
  } catch (err) {
    console.error("Error recalibrating:", err);
    return NextResponse.json(
      { error: "Failed to recalibrate" },
      { status: 500 }
    );
  }
}
