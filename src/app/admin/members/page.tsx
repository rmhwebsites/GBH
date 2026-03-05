"use client";

import useSWR from "swr";
import { useState } from "react";
import Link from "next/link";
import {
  Loader2,
  Pencil,
  X,
  Check,
  Users,
  ArrowRight,
} from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/calculations";
import type { MemberInvestment } from "@/types/database";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface MemberSummary {
  memberstackId: string;
  name: string;
  email: string;
  totalInvested: number;
  totalUnits: number;
  recordCount: number;
}

export default function AdminMembersPage() {
  const { data, isLoading, mutate } = useSWR<{ members: MemberInvestment[] }>(
    "/api/admin/members",
    fetcher
  );
  const { data: navData } = useSWR<{ nav: number; totalValue: number }>(
    "/api/portfolio/nav",
    fetcher
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    member_name: "",
    member_email: "",
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

  const members = data?.members || [];
  const navPerUnit = navData?.nav || 0;

  // Aggregate all records per memberstack_id
  const memberSummaries: MemberSummary[] = [];
  const memberMap = new Map<string, MemberSummary>();

  members.forEach((m) => {
    const existing = memberMap.get(m.memberstack_id);
    if (existing) {
      existing.totalInvested += m.amount_invested;
      existing.totalUnits += m.units_owned;
      existing.recordCount += 1;
      // Use the most recent name/email
      existing.name = m.member_name;
      existing.email = m.member_email;
    } else {
      const summary: MemberSummary = {
        memberstackId: m.memberstack_id,
        name: m.member_name,
        email: m.member_email,
        totalInvested: m.amount_invested,
        totalUnits: m.units_owned,
        recordCount: 1,
      };
      memberMap.set(m.memberstack_id, summary);
      memberSummaries.push(summary);
    }
  });

  // Sort by name
  memberSummaries.sort((a, b) => a.name.localeCompare(b.name));

  const handleUpdate = async (memberstackId: string) => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/members", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberstack_id: memberstackId,
          member_name: editForm.member_name,
          member_email: editForm.member_email,
        }),
      });
      if (!res.ok) throw new Error("Failed to update");
      setEditingId(null);
      mutate();
      showMessage("success", "Member info updated across all records");
    } catch {
      showMessage("error", "Failed to update member");
    }
    setSaving(false);
  };

  const startEdit = (summary: MemberSummary) => {
    setEditingId(summary.memberstackId);
    setEditForm({
      member_name: summary.name,
      member_email: summary.email,
    });
  };

  // Fund totals
  const totalInvested = memberSummaries.reduce(
    (sum, m) => sum + m.totalInvested,
    0
  );
  const totalUnits = memberSummaries.reduce(
    (sum, m) => sum + m.totalUnits,
    0
  );
  const totalCurrentValue = totalUnits * navPerUnit;

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
            View member summaries. Edit name/email here.
            {navPerUnit > 0 && (
              <span className="ml-2 text-gold">
                Current NAV: {formatCurrency(navPerUnit)}/unit
              </span>
            )}
          </p>
        </div>
        <Link
          href="/admin/investments"
          className="flex items-center gap-2 rounded-lg bg-gold px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-gold-light"
        >
          Record Investment
          <ArrowRight className="h-4 w-4" />
        </Link>
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

      {/* Summary Bar */}
      {memberSummaries.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          <div className="glass-card px-4 py-3">
            <p className="text-[10px] uppercase tracking-wider text-muted sm:text-xs">
              Members
            </p>
            <p className="mt-0.5 text-lg font-semibold text-foreground">
              {memberSummaries.length}
            </p>
          </div>
          <div className="glass-card px-4 py-3">
            <p className="text-[10px] uppercase tracking-wider text-muted sm:text-xs">
              Total Invested
            </p>
            <p className="mt-0.5 text-lg font-semibold text-foreground">
              {formatCurrency(totalInvested)}
            </p>
          </div>
          <div className="glass-card px-4 py-3">
            <p className="text-[10px] uppercase tracking-wider text-muted sm:text-xs">
              Total Units
            </p>
            <p className="mt-0.5 text-lg font-semibold text-foreground">
              {formatNumber(totalUnits, 4)}
            </p>
          </div>
          <div className="glass-card px-4 py-3">
            <p className="text-[10px] uppercase tracking-wider text-muted sm:text-xs">
              Total Value
            </p>
            <p className="mt-0.5 text-lg font-semibold text-foreground">
              {formatCurrency(totalCurrentValue)}
            </p>
          </div>
        </div>
      )}

      {/* Members Table */}
      <div className="glass-card overflow-hidden">
        <div className="border-b border-card-border px-6 py-4">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-gold" />
            <h2 className="text-lg font-semibold text-foreground">
              Members ({memberSummaries.length})
            </h2>
          </div>
          <p className="mt-1 text-xs text-muted">
            Aggregated from {members.length} investment record
            {members.length !== 1 ? "s" : ""}. To add or modify investments, use
            the{" "}
            <Link
              href="/admin/investments"
              className="text-gold underline hover:text-gold-light"
            >
              Investments page
            </Link>
            .
          </p>
        </div>
        {memberSummaries.length === 0 ? (
          <div className="p-8 text-center text-muted">
            No members yet. Go to the{" "}
            <Link
              href="/admin/investments"
              className="text-gold underline hover:text-gold-light"
            >
              Investments page
            </Link>{" "}
            to record the first investment.
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
                  <th className="px-4 py-3 font-medium text-right">
                    Return
                  </th>
                  <th className="px-4 py-3 font-medium text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {memberSummaries.map((m) => {
                  const currentValue = m.totalUnits * navPerUnit;
                  const gainLoss = currentValue - m.totalInvested;
                  const returnPct =
                    m.totalInvested > 0
                      ? ((currentValue - m.totalInvested) / m.totalInvested) *
                        100
                      : 0;
                  const isPositive = gainLoss >= 0;
                  const isEditing = editingId === m.memberstackId;

                  return (
                    <tr
                      key={m.memberstackId}
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
                              {m.name}
                            </p>
                            <a
                              href={`mailto:${m.email}`}
                              className="text-xs text-muted hover:text-gold hover:underline"
                            >
                              {m.email}
                            </a>
                            <p className="text-[10px] text-muted/60">
                              {m.recordCount} transaction
                              {m.recordCount !== 1 ? "s" : ""}
                            </p>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-foreground">
                        {formatCurrency(m.totalInvested)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-muted">
                        {formatNumber(m.totalUnits, 4)}
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
                          {gainLoss >= 0 ? "+" : ""}
                          {formatCurrency(gainLoss)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`text-sm font-medium ${
                            isPositive ? "text-gain" : "text-loss"
                          }`}
                        >
                          {returnPct >= 0 ? "+" : ""}
                          {returnPct.toFixed(2)}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isEditing ? (
                          <div className="flex justify-end gap-1">
                            <button
                              onClick={() =>
                                handleUpdate(m.memberstackId)
                              }
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
                            title="Edit name & email"
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
