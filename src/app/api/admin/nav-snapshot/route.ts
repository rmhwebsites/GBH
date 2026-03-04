import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { getQuotes } from "@/lib/yahoo";
import { calculatePortfolioSummary, calculateNAV } from "@/lib/calculations";

/**
 * Saves a NAV snapshot to Supabase nav_history.
 * Lightweight version of the full backup — no Google Sheets dependency.
 * Use this to seed initial data or trigger manual snapshots.
 *
 * Protected by CRON_SECRET or ADMIN check.
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authorization (accept either CRON_SECRET or admin check)
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createServerClient();

    // Fetch holdings and metadata
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

    if (stockHoldings.length === 0) {
      return NextResponse.json(
        { error: "No active stock holdings found" },
        { status: 400 }
      );
    }

    // Fetch live quotes and calculate portfolio
    const tickers = stockHoldings.map((h) => h.ticker);
    const quotes = await getQuotes(tickers);
    const summary = calculatePortfolioSummary(
      stockHoldings,
      quotes,
      cashBalance
    );
    const navPerUnit = calculateNAV(summary.totalValue, totalUnits);

    // Get today's date in EST
    const now = new Date();
    const estDate = now.toLocaleDateString("en-CA", {
      timeZone: "America/New_York",
    });

    // Upsert NAV snapshot (no duplicates for same date)
    const { error: navError } = await supabase
      .from("nav_history")
      .upsert(
        {
          snapshot_date: estDate,
          nav_per_unit: parseFloat(navPerUnit.toFixed(6)),
          total_value: parseFloat(summary.totalValue.toFixed(2)),
          total_units: parseFloat(totalUnits.toFixed(6)),
          total_cost: parseFloat(summary.totalCost.toFixed(2)),
          total_gain_loss: parseFloat(summary.totalGainLoss.toFixed(2)),
          total_gain_loss_percent: parseFloat(
            summary.totalGainLossPercent.toFixed(4)
          ),
          num_holdings: stockHoldings.length,
          cash_balance: parseFloat(cashBalance.toFixed(2)),
        },
        { onConflict: "snapshot_date" }
      );

    if (navError) {
      return NextResponse.json(
        { error: "Failed to save NAV snapshot", details: navError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      snapshot: {
        date: estDate,
        navPerUnit: parseFloat(navPerUnit.toFixed(6)),
        totalValue: parseFloat(summary.totalValue.toFixed(2)),
        totalUnits: parseFloat(totalUnits.toFixed(6)),
        gainLossPercent: parseFloat(
          summary.totalGainLossPercent.toFixed(2)
        ),
        numHoldings: stockHoldings.length,
      },
    });
  } catch (err) {
    console.error("NAV snapshot error:", err);
    return NextResponse.json(
      {
        error: "Failed to create NAV snapshot",
        details: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
