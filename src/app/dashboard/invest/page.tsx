"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import {
  Loader2,
  Landmark,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  Building2,
  Receipt,
} from "lucide-react";
import type {
  InvestmentWindow,
  SubmissionStatus,
} from "@/types/database";
import {
  formatBankAccount,
  type LinkedBankAccount,
} from "@/lib/stripeCustomers";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface WindowWithState extends InvestmentWindow {
  is_open: boolean;
  is_upcoming: boolean;
}

interface MySubmission {
  id: string;
  amount: number;
  status: SubmissionStatus;
  failure_reason: string | null;
  created_at: string;
  window_title: string | null;
  bank_name: string | null;
  bank_last4: string | null;
  settled_at: string | null;
  units_granted: number | null;
  nav_per_unit: number | null;
  is_resolved: boolean;
  reversal_flagged_at: string | null;
}

const STATUS_META: Record<
  SubmissionStatus,
  { label: string; classes: string }
> = {
  pending_payment: {
    label: "Not completed",
    classes: "bg-highlight text-muted",
  },
  processing: { label: "In transit", classes: "bg-gold/10 text-gold" },
  paid: { label: "Received", classes: "bg-gain/10 text-gain" },
  processed: { label: "Invested", classes: "bg-gain/20 text-gain" },
  failed: { label: "Returned by bank", classes: "bg-loss/10 text-loss" },
  canceled: { label: "Not completed", classes: "bg-highlight text-muted" },
};

// A contribution only counts as a transaction once money has actually moved.
// Starting a checkout and closing it is a non-event, not a failure.
const REAL_TRANSACTION_STATUSES: SubmissionStatus[] = [
  "processing",
  "paid",
  "processed",
  "failed",
];

