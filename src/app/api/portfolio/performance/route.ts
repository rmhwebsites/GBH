import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { getHistoricalData, getQuotes } from "@/lib/yahoo";
import { calculatePortfolioSummary, calculateNAV } from "@/lib/calculations";
import { requireAuth, isAuthError } from "@/lib/auth";
import { getVerifiedTotalUnits } from "@/lib/units";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (isAuthError(auth)) return auth;
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

    // ── Fetch all data in parallel ─────────────────────────────────────
    const [navHistoryRes, holdingsRes, metadataRes] = await Promise.all([
      supabase
        .from("nav_history")
        .select(
          "snapshot_date, nav_per_unit, total_value, total_units, total_gain_loss_percent, num_holdings"
        )
        .gte("snapshot_date", startDate)
        .order("snapshot_date", { ascending: true }),
      supabase.from("portfolio_holdings").select("*").eq("is_active", true),
      supabase.from("fund_metadata").select("*").limit(1).single(),
    ]);

    const navHistory = navHistoryRes.data || [];
    const holdings = holdingsRes.data || [];
    const stockHoldings = holdings.filter((h) => h.ticker !== "CASH");
    const cashHolding = holdings.find((h) => h.ticker === "CASH");
    const cashBalance = cashHolding?.shares || 0;

    // SAFETY GUARD: Always use verified total units
    const verification = await getVerifiedTotalUnits(supabase);
    const totalUnits = verification.totalMemberUnits;

    // ── Calculate live portfolio data (single quote fetch) ─────────────
    let liveNavPerUnit = 0;
    let liveTotalValue = 0;
    let costBasisReturn = 0;

    if (stockHoldings.length > 0) {
      const tickers = stockHoldings.map((h) => h.ticker);
      const quotes = await getQuotes(tickers);
      const summary = calculatePortfolioSummary(
        stockHoldings,
        quotes,
        cashBalance
      );
      liveTotalValue = summary.totalValue;
      costBasisReturn = summary.totalGainLossPercent;

      if (totalUnits > 0) {
        liveNavPerUnit = calculateNAV(summary.totalValue, totalUnits);
      }
    }

    // ── Build NAV time-series ──────────────────────────────────────────
    const navPoints: { date: string; navPerUnit: number }[] = [];

    if (navHistory.length > 0) {
      for (const nav of navHistory) {
        navPoints.push({
          date: nav.snapshot_date,
          navPerUnit: nav.nav_per_unit,
        });
      }
    }

    // Add today's live NAV
    const todayDate = now.toLocaleDateString("en-CA", {
      timeZone: "America/New_York",
    });
    const lastNavDate =
      navPoints.length > 0 ? navPoints[navPoints.length - 1].date : null;

    if (liveNavPerUnit > 0 && todayDate !== lastNavDate) {
      navPoints.push({ date: todayDate, navPerUnit: liveNavPerUnit });
    } else if (liveNavPerUnit > 0 && todayDate === lastNavDate) {
      navPoints[navPoints.length - 1].navPerUnit = liveNavPerUnit;
    }

    // ── Fetch SPY data for S&P 500 comparison ──────────────────────────
    const spyHistorical = await getHistoricalData("SPY", period);
    const spyMap = new Map<string, number>();
    for (const point of spyHistorical) {
      spyMap.set(point.time, point.close);
    }

    // ── Build indexed performance (base = 100) ─────────────────────────
    const hasNavHistory = navPoints.length >= 2;

    const portfolioPerformance: { time: string; value: number }[] = [];
    const sp500Performance: { time: string; value: number }[] = [];

    let portfolioReturn = 0;
    let sp500Return = 0;

    if (hasNavHistory) {
      // ── NAV-based chart (preferred — reflects actual portfolio changes) ──
      const firstNav = navPoints[0].navPerUnit;
      const firstNavDate = navPoints[0].date;

      // Find SPY price at or nearest to our first NAV date
      let spyFirstPrice: number | undefined;
      spyFirstPrice = spyMap.get(firstNavDate);
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

      for (const nav of navPoints) {
        portfolioPerformance.push({
          time: nav.date,
          value: (nav.navPerUnit / firstNav) * 100,
        });

        const spyPrice = spyMap.get(nav.date);
        if (spyPrice) {
          sp500Performance.push({
            time: nav.date,
            value: (spyPrice / spyFirstPrice!) * 100,
          });
        }
      }

      // Add SPY today if not matched
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

      const lastNavValue = navPoints[navPoints.length - 1].navPerUnit;
      portfolioReturn = ((lastNavValue / firstNav) - 1) * 100;

      if (sp500Performance.length > 0) {
        sp500Return =
          sp500Performance[sp500Performance.length - 1].value - 100;
      }
    } else {
      // ── Not enough NAV history: show SPY chart + cost-basis return ──
      const spyDates = Array.from(spyMap.keys()).sort();
      if (spyDates.length > 0) {
        const spyFirstPrice = spyMap.get(spyDates[0]) || 1;
        for (const date of spyDates) {
          const price = spyMap.get(date)!;
          sp500Performance.push({
            time: date,
            value: (price / spyFirstPrice) * 100,
          });
        }
        sp500Return =
          sp500Performance[sp500Performance.length - 1].value - 100;
      }

      // Use cost-basis return (total gain/loss %)
      portfolioReturn = costBasisReturn;

      // Show single portfolio point so the chart isn't entirely empty
      if (liveNavPerUnit > 0) {
        portfolioPerformance.push({
          time: todayDate,
          value: 100 + costBasisReturn,
        });
      }
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
