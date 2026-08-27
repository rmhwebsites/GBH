import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { requireAdmin, isAuthError } from "@/lib/auth";
import { isStripeConfigured } from "@/lib/stripe";
import { listBankAccounts, type MemberStripeInfo } from "@/lib/stripeCustomers";

/**
 * Every member with their linked Stripe customer and bank account(s).
 * Masked details only — Stripe never exposes full account numbers.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (isAuthError(auth)) return auth;

  try {
    const supabase = createServerClient();

    // Every known member (deduplicated — one row per person)
    const { data: memberRows, error: memberError } = await supabase
      .from("member_investments")
      .select("memberstack_id, member_name")
      .order("member_name");

    if (memberError) {
      return NextResponse.json({ error: memberError.message }, { status: 500 });
    }

    const members = new Map<string, string>();
    for (const row of memberRows || []) {
      if (!members.has(row.memberstack_id)) {
        members.set(row.memberstack_id, row.member_name);
      }
    }

    // Their Stripe customer mappings (table may not exist pre-migration)
    const { data: links } = await supabase
      .from("member_stripe_customers")
      .select("memberstack_id, stripe_customer_id");

    const customerByMember = new Map<string, string>(
      (links || []).map((l) => [l.memberstack_id, l.stripe_customer_id])
    );

    // Fetch bank accounts for linked members (one Stripe call each)
    const linkedIds = [...members.keys()].filter((id) =>
      customerByMember.has(id)
    );
    const bankAccountsByMember = new Map(
      isStripeConfigured()
        ? await Promise.all(
            linkedIds.map(
              async (id) =>
                [id, await listBankAccounts(customerByMember.get(id)!)] as const
            )
          )
        : []
    );

    const accounts: MemberStripeInfo[] = [...members.entries()].map(
      ([memberstackId, memberName]) => ({
        memberstackId,
        memberName,
        stripeCustomerId: customerByMember.get(memberstackId) || null,
        bankAccounts: bankAccountsByMember.get(memberstackId) || [],
      })
    );

    return NextResponse.json({
      accounts,
      stripeConfigured: isStripeConfigured(),
    });
  } catch (err) {
    console.error("Error fetching Stripe accounts:", err);
    return NextResponse.json(
      { error: "Failed to fetch payment accounts" },
      { status: 500 }
    );
  }
}
