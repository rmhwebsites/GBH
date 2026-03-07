import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { getQuotes } from "@/lib/yahoo";
import { requireAuth, isAuthError } from "@/lib/auth";
import {
  calculatePortfolioSummary,
  calculateNAV,
  calculateMemberData,
} from "@/lib/calculations";
import { getVerifiedTotalUnits } from "@/lib/units";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (isAuthError(auth)) return auth;

  try {
    const { id: memberstackId } = await params;
    const supabase = createServerClient();

    // Get member investments
    const { data: investments, error: invError } = await supabase
      .from("member_investments")
      .select("*")
      .eq("memberstack_id", memberstackId)
      .order("investment_date", { ascending: true });

    if (invError) {
      return NextResponse.json({ error: invError.message }, { status: 500 });
    }

    if (!investments || investments.length === 0) {
      return NextResponse.json({
        investments: [],
        totalInvested: 0,
        totalUnits: 0,
        currentValue: 0,
        totalGainLoss: 0,
        totalGainLossPercent: 0,
      });
    }

    // Calculate current NAV
    const { data: holdings } = await supabase
      .from("portfolio_holdings")
      .select("*")
      .eq("is_active", true);

    // SAFETY GUARD: Always use verified total units
    const verification = await getVerifiedTotalUnits(supabase);
    const totalUnits = verification.totalMemberUnits;

    let navPerUnit = 0;
    if (holdings && holdings.length > 0 && totalUnits > 0) {
      // Separate cash from stock holdings
      const cashHolding = holdings.find((h) => h.ticker === "CASH");
      const stockHoldings = holdings.filter((h) => h.ticker !== "CASH");
      const cashBalance = cashHolding?.shares || 0;

      const tickers = stockHoldings.map((h) => h.ticker);
      const quotes = tickers.length > 0 ? await getQuotes(tickers) : [];
      const summary = calculatePortfolioSummary(
        stockHoldings,
        quotes,
        cashBalance
      );
      navPerUnit = calculateNAV(summary.totalValue, totalUnits);
    }

    const memberData = calculateMemberData(investments, navPerUnit);

    return NextResponse.json(memberData);
  } catch (err) {
    console.error("Error fetching member data:", err);
    return NextResponse.json(
      { error: "Failed to fetch member data" },
      { status: 500 }
    );
  }
}
