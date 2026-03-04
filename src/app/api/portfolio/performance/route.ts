import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { getHistoricalData, getQuotes } from "@/lib/yahoo";
import { calculatePortfolioSummary, calculateNAV } from "@/lib/calculations";

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

    // Determine start date based on period
    const now = new Date();
    let startDate: string;

    switch (period) {
      case "1mo": {
        const d = new Date(now);
        d.setMonth(d.getMonth() - 1);
        startDate = d.toISOString().split("T")[0];
        break;
      }
      case "3mo": {
        const d = new Date(now);
        d.setMonth(d.getMonth() - 3);
        startDate = d.toISOString().split("T")[0];
        break;
      }
      case "1y": {
        const d = new Date(now);
        d.setFullYear(d.getFullYear() - 1);
        startDate = d.toISOString().split("T")[0];
        break;
      }
      case "5y": {
        const d = new Date(now);
        d.setFullYear(d.getFullYear() - 5);
        startDate = d.toISOString().split("T")[0];
        break;
      }
      case "max":
      default:
        startDate = "2020-01-01";
        break;
    }

    // ── Fetch NAV history from Supabase ──────────────────────────────
    // NAV history is recorded daily and correctly reflects the actual
    // portfolio composition at each point in time (accounts for when
    // stocks were acquired/sold, cash changes, etc.)
    const { data: navHistory, error: navError } = await supabase
      .from("nav_history")
      .select(
        "snapshot_date, nav_per_unit, total_value, total_units, total_gain_loss_percent, num_holdings"
      )
      .gte("snapshot_date", startDate)
      .order("snapshot_date", { ascending: true });

    if (navError) {
      console.error("NAV history fetch error:", navError);
    }

    // ── Calculate today's live NAV as the latest data point ──────────
    const [holdingsRes, metadataRes] = await Promise.all([
      supabase.from("portfolio_holdings").select("*").eq("is_active", true),
      supabase.from("fund_metadata").select("*").limit(1).single(),
    ]);

    const holdings = holdingsRes.data || [];
    const metadata = metadataRes.data;
    const stockHoldings = holdings.filter((h) => h.ticker !== "CASH");
    const cashHolding = holdings.find((h) => h.ticker === "CASH");
    const cashBalance = cashHolding?.shares || 0;
    const totalUnits = metadata?.total_units_outstanding || 0;

    let liveNavPerUnit = 0;
    let liveTotalValue = 0;

    if (stockHoldings.length > 0 && totalUnits > 0) {
      const tickers = stockHoldings.map((h) => h.ticker);
      const quotes = await getQuotes(tickers);
      const summary = calculatePortfolioSummary(
        stockHoldings,
        quotes,
        cashBalance
      );
      liveTotalValue = summary.totalValue;
      liveNavPerUnit = calculateNAV(summary.totalValue, totalUnits);
    }

    // ── Build the NAV-based performance data ─────────────────────────
    // Combine stored NAV history with today's live NAV
    const navPoints: { date: string; navPerUnit: number }[] = [];

    if (navHistory && navHistory.length > 0) {
      for (const nav of navHistory) {
        navPoints.push({
          date: nav.snapshot_date,
          navPerUnit: nav.nav_per_unit,
        });
      }
    }

    // Add today's live NAV if it's not already in the history
    const todayDate = now.toLocaleDateString("en-CA", {
      timeZone: "America/New_York",
    });
    const lastNavDate =
      navPoints.length > 0 ? navPoints[navPoints.length - 1].date : null;

    if (liveNavPerUnit > 0 && todayDate !== lastNavDate) {
      navPoints.push({
        date: todayDate,
        navPerUnit: liveNavPerUnit,
      });
    } else if (liveNavPerUnit > 0 && todayDate === lastNavDate) {
      // Update today's entry with live value
      navPoints[navPoints.length - 1].navPerUnit = liveNavPerUnit;
    }

    // If we have no NAV data at all, return empty
    if (navPoints.length === 0) {
      return NextResponse.json({
        portfolio: [],
        sp500: [],
        stats: {
          portfolioReturn: 0,
          sp500Return: 0,
          alpha: 0,
          totalValue: liveTotalValue,
          holdingsCount: stockHoldings.length,
        },
      });
    }

    // ── Fetch SPY data for S&P 500 comparison ────────────────────────
    const spyHistorical = await getHistoricalData("SPY", period);
    const spyMap = new Map<string, number>();
    for (const point of spyHistorical) {
      spyMap.set(point.time, point.close);
    }

    // ── Build indexed performance (base = 100) ──────────────────────
    const firstNav = navPoints[0].navPerUnit;
    const firstNavDate = navPoints[0].date;

    // Find SPY price at or nearest to our first NAV date
    let spyFirstPrice: number | undefined;
    // First try exact match
    spyFirstPrice = spyMap.get(firstNavDate);
    // If no exact match, find the nearest date on or after
    if (!spyFirstPrice) {
      const spyDates = Array.from(spyMap.keys()).sort();
      for (const date of spyDates) {
        if (date >= firstNavDate) {
          spyFirstPrice = spyMap.get(date);
          break;
        }
      }
    }
    if (!spyFirstPrice) spyFirstPrice = 1;

    const portfolioPerformance: { time: string; value: number }[] = [];
    const sp500Performance: { time: string; value: number }[] = [];

    for (const nav of navPoints) {
      // Portfolio line: indexed to 100 based on NAV per unit
      portfolioPerformance.push({
        time: nav.date,
        value: (nav.navPerUnit / firstNav) * 100,
      });

      // SPY line: find the closest SPY price for this date
      const spyPrice = spyMap.get(nav.date);
      if (spyPrice) {
        sp500Performance.push({
          time: nav.date,
          value: (spyPrice / spyFirstPrice!) * 100,
        });
      }
    }

    // If SPY has data for today that wasn't matched, add it
    const spyToday = spyMap.get(todayDate);
    const lastSpyDate =
      sp500Performance.length > 0
        ? sp500Performance[sp500Performance.length - 1].time
        : null;
    if (spyToday && todayDate !== lastSpyDate) {
      sp500Performance.push({
        time: todayDate,
        value: (spyToday / spyFirstPrice!) * 100,
      });
    }

    // ── Calculate summary stats ──────────────────────────────────────
    const lastNavValue = navPoints[navPoints.length - 1].navPerUnit;
    const portfolioReturn = ((lastNavValue / firstNav) - 1) * 100;

    let sp500Return = 0;
    if (sp500Performance.length > 0) {
      sp500Return =
        sp500Performance[sp500Performance.length - 1].value - 100;
    }

    return NextResponse.json({
      portfolio: portfolioPerformance,
      sp500: sp500Performance,
      stats: {
        portfolioReturn,
        sp500Return,
        alpha: portfolioReturn - sp500Return,
        totalValue: liveTotalValue,
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