const QUICK_AMOUNTS = [100, 250, 500, 1000];

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatMoney(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

export default function InvestPage() {
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [returnStatus, setReturnStatus] = useState<string | null>(null);
  const [directResult, setDirectResult] = useState<string | null>(null);
  const [showIncomplete, setShowIncomplete] = useState(false);

  const { data, isLoading, mutate } = useSWR<{
    window: WindowWithState | null;
    submissions: MySubmission[];
  }>("/api/investment-window", fetcher, { refreshInterval: 30 * 1000 });

  const { data: paymentData } = useSWR<{
    bankAccounts: LinkedBankAccount[];
    configured: boolean;
  }>("/api/investment-window/payment-method", fetcher);

  // Read Stripe return status from the query string (client-only)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("status");
    if (status === "success" || status === "canceled") {
      // Syncing URL state after mount is intentional — reading the query
      // string during render would break SSR hydration.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setReturnStatus(status);
      // Clean the URL so a refresh doesn't re-show the banner
      window.history.replaceState({}, "", "/dashboard/invest");
      mutate();
    }
  }, [mutate]);

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-gold" />
          <p className="text-muted">Loading...</p>
        </div>
      </div>
    );
  }

  const invWindow = data?.window || null;
  const submissions = data?.submissions || [];
  const isOpen = invWindow?.is_open ?? false;
  const bankAccounts = paymentData?.bankAccounts || [];
  const hasSavedBank = bankAccounts.length > 0;

  // A failure that has been resolved (or superseded by a later contribution)
  // moves out of the active list — it no longer needs the member's attention
  const isActiveTransaction = (s: MySubmission) =>
    REAL_TRANSACTION_STATUSES.includes(s.status) &&
    !(s.status === "failed" && s.is_resolved);

  const realContributions = submissions.filter(isActiveTransaction);
  const incompleteContributions = submissions.filter(
    (s) => !isActiveTransaction(s)
  );
  const incompleteCount = incompleteContributions.length;

  const parsedAmount = parseFloat(amount);
  const amountValid =
    Number.isFinite(parsedAmount) &&
    parsedAmount >= (invWindow?.min_amount ?? 0) &&
    (!invWindow?.max_amount || parsedAmount <= invWindow.max_amount);

  const handleSubmit = async (useNewBank = false) => {
    if (!amountValid) {
      setError("Enter a valid amount within the window limits.");
      return;
    }
    setSubmitting(true);
    setError(null);
    setDirectResult(null);

    try {
      const res = await fetch("/api/investment-window/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: parsedAmount, useNewBank }),
      });
      const body = await res.json();

      if (!res.ok) {
        setError(body.error || "Failed to start payment.");
        setSubmitting(false);
        return;
      }

      // Saved bank debited directly — no redirect needed
      if (body.paid) {
        const bank = body.bank?.last4
          ? `${body.bank.bankName} ••••${body.bank.last4}`
          : "your saved bank account";
        setDirectResult(
          `${formatMoney(parsedAmount)} is on its way from ${bank}.`
        );
        setAmount("");
        setSubmitting(false);
        mutate();
        return;
      }

      if (!body.url) {
        setError("Failed to start payment.");
        setSubmitting(false);
        return;
      }

      // No saved bank yet — go to Stripe Checkout to link one
      window.location.href = body.url;
    } catch {
      setError("Failed to start payment. Please try again.");
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Invest</h1>
        <p className="mt-1 text-sm text-muted">
          Contribute to the fund during an open investment window
        </p>
      </div>

      {/* Stripe return banners */}
      {returnStatus === "success" && (
        <div className="glass-card border-gain/20 p-5">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-gain" />
            <div>
              <h3 className="font-medium text-foreground">
                Payment Submitted
              </h3>
              <p className="mt-1 text-sm text-muted">
                Your bank transfer has started. ACH payments usually settle in
                about 4 business days — your submission below will update
                automatically, and your units are granted once the fund
                processes the contribution.
              </p>
            </div>
          </div>
        </div>
      )}
      {returnStatus === "canceled" && (
        <div className="glass-card border-card-border p-5">
          <div className="flex items-start gap-3">
            <XCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-muted" />
            <div>
              <h3 className="font-medium text-foreground">Payment Canceled</h3>
              <p className="mt-1 text-sm text-muted">
                No money moved. You can start a new contribution any time while
                the window is open.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Saved-bank debit succeeded (no redirect) */}
      {directResult && (
        <div className="glass-card border-gain/20 p-5">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-gain" />
            <div>
              <h3 className="font-medium text-foreground">
                Contribution Started
              </h3>
              <p className="mt-1 text-sm text-muted">
                {directResult} ACH transfers usually settle in about 4 business
                days. Your units are granted once the fund processes it.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* No window at all */}
      {!invWindow && (
        <div className="glass-card p-6 text-center">
          <Landmark className="mx-auto h-10 w-10 text-muted/50" />
          <h2 className="mt-3 text-lg font-medium text-foreground">
            No Investment Window
          </h2>
          <p className="mt-1 text-sm text-muted">
            There is no investment window scheduled right now. Check back later
            or watch for an announcement.
          </p>
        </div>
      )}

      {/* Upcoming window */}
      {invWindow && invWindow.is_upcoming && (
        <div className="glass-card p-8 text-center">
          <Clock className="mx-auto h-12 w-12 text-gold/50" />
          <h2 className="mt-4 text-lg font-medium text-foreground">
            {invWindow.title}
          </h2>
          {invWindow.description && (
            <p className="mt-1 text-sm text-muted">{invWindow.description}</p>
          )}
          <p className="mt-3 text-sm text-muted">
            Opens {formatDateTime(invWindow.opens_at)}
          </p>
        </div>
      )}

      {/* Closed window */}
      {invWindow && !invWindow.is_open && !invWindow.is_upcoming && (
        <div className="glass-card border-loss/20 p-4">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-loss" />
            <p className="text-sm font-medium text-foreground">
              The last investment window closed{" "}
              {formatDateTime(invWindow.closes_at)}
            </p>
          </div>
        </div>
      )}

      {/* Open window — contribution form */}
      {invWindow && isOpen && (
        <div className="glass-card p-5 sm:p-6">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">
              {invWindow.title}
            </h2>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 animate-pulse rounded-full bg-gain" />
              <span className="text-xs text-muted">Open</span>
            </div>
          </div>
          {invWindow.description && (
            <p className="mb-4 text-sm text-muted">{invWindow.description}</p>
          )}
          <p className="mb-4 flex items-center gap-1.5 text-xs text-muted">
            <Clock className="h-3 w-3" />
            Closes {formatDateTime(invWindow.closes_at)}
          </p>

          <div className="space-y-4">
            {/* Quick amounts */}
            <div className="flex flex-wrap gap-2">
              {QUICK_AMOUNTS.filter(
                (q) =>
                  q >= invWindow.min_amount &&
                  (!invWindow.max_amount || q <= invWindow.max_amount)
              ).map((q) => (
                <button
                  key={q}
                  onClick={() => {
                    setAmount(String(q));
                    setError(null);
                  }}
                  className={`rounded-lg border px-4 py-2 text-sm font-medium transition-all ${
                    parsedAmount === q
                      ? "border-gold/50 bg-gold/10 text-gold ring-1 ring-gold/30"
                      : "border-card-border bg-card text-foreground hover:bg-highlight"
                  }`}
                >
                  ${q.toLocaleString()}
                </button>
              ))}
            </div>

            {/* Amount input */}
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">
                Investment Amount
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">
                  $
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  min={invWindow.min_amount}
                  max={invWindow.max_amount ?? undefined}
                  step="0.01"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    setError(null);
                  }}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-card-border bg-card py-2.5 pl-7 pr-3 text-sm text-foreground placeholder-muted focus:border-gold focus:outline-none"
                />
              </div>
              <p className="mt-1 text-xs text-muted">
                Minimum {formatMoney(invWindow.min_amount)}
                {invWindow.max_amount
                  ? ` · Maximum ${formatMoney(invWindow.max_amount)}`
                  : ""}
              </p>
            </div>

            {/* Which bank account this will be drawn from */}
            <div className="rounded-lg border border-card-border bg-card p-3.5">
              <div className="flex items-start gap-2.5">
                <Building2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-gold" />
                <div className="min-w-0">
                  {bankAccounts.length > 0 ? (
                    <>
                      <p className="text-xs font-medium text-muted">
                        Paying from
                      </p>
                      {bankAccounts.map((account) => (
                        <p
                          key={account.id}
                          className="text-sm font-semibold text-foreground"
                        >
                          {formatBankAccount(account)}
                        </p>
                      ))}
                      <p className="mt-1 text-xs text-muted">
                        You can choose a different bank at checkout.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-foreground">
                        No bank account linked yet
                      </p>
                      <p className="mt-0.5 text-xs text-muted">
                        You&apos;ll securely connect your bank at checkout.
                        It will be saved for future contributions.
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-loss/10 px-4 py-3 text-sm text-loss">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <button
              onClick={() => handleSubmit()}
              disabled={submitting || !amountValid}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-gold px-6 py-3 text-sm font-semibold text-black transition-colors hover:bg-gold/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Landmark className="h-4 w-4" />
              )}
              {submitting
                ? "Redirecting to payment..."
                : amountValid
                ? hasSavedBank
                  ? `Invest ${formatMoney(parsedAmount)}`
                  : `Continue to Bank Payment — ${formatMoney(parsedAmount)}`
                : hasSavedBank
                ? "Invest"
                : "Continue to Bank Payment"}
              {!submitting && !hasSavedBank && (
                <ArrowRight className="h-4 w-4" />
              )}
            </button>

            {hasSavedBank && (
              <button
                onClick={() => handleSubmit(true)}
                disabled={submitting || !amountValid}
                className="w-full text-center text-xs text-muted underline-offset-2 transition-colors hover:text-foreground hover:underline disabled:opacity-50"
              >
                Use a different bank account
              </button>
            )}

            <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted/70">
              <ShieldCheck className="h-3.5 w-3.5" />
              {hasSavedBank
                ? "Your saved bank is debited securely via Stripe — no need to re-enter it."
                : "Secure bank payment (ACH) powered by Stripe. Your bank is saved for next time."}{" "}
              Units are granted at the fund&apos;s NAV when your contribution is
              processed.
            </p>
          </div>
        </div>
      )}

      {/* Contribution history — one record per real transaction */}
      {realContributions.length > 0 && (
        <div className="glass-card overflow-hidden">
          <div className="border-b border-card-border px-4 py-3 sm:px-6 sm:py-4">
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-gold" />
              <h2 className="text-lg font-semibold text-foreground">
                Contribution History
              </h2>
            </div>
          </div>
          <div className="divide-y divide-card-border/50">
            {realContributions.map((sub) => {
              const meta = STATUS_META[sub.status];
              return (
                <div key={sub.id} className="px-4 py-4 sm:px-6">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">
                        {formatMoney(sub.amount)}
                      </p>
                      <p className="mt-0.5 text-xs text-muted">
                        {formatDateTime(sub.created_at)}
                        {sub.window_title ? ` · ${sub.window_title}` : ""}
                      </p>
                      {sub.bank_last4 && (
                        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                          <Building2 className="h-3 w-3" />
                          {sub.bank_name || "Bank"} ••••{sub.bank_last4}
                        </p>
                      )}
                    </div>
                    <span
                      className={`flex-shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${meta.classes}`}
                    >
                      {meta.label}
                    </span>
                  </div>

                  {/* What the money actually bought */}
                  {sub.status === "processed" && sub.units_granted != null && (
                    <p className="mt-2 text-xs text-gain">
                      {sub.units_granted.toFixed(4)} units
                      {sub.nav_per_unit != null
                        ? ` at ${formatMoney(sub.nav_per_unit)} per unit`
                        : ""}
                    </p>
                  )}
                  {sub.status === "processing" && (
                    <p className="mt-2 text-xs text-muted">
                      Bank transfers usually clear in about 4 business days.
                    </p>
                  )}
                  {sub.status === "paid" && (
                    <p className="mt-2 text-xs text-muted">
                      Received{sub.settled_at ? ` ${formatDateTime(sub.settled_at)}` : ""} — units are granted when the fund processes it.
                    </p>
                  )}
                  {sub.status === "failed" && sub.failure_reason && (
                    <p className="mt-2 text-xs text-loss">
                      {sub.failure_reason}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Incomplete attempts are not transactions — kept out of the way */}
          {incompleteCount > 0 && (
            <div className="border-t border-card-border/50 px-4 py-3 sm:px-6">
              <button
                onClick={() => setShowIncomplete(!showIncomplete)}
                className="text-xs text-muted transition-colors hover:text-foreground"
              >
                {showIncomplete ? "Hide" : "Show"} {incompleteCount} past{" "}
                {incompleteCount === 1 ? "attempt" : "attempts"}
              </button>
              {showIncomplete && (
                <div className="mt-2 space-y-1.5">
                  {incompleteContributions.map((sub) => (
                    <div
                      key={sub.id}
                      className="flex items-center justify-between gap-2 text-xs text-muted"
                    >
                      <span>
                        {formatMoney(sub.amount)} · {formatDateTime(sub.created_at)}
                      </span>
                      <span>
                        {sub.status === "failed" ? "Resolved" : "Not completed"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* First-time members with only incomplete attempts */}
      {realContributions.length === 0 && incompleteCount > 0 && (
        <p className="text-center text-xs text-muted">
          No completed contributions yet. Incomplete attempts aren&apos;t
          recorded as transactions.
        </p>
      )}
    </div>
  );
}