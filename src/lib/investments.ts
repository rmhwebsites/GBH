import type { SupabaseClient } from "@supabase/supabase-js";
import { getVerifiedTotalUnits, syncTotalUnits } from "@/lib/units";
import type { MemberInvestment } from "@/types/database";

export interface RecordInvestmentInput {
  memberstack_id: string;
  member_name: string;
  member_email: string | null;
  /** positive = invest, negative = withdraw */
  amount: number;
  investment_date?: string;
}

export interface RecordInvestmentResult {
  investment: MemberInvestment;
  navPerUnit: number;
  unitsGranted: number;
}

/**
 * Record an investment (or withdrawal) at the live NAV and grant units.
 * Shared by the admin manual-entry route and Stripe submission processing.
 * Throws Error with a user-facing message on validation failure.
 */
export async function recordInvestment(
  supabase: SupabaseClient,
  input: RecordInvestmentInput
): Promise<RecordInvestmentResult> {
  const amount = input.amount;

  // Get current NAV to calculate units
  const { data: holdings } = await supabase
    .from("portfolio_holdings")
    .select("*")
    .eq("is_active", true);

  let navPerUnit = 0;
  let unitsToGrant = 0;

  // SAFETY: Use verified total units (cross-checked against member_investments)
  const verification = await getVerifiedTotalUnits(supabase);
  const verifiedTotalUnits = verification.totalMemberUnits;

  if (verifiedTotalUnits > 0 && holdings && holdings.length > 0) {
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
    const summary = calculatePortfolioSummary(stockHoldings, quotes, cashBalance);
    navPerUnit = calculateNAV(summary.totalValue, verifiedTotalUnits);

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
      .eq("memberstack_id", input.memberstack_id);

    const totalUnits =
      memberInvestments?.reduce((sum, inv) => sum + inv.units_owned, 0) || 0;

    if (totalUnits + unitsToGrant < -0.001) {
      // unitsToGrant is negative for withdrawals
      throw new Error(
        `Insufficient units. Member has ${totalUnits.toFixed(4)} units, trying to withdraw ${Math.abs(unitsToGrant).toFixed(4)} units.`
      );
    }
  }

  // Create investment record
  const insertData: Record<string, unknown> = {
    memberstack_id: input.memberstack_id,
    member_name: input.member_name,
    member_email: input.member_email,
    amount_invested: amount,
    units_owned: unitsToGrant,
  };

  if (input.investment_date) {
    insertData.investment_date = input.investment_date;
  }

  const { data, error } = await supabase
    .from("member_investments")
    .insert(insertData)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  // Sync total units from source of truth (member_investments table)
  // This is safer than incremental math which can drift over time
  await syncTotalUnits(supabase);

  return { investment: data, navPerUnit, unitsGranted: unitsToGrant };
}
