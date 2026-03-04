"use client";

import useSWR from "swr";
import { useState } from "react";
import { Loader2, Check, X, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/calculations";
import type { PortfolioHolding, TradeRecord } from "@/types/database";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function AdminTradesPage() {
  const { data: holdingsData } = useSWR<{ holdings: PortfolioHolding[] }>(
    "/api/admin/holdings",
    fetcher
  );
  const {
    data: tradesData,
    isLoading,
    mutate,
  } = useSWR<{ trades: TradeRecord[] }>("/api/admin/trades", fetcher);

  const [form, setForm] = useState({
    action: "BUY" as "BUY" | "SELL",
    ticker: "",
    company_name: "",
    shares: "",
    price_per_share: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const activeHoldings = holdingsData?.holdings?.filter((h) => h.is_active) || [];

  const showMessage = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.ticker || !form.shares || !form.price_per_share) return;

    setSaving(true);
    try {
      const res = await fetch("/api/admin/trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: form.action,
          ticker: form.ticker,
          company_name:
            form.company_name ||
            activeHoldings.find((h) => h.ticker === form.ticker)
              ?.company_name ||
            form.ticker,
          shares: parseFloat(form.shares),
          price_per_share: parseFloat(form.price_per_share),
          notes: form.notes || null,
        }),
      });
      if (!res.ok) throw new Error("Failed to record trade");

      const total = parseFloat(form.shares) * parseFloat(form.price_per_share);
      showMessage(
        "success",
        `${form.action} ${form.shares} shares of ${form.ticker} @ ${formatCurrency(parseFloat(form.price_per_share))} = ${formatCurrency(total)}`
      );
      setForm({
        action: "BUY",
        ticker: "",
        company_name: "",
        shares: "",
        price_per_share: "",
        notes: "",
      });
      mutate();
    } catch {
      showMessage("error", "Failed to record trade");
    }
    setSaving(false);
  };

  const totalValue =
    form.shares && form.price_per_share
      ? parseFloat(form.shares) * parseFloat(form.price_per_share)
      : 0;

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Record Trade</h1>
        <p className="mt-1 text-sm text-muted">
          Log a buy or sell. Holdings update automatically.
        </p>
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

      {/* Trade Form */}
      <form onSubmit={handleSubmit} className="glass-card p-6">
        {/* Action Toggle */}
        <div className="mb-6 flex gap-2">
          <button
            type="button"
            onClick={() => setForm({ ...form, action: "BUY" })}
            className={`flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-medium transition-colors ${
              form.action === "BUY"
                ? "bg-gain/20 text-gain"
                : "bg-card-glass text-muted hover:text-foreground"
            }`}
          >
            <ArrowUpRight className="h-4 w-4" />
            BUY
          </button>
          <button
            type="button"
            onClick={() => setForm({ ...form, action: "SELL" })}
            className={`flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-medium transition-colors ${
              form.action === "SELL"
                ? "bg-loss/20 text-loss"
                : "bg-card-glass text-muted hover:text-foreground"
            }`}
          >
            <ArrowDownRight className="h-4 w-4" />
            SELL
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs text-muted">
              Stock Ticker
            </label>
            {form.action === "SELL" && activeHoldings.length > 0 ? (
              <select
                value={form.ticker}
                onChange={(e) => setForm({ ...form, ticker: e.target.value })}
                className="w-full rounded-lg border border-input-border bg-input-bg px-3 py-2 text-sm text-foreground focus:border-gold focus:outline-none"
              >
                <option value="">Select stock...</option>
                {activeHoldings.map((h) => (
                  <option key={h.ticker} value={h.ticker}>
                    {h.ticker} - {h.company_name} ({formatNumber(h.shares)}{" "}
                    shares)
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                placeholder="AAPL"
                value={form.ticker}
                onChange={(e) =>
                  setForm({ ...form, ticker: e.target.value.toUpperCase() })
                }
                className="w-full rounded-lg border border-input-border bg-input-bg px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-gold focus:outline-none"
              />
            )}
          </div>
          {form.action === "BUY" && (
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
          )}
          <div>
            <label className="mb-1 block text-xs text-muted">
              Number of Shares
            </label>
            <input
              type="number"
              step="0.01"
              placeholder="50"
              value={form.shares}
              onChange={(e) => setForm({ ...form, shares: e.target.value })}
              className="w-full rounded-lg border border-input-border bg-input-bg px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-gold focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">
              Price Per Share ($)
            </label>
            <input
              type="number"
              step="0.01"
              placeholder="175.50"
              value={form.price_per_share}
              onChange={(e) =>
                setForm({ ...form, price_per_share: e.target.value })
              }
              className="w-full rounded-lg border border-input-border bg-input-bg px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-gold focus:outline-none"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs text-muted">
              Notes (optional)
            </label>
            <input
              type="text"
              placeholder="Reason for trade..."
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full rounded-lg border border-input-border bg-input-bg px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-gold focus:outline-none"
            />
          </div>
        </div>

        {/* Preview */}
        {totalValue > 0 && (
          <div className="mt-4 rounded-lg bg-card-glass p-4">
            <p className="text-sm text-muted">
              Trade Total:{" "}
              <span className="text-lg font-semibold text-foreground">
                {formatCurrency(totalValue)}
              </span>
            </p>
          </div>
        )}

        <div className="mt-6">
          <button
            type="submit"
            disabled={saving || !form.ticker || !form.shares || !form.price_per_share}
            className={`flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-medium text-black transition-colors disabled:opacity-50 ${
              form.action === "BUY"
                ? "bg-gain hover:bg-gain/80"
                : "bg-loss hover:bg-loss/80"
            }`}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : form.action === "BUY" ? (
              <ArrowUpRight className="h-4 w-4" />
            ) : (
              <ArrowDownRight className="h-4 w-4" />
            )}
            Record {form.action}
          </button>
        </div>
      </form>

      {/* Recent Trades */}
      <div className="glass-card overflow-hidden">
        <div className="border-b border-card-border px-6 py-4">
          <h2 className="text-lg font-semibold text-foreground">
            Recent Trades
          </h2>
        </div>
        {(tradesData?.trades?.length || 0) === 0 ? (
          <div className="p-8 text-center text-muted">No trades recorded yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-card-border text-left text-xs uppercase tracking-wider text-muted">
                  <th className="px-6 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Stock</th>
                  <th className="px-4 py-3 font-medium text-right">Shares</th>
                  <th className="px-4 py-3 font-medium text-right">Price</th>
                  <th className="px-4 py-3 font-medium text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {tradesData?.trades?.slice(0, 15).map((t) => (
                  <tr
                    key={t.id}
                    className="border-b border-card-border/50 text-sm"
                  >
                    <td className="px-6 py-3 text-muted">
                      {new Date(t.trade_date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs font-semibold ${
                          t.action === "BUY" ? "text-gain" : "text-loss"
                        }`}
                      >
                        {t.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">
                      {t.ticker}
                    </td>
                    <td className="px-4 py-3 text-right text-foreground">
                      {formatNumber(t.shares)}
                    </td>
                    <td className="px-4 py-3 text-right text-foreground">
                      {formatCurrency(t.price_per_share)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-foreground">
                      {formatCurrency(t.total_amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
