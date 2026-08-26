"use client";

import { useMemo, useState } from "react";
import useSWR, { mutate } from "swr";
import {
  Loader2,
  Save,
  Landmark,
  Users,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Pencil,
  Trash2,
  X,
  DollarSign,
  BadgeCheck,
} from "lucide-react";
import type {
  InvestmentWindow,
  InvestmentSubmission,
  SubmissionStatus,
} from "@/types/database";
import { MemberAvatar } from "@/components/ui/MemberAvatar";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface WindowWithSubmissions extends InvestmentWindow {
  submissions: InvestmentSubmission[];
}

const STATUS_META: Record<
  SubmissionStatus,
  { label: string; classes: string }
> = {
  pending_payment: { label: "Pending", classes: "bg-highlight text-muted" },
  processing: { label: "Processing", classes: "bg-gold/10 text-gold" },
  paid: { label: "Paid", classes: "bg-gain/10 text-gain" },
  processed: { label: "Invested", classes: "bg-gain/20 text-gain" },
  failed: { label: "Failed", classes: "bg-loss/10 text-loss" },
  canceled: { label: "Canceled", classes: "bg-highlight text-muted" },
};

function toLocalInput(isoStr: string | null): string {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 16);
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
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

function windowState(w: InvestmentWindow): "open" | "upcoming" | "closed" | "inactive" {
  if (!w.is_active) return "inactive";
  const now = new Date();
  if (new Date(w.opens_at) > now) return "upcoming";
  if (new Date(w.closes_at) <= now) return "closed";
  return "open";
}

const STATE_META = {
  open: { label: "Open", classes: "bg-gain/10 text-gain" },
  upcoming: { label: "Scheduled", classes: "bg-gold/10 text-gold" },
  closed: { label: "Closed", classes: "bg-highlight text-muted" },
  inactive: { label: "Inactive", classes: "bg-loss/10 text-loss" },
} as const;

