import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { requireAuth, isAuthError } from "@/lib/auth";
import { getQuotes } from "@/lib/yahoo";
import { calculateIncome } from "@/lib/dividends";

/**
 * Dividend income the current holdings generate, month by month.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (isAuthError(auth)) return auth;

  try {
    const supabase = createServerClient();
    const { data: holdings, error } = await supabase
      .from("portfolio_holdings")
      .select("ticker, shares")
      .eq("is_active", true);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const stocks = (holdings || []).filter(
      (h) => h.ticker !== "CASH" && Number(h.shares) > 0
    );
    if (stocks.length === 0) {
      return NextResponse.json({
        months: [],
        annualTotal: 0,
        yieldPercent: 0,
        perHolding: [],
        nonPaying: [],
      });
    }

    // Yield is quoted against invested value, not the cash pile — cash earns
    // money-market interest that this calculation does not attempt to model.
    const quotes = await getQuotes(stocks.map((h) => h.ticker));
    const priceOf = new Map(quotes.map((q) => [q.ticker, q.price]));
    const investedValue = stocks.reduce(
      (sum, h) => sum + Number(h.shares) * (priceOf.get(h.ticker) || 0),
      0
    );

    const income = await calculateIncome(
      stocks.map((h) => ({ ticker: h.ticker, shares: Number(h.shares) })),
      investedValue,
      new Date()
    );

    return NextResponse.json(income);
  } catch (err) {
    console.error("Error calculating income:", err);
    return NextResponse.json(
      { error: "Failed to calculate income" },
      { status: 500 }
    );
  }
}
