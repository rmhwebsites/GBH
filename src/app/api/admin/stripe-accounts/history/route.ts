import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { requireAdmin, isAuthError } from "@/lib/auth";
import { isStripeConfigured } from "@/lib/stripe";
import { listPaymentHistory } from "@/lib/stripeCustomers";

/** A member's Stripe contribution history, for admin review. */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (isAuthError(auth)) return auth;

  const memberstackId =
    request.nextUrl.searchParams.get("memberstack_id") || "";
  if (!memberstackId) {
    return NextResponse.json(
      { error: "Missing memberstack_id" },
      { status: 400 }
    );
  }

  if (!isStripeConfigured()) {
    return NextResponse.json({ payments: [] });
  }

  try {
    const supabase = createServerClient();
    const { data } = await supabase
      .from("member_stripe_customers")
      .select("stripe_customer_id")
      .eq("memberstack_id", memberstackId)
      .limit(1);

    const customerId = data?.[0]?.stripe_customer_id;
    if (!customerId) {
      return NextResponse.json({ payments: [] });
    }

    return NextResponse.json({
      payments: await listPaymentHistory(customerId),
    });
  } catch (err) {
    console.error("Error fetching payment history:", err);
    return NextResponse.json({ payments: [] });
  }
}
