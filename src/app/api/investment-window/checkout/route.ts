import { NextRequest, NextResponse } from "next/server";
import { createServerClient, withSchemaRetry } from "@/lib/supabase";
import { requireAuth, isAuthError } from "@/lib/auth";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { getOrCreateStripeCustomer } from "@/lib/stripeCustomers";
import type { InvestmentWindow } from "@/types/database";

/**
 * Member submits an investment amount during an open window.
 *
 * If they already have a saved bank account, it is debited directly and the
 * response reports the payment as started. Otherwise a Stripe Checkout
 * session is returned so they can link a bank, which is then saved for
 * future contributions.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (isAuthError(auth)) return auth;

  try {
    if (!isStripeConfigured()) {
      return NextResponse.json(
        { error: "Payments are not configured yet. Contact an admin." },
        { status: 503 }
      );
    }

    const body = await request.json();
    const amount = Number(body.amount);
    // Set when the member explicitly wants to use a different bank account
    const useNewBank = Boolean(body.useNewBank);

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "Enter a valid investment amount" },
        { status: 400 }
      );
    }
    // Normalize to cents to avoid float dust
    const amountCents = Math.round(amount * 100);
    const amountDollars = amountCents / 100;

    const supabase = createServerClient();

    // 1. Find the open window
    const { data: windows, error: windowError } = await withSchemaRetry((c) =>
      c.from("investment_windows").select("*").eq("is_active", true)
    );

    if (windowError) {
      return NextResponse.json(
        { error: "Investment windows are not set up yet" },
        { status: 503 }
      );
    }

    const now = new Date();
    const window = ((windows || []) as InvestmentWindow[]).find(
      (w) => new Date(w.opens_at) <= now && now < new Date(w.closes_at)
    );

    if (!window) {
      return NextResponse.json(
        { error: "No investment window is currently open" },
        { status: 403 }
      );
    }

    // 2. Validate amount against window limits
    if (amountDollars < window.min_amount) {
      return NextResponse.json(
        { error: `Minimum investment is $${window.min_amount.toLocaleString()}` },
        { status: 400 }
      );
    }
    if (window.max_amount && amountDollars > window.max_amount) {
      return NextResponse.json(
        { error: `Maximum investment is $${window.max_amount.toLocaleString()}` },
        { status: 400 }
      );
    }

    // 3. Resolve the member's name/email server-side
    const { data: memberRows } = await supabase
      .from("member_investments")
      .select("member_name, member_email")
      .eq("memberstack_id", auth.memberId)
      .limit(1);

    const memberName = memberRows?.[0]?.member_name || "Unknown Member";
    const memberEmail = memberRows?.[0]?.member_email || null;

    // 4. Retire any stale pending submissions for this member + window
    await supabase
      .from("investment_submissions")
      .update({ status: "canceled", updated_at: new Date().toISOString() })
      .eq("window_id", window.id)
      .eq("memberstack_id", auth.memberId)
      .eq("status", "pending_payment");

    // 5. Create the submission record
    const { data: submission, error: subError } = await supabase
      .from("investment_submissions")
      .insert({
        window_id: window.id,
        memberstack_id: auth.memberId,
        member_name: memberName,
        member_email: memberEmail,
        amount: amountDollars,
        status: "pending_payment",
      })
      .select()
      .single();

    if (subError) {
      return NextResponse.json({ error: subError.message }, { status: 500 });
    }

    // Funds settle to the fund's bank account on file with Stripe
    const appUrl = (
      process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin
    ).replace(/\/+$/, "");
    const stripe = getStripe();

    // Reuse the member's Stripe customer so their linked bank account is
    // remembered between windows (and visible to them before they pay)
    const customerId = await getOrCreateStripeCustomer(supabase, {
      memberstackId: auth.memberId,
      name: memberName,
      email: memberEmail,
    });

    // 6. If they already have a saved bank account, debit it directly.
    //    ACH mandates captured at the first checkout authorise later
    //    off-session debits, so there is no redirect and nothing to re-enter.
    if (!useNewBank) {
      const saved = await stripe.paymentMethods.list({
        customer: customerId,
        type: "us_bank_account",
      });
      const bank = saved.data[0];

      if (bank) {
        try {
          const intent = await stripe.paymentIntents.create({
            amount: amountCents,
            currency: "usd",
            customer: customerId,
            payment_method: bank.id,
            payment_method_types: ["us_bank_account"],
            confirm: true,
            off_session: true,
            description: `GBH Capital — ${window.title}`,
            metadata: {
              submission_id: submission.id,
              memberstack_id: auth.memberId,
            },
          });

          // ACH settles asynchronously, so 'processing' is the normal result
          const status =
            intent.status === "succeeded"
              ? "paid"
              : intent.status === "processing"
              ? "processing"
              : null;

          if (status) {
            await supabase
              .from("investment_submissions")
              .update({
                stripe_payment_intent: intent.id,
                status,
                bank_name: bank.us_bank_account?.bank_name || null,
                bank_last4: bank.us_bank_account?.last4 || null,
                settled_at: status === "paid" ? new Date().toISOString() : null,
                updated_at: new Date().toISOString(),
              })
              .eq("id", submission.id);

            return NextResponse.json({
              paid: true,
              status,
              bank: {
                bankName: bank.us_bank_account?.bank_name || "your bank",
                last4: bank.us_bank_account?.last4 || "",
              },
            });
          }
          // Anything else (e.g. the mandate needs re-authorisation) falls
          // through to Checkout below rather than failing the member
        } catch (err) {
          console.error(
            "Off-session debit failed; falling back to Checkout:",
            err
          );
        }
      }
    }

    // 7. No saved bank (or the direct debit could not proceed) — send them to
    //    Checkout to link one. It is saved for future contributions.
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["us_bank_account"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `GBH Capital — ${window.title}`,
              description: `Investment contribution for ${memberName}`,
            },
            unit_amount: amountCents,
          },
          quantity: 1,
        },
      ],
      customer: customerId,
      metadata: {
        submission_id: submission.id,
        memberstack_id: auth.memberId,
      },
      payment_intent_data: {
        // Save the bank account to the customer for future contributions
        setup_future_usage: "off_session",
        metadata: {
          submission_id: submission.id,
          memberstack_id: auth.memberId,
        },
      },
      success_url: `${appUrl}/dashboard/invest?status=success`,
      cancel_url: `${appUrl}/dashboard/invest?status=canceled`,
    });

    // 8. Attach the session id for webhook correlation
    await supabase
      .from("investment_submissions")
      .update({
        stripe_session_id: session.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", submission.id);

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Error creating checkout:", err);
    return NextResponse.json(
      { error: "Failed to start payment. Please try again." },
      { status: 500 }
    );
  }
}
