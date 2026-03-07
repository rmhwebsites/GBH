import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { requireAdmin, isAuthError } from "@/lib/auth";
import { getVerifiedTotalUnits, syncTotalUnits } from "@/lib/units";

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (isAuthError(auth)) return auth;

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

    // SAFETY: Use verified total units (cross-checked against member_investments)
    const verification = await getVerifiedTotalUnits(supabase);
    const verifiedTotalUnits = verification.totalMemberUnits;

    if (
      verifiedTotalUnits > 0 &&
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
        verifiedTotalUnits
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

    // Sync total units from source of truth (member_investments table)
    // This is safer than incremental math which can drift over time
    await syncTotalUnits(supabase);

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
  const auth = await requireAdmin(request);
  if (isAuthError(auth)) return auth;

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

    // Sync total units from source of truth (member_investments table)
    await syncTotalUnits(supabase);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error deleting investment:", err);
    return NextResponse.json(
      { error: "Failed to delete investment" },
      { status: 500 }
    );
  }
}
