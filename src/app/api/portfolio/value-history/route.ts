import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { getQuotes } from "@/lib/yahoo";
import { calculatePortfolioSummary } from "@/lib/calculations";
import { requireAuth, isAuthError } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (isAuthError(auth)) return auth;
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "max";

    const supabase = createServerClient();

    // Calculate start date based on period
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
      default:
        startDate = "2020-01-01";
        break;
    }

    // Fetch nav history and live holdings in parallel
    const [navRes, holdingsRes] = await Promise.all([
      supabase
        .from("nav_history")
        .select("snapshot_date, total_value")
        .gte("snapshot_date", startDate)
        .order("snapshot_date", { ascending: true }),
      supabase.from("portfolio_holdings").select("*").eq("is_active", true),
    ]);

    const navHistory = navRes.data || [];
    const holdings = holdingsRes.data || [];

    // Build points array from history
    const points: { time: string; value: number }[] = [];

    for (const nav of navHistory) {
      points.push({
        time: nav.snapshot_date,
        value: nav.total_value,
      });
    }

    // Add today's live value
    const stockHoldings = holdings.filter((h) => h.ticker !== "CASH");
    const cashHolding = holdings.find((h) => h.ticker === "CASH");
    const cashBalance = cashHolding?.shares || 0;

    if (stockHoldings.length > 0) {
      const tickers = stockHoldings.map((h) => h.ticker);
      const quotes = await getQuotes(tickers);
      const summary = calculatePortfolioSummary(
        stockHoldings,
        quotes,
        cashBalance
      );

      const todayDate = now.toLocaleDateString("en-CA", {
        timeZone: "America/New_York",
      });

      const lastDate =
        points.length > 0 ? points[points.length - 1].time : null;

      if (todayDate !== lastDate) {
        points.push({ time: todayDate, value: summary.totalValue });
      } else {
        // Update today's value with live data
        points[points.length - 1].value = summary.totalValue;
      }
    }

    return NextResponse.json({ points });
  } catch (err) {
    console.error("Error fetching value history:", err);
    return NextResponse.json(
      { error: "Failed to fetch value history" },
      { status: 500 }
    );
  }
}
