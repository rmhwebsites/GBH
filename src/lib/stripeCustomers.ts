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
  bankAccounts: LinkedBankAccount[];
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

  const customer = await getStripe().customers.create({
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
