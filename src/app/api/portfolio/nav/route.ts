import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { getQuotes } from "@/lib/yahoo";
import {
  calculatePortfolioSummary,
  calculateNAV,
} from "@/lib/calculations";

export const revalidate = 300;

export async function GET() {
  try {
    const supabase = createServerClient();

    // Get holdings
    const { data: holdings, error: holdingsError } = await supabase
      .from("portfolio_holdings")
      .select("*")
      .eq("is_active", true);

    if (holdingsError) {
      return NextResponse.json(
        { error: holdingsError.message },
        { status: 500 }
      );
    }

    // Get fund metadata
    const { data: metadata, error: metaError } = await supabase
      .from("fund_metadata")
      .select("*")
      .limit(1)
      .single();

    if (metaError) {
      return NextResponse.json(
        { error: metaError.message },
        { status: 500 }
      );
    }

    if (!holdings || holdings.length === 0) {
      return NextResponse.json({
        nav: 0,
        totalValue: 0,
        totalUnits: metadata?.total_units_outstanding || 0,
      });
    }

    const tickers = holdings.map((h) => h.ticker);
    const quotes = await getQuotes(tickers);
    const summary = calculatePortfolioSummary(holdings, quotes);
    const nav = calculateNAV(
      summary.totalValue,
      metadata.total_units_outstanding
    );

    return NextResponse.json({
      nav,
      totalValue: summary.totalValue,
      totalUnits: metadata.total_units_outstanding,
    });
  } catch (err) {
    console.error("Error calculating NAV:", err);
    return NextResponse.json(
      { error: "Failed to calculate NAV" },
      { status: 500 }
    );
  }
}
