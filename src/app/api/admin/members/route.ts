import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export async function GET() {
  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("member_investments")
      .select("*")
      .order("member_name");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ members: data });
  } catch (err) {
    console.error("Error fetching members:", err);
    return NextResponse.json(
      { error: "Failed to fetch members" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const supabase = createServerClient();

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

      // Separate cash from stock holdings (match investments API)
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
      const navPerUnit = calculateNAV(
        summary.totalValue,
        metadata.total_units_outstanding
      );

      if (navPerUnit > 0) {
        unitsToGrant = body.amount_invested / navPerUnit;
      }
    } else {
      // First investor - 1 unit per dollar (or set initial NAV)
      unitsToGrant = body.amount_invested;
    }

    // Create member investment record
    const { data, error } = await supabase
      .from("member_investments")
      .insert({
        memberstack_id: body.memberstack_id,
        member_name: body.member_name,
        member_email: body.member_email,
        amount_invested: body.amount_invested,
        units_owned: unitsToGrant,
      })
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
        fund_inception_date: new Date().toISOString().split("T")[0],
      });
    }

    return NextResponse.json({ member: data }, { status: 201 });
  } catch (err) {
    console.error("Error adding member:", err);
    return NextResponse.json(
      { error: "Failed to add member" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const supabase = createServerClient();

    // Get the old record to calculate unit difference
    const { data: oldRecord, error: fetchError } = await supabase
      .from("member_investments")
      .select("units_owned")
      .eq("id", body.id)
      .single();

    if (fetchError || !oldRecord) {
      return NextResponse.json(
        { error: "Record not found" },
        { status: 404 }
      );
    }

    const oldUnits = oldRecord.units_owned;
    const newUnits = body.units_owned;
    const unitsDiff = newUnits - oldUnits;

    // Update the member record
    const { data, error } = await supabase
      .from("member_investments")
      .update({
        member_name: body.member_name,
        member_email: body.member_email,
        amount_invested: body.amount_invested,
        units_owned: body.units_owned,
      })
      .eq("id", body.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Sync fund_metadata.total_units_outstanding if units changed
    if (unitsDiff !== 0) {
      const { data: metadata } = await supabase
        .from("fund_metadata")
        .select("*")
        .limit(1)
        .single();

      if (metadata) {
        const newTotalUnits = Math.max(
          0,
          metadata.total_units_outstanding + unitsDiff
        );
        await supabase
          .from("fund_metadata")
          .update({ total_units_outstanding: newTotalUnits })
          .eq("id", metadata.id);
      }
    }

    return NextResponse.json({ member: data });
  } catch (err) {
    console.error("Error updating member:", err);
    return NextResponse.json(
      { error: "Failed to update member" },
      { status: 500 }
    );
  }
}
