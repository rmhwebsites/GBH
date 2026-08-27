import { NextRequest, NextResponse } from "next/server";
import { createServerClient, withSchemaRetry } from "@/lib/supabase";
import { requireAdmin, isAuthError } from "@/lib/auth";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import {
  listBankAccounts,
  linkStripeCustomer,
  unlinkStripeCustomer,
  type MemberStripeInfo,
} from "@/lib/stripeCustomers";

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
    const linkResult = await withSchemaRetry((c) =>
      c
        .from("member_stripe_customers")
        .select("memberstack_id, stripe_customer_id, linked_manually")
    );
    let links = linkResult.data;
    const linkError = linkResult.error;

    // Fall back if the linked_manually migration hasn't been run yet, so the
    // roster still works rather than showing everyone as unlinked
    if (linkError?.message?.includes("linked_manually")) {
      const fallback = await withSchemaRetry((c) =>
        c
          .from("member_stripe_customers")
          .select("memberstack_id, stripe_customer_id")
      );
      links = (fallback.data || []).map((l) => ({
        ...l,
        linked_manually: false,
      }));
    }

    const customerByMember = new Map<string, string>(
      (links || []).map((l) => [l.memberstack_id, l.stripe_customer_id])
    );
    const manualByMember = new Map<string, boolean>(
      (links || []).map((l) => [l.memberstack_id, Boolean(l.linked_manually)])
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
        linkedManually: manualByMember.get(memberstackId) || false,
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

/** Link an existing Stripe customer to a member. */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (isAuthError(auth)) return auth;

  try {
    const { memberstack_id, stripe_customer_id } = (await request.json()) as {
      memberstack_id?: string;
      stripe_customer_id?: string;
    };

    if (!memberstack_id || !stripe_customer_id) {
      return NextResponse.json(
        { error: "Member and Stripe customer are both required" },
        { status: 400 }
      );
    }

    if (!isStripeConfigured()) {
      return NextResponse.json(
        { error: "Stripe is not configured" },
        { status: 503 }
      );
    }

    // Confirm the customer exists (and isn't deleted) before linking
    let customerEmail: string | null = null;
    try {
      const customer = await getStripe().customers.retrieve(stripe_customer_id);
      if (customer.deleted) {
        return NextResponse.json(
          { error: "That Stripe customer has been deleted" },
          { status: 400 }
        );
      }
      customerEmail = customer.email;
    } catch {
      return NextResponse.json(
        { error: "No such Stripe customer" },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // A Stripe customer must belong to exactly one member
    const { data: clash } = await supabase
      .from("member_stripe_customers")
      .select("memberstack_id, member_name")
      .eq("stripe_customer_id", stripe_customer_id)
      .neq("memberstack_id", memberstack_id)
      .limit(1);

    if (clash && clash.length > 0) {
      return NextResponse.json(
        {
          error: `That Stripe customer is already linked to ${clash[0].member_name}. Unlink them first.`,
        },
        { status: 409 }
      );
    }

    // Resolve the member's name from their investment records
    const { data: memberRows } = await supabase
      .from("member_investments")
      .select("member_name, member_email")
      .eq("memberstack_id", memberstack_id)
      .limit(1);

    if (!memberRows || memberRows.length === 0) {
      return NextResponse.json({ error: "Unknown member" }, { status: 400 });
    }

    await linkStripeCustomer(supabase, {
      memberstackId: memberstack_id,
      stripeCustomerId: stripe_customer_id,
      memberName: memberRows[0].member_name,
      memberEmail: memberRows[0].member_email || customerEmail,
      manual: true,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error linking Stripe customer:", err);
    const message =
      err instanceof Error ? err.message : "Failed to link Stripe customer";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Unlink a member from their Stripe customer (the customer itself is kept). */
export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (isAuthError(auth)) return auth;

  try {
    const memberstackId =
      request.nextUrl.searchParams.get("memberstack_id") || "";
    if (!memberstackId) {
      return NextResponse.json(
        { error: "Missing memberstack_id" },
        { status: 400 }
      );
    }

    await unlinkStripeCustomer(createServerClient(), memberstackId);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error unlinking Stripe customer:", err);
    const message =
      err instanceof Error ? err.message : "Failed to unlink Stripe customer";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
