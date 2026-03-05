import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { getQuotes } from "@/lib/yahoo";
import { calculatePortfolioSummary } from "@/lib/calculations";

export const revalidate = 300;

export async function GET() {
  try {
    const supabase = createServerClient();

    const { data: holdings, error } = await supabase
      .from("portfolio_holdings")
      .select("*")
      .eq("is_active", true)
      .order("ticker");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!holdings || holdings.length === 0) {
      return NextResponse.json({
        totalValue: 0,
        totalCost: 0,
        totalGainLoss: 0,
        totalGainLossPercent: 0,
        totalDayChange: 0,
        totalDayChangePercent: 0,
        holdings: [],
        cashBalance: 0,
      });
    }

    // Separate cash from stock holdings
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

    return NextResponse.json(summary);
  } catch (err) {
    console.error("Error fetching portfolio:", err);
    return NextResponse.json(
      { error: "Failed to fetch portfolio" },
      { status: 500 }
    );
  }
}
