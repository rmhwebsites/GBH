import { NextRequest, NextResponse } from "next/server";
import { createServerClient, withSchemaRetry } from "@/lib/supabase";
import { requireAuth, isAuthError } from "@/lib/auth";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import type { InvestmentWindow } from "@/types/database";

/**
 * Member submits an investment amount during an open window.
 * Creates a submission row and a Stripe Checkout session (ACH bank debit),
 * returning the Checkout URL to redirect to.
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

    // 6. Create the Stripe Checkout session (ACH debit — funds settle to
    //    the fund's bank account on file with Stripe)
    const appUrl = (
      process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin
    ).replace(/\/+$/, "");
    const stripe = getStripe();

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
      customer_email: memberEmail || undefined,
      metadata: {
        submission_id: submission.id,
        memberstack_id: auth.memberId,
      },
      payment_intent_data: {
        metadata: {
          submission_id: submission.id,
          memberstack_id: auth.memberId,
        },
      },
      success_url: `${appUrl}/dashboard/invest?status=success`,
      cancel_url: `${appUrl}/dashboard/invest?status=canceled`,
    });

    // 7. Attach the session id for webhook correlation
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