export default function AdminFundingPage() {
  const { data, isLoading } = useSWR<{ windows: WindowWithSubmissions[] }>(
    "/api/admin/investment-windows",
    fetcher,
    { refreshInterval: 30 * 1000 }
  );

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [opensAt, setOpensAt] = useState("");
  const [closesAt, setClosesAt] = useState("");
  const [minAmount, setMinAmount] = useState("100");
  const [maxAmount, setMaxAmount] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [processMessage, setProcessMessage] = useState<string | null>(null);
  const [busyWindowId, setBusyWindowId] = useState<string | null>(null);

  const windows = useMemo(() => data?.windows || [], [data]);

  const stats = useMemo(() => {
    let raised = 0;
    let awaitingProcess = 0;
    let inFlight = 0;
    for (const w of windows) {
      for (const s of w.submissions) {
        if (s.status === "paid" || s.status === "processed") raised += s.amount;
        if (s.status === "paid") awaitingProcess++;
        if (s.status === "processing") inFlight++;
      }
    }
    return { raised, awaitingProcess, inFlight };
  }, [windows]);

  const resetForm = () => {
    setEditingId(null);
    setTitle("");
    setDescription("");
    setOpensAt("");
    setClosesAt("");
    setMinAmount("100");
    setMaxAmount("");
  };

  const startEditing = (w: InvestmentWindow) => {
    setEditingId(w.id);
    setTitle(w.title);
    setDescription(w.description || "");
    setOpensAt(toLocalInput(w.opens_at));
    setClosesAt(toLocalInput(w.closes_at));
    setMinAmount(String(w.min_amount));
    setMaxAmount(w.max_amount ? String(w.max_amount) : "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSave = async () => {
    if (!opensAt || !closesAt) {
      setMessage("Error: Open and close dates are required");
      return;
    }
    if (new Date(opensAt) >= new Date(closesAt)) {
      setMessage("Error: Open date must be before close date");
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const payload = {
        ...(editingId ? { id: editingId } : {}),
        title: title || "Investment Window",
        description: description || null,
        opens_at: new Date(opensAt).toISOString(),
        closes_at: new Date(closesAt).toISOString(),
        min_amount: parseFloat(minAmount) || 100,
        max_amount: maxAmount ? parseFloat(maxAmount) : null,
      };

      const res = await fetch("/api/admin/investment-windows", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json();
        setMessage(`Error: ${body.error}`);
        return;
      }

      setMessage(editingId ? "Window updated!" : "Window created!");
      resetForm();
      mutate("/api/admin/investment-windows");
      setTimeout(() => setMessage(null), 3000);
    } catch {
      setMessage("Error: Failed to save window");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (w: InvestmentWindow) => {
    setBusyWindowId(w.id);
    try {
      await fetch("/api/admin/investment-windows", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: w.id, is_active: !w.is_active }),
      });
      mutate("/api/admin/investment-windows");
    } finally {
      setBusyWindowId(null);
    }
  };

  const handleDelete = async (id: string) => {
    setBusyWindowId(id);
    try {
      const res = await fetch(`/api/admin/investment-windows?id=${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await res.json();
        setProcessMessage(`Error: ${body.error}`);
        setTimeout(() => setProcessMessage(null), 5000);
      } else if (editingId === id) {
        resetForm();
      }
      mutate("/api/admin/investment-windows");
    } finally {
      setBusyWindowId(null);
    }
  };

  const handleProcess = async (submissionId: string) => {
    setProcessingId(submissionId);
    setProcessMessage(null);
    try {
      const res = await fetch("/api/admin/investment-windows/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submission_id: submissionId }),
      });
      const body = await res.json();
      if (!res.ok) {
        setProcessMessage(`Error: ${body.error}`);
      } else {
        setProcessMessage(
          `Invested ${formatMoney(body.investment.amount_invested)} — ${body.unitsGranted.toFixed(4)} units at ${formatMoney(body.navPerUnit)}/unit`
        );
      }
      mutate("/api/admin/investment-windows");
      setTimeout(() => setProcessMessage(null), 6000);
    } catch {
      setProcessMessage("Error: Failed to process submission");
    } finally {
      setProcessingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Funding</h1>
        <p className="mt-1 text-sm text-muted">
          Open investment windows and process member contributions (Stripe ACH)
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="glass-card p-5">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-gold" />
            <p className="text-sm text-muted">Raised (paid + invested)</p>
          </div>
          <p className="mt-1 text-2xl font-semibold text-foreground">
            {formatMoney(stats.raised)}
          </p>
        </div>
        <div className="glass-card p-5">
          <div className="flex items-center gap-2">
            <BadgeCheck className="h-4 w-4 text-gold" />
            <p className="text-sm text-muted">Awaiting Processing</p>
          </div>
          <p className="mt-1 text-2xl font-semibold text-foreground">
            {stats.awaitingProcess}
          </p>
        </div>
        <div className="glass-card p-5">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-gold" />
            <p className="text-sm text-muted">Bank Transfers In Flight</p>
          </div>
          <p className="mt-1 text-2xl font-semibold text-foreground">
            {stats.inFlight}
          </p>
        </div>
      </div>

      {/* Create / Edit window */}
      <div className="glass-card p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Landmark className="h-4 w-4 text-gold" />
            <h2 className="text-lg font-semibold text-foreground">
              {editingId ? "Edit Window" : "New Investment Window"}
            </h2>
          </div>
          {editingId && (
            <button
              onClick={resetForm}
              className="flex items-center gap-1 text-xs text-muted hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
              Cancel edit
            </button>
          )}
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">
                Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Q3 2026 Contribution Window"
                className="w-full rounded-lg border border-card-border bg-card px-3 py-2 text-sm text-foreground placeholder-muted focus:border-gold focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">
                Description <span className="text-muted">(optional)</span>
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Shown to members on the Invest page"
                className="w-full rounded-lg border border-card-border bg-card px-3 py-2 text-sm text-foreground placeholder-muted focus:border-gold focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">
                Opens At
              </label>
              <input
                type="datetime-local"
                value={opensAt}
                onChange={(e) => setOpensAt(e.target.value)}
                className="w-full rounded-lg border border-card-border bg-card px-3 py-2 text-sm text-foreground focus:border-gold focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">
                Closes At
              </label>
              <input
                type="datetime-local"
                value={closesAt}
                onChange={(e) => setClosesAt(e.target.value)}
                className="w-full rounded-lg border border-card-border bg-card px-3 py-2 text-sm text-foreground focus:border-gold focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">
                Min Amount ($)
              </label>
              <input
                type="number"
                min={1}
                value={minAmount}
                onChange={(e) => setMinAmount(e.target.value)}
                className="w-full rounded-lg border border-card-border bg-card px-3 py-2 text-sm text-foreground focus:border-gold focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">
                Max Amount ($, blank = none)
              </label>
              <input
                type="number"
                min={1}
                value={maxAmount}
                onChange={(e) => setMaxAmount(e.target.value)}
                className="w-full rounded-lg border border-card-border bg-card px-3 py-2 text-sm text-foreground focus:border-gold focus:outline-none"
              />
            </div>
          </div>

          {opensAt && closesAt && new Date(opensAt) >= new Date(closesAt) && (
            <div className="flex items-center gap-1.5 text-xs text-loss">
              <AlertCircle className="h-3 w-3" />
              Open date must be before close date
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-gold px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-gold/90 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {saving
                ? "Saving..."
                : editingId
                ? "Update Window"
                : "Create Window"}
            </button>
            {message && (
              <span
                className={`flex items-center gap-1 text-sm ${
                  message.startsWith("Error") ? "text-loss" : "text-gain"
                }`}
              >
                {!message.startsWith("Error") && (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                )}
                {message}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Process feedback */}
      {processMessage && (
        <div
          className={`glass-card p-4 text-sm ${
            processMessage.startsWith("Error")
              ? "border-loss/20 text-loss"
              : "border-gain/20 text-gain"
          }`}
        >
          {processMessage}
        </div>
      )}

      {/* Windows list */}
      {windows.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <Landmark className="mx-auto h-10 w-10 text-muted/50" />
          <p className="mt-3 text-muted">
            No investment windows yet. Create the first one above.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {windows.map((w) => {
            const state = windowState(w);
            const stateMeta = STATE_META[state];
            const isExpanded = expandedId === w.id;
            const paidTotal = w.submissions
              .filter((s) => s.status === "paid" || s.status === "processed")
              .reduce((sum, s) => sum + s.amount, 0);

            return (
              <div key={w.id} className="glass-card overflow-hidden">
                {/* Window header row */}
                <div className="flex items-center gap-3 px-4 py-4 sm:px-6">
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : w.id)}
                    className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">
                          {w.title}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${stateMeta.classes}`}
                        >
                          {stateMeta.label}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDateTime(w.opens_at)} —{" "}
                          {formatDateTime(w.closes_at)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {w.submissions.length} submission
                          {w.submissions.length !== 1 ? "s" : ""}
                        </span>
                        {paidTotal > 0 && (
                          <span className="flex items-center gap-1 font-medium text-gold">
                            <DollarSign className="h-3 w-3" />
                            {formatMoney(paidTotal)} raised
                          </span>
                        )}
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 flex-shrink-0 text-muted" />
                    ) : (
                      <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted" />
                    )}
                  </button>
                  <div className="flex flex-shrink-0 items-center gap-1">
                    <button
                      onClick={() => toggleActive(w)}
                      disabled={busyWindowId === w.id}
                      className={`rounded-lg px-2 py-1 text-[11px] font-medium transition-colors disabled:opacity-50 ${
                        w.is_active
                          ? "text-muted hover:bg-card hover:text-loss"
                          : "text-gain hover:bg-card"
                      }`}
                      title={w.is_active ? "Deactivate" : "Reactivate"}
                    >
                      {w.is_active ? "Deactivate" : "Activate"}
                    </button>
                    <button
                      onClick={() => startEditing(w)}
                      className="rounded-lg p-2 text-muted transition-colors hover:bg-card hover:text-gold"
                      title="Edit window"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(w.id)}
                      disabled={busyWindowId === w.id}
                      className="rounded-lg p-2 text-muted transition-colors hover:bg-card hover:text-loss disabled:opacity-50"
                      title="Delete window"
                    >
                      {busyWindowId === w.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Submissions */}
                {isExpanded && (
                  <div className="border-t border-card-border/30">
                    {w.submissions.length === 0 ? (
                      <p className="p-4 text-sm text-muted sm:px-6">
                        No submissions yet.
                      </p>
                    ) : (
                      <div className="divide-y divide-card-border/50">
                        {w.submissions.map((sub) => {
                          const meta = STATUS_META[sub.status];
                          return (
                            <div
                              key={sub.id}
                              className="flex items-center gap-3 px-4 py-3 sm:px-6"
                            >
                              <MemberAvatar name={sub.member_name} size="sm" />
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-sm font-medium text-foreground">
                                    {sub.member_name}
                                  </span>
                                  <span className="text-sm font-bold text-gold">
                                    {formatMoney(sub.amount)}
                                  </span>
                                  <span
                                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.classes}`}
                                  >
                                    {meta.label}
                                  </span>
                                </div>
                                <p className="mt-0.5 text-xs text-muted">
                                  {formatDateTime(sub.created_at)}
                                  {sub.failure_reason
                                    ? ` · ${sub.failure_reason}`
                                    : ""}
                                </p>
                              </div>
                              {sub.status === "paid" && (
                                <button
                                  onClick={() => handleProcess(sub.id)}
                                  disabled={processingId === sub.id}
                                  className="flex flex-shrink-0 items-center gap-1.5 rounded-lg bg-gold px-3 py-1.5 text-xs font-semibold text-black transition-colors hover:bg-gold/90 disabled:opacity-50"
                                >
                                  {processingId === sub.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <BadgeCheck className="h-3 w-3" />
                                  )}
                                  {processingId === sub.id
                                    ? "Processing..."
                                    : "Process at NAV"}
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
