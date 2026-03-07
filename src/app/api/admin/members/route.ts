import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { requireAdmin, isAuthError } from "@/lib/auth";
import { getVerifiedTotalUnits, syncTotalUnits } from "@/lib/units";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (isAuthError(auth)) return auth;

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
  const auth = await requireAdmin(request);
  if (isAuthError(auth)) return auth;

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
        verifiedTotalUnits
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

    // Sync total units from source of truth (member_investments table)
    await syncTotalUnits(supabase);

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
  const auth = await requireAdmin(request);
  if (isAuthError(auth)) return auth;

  try {
    const body = await request.json();
    const supabase = createServerClient();

    // Update name and email across ALL records for this memberstack_id
    // Financial data (amount_invested, units_owned) is managed via the Investments page
    const { data, error } = await supabase
      .from("member_investments")
      .update({
        member_name: body.member_name,
        member_email: body.member_email,
      })
      .eq("memberstack_id", body.memberstack_id)
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ members: data });
  } catch (err) {
    console.error("Error updating member:", err);
    return NextResponse.json(
      { error: "Failed to update member" },
      { status: 500 }
    );
  }
}
