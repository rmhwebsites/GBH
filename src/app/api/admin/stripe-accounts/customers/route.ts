import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { requireAdmin, isAuthError } from "@/lib/auth";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import type { StripeCustomerSummary } from "@/lib/stripeCustomers";

/**
 * Existing Stripe customers, for an admin choosing one to link to a member.
 * Flags customers already linked so the same customer isn't attached twice.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (isAuthError(auth)) return auth;

  if (!isStripeConfigured()) {
    return NextResponse.json({ customers: [], stripeConfigured: false });
  }

  try {
    const search = (
      request.nextUrl.searchParams.get("search") || ""
    ).trim().toLowerCase();

    const supabase = createServerClient();
    const { data: links } = await supabase
      .from("member_stripe_customers")
      .select("stripe_customer_id, member_name");

    const linkedNames = new Map<string, string>(
      (links || []).map((l) => [l.stripe_customer_id, l.member_name])
    );

    // Small member base — list and filter locally rather than relying on
    // Stripe's search syntax, which has no substring match for names
    const result = await getStripe().customers.list({ limit: 100 });

    const customers: StripeCustomerSummary[] = result.data
      .filter((c) => {
        if (!search) return true;
        return (
          (c.name || "").toLowerCase().includes(search) ||
          (c.email || "").toLowerCase().includes(search) ||
          c.id.toLowerCase().includes(search)
        );
      })
      .map((c) => ({
        id: c.id,
        name: c.name ?? null,
        email: c.email ?? null,
        created: c.created,
        linkedToMember: linkedNames.get(c.id) || null,
      }))
      .sort((a, b) => b.created - a.created);

    return NextResponse.json({
      customers,
      stripeConfigured: true,
      hasMore: result.has_more,
    });
  } catch (err) {
    console.error("Error listing Stripe customers:", err);
    return NextResponse.json(
      { error: "Failed to list Stripe customers" },
      { status: 500 }
    );
  }
}
