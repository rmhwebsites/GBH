"use client";

import useSWR from "swr";
import { useState } from "react";
import {
  Loader2,
  Check,
  X,
  Pin,
  PinOff,
  Pencil,
  Trash2,
  Plus,
} from "lucide-react";
import type { FundUpdate } from "@/types/database";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function AdminUpdatesPage() {
  const {
    data,
    isLoading,
    mutate,
  } = useSWR<{ updates: FundUpdate[] }>("/api/admin/updates", fetcher);

  const [form, setForm] = useState({
    title: "",
    content: "",
    category: "announcement" as "trade" | "announcement" | "report",
    is_pinned: false,
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    title: "",
    content: "",
    category: "announcement" as "trade" | "announcement" | "report",
    is_pinned: false,
  });

  const showMessage = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.content) return;

    setSaving(true);
    try {
      const res = await fetch("/api/admin/updates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Failed to create update");

      showMessage("success", `Update "${form.title}" published`);
      setForm({ title: "", content: "", category: "announcement", is_pinned: false });
      mutate();
    } catch {
      showMessage("error", "Failed to create update");
    }
    setSaving(false);
  };

  const handleEdit = (update: FundUpdate) => {
    setEditingId(update.id);
    setEditForm({
      title: update.title,
      content: update.content,
      category: update.category,
      is_pinned: update.is_pinned,
    });
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;

    try {
      const res = await fetch(`/api/admin/updates/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      if (!res.ok) throw new Error("Failed to update");

      showMessage("success", "Update saved");
      setEditingId(null);
      mutate();
    } catch {
      showMessage("error", "Failed to save changes");
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`Delete "${title}"?`)) return;

    try {
      const res = await fetch(`/api/admin/updates/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");

      showMessage("success", "Update deleted");
      mutate();
    } catch {
      showMessage("error", "Failed to delete update");
    }
  };

  const handleTogglePin = async (update: FundUpdate) => {
    try {
      const res = await fetch(`/api/admin/updates/${update.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_pinned: !update.is_pinned }),
      });
      if (!res.ok) throw new Error("Failed to toggle pin");
      mutate();
    } catch {
      showMessage("error", "Failed to toggle pin");
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
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          Manage Updates
        </h1>
        <p className="mt-1 text-sm text-muted">
          Post announcements visible to all fund members.
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

      {/* Create Form */}
      <form onSubmit={handleCreate} className="glass-card p-6">
        <h2 className="mb-4 text-lg font-semibold text-foreground">
          New Update
        </h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs text-muted">Title</label>
            <input
              type="text"
              placeholder="Update title..."
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full rounded-lg border border-input-border bg-input-bg px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-gold focus:outline-none"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs text-muted">Content</label>
            <textarea
              placeholder="Write your update..."
              rows={4}
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              className="w-full rounded-lg border border-input-border bg-input-bg px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-gold focus:outline-none resize-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-muted">Category</label>
            <select
              value={form.category}
              onChange={(e) =>
                setForm({
                  ...form,
                  category: e.target.value as typeof form.category,
                })
              }
              className="w-full rounded-lg border border-input-border bg-input-bg px-3 py-2 text-sm text-foreground focus:border-gold focus:outline-none"
            >
              <option value="announcement">Announcement</option>
              <option value="trade">Trade</option>
              <option value="report">Report</option>
            </select>
          </div>

          <div className="flex items-end">
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-input-border bg-input-bg px-3 py-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={form.is_pinned}
                onChange={(e) =>
                  setForm({ ...form, is_pinned: e.target.checked })
                }
                className="accent-gold"
              />
              <Pin className="h-3.5 w-3.5 text-muted" />
              Pin to top
            </label>
          </div>
        </div>

        <div className="mt-6">
          <button
            type="submit"
            disabled={saving || !form.title || !form.content}
            className="flex items-center gap-2 rounded-lg bg-accent px-6 py-2.5 text-sm font-medium text-black transition-colors hover:bg-accent-hover disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Publish Update
          </button>
        </div>
      </form>

      {/* Updates List */}
      <div className="glass-card overflow-hidden">
        <div className="border-b border-card-border px-6 py-4">
          <h2 className="text-lg font-semibold text-foreground">
            All Updates ({data?.updates?.length || 0})
          </h2>
        </div>

        {(data?.updates?.length || 0) === 0 ? (
          <div className="p-8 text-center text-muted">
            No updates published yet.
          </div>
        ) : (
          <div className="divide-y divide-card-border">
            {data?.updates?.map((update) => (
              <div key={update.id} className="px-6 py-4">
                {editingId === update.id ? (
                  /* Inline Edit Mode */
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={editForm.title}
                      onChange={(e) =>
                        setEditForm({ ...editForm, title: e.target.value })
                      }
                      className="w-full rounded-lg border border-input-border bg-input-bg px-3 py-2 text-sm text-foreground focus:border-gold focus:outline-none"
                    />
                    <textarea
                      rows={3}
                      value={editForm.content}
                      onChange={(e) =>
                        setEditForm({ ...editForm, content: e.target.value })
                      }
                      className="w-full rounded-lg border border-input-border bg-input-bg px-3 py-2 text-sm text-foreground focus:border-gold focus:outline-none resize-none"
                    />
                    <div className="flex items-center gap-3">
                      <select
                        value={editForm.category}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            category: e.target.value as typeof editForm.category,
                          })
                        }
                        className="rounded-lg border border-input-border bg-input-bg px-3 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none"
                      >
                        <option value="announcement">Announcement</option>
                        <option value="trade">Trade</option>
                        <option value="report">Report</option>
                      </select>
                      <button
                        onClick={handleSaveEdit}
                        className="rounded p-1.5 text-gain hover:bg-gain/10"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="rounded p-1.5 text-muted hover:bg-card-glass"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Display Mode */
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        {update.is_pinned && (
                          <Pin className="h-3 w-3 text-gold" />
                        )}
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                            update.category === "trade"
                              ? "bg-gain/10 text-gain"
                              : update.category === "report"
                                ? "bg-[#5CA0CE]/10 text-[#5CA0CE]"
                                : "bg-gold/10 text-gold"
                          }`}
                        >
                          {update.category}
                        </span>
                        <span className="text-xs text-muted">
                          {new Date(update.created_at).toLocaleDateString(
                            "en-US",
                            {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            }
                          )}
                        </span>
                      </div>
                      <h3 className="text-sm font-semibold text-foreground">
                        {update.title}
                      </h3>
                      <p className="mt-1 text-xs text-muted line-clamp-2">
                        {update.content}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleTogglePin(update)}
                        className="rounded p-1.5 text-muted hover:bg-card-glass hover:text-gold"
                        title={update.is_pinned ? "Unpin" : "Pin"}
                      >
                        {update.is_pinned ? (
                          <PinOff className="h-3.5 w-3.5" />
                        ) : (
                          <Pin className="h-3.5 w-3.5" />
                        )}
                      </button>
                      <button
                        onClick={() => handleEdit(update)}
                        className="rounded p-1.5 text-muted hover:bg-card-glass hover:text-foreground"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(update.id, update.title)}
                        className="rounded p-1.5 text-muted hover:bg-loss/10 hover:text-loss"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
