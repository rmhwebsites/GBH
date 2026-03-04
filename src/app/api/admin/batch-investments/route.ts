import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

/**
 * Batch endpoint to delete all existing investment records and re-enter
 * them with correct dates and NAV-based units.
 *
 * Body: { investments: Array<{ memberstack_id, member_name, member_email, amount, date, nav? }> }
 * If nav is provided, units = amount / nav. Otherwise units = amount (1:1 at $1.00 NAV).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const investments: Array<{
      memberstack_id: string;
      member_name: string;
      member_email: string;
      amount: number;
      date: string;
      nav?: number;
    }> = body.investments;

    if (!investments || investments.length === 0) {
      return NextResponse.json(
        { error: "No investments provided" },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // Step 1: Delete ALL existing member_investments records
    const { error: deleteError } = await supabase
      .from("member_investments")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000"); // delete all rows

    if (deleteError) {
      return NextResponse.json(
        { error: `Delete failed: ${deleteError.message}` },
        { status: 500 }
      );
    }

    // Step 2: Reset total_units_outstanding to 0
    const { data: metadata } = await supabase
      .from("fund_metadata")
      .select("*")
      .limit(1)
      .single();

    if (metadata) {
      await supabase
        .from("fund_metadata")
        .update({ total_units_outstanding: 0 })
        .eq("id", metadata.id);
    }

    // Step 3: Insert all investments (units = amount/nav if nav provided, else 1:1)
    const insertData = investments.map((inv) => ({
      memberstack_id: inv.memberstack_id,
      member_name: inv.member_name,
      member_email: inv.member_email,
      amount_invested: inv.amount,
      units_owned: inv.nav ? inv.amount / inv.nav : inv.amount,
      investment_date: inv.date,
    }));

    const { data: inserted, error: insertError } = await supabase
      .from("member_investments")
      .insert(insertData)
      .select();

    if (insertError) {
      return NextResponse.json(
        { error: `Insert failed: ${insertError.message}` },
        { status: 500 }
      );
    }

    // Step 4: Calculate total member units and update fund_metadata
    const totalUnits = insertData.reduce((sum, inv) => sum + inv.units_owned, 0);

    if (metadata) {
      await supabase
        .from("fund_metadata")
        .update({ total_units_outstanding: totalUnits })
        .eq("id", metadata.id);
    }

    // Step 5: Auto-recalibrate NAV (set total_units = portfolio cost basis)
    const { data: holdings } = await supabase
      .from("portfolio_holdings")
      .select("*")
      .eq("is_active", true);

    let recalibrated = false;
    let newNAV = 0;

    if (holdings && holdings.length > 0) {
      const { getQuotes } = await import("@/lib/yahoo");
      const { calculatePortfolioSummary } = await import(
        "@/lib/calculations"
      );

      // Separate cash from stock holdings
      const cashHolding = holdings.find((h: { ticker: string }) => h.ticker === "CASH");
      const stockHoldings = holdings.filter((h: { ticker: string }) => h.ticker !== "CASH");
      const cashBalance = cashHolding?.shares || 0;

      const tickers = stockHoldings.map((h: { ticker: string }) => h.ticker);
      const quotes = tickers.length > 0 ? await getQuotes(tickers) : [];
      const summary = calculatePortfolioSummary(stockHoldings, quotes, cashBalance);
      const portfolioCostBasis = summary.totalCost;

      if (metadata) {
        await supabase
          .from("fund_metadata")
          .update({ total_units_outstanding: portfolioCostBasis })
          .eq("id", metadata.id);
      }

      newNAV = summary.totalValue / portfolioCostBasis;
      recalibrated = true;
    }

    return NextResponse.json({
      success: true,
      recordsInserted: inserted?.length || 0,
      totalMemberUnits: totalUnits,
      recalibrated,
      newNAV,
    });
  } catch (err) {
    console.error("Batch investment error:", err);
    return NextResponse.json(
      { error: "Failed to batch process investments" },
      { status: 500 }
    );
  }
}
