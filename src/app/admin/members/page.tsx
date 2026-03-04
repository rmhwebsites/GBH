"use client";

import useSWR from "swr";
import { useState } from "react";
import {
  Loader2,
  Plus,
  Pencil,
  X,
  Save,
  Check,
  Users,
} from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/calculations";
import type { MemberInvestment } from "@/types/database";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface MemberForm {
  memberstack_id: string;
  member_name: string;
  member_email: string;
  amount_invested: string;
}

const emptyForm: MemberForm = {
  memberstack_id: "",
  member_name: "",
  member_email: "",
  amount_invested: "",
};

export default function AdminMembersPage() {
  const { data, isLoading, mutate } = useSWR<{ members: MemberInvestment[] }>(
    "/api/admin/members",
    fetcher
  );
  const { data: navData } = useSWR<{ nav: number; totalValue: number }>(
    "/api/portfolio/nav",
    fetcher
  );
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<MemberForm>(emptyForm);
  const [editForm, setEditForm] = useState({
    member_name: "",
    member_email: "",
    amount_invested: "",
    units_owned: "",
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const showMessage = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleAdd = async () => {
    if (!form.memberstack_id || !form.amount_invested) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberstack_id: form.memberstack_id,
          member_name: form.member_name,
          member_email: form.member_email,
          amount_invested: parseFloat(form.amount_invested),
        }),
      });
      if (!res.ok) throw new Error("Failed to add member");
      setForm(emptyForm);
      setShowForm(false);
      mutate();
      showMessage("success", `${form.member_name} added`);
    } catch {
      showMessage("error", "Failed to add member");
    }
    setSaving(false);
  };

  const handleUpdate = async (id: string) => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/members", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          member_name: editForm.member_name,
          member_email: editForm.member_email,
          amount_invested: parseFloat(editForm.amount_invested),
          units_owned: parseFloat(editForm.units_owned),
        }),
      });
      if (!res.ok) throw new Error("Failed to update");
      setEditingId(null);
      mutate();
      showMessage("success", "Member updated");
    } catch {
      showMessage("error", "Failed to update member");
    }
    setSaving(false);
  };

  const startEdit = (m: MemberInvestment) => {
    setEditingId(m.id);
    setEditForm({
      member_name: m.member_name,
      member_email: m.member_email,
      amount_invested: m.amount_invested.toString(),
      units_owned: m.units_owned.toString(),
    });
    setShowForm(false);
  };

  const members = data?.members || [];
  const navPerUnit = navData?.nav || 0;

  // Group by memberstack_id to calculate totals
  const memberGroups = new Map<
    string,
    { name: string; email: string; totalInvested: number; totalUnits: number; investments: MemberInvestment[] }
  >();
  members.forEach((m) => {
    const existing = memberGroups.get(m.memberstack_id);
    if (existing) {
      existing.totalInvested += m.amount_invested;
      existing.totalUnits += m.units_owned;
      existing.investments.push(m);
    } else {
      memberGroups.set(m.memberstack_id, {
        name: m.member_name,
        email: m.member_email,
        totalInvested: m.amount_invested,
        totalUnits: m.units_owned,
        investments: [m],
      });
    }
  });

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
            Manage Members
          </h1>
          <p className="mt-1 text-sm text-muted">
            Add investments and manage member accounts.
            {navPerUnit > 0 && (
              <span className="ml-2 text-gold">
                Current NAV: {formatCurrency(navPerUnit)}/unit
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => {
            setShowForm(!showForm);
            setEditingId(null);
            setForm(emptyForm);
          }}
          className="flex items-center gap-2 rounded-lg bg-gold px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-gold-light"
        >
          <Plus className="h-4 w-4" />
          Add Investment
        </button>
      </div>

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

      {/* Add Form */}
      {showForm && (
        <div className="glass-card p-6">
          <h3 className="mb-4 text-lg font-medium text-foreground">
            Add Member Investment
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-muted">
                Memberstack ID
              </label>
              <input
                type="text"
                placeholder="mem_abc123..."
                value={form.memberstack_id}
                onChange={(e) =>
                  setForm({ ...form, memberstack_id: e.target.value })
                }
                className="w-full rounded-lg border border-input-border bg-input-bg px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-gold focus:outline-none"
              />
              <p className="mt-1 text-xs text-muted">
                Find this in your Memberstack dashboard
              </p>
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
              <label className="mb-1 block text-xs text-muted">Email</label>
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
            <div>
              <label className="mb-1 block text-xs text-muted">
                Investment Amount ($)
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="5000.00"
                value={form.amount_invested}
                onChange={(e) =>
                  setForm({ ...form, amount_invested: e.target.value })
                }
                className="w-full rounded-lg border border-input-border bg-input-bg px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-gold focus:outline-none"
              />
              {form.amount_invested && navPerUnit > 0 && (
                <p className="mt-1 text-xs text-gold">
                  = {formatNumber(parseFloat(form.amount_invested) / navPerUnit, 4)} units
                </p>
              )}
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              onClick={handleAdd}
              disabled={saving || !form.memberstack_id || !form.amount_invested}
              className="flex items-center gap-2 rounded-lg bg-gold px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-gold-light disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Add Investment
            </button>
            <button
              onClick={() => {
                setShowForm(false);
                setForm(emptyForm);
              }}
              className="rounded-lg border border-card-border px-4 py-2 text-sm text-muted hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Members Table */}
      <div className="glass-card overflow-hidden">
        <div className="border-b border-card-border px-6 py-4">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-gold" />
            <h2 className="text-lg font-semibold text-foreground">
              Members ({memberGroups.size})
            </h2>
          </div>
        </div>
        {members.length === 0 ? (
          <div className="p-8 text-center text-muted">
            No members yet. Click &quot;Add Investment&quot; to register the first member.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-card-border text-left text-xs uppercase tracking-wider text-muted">
                  <th className="px-6 py-3 font-medium">Member</th>
                  <th className="px-4 py-3 font-medium text-right">
                    Invested
                  </th>
                  <th className="px-4 py-3 font-medium text-right">Units</th>
                  <th className="px-4 py-3 font-medium text-right">
                    Current Value
                  </th>
                  <th className="px-4 py-3 font-medium text-right">
                    Gain/Loss
                  </th>
                  <th className="px-4 py-3 font-medium text-right">Date</th>
                  <th className="px-4 py-3 font-medium text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => {
                  const currentValue = m.units_owned * navPerUnit;
                  const gainLoss = currentValue - m.amount_invested;
                  const isPositive = gainLoss >= 0;
                  const isEditing = editingId === m.id;

                  return (
                    <tr
                      key={m.id}
                      className="border-b border-card-border/50 transition-colors hover:bg-card-glass"
                    >
                      <td className="px-6 py-3">
                        {isEditing ? (
                          <div className="space-y-1">
                            <input
                              type="text"
                              value={editForm.member_name}
                              onChange={(e) =>
                                setEditForm({
                                  ...editForm,
                                  member_name: e.target.value,
                                })
                              }
                              className="w-full rounded border border-input-border bg-input-bg px-2 py-1 text-sm text-foreground focus:border-gold focus:outline-none"
                            />
                            <input
                              type="email"
                              value={editForm.member_email}
                              onChange={(e) =>
                                setEditForm({
                                  ...editForm,
                                  member_email: e.target.value,
                                })
                              }
                              className="w-full rounded border border-input-border bg-input-bg px-2 py-1 text-xs text-muted focus:border-gold focus:outline-none"
                            />
                          </div>
                        ) : (
                          <div>
                            <p className="font-medium text-foreground">
                              {m.member_name}
                            </p>
                            <p className="text-xs text-muted">
                              {m.member_email}
                            </p>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isEditing ? (
                          <input
                            type="number"
                            step="0.01"
                            value={editForm.amount_invested}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                amount_invested: e.target.value,
                              })
                            }
                            className="w-28 rounded border border-input-border bg-input-bg px-2 py-1 text-right text-sm text-foreground focus:border-gold focus:outline-none"
                          />
                        ) : (
                          <span className="text-sm text-foreground">
                            {formatCurrency(m.amount_invested)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isEditing ? (
                          <input
                            type="number"
                            step="0.0001"
                            value={editForm.units_owned}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                units_owned: e.target.value,
                              })
                            }
                            className="w-28 rounded border border-input-border bg-input-bg px-2 py-1 text-right text-sm text-foreground focus:border-gold focus:outline-none"
                          />
                        ) : (
                          <span className="text-sm text-muted">
                            {formatNumber(m.units_owned, 4)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-foreground">
                        {formatCurrency(currentValue)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`text-sm font-medium ${
                            isPositive ? "text-gain" : "text-loss"
                          }`}
                        >
                          {formatCurrency(gainLoss)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-muted">
                        {new Date(m.investment_date).toLocaleDateString(
                          "en-US",
                          { month: "short", day: "numeric", year: "numeric" }
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isEditing ? (
                          <div className="flex justify-end gap-1">
                            <button
                              onClick={() => handleUpdate(m.id)}
                              disabled={saving}
                              className="rounded p-1.5 text-gain hover:bg-gain/10"
                            >
                              {saving ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Check className="h-4 w-4" />
                              )}
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="rounded p-1.5 text-muted hover:bg-card-glass"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEdit(m)}
                            className="rounded p-1.5 text-muted hover:bg-card-glass hover:text-gold"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
