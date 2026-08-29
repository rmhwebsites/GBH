import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { createServerClient } from "@/lib/supabase";
import { getStripe } from "@/lib/stripe";
import type { SubmissionStatus } from "@/types/database";

// Explicit allowed transitions so webhook retries / out-of-order events can
// never corrupt a submission: a late 'completed' can't undo 'paid', but an
// ACH failure CAN move 'processing' to 'failed'. 'canceled' may still become
// paid — a member can finish an older checkout tab after we retired it, and
// real money movement must always win over our local bookkeeping.
const ALLOWED_TRANSITIONS: Record<SubmissionStatus, SubmissionStatus[]> = {
  pending_payment: ["processing", "paid", "failed", "canceled"],
  processing: ["paid", "failed"],
  canceled: ["processing", "paid"],
  failed: [],
  paid: ["processed"],
  processed: [],
};

async function updateSubmission(
  sessionId: string,
  submissionIdHint: string | undefined,
  nextStatus: SubmissionStatus,
  extra: Record<string, unknown> = {}
) {
  // Nothing to correlate on (an unrelated payment intent) — ignore it
  if (!submissionIdHint && !sessionId) return;

  const supabase = createServerClient();

  let query = supabase
    .from("investment_submissions")
    .select("id, status")
    .limit(1);
  if (submissionIdHint) {
    query = query.eq("id", submissionIdHint);
  } else {
    query = query.eq("stripe_session_id", sessionId);
  }

  const { data: rows } = await query;
  const submission = rows?.[0];
  if (!submission) {
    console.error(`Webhook: no submission for session ${sessionId}`);
    return;
  }

  const current = submission.status as SubmissionStatus;
  if (!ALLOWED_TRANSITIONS[current].includes(nextStatus)) {
    return;
  }

  await supabase
    .from("investment_submissions")
    .update({
      status: nextStatus,
      updated_at: new Date().toISOString(),
      // Record when the transfer actually cleared
      ...(nextStatus === "paid" ? { settled_at: new Date().toISOString() } : {}),
      ...extra,
    })
    .eq("id", submission.id);
}

export async function POST(request: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Webhook not configured" },
      { status: 503 }
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const rawBody = await request.text();
    event = getStripe().webhooks.constructEvent(rawBody, signature, secret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const paymentIntent =
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id || null;
        // ACH: checkout completes first, money moves later —
        // payment_status distinguishes instant vs pending settlement
        const status: SubmissionStatus =
          session.payment_status === "paid" ? "paid" : "processing";
        await updateSubmission(
          session.id,
          session.metadata?.submission_id,
          status,
          { stripe_payment_intent: paymentIntent }
        );
        break;
      }

      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object;
        await updateSubmission(
          session.id,
          session.metadata?.submission_id,
          "paid"
        );
        break;
      }

      case "checkout.session.async_payment_failed": {
        const session = event.data.object;
        await updateSubmission(
          session.id,
          session.metadata?.submission_id,
          "failed",
          { failure_reason: "Bank payment failed or was returned" }
        );
        break;
      }

      case "checkout.session.expired": {
        const session = event.data.object;
        await updateSubmission(
          session.id,
          session.metadata?.submission_id,
          "canceled",
          { failure_reason: "Checkout session expired" }
        );
        break;
      }

      // Direct off-session debits of a saved bank account emit
      // payment_intent.* events rather than checkout.session.*
      case "payment_intent.processing": {
        const intent = event.data.object;
        await updateSubmission(
          "",
          intent.metadata?.submission_id,
          "processing",
          { stripe_payment_intent: intent.id }
        );
        break;
      }

      case "payment_intent.succeeded": {
        const intent = event.data.object;
        await updateSubmission("", intent.metadata?.submission_id, "paid", {
          stripe_payment_intent: intent.id,
        });
        break;
      }

      case "payment_intent.payment_failed": {
        const intent = event.data.object;
        await updateSubmission("", intent.metadata?.submission_id, "failed", {
          stripe_payment_intent: intent.id,
          failure_reason:
            intent.last_payment_error?.message ||
            "Bank payment failed or was returned",
        });
        break;
      }

      default:
        // Unhandled event types are fine — acknowledge them
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Webhook handler error:", err);
    // 500 makes Stripe retry, which is what we want for transient failures
    return NextResponse.json({ error: "Handler failure" }, { status: 500 });
  }
}
