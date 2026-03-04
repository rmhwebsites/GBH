"use client";

import useSWR from "swr";
import { useState } from "react";
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  X,
  Save,
  Check,
} from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/calculations";
import type { PortfolioHolding } from "@/types/database";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface HoldingForm {
  ticker: string;
  company_name: string;
  shares: string;
  avg_cost_basis: string;
}

const emptyForm: HoldingForm = {
  ticker: "",
  company_name: "",
  shares: "",
  avg_cost_basis: "",
};

export default function AdminHoldingsPage() {
  const { data, isLoading, mutate } = useSWR<{ holdings: PortfolioHolding[] }>(
    "/api/admin/holdings",
    fetcher
  );
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<HoldingForm>(emptyForm);
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
    setSaving(true);
    try {
      const res = await fetch("/api/admin/holdings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker: form.ticker,
          company_name: form.company_name,
          shares: parseFloat(form.shares),
          avg_cost_basis: parseFloat(form.avg_cost_basis),
        }),
      });
      if (!res.ok) throw new Error("Failed to add");
      setForm(emptyForm);
      setShowForm(false);
      mutate();
      showMessage("success", `${form.ticker.toUpperCase()} added successfully`);
    } catch {
      showMessage("error", "Failed to add holding");
    }
    setSaving(false);
  };

  const handleUpdate = async () => {
    if (!editingId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/holdings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingId,
          ticker: form.ticker,
          company_name: form.company_name,
          shares: parseFloat(form.shares),
          avg_cost_basis: parseFloat(form.avg_cost_basis),
        }),
      });
      if (!res.ok) throw new Error("Failed to update");
      setEditingId(null);
      setForm(emptyForm);
      mutate();
      showMessage("success", "Holding updated");
    } catch {
      showMessage("error", "Failed to update holding");
    }
    setSaving(false);
  };

  const handleDelete = async (id: string, ticker: string) => {
    if (!confirm(`Remove ${ticker} from portfolio?`)) return;
    try {
      await fetch("/api/admin/holdings", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      mutate();
      showMessage("success", `${ticker} removed`);
    } catch {
      showMessage("error", "Failed to delete");
    }
  };

  const startEdit = (h: PortfolioHolding) => {
    setEditingId(h.id);
    setForm({
      ticker: h.ticker,
      company_name: h.company_name,
      shares: h.shares.toString(),
      avg_cost_basis: h.avg_cost_basis.toString(),
    });
    setShowForm(false);
  };

  const holdings = data?.holdings || [];
  const activeHoldings = holdings.filter((h) => h.is_active);
  const inactiveHoldings = holdings.filter((h) => !h.is_active);

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
            Manage Holdings
          </h1>
          <p className="mt-1 text-sm text-muted">
            Add, edit, or remove portfolio positions
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
          Add Stock
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
            Add New Holding
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs text-muted">
                Ticker Symbol
              </label>
              <input
                type="text"
                placeholder="AAPL"
                value={form.ticker}
                onChange={(e) =>
                  setForm({ ...form, ticker: e.target.value.toUpperCase() })
                }
                className="w-full rounded-lg border border-input-border bg-input-bg px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-gold focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">
                Company Name
              </label>
              <input
                type="text"
                placeholder="Apple Inc."
                value={form.company_name}
                onChange={(e) =>
                  setForm({ ...form, company_name: e.target.value })
                }
                className="w-full rounded-lg border border-input-border bg-input-bg px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-gold focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Shares</label>
              <input
                type="number"
                step="0.01"
                placeholder="100"
                value={form.shares}
                onChange={(e) => setForm({ ...form, shares: e.target.value })}
                className="w-full rounded-lg border border-input-border bg-input-bg px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-gold focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">
                Avg Cost Basis ($)
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="150.00"
                value={form.avg_cost_basis}
                onChange={(e) =>
                  setForm({ ...form, avg_cost_basis: e.target.value })
                }
                className="w-full rounded-lg border border-input-border bg-input-bg px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-gold focus:outline-none"
              />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              onClick={handleAdd}
              disabled={saving || !form.ticker || !form.shares}
              className="flex items-center gap-2 rounded-lg bg-gold px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-gold-light disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Add Holding
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

      {/* Holdings Table */}
      <div className="glass-card overflow-hidden">
        <div className="border-b border-card-border px-6 py-4">
          <h2 className="text-lg font-semibold text-foreground">
            Active Holdings ({activeHoldings.length})
          </h2>
        </div>
        {activeHoldings.length === 0 ? (
          <div className="p-8 text-center text-muted">
            No holdings yet. Click &quot;Add Stock&quot; to get started.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-card-border text-left text-xs uppercase tracking-wider text-muted">
                  <th className="px-6 py-3 font-medium">Ticker</th>
                  <th className="px-4 py-3 font-medium">Company</th>
                  <th className="px-4 py-3 font-medium text-right">Shares</th>
                  <th className="px-4 py-3 font-medium text-right">
                    Avg Cost
                  </th>
                  <th className="px-4 py-3 font-medium text-right">
                    Cost Basis
                  </th>
                  <th className="px-4 py-3 font-medium text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {activeHoldings.map((h) => {
                  const isEditing = editingId === h.id;
                  return (
                    <tr
                      key={h.id}
                      className="border-b border-card-border/50 transition-colors hover:bg-card-glass"
                    >
                      <td className="px-6 py-3">
                        {isEditing ? (
                          <input
                            type="text"
                            value={form.ticker}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                ticker: e.target.value.toUpperCase(),
                              })
                            }
                            className="w-20 rounded border border-input-border bg-input-bg px-2 py-1 text-sm text-foreground focus:border-gold focus:outline-none"
                          />
                        ) : (
                          <span className="font-medium text-gold">
                            {h.ticker}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <input
                            type="text"
                            value={form.company_name}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                company_name: e.target.value,
                              })
                            }
                            className="w-full rounded border border-input-border bg-input-bg px-2 py-1 text-sm text-foreground focus:border-gold focus:outline-none"
                          />
                        ) : (
                          <span className="text-sm text-muted">
                            {h.company_name}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isEditing ? (
                          <input
                            type="number"
                            step="0.01"
                            value={form.shares}
                            onChange={(e) =>
                              setForm({ ...form, shares: e.target.value })
                            }
                            className="w-24 rounded border border-input-border bg-input-bg px-2 py-1 text-right text-sm text-foreground focus:border-gold focus:outline-none"
                          />
                        ) : (
                          <span className="text-sm text-foreground">
                            {formatNumber(h.shares)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isEditing ? (
                          <input
                            type="number"
                            step="0.01"
                            value={form.avg_cost_basis}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                avg_cost_basis: e.target.value,
                              })
                            }
                            className="w-24 rounded border border-input-border bg-input-bg px-2 py-1 text-right text-sm text-foreground focus:border-gold focus:outline-none"
                          />
                        ) : (
                          <span className="text-sm text-foreground">
                            {formatCurrency(h.avg_cost_basis)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-foreground">
                        {formatCurrency(h.shares * h.avg_cost_basis)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isEditing ? (
                          <div className="flex justify-end gap-1">
                            <button
                              onClick={handleUpdate}
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
                              onClick={() => {
                                setEditingId(null);
                                setForm(emptyForm);
                              }}
                              className="rounded p-1.5 text-muted hover:bg-card-glass"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-1">
                            <button
                              onClick={() => startEdit(h)}
                              className="rounded p-1.5 text-muted hover:bg-card-glass hover:text-gold"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(h.id, h.ticker)}
                              className="rounded p-1.5 text-muted hover:bg-loss/10 hover:text-loss"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
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

      {/* Inactive Holdings */}
      {inactiveHoldings.length > 0 && (
        <div className="glass-card overflow-hidden opacity-60">
          <div className="border-b border-card-border px-6 py-4">
            <h2 className="text-sm font-semibold text-muted">
              Inactive/Sold ({inactiveHoldings.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <tbody>
                {inactiveHoldings.map((h) => (
                  <tr
                    key={h.id}
                    className="border-b border-card-border/30 text-sm text-muted"
                  >
                    <td className="px-6 py-2">{h.ticker}</td>
                    <td className="px-4 py-2">{h.company_name}</td>
                    <td className="px-4 py-2 text-right">
                      {formatNumber(h.shares)} shares
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
