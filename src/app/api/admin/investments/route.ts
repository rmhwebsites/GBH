import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const supabase = createServerClient();

    const amount = body.amount; // positive = invest, negative = withdraw

    // Get current NAV to calculate units
    const { data: holdings } = await supabase
      .from("portfolio_holdings")
      .select("*")
      .eq("is_active", true);

    const { data: metadata } = await supabase
      .from("fund_metadata")
      .select("*")
      .limit(1)
      .single();

    let navPerUnit = 0;
    let unitsToGrant = 0;

    if (
      metadata &&
      metadata.total_units_outstanding > 0 &&
      holdings &&
      holdings.length > 0
    ) {
      const { getQuotes } = await import("@/lib/yahoo");
      const { calculatePortfolioSummary, calculateNAV } = await import(
        "@/lib/calculations"
      );

      // Separate cash from stock holdings
      const cashHolding = holdings.find(
        (h: { ticker: string }) => h.ticker === "CASH"
      );
      const stockHoldings = holdings.filter(
        (h: { ticker: string }) => h.ticker !== "CASH"
      );
      const cashBalance = cashHolding?.shares || 0;

      const tickers = stockHoldings.map((h: { ticker: string }) => h.ticker);
      const quotes = tickers.length > 0 ? await getQuotes(tickers) : [];
      const summary = calculatePortfolioSummary(
        stockHoldings,
        quotes,
        cashBalance
      );
      navPerUnit = calculateNAV(
        summary.totalValue,
        metadata.total_units_outstanding
      );

      if (navPerUnit > 0) {
        unitsToGrant = amount / navPerUnit;
      }
    } else {
      // First investor - 1 unit per dollar
      navPerUnit = 1;
      unitsToGrant = amount;
    }

    // For withdrawals, verify the member has enough units
    if (amount < 0) {
      const { data: memberInvestments } = await supabase
        .from("member_investments")
        .select("units_owned")
        .eq("memberstack_id", body.memberstack_id);

      const totalUnits =
        memberInvestments?.reduce((sum, inv) => sum + inv.units_owned, 0) || 0;

      if (totalUnits + unitsToGrant < -0.001) {
        // unitsToGrant is negative for withdrawals
        return NextResponse.json(
          {
            error: `Insufficient units. Member has ${totalUnits.toFixed(4)} units, trying to withdraw ${Math.abs(unitsToGrant).toFixed(4)} units.`,
          },
          { status: 400 }
        );
      }
    }

    // Create investment record
    const insertData: Record<string, unknown> = {
      memberstack_id: body.memberstack_id,
      member_name: body.member_name,
      member_email: body.member_email,
      amount_invested: amount,
      units_owned: unitsToGrant,
    };

    // Allow custom date
    if (body.investment_date) {
      insertData.investment_date = body.investment_date;
    }

    const { data, error } = await supabase
      .from("member_investments")
      .insert(insertData)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Update total units outstanding
    if (metadata) {
      await supabase
        .from("fund_metadata")
        .update({
          total_units_outstanding:
            metadata.total_units_outstanding + unitsToGrant,
        })
        .eq("id", metadata.id);
    } else {
      // Create fund metadata if it doesn't exist
      await supabase.from("fund_metadata").insert({
        total_units_outstanding: unitsToGrant,
        fund_inception_date:
          body.investment_date || new Date().toISOString().split("T")[0],
      });
    }

    return NextResponse.json(
      { investment: data, navPerUnit, unitsGranted: unitsToGrant },
      { status: 201 }
    );
  } catch (err) {
    console.error("Error recording investment:", err);
    return NextResponse.json(
      { error: "Failed to record investment" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const supabase = createServerClient();

    // Get the investment record first to know how many units to remove
    const { data: investment, error: fetchError } = await supabase
      .from("member_investments")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !investment) {
      return NextResponse.json(
        { error: "Investment record not found" },
        { status: 404 }
      );
    }

    // Delete the record
    const { error: deleteError } = await supabase
      .from("member_investments")
      .delete()
      .eq("id", id);

    if (deleteError) {
      return NextResponse.json(
        { error: deleteError.message },
        { status: 500 }
      );
    }

    // Update total units outstanding (subtract the units that were removed)
    const { data: metadata } = await supabase
      .from("fund_metadata")
      .select("*")
      .limit(1)
      .single();

    if (metadata) {
      const newUnits = Math.max(
        0,
        metadata.total_units_outstanding - investment.units_owned
      );
      await supabase
        .from("fund_metadata")
        .update({ total_units_outstanding: newUnits })
        .eq("id", metadata.id);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error deleting investment:", err);
    return NextResponse.json(
      { error: "Failed to delete investment" },
      { status: 500 }
    );
  }
}
