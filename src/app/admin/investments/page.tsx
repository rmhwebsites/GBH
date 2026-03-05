"use client";

import useSWR from "swr";
import { useState } from "react";
import {
  Loader2,
  Plus,
  Check,
  X,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Trash2,
  Wallet,
  CalendarClock,
  Activity,
  Users,
  TrendingUp,
} from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/calculations";
import type { MemberInvestment } from "@/types/database";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface InvestmentForm {
  memberstack_id: string;
  member_name: string;
  member_email: string;
  amount: string;
  investment_date: string;
  type: "invest" | "withdraw";
}

const emptyForm: InvestmentForm = {
  memberstack_id: "",
  member_name: "",
  member_email: "",
  amount: "",
  investment_date: new Date().toISOString().split("T")[0],
  type: "invest",
};

export default function AdminInvestmentsPage() {
  const {
    data: membersData,
    isLoading,
    mutate,
  } = useSWR<{ members: MemberInvestment[] }>("/api/admin/members", fetcher);
  const { data: navData } = useSWR<{ nav: number; totalValue: number }>(
    "/api/portfolio/nav",
    fetcher
  );

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<InvestmentForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const showMessage = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const members = membersData?.members || [];
  const navPerUnit = navData?.nav || 0;

  // Get unique members for the dropdown
  const uniqueMembers = new Map<
    string,
    { name: string; email: string; memberstackId: string }
  >();
  members.forEach((m) => {
    if (!uniqueMembers.has(m.memberstack_id)) {
      uniqueMembers.set(m.memberstack_id, {
        name: m.member_name,
        email: m.member_email,
        memberstackId: m.memberstack_id,
      });
    }
  });

  const handleSelectMember = (memberstackId: string) => {
    const member = uniqueMembers.get(memberstackId);
    if (member) {
      setForm({
        ...form,
        memberstack_id: member.memberstackId,
        member_name: member.name,
        member_email: member.email,
      });
    } else {
      setForm({
        ...form,
        memberstack_id: memberstackId,
        member_name: "",
        member_email: "",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.memberstack_id || !form.amount) return;

    setSaving(true);
    try {
      const amount = parseFloat(form.amount);
      const actualAmount = form.type === "withdraw" ? -amount : amount;

      const res = await fetch("/api/admin/investments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberstack_id: form.memberstack_id,
          member_name: form.member_name,
          member_email: form.member_email,
          amount: actualAmount,
          investment_date: form.investment_date,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to record");
      }

      const result = await res.json();
      showMessage(
        "success",
        `${form.type === "invest" ? "Investment" : "Withdrawal"} of ${formatCurrency(amount)} recorded for ${form.member_name}. Units: ${formatNumber(Math.abs(result.investment.units_owned), 4)}`
      );
      setForm({ ...emptyForm, investment_date: new Date().toISOString().split("T")[0] });
      setShowForm(false);
      mutate();
    } catch (err) {
      showMessage("error", err instanceof Error ? err.message : "Failed to record");
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this investment record? This will also update the unit totals.")) return;

    setDeleting(id);
    try {
      const res = await fetch(`/api/admin/investments?id=${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
      showMessage("success", "Investment record deleted");
      mutate();
    } catch {
      showMessage("error", "Failed to delete record");
    }
    setDeleting(null);
  };

  // Group investments by member for the summary
  const memberSummaries = new Map<
    string,
    {
      name: string;
      email: string;
      totalInvested: number;
      totalUnits: number;
      investments: MemberInvestment[];
    }
  >();
  members.forEach((m) => {
    const existing = memberSummaries.get(m.memberstack_id);
    if (existing) {
      existing.totalInvested += m.amount_invested;
      existing.totalUnits += m.units_owned;
      existing.investments.push(m);
    } else {
      memberSummaries.set(m.memberstack_id, {
        name: m.member_name,
        email: m.member_email,
        totalInvested: m.amount_invested,
        totalUnits: m.units_owned,
        investments: [m],
      });
    }
  });

  // ── Calculate totals ─────────────────────────────────────────────
  const totalInvestedAllTime = members.reduce(
    (sum, m) => sum + m.amount_invested,
    0
  );

  const totalUnitsAll = members.reduce((sum, m) => sum + m.units_owned, 0);

  // Total invested in last 12 months
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);
  const totalInvestedLast12 = members
    .filter((m) => new Date(m.investment_date) >= twelveMonthsAgo)
    .reduce((sum, m) => sum + m.amount_invested, 0);

  // Average NAV at entry (weighted average = total invested / total units)
  const avgNavAtEntry =
    totalUnitsAll > 0 ? totalInvestedAllTime / totalUnitsAll : 0;

  // Current total value based on NAV
  const totalCurrentValue = totalUnitsAll * navPerUnit;
  const totalGainLoss = totalCurrentValue - totalInvestedAllTime;
  const totalGainLossIsPositive = totalGainLoss >= 0;

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Investment History
          </h1>
          <p className="mt-1 text-sm text-muted">
            Record investments and withdrawals for members.
            {navPerUnit > 0 && (
              <span className="ml-2 text-gold">
                Current NAV: {formatCurrency(navPerUnit)}/unit
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setShowForm(!showForm);
              setForm({ ...emptyForm, investment_date: new Date().toISOString().split("T")[0] });
            }}
            className="flex items-center gap-2 rounded-lg bg-gold px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-gold-light"
          >
            <Plus className="h-4 w-4" />
            Record Transaction
          </button>
        </div>
      </div>

      {/* Summary Totals */}
      {members.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
          <div className="glass-card p-4 sm:p-5">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gold/10 sm:h-10 sm:w-10">
                <Wallet className="h-4 w-4 text-gold sm:h-5 sm:w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted">Total Invested</p>
                <p className="text-lg font-semibold text-foreground sm:text-xl">
                  {formatCurrency(totalInvestedAllTime)}
                </p>
              </div>
            </div>
          </div>

          <div className="glass-card p-4 sm:p-5">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-navy/30 sm:h-10 sm:w-10">
                <CalendarClock className="h-4 w-4 text-gold-light sm:h-5 sm:w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted">Last 12 Months</p>
                <p className="text-lg font-semibold text-foreground sm:text-xl">
                  {formatCurrency(totalInvestedLast12)}
                </p>
              </div>
            </div>
          </div>

          <div className="glass-card p-4 sm:p-5">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gold/10 sm:h-10 sm:w-10">
                <Activity className="h-4 w-4 text-gold sm:h-5 sm:w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted">Avg Entry NAV</p>
                <p className="text-lg font-semibold text-foreground sm:text-xl">
                  {formatCurrency(avgNavAtEntry)}
                </p>
              </div>
            </div>
          </div>

          <div className="glass-card p-4 sm:p-5">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-navy/30 sm:h-10 sm:w-10">
                <Users className="h-4 w-4 text-gold-light sm:h-5 sm:w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted">Members</p>
                <p className="text-lg font-semibold text-foreground sm:text-xl">
                  {memberSummaries.size}
                </p>
                <p className="text-xs text-muted">
                  {members.length} record{members.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
          </div>

          <div className="glass-card p-4 sm:p-5">
            <div className="flex items-center gap-2 sm:gap-3">
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg sm:h-10 sm:w-10 ${
                  totalGainLossIsPositive ? "bg-gain/10" : "bg-loss/10"
                }`}
              >
                <TrendingUp
                  className={`h-4 w-4 sm:h-5 sm:w-5 ${
                    totalGainLossIsPositive ? "text-gain" : "text-loss"
                  }`}
                />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted">Total Value</p>
                <p className="text-lg font-semibold text-foreground sm:text-xl">
                  {formatCurrency(totalCurrentValue)}
                </p>
                <p
                  className={`text-xs font-medium ${
                    totalGainLossIsPositive ? "text-gain" : "text-loss"
                  }`}
                >
                  {totalGainLossIsPositive ? "+" : ""}
                  {formatCurrency(totalGainLoss)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Status Message */}
      {message && (
        <div
          className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm ${
            message.type === "success"
              ? "bg-gain/10 text-gain"
              : "bg-loss/10 text-loss"
          }`}
        >
          {message.type === "success" ? (
            <Check className="h-4 w-4" />
          ) : (
            <X className="h-4 w-4" />
          )}
          {message.text}
        </div>
      )}

      {/* Record Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="glass-card p-6">
          <h3 className="mb-4 text-lg font-medium text-foreground">
            Record Investment / Withdrawal
          </h3>

          {/* Type Toggle */}
          <div className="mb-6 flex gap-2">
            <button
              type="button"
              onClick={() => setForm({ ...form, type: "invest" })}
              className={`flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-medium transition-colors ${
                form.type === "invest"
                  ? "bg-gain/20 text-gain"
                  : "bg-card-glass text-muted hover:text-foreground"
              }`}
            >
              <ArrowUpRight className="h-4 w-4" />
              Investment
            </button>
            <button
              type="button"
              onClick={() => setForm({ ...form, type: "withdraw" })}
              className={`flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-medium transition-colors ${
                form.type === "withdraw"
                  ? "bg-loss/20 text-loss"
                  : "bg-card-glass text-muted hover:text-foreground"
              }`}
            >
              <ArrowDownRight className="h-4 w-4" />
              Withdrawal
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Member Select */}
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs text-muted">
                Select Member
              </label>
              {uniqueMembers.size > 0 ? (
                <select
                  value={form.memberstack_id}
                  onChange={(e) => handleSelectMember(e.target.value)}
                  className="w-full rounded-lg border border-input-border bg-input-bg px-3 py-2 text-sm text-foreground focus:border-gold focus:outline-none"
                >
                  <option value="">Select a member...</option>
                  {Array.from(uniqueMembers.entries()).map(([id, m]) => (
                    <option key={id} value={id}>
                      {m.name} ({m.email})
                    </option>
                  ))}
                  <option value="__new__">+ Add New Member</option>
                </select>
              ) : (
                <p className="text-sm text-muted">
                  No members yet. Fill in the details below.
                </p>
              )}
            </div>

            {/* New member fields - only show if adding new */}
            {(form.memberstack_id === "__new__" ||
              uniqueMembers.size === 0) && (
              <>
                <div>
                  <label className="mb-1 block text-xs text-muted">
                    Memberstack ID
                  </label>
                  <input
                    type="text"
                    placeholder="mem_abc123..."
                    value={
                      form.memberstack_id === "__new__"
                        ? ""
                        : form.memberstack_id
                    }
                    onChange={(e) =>
                      setForm({ ...form, memberstack_id: e.target.value })
                    }
                    className="w-full rounded-lg border border-input-border bg-input-bg px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-gold focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted">
                    Member Name
                  </label>
                  <input
                    type="text"
                    placeholder="John Doe"
                    value={form.member_name}
                    onChange={(e) =>
                      setForm({ ...form, member_name: e.target.value })
                    }
                    className="w-full rounded-lg border border-input-border bg-input-bg px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-gold focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted">
                    Email
                  </label>
                  <input
                    type="email"
                    placeholder="john@example.com"
                    value={form.member_email}
                    onChange={(e) =>
                      setForm({ ...form, member_email: e.target.value })
                    }
                    className="w-full rounded-lg border border-input-border bg-input-bg px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-gold focus:outline-none"
                  />
                </div>
              </>
            )}

            {/* Amount */}
            <div>
              <label className="mb-1 block text-xs text-muted">
                Amount ($)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="5000.00"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className="w-full rounded-lg border border-input-border bg-input-bg px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-gold focus:outline-none"
              />
              {form.amount && navPerUnit > 0 && (
                <p className="mt-1 text-xs text-gold">
                  = {formatNumber(parseFloat(form.amount) / navPerUnit, 4)}{" "}
                  units @ {formatCurrency(navPerUnit)}/unit
                </p>
              )}
            </div>

            {/* Date */}
            <div>
              <label className="mb-1 block text-xs text-muted">Date</label>
              <input
                type="date"
                value={form.investment_date}
                onChange={(e) =>
                  setForm({ ...form, investment_date: e.target.value })
                }
                className="w-full rounded-lg border border-input-border bg-input-bg px-3 py-2 text-sm text-foreground focus:border-gold focus:outline-none [color-scheme:dark]"
              />
            </div>
          </div>

          <div className="mt-6 flex gap-2">
            <button
              type="submit"
              disabled={
                saving ||
                !form.memberstack_id ||
                form.memberstack_id === "__new__" ||
                !form.amount
              }
              className={`flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-medium text-black transition-colors disabled:opacity-50 ${
                form.type === "invest"
                  ? "bg-gain hover:bg-gain/80"
                  : "bg-loss hover:bg-loss/80"
              }`}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <DollarSign className="h-4 w-4" />
              )}
              Record {form.type === "invest" ? "Investment" : "Withdrawal"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setForm(emptyForm);
              }}
              className="rounded-lg border border-card-border px-4 py-2 text-sm text-muted hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Member Summaries */}
      {Array.from(memberSummaries.entries()).map(([memberstackId, summary]) => {
        const currentValue = summary.totalUnits * navPerUnit;
        const gainLoss = currentValue - summary.totalInvested;
        const isPositive = gainLoss >= 0;

        return (
          <div key={memberstackId} className="glass-card overflow-hidden">
            {/* Member Header */}
            <div className="border-b border-card-border px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">
                    {summary.name}
                  </h3>
                  <a
                    href={`mailto:${summary.email}`}
                    className="text-xs text-muted hover:text-gold hover:underline"
                  >
                    {summary.email}
                  </a>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted">
                    Invested: {formatCurrency(summary.totalInvested)}
                  </p>
                  <p className="text-sm text-muted">
                    Value: {formatCurrency(currentValue)} ·{" "}
                    <span
                      className={`font-medium ${
                        isPositive ? "text-gain" : "text-loss"
                      }`}
                    >
                      {isPositive ? "+" : ""}
                      {formatCurrency(gainLoss)}
                    </span>
                  </p>
                  <p className="text-xs text-muted">
                    {formatNumber(summary.totalUnits, 4)} units
                  </p>
                </div>
              </div>
            </div>

            {/* Investment History Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-card-border text-left text-xs uppercase tracking-wider text-muted">
                    <th className="px-6 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium text-right">
                      Amount
                    </th>
                    <th className="px-4 py-3 font-medium text-right">
                      Units
                    </th>
                    <th className="px-4 py-3 font-medium text-right">
                      NAV at Entry
                    </th>
                    <th className="px-4 py-3 font-medium text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {summary.investments
                    .sort(
                      (a, b) =>
                        new Date(b.investment_date).getTime() -
                        new Date(a.investment_date).getTime()
                    )
                    .map((inv) => {
                      const entryNav =
                        inv.units_owned !== 0
                          ? inv.amount_invested / inv.units_owned
                          : 0;
                      return (
                        <tr
                          key={inv.id}
                          className="border-b border-card-border/50 text-sm transition-colors hover:bg-card-glass"
                        >
                          <td className="px-6 py-3 text-foreground">
                            {new Date(inv.investment_date).toLocaleDateString(
                              "en-US",
                              {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                                timeZone: "UTC",
                              }
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span
                              className={`font-medium ${
                                inv.amount_invested >= 0
                                  ? "text-gain"
                                  : "text-loss"
                              }`}
                            >
                              {inv.amount_invested >= 0 ? "+" : ""}
                              {formatCurrency(inv.amount_invested)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-muted">
                            {inv.units_owned >= 0 ? "+" : ""}
                            {formatNumber(inv.units_owned, 4)}
                          </td>
                          <td className="px-4 py-3 text-right text-muted">
                            {formatCurrency(entryNav)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => handleDelete(inv.id)}
                              disabled={deleting === inv.id}
                              className="rounded p-1.5 text-muted hover:bg-loss/10 hover:text-loss"
                            >
                              {deleting === inv.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      {members.length === 0 && (
        <div className="glass-card p-12 text-center">
          <DollarSign className="mx-auto h-12 w-12 text-muted" />
          <p className="mt-4 text-lg text-muted">No investments recorded yet</p>
          <p className="mt-2 text-sm text-muted">
            Click &quot;Record Transaction&quot; to add the first investment.
          </p>
        </div>
      )}
    </div>
  );
}
