import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { getHistoricalData, getQuotes } from "@/lib/yahoo";
import type { ChartDataPoint } from "@/types/database";

export const revalidate = 3600; // Cache for 1 hour

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const period = (searchParams.get("period") || "1y") as
      | "1mo"
      | "3mo"
      | "1y"
      | "5y"
      | "max";

    const supabase = createServerClient();

    // Get active holdings
    const { data: holdings, error } = await supabase
      .from("portfolio_holdings")
      .select("*")
      .eq("is_active", true);

    if (error || !holdings || holdings.length === 0) {
      return NextResponse.json({ portfolio: [], sp500: [] });
    }

    // Filter out CASH from performance calculations
    const stockHoldings = holdings.filter((h) => h.ticker !== "CASH");

    if (stockHoldings.length === 0) {
      return NextResponse.json({ portfolio: [], sp500: [] });
    }

    // Fetch historical data for all tickers + SPY (S&P 500 ETF)
    const tickers = stockHoldings.map((h) => h.ticker);
    const allTickers = [...tickers, "SPY"];

    const historicalPromises = allTickers.map((ticker) =>
      getHistoricalData(ticker, period).then((data) => ({
        ticker,
        data,
      }))
    );

    const results = await Promise.all(historicalPromises);

    // Build a map of ticker -> date -> close price
    const tickerData = new Map<string, Map<string, number>>();
    for (const result of results) {
      const dateMap = new Map<string, number>();
      for (const point of result.data) {
        dateMap.set(point.time, point.close);
      }
      tickerData.set(result.ticker, dateMap);
    }

    // Get SPY data
    const spyData = tickerData.get("SPY");
    if (!spyData) {
      return NextResponse.json({ portfolio: [], sp500: [] });
    }

    // Get all unique dates from SPY (it's the most liquid, so use it as baseline)
    const dates = Array.from(spyData.keys()).sort();

    if (dates.length === 0) {
      return NextResponse.json({ portfolio: [], sp500: [] });
    }

    // Calculate portfolio value for each date
    // Use share quantities from current holdings (simplified - assumes constant position)
    const holdingShares = new Map(
      stockHoldings.map((h) => [h.ticker, h.shares])
    );

    // Get current quotes for reference
    const quotes = await getQuotes(tickers);
    const totalCurrentValue = stockHoldings.reduce((sum, h) => {
      const quote = quotes.find((q) => q.ticker === h.ticker);
      return sum + (quote ? h.shares * quote.price : 0);
    }, 0);

    // Find the first date where we have data for all holdings
    let firstValidDate = dates[0];
    for (const date of dates) {
      const allHaveData = tickers.every((t) => tickerData.get(t)?.has(date));
      if (allHaveData) {
        firstValidDate = date;
        break;
      }
    }

    // Calculate indexed performance (base = 100)
    const spyFirstPrice = spyData.get(firstValidDate) || 1;

    // Calculate portfolio value at start
    let portfolioFirstValue = 0;
    for (const h of stockHoldings) {
      const price = tickerData.get(h.ticker)?.get(firstValidDate);
      if (price) {
        portfolioFirstValue += h.shares * price;
      }
    }

    if (portfolioFirstValue === 0) portfolioFirstValue = 1;

    const portfolioPerformance: { time: string; value: number }[] = [];
    const sp500Performance: { time: string; value: number }[] = [];

    for (const date of dates) {
      if (date < firstValidDate) continue;

      // Portfolio value
      let portfolioValue = 0;
      let allValid = true;
      for (const h of stockHoldings) {
        const price = tickerData.get(h.ticker)?.get(date);
        if (price) {
          portfolioValue += h.shares * price;
        } else {
          allValid = false;
        }
      }

      const spyPrice = spyData.get(date);
      if (!spyPrice || !allValid) continue;

      portfolioPerformance.push({
        time: date,
        value: (portfolioValue / portfolioFirstValue) * 100,
      });

      sp500Performance.push({
        time: date,
        value: (spyPrice / spyFirstPrice) * 100,
      });
    }

    // Also calculate summary stats
    const lastPortfolioVal =
      portfolioPerformance.length > 0
        ? portfolioPerformance[portfolioPerformance.length - 1].value
        : 100;
    const lastSPYVal =
      sp500Performance.length > 0
        ? sp500Performance[sp500Performance.length - 1].value
        : 100;

    return NextResponse.json({
      portfolio: portfolioPerformance,
      sp500: sp500Performance,
      stats: {
        portfolioReturn: lastPortfolioVal - 100,
        sp500Return: lastSPYVal - 100,
        alpha: lastPortfolioVal - lastSPYVal,
        totalValue: totalCurrentValue,
        holdingsCount: stockHoldings.length,
      },
    });
  } catch (err) {
    console.error("Error fetching performance:", err);
    return NextResponse.json(
      { error: "Failed to fetch performance data" },
      { status: 500 }
    );
  }
}
