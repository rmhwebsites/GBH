import type { SupabaseClient } from "@supabase/supabase-js";
import { getStripe } from "@/lib/stripe";

/**
 * A member's saved bank account, as Stripe reports it.
 * Stripe never returns full account numbers — only these masked fields.
 */
export interface LinkedBankAccount {
  id: string;
  bankName: string;
  last4: string;
  accountType: string | null;
}

export interface MemberStripeInfo {
  memberstackId: string;
  memberName: string;
  stripeCustomerId: string | null;
  /** True when an admin linked this customer by hand */
  linkedManually?: boolean;
  bankAccounts: LinkedBankAccount[];
}

/** A Stripe customer as shown in the admin link picker */
export interface StripeCustomerSummary {
  id: string;
  name: string | null;
  email: string | null;
  created: number;
  /** Name of the member this customer is already linked to, if any */
  linkedToMember: string | null;
}

/** One contribution attempt as recorded by Stripe */
export interface PaymentHistoryItem {
  id: string;
  amount: number;
  status: string;
  created: number;
  description: string | null;
}

/**
 * Find or create the Stripe customer for a member, remembering the mapping
 * so the same customer (and their saved bank accounts) is reused every time.
 */
export async function getOrCreateStripeCustomer(
  supabase: SupabaseClient,
  member: { memberstackId: string; name: string; email: string | null }
): Promise<string> {
  const { data: existing } = await supabase
    .from("member_stripe_customers")
    .select("stripe_customer_id")
    .eq("memberstack_id", member.memberstackId)
    .limit(1);

  if (existing?.[0]?.stripe_customer_id) {
    return existing[0].stripe_customer_id;
  }

  const stripe = getStripe();

  // Adopt an existing Stripe customer with this email rather than creating a
  // duplicate — keeps one customer (and one payment history) per person
  if (member.email) {
    const matches = await stripe.customers.list({
      email: member.email,
      limit: 1,
    });
    if (matches.data.length > 0) {
      const found = matches.data[0];
      await linkStripeCustomer(supabase, {
        memberstackId: member.memberstackId,
        stripeCustomerId: found.id,
        memberName: member.name,
        memberEmail: member.email,
        manual: false,
      });
      return found.id;
    }
  }

  const customer = await stripe.customers.create({
    name: member.name,
    email: member.email || undefined,
    metadata: { memberstack_id: member.memberstackId },
  });

  // upsert (not insert) so a concurrent checkout can't violate the primary key
  await supabase.from("member_stripe_customers").upsert(
    {
      memberstack_id: member.memberstackId,
      stripe_customer_id: customer.id,
      member_name: member.name,
      member_email: member.email,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "memberstack_id" }
  );

  return customer.id;
}

/**
 * Point a member at a Stripe customer. Used both by the automatic path and
 * by admins linking an existing customer by hand.
 */
export async function linkStripeCustomer(
  supabase: SupabaseClient,
  params: {
    memberstackId: string;
    stripeCustomerId: string;
    memberName: string;
    memberEmail: string | null;
    manual: boolean;
  }
): Promise<void> {
  const base = {
    memberstack_id: params.memberstackId,
    stripe_customer_id: params.stripeCustomerId,
    member_name: params.memberName,
    member_email: params.memberEmail,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("member_stripe_customers")
    .upsert(
      { ...base, linked_manually: params.manual },
      { onConflict: "memberstack_id" }
    );

  if (!error) return;

  // Fall back if the linked_manually migration hasn't been applied yet —
  // linking still works, it just isn't flagged as manual
  if (error.message.includes("linked_manually")) {
    const { error: retryError } = await supabase
      .from("member_stripe_customers")
      .upsert(base, { onConflict: "memberstack_id" });
    if (retryError) throw new Error(retryError.message);
    return;
  }

  throw new Error(error.message);
}

/** Remove a member's Stripe customer link. The Stripe customer is untouched. */
export async function unlinkStripeCustomer(
  supabase: SupabaseClient,
  memberstackId: string
): Promise<void> {
  const { error } = await supabase
    .from("member_stripe_customers")
    .delete()
    .eq("memberstack_id", memberstackId);

  if (error) throw new Error(error.message);
}

/** Contribution history for a customer, newest first (masked amounts only). */
export async function listPaymentHistory(
  stripeCustomerId: string,
  limit = 20
): Promise<PaymentHistoryItem[]> {
  try {
    const intents = await getStripe().paymentIntents.list({
      customer: stripeCustomerId,
      limit,
    });

    return intents.data.map((pi) => ({
      id: pi.id,
      amount: pi.amount / 100,
      status: pi.status,
      created: pi.created,
      description: pi.description,
    }));
  } catch (err) {
    console.error(`Failed to list payments for ${stripeCustomerId}:`, err);
    return [];
  }
}

/** Bank accounts saved to a Stripe customer (masked details only). */
export async function listBankAccounts(
  stripeCustomerId: string
): Promise<LinkedBankAccount[]> {
  try {
    const methods = await getStripe().paymentMethods.list({
      customer: stripeCustomerId,
      type: "us_bank_account",
    });

    return methods.data.map((pm) => ({
      id: pm.id,
      bankName: pm.us_bank_account?.bank_name || "Bank account",
      last4: pm.us_bank_account?.last4 || "••••",
      accountType: pm.us_bank_account?.account_type || null,
    }));
  } catch (err) {
    console.error(`Failed to list bank accounts for ${stripeCustomerId}:`, err);
    return [];
  }
}

/** Human-readable label, e.g. "Chase ••••6789 (checking)" */
export function formatBankAccount(account: LinkedBankAccount): string {
  const type = account.accountType ? ` (${account.accountType})` : "";
  return `${account.bankName} ••••${account.last4}${type}`;
}
