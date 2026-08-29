import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { requireAdmin, isAuthError } from "@/lib/auth";
import { recordInvestment } from "@/lib/investments";
import { getStripe, isStripeConfigured } from "@/lib/stripe";

/**
 * Convert a PAID submission into a member_investments record at live NAV.
 * The member's units are granted here, not at payment time, so the admin
 * controls exactly when contributions enter the fund.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (isAuthError(auth)) return auth;

  try {
    const body = await request.json();
    const { submission_id } = body as { submission_id?: string };

    if (!submission_id) {
      return NextResponse.json(
        { error: "Missing submission_id" },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    const { data: submission, error: fetchError } = await supabase
      .from("investment_submissions")
      .select("*")
      .eq("id", submission_id)
      .single();

    if (fetchError || !submission) {
      return NextResponse.json(
        { error: "Submission not found" },
        { status: 404 }
      );
    }

    if (submission.status !== "paid") {
      return NextResponse.json(
        {
          error: `Only paid submissions can be processed (current status: ${submission.status})`,
        },
        { status: 409 }
      );
    }

    // Units change the ownership split of the whole fund, so confirm the money
    // actually settled with Stripe rather than trusting our own status — a
    // missed or out-of-order webhook must never mint units for funds in
    // transit. ACH sits in 'processing' for days before it truly clears.
    if (isStripeConfigured() && submission.stripe_payment_intent) {
      try {
        const intent = await getStripe().paymentIntents.retrieve(
          submission.stripe_payment_intent
        );
        if (intent.status !== "succeeded") {
          return NextResponse.json(
            {
              error: `Stripe reports this payment as "${intent.status}", not settled. Units are only granted once funds have cleared.`,
            },
            { status: 409 }
          );
        }
      } catch (err) {
        console.error("Could not verify payment with Stripe:", err);
        return NextResponse.json(
          {
            error:
              "Could not verify the payment with Stripe. Try again shortly.",
          },
          { status: 502 }
        );
      }
    }

    // Claim the submission first so a double-click can't grant units twice —
    // only one request can flip paid -> processed
    const { data: claimed } = await supabase
      .from("investment_submissions")
      .update({ status: "processed", updated_at: new Date().toISOString() })
      .eq("id", submission_id)
      .eq("status", "paid")
      .select("id");

    if (!claimed || claimed.length === 0) {
      return NextResponse.json(
        { error: "Submission was already processed" },
        { status: 409 }
      );
    }

    try {
      const result = await recordInvestment(supabase, {
        memberstack_id: submission.memberstack_id,
        member_name: submission.member_name,
        member_email: submission.member_email,
        amount: submission.amount,
      });

      await supabase
        .from("investment_submissions")
        .update({
          processed_investment_id: result.investment.id,
          units_granted: result.unitsGranted,
          nav_per_unit: result.navPerUnit,
          updated_at: new Date().toISOString(),
        })
        .eq("id", submission_id);

      return NextResponse.json({
        success: true,
        investment: result.investment,
        navPerUnit: result.navPerUnit,
        unitsGranted: result.unitsGranted,
      });
    } catch (recordErr) {
      // Recording failed — release the claim so it can be retried
      await supabase
        .from("investment_submissions")
        .update({ status: "paid", updated_at: new Date().toISOString() })
        .eq("id", submission_id);
      throw recordErr;
    }
  } catch (err) {
    console.error("Error processing submission:", err);
    const message =
      err instanceof Error ? err.message : "Failed to process submission";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Mark a failed contribution as resolved so it drops out of the active list. */
export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (isAuthError(auth)) return auth;

  try {
    const { submission_id, resolved } = (await request.json()) as {
      submission_id?: string;
      resolved?: boolean;
    };

    if (!submission_id) {
      return NextResponse.json(
        { error: "Missing submission_id" },
        { status: 400 }
      );
    }

    const supabase = createServerClient();
    const { error } = await supabase
      .from("investment_submissions")
      .update({
        resolved_at: resolved === false ? null : new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", submission_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error resolving submission:", err);
    return NextResponse.json(
      { error: "Failed to update submission" },
      { status: 500 }
    );
  }
}
