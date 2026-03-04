import { NextResponse } from "next/server";
import { getQuotes } from "@/lib/yahoo";
import { createServerClient } from "@/lib/supabase";

export const revalidate = 300; // 5 minutes

export async function GET() {
  try {
    const supabase = createServerClient();

    // Get all active holdings
    const { data: holdings, error } = await supabase
      .from("portfolio_holdings")
      .select("ticker")
      .eq("is_active", true);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!holdings || holdings.length === 0) {
      return NextResponse.json({ quotes: [] });
    }

    const tickers = holdings.map((h) => h.ticker);
    const quotes = await getQuotes(tickers);

    return NextResponse.json({ quotes });
  } catch (err) {
    console.error("Error fetching quotes:", err);
    return NextResponse.json(
      { error: "Failed to fetch stock quotes" },
      { status: 500 }
    );
  }
}
