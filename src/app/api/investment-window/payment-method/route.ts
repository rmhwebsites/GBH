import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { requireAuth, isAuthError } from "@/lib/auth";
import { isStripeConfigured } from "@/lib/stripe";
import { listBankAccounts } from "@/lib/stripeCustomers";

/**
 * The signed-in member's own linked bank account(s), so they can confirm
 * where a contribution will be drawn from before paying.
 * Returns masked details only — Stripe never exposes full account numbers.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (isAuthError(auth)) return auth;

  if (!isStripeConfigured()) {
    return NextResponse.json({ bankAccounts: [], configured: false });
  }

  try {
    const supabase = createServerClient();

    const { data } = await supabase
      .from("member_stripe_customers")
      .select("stripe_customer_id")
      .eq("memberstack_id", auth.memberId)
      .limit(1);

    const customerId = data?.[0]?.stripe_customer_id;
    if (!customerId) {
      // No customer yet — they'll link a bank on their first checkout
      return NextResponse.json({ bankAccounts: [], configured: true });
    }

    const bankAccounts = await listBankAccounts(customerId);
    return NextResponse.json({ bankAccounts, configured: true });
  } catch (err) {
    console.error("Error fetching member payment method:", err);
    return NextResponse.json({ bankAccounts: [], configured: true });
  }
}
