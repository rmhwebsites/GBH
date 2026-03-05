"use client";

import useSWR from "swr";
import { Loader2, Pin, Bell, TrendingUp, FileText, Megaphone } from "lucide-react";
import type { FundUpdate } from "@/types/database";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function timeAgo(dateStr: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / 1000
  );
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const categoryConfig: Record<
  string,
  { label: string; class: string; icon: typeof Bell }
> = {
  trade: { label: "Trade", class: "bg-gain/10 text-gain", icon: TrendingUp },
  announcement: {
    label: "Announcement",
    class: "bg-gold/10 text-gold",
    icon: Megaphone,
  },
  report: {
    label: "Report",
    class: "bg-[#5CA0CE]/10 text-[#5CA0CE]",
    icon: FileText,
  },
};

export default function UpdatesPage() {
  const { data, isLoading } = useSWR<{ updates: FundUpdate[] }>(
    "/api/updates",
    fetcher,
    { refreshInterval: 5 * 60 * 1000 }
  );

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
      </div>
    );
  }

  const updates = data?.updates || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Fund Updates</h1>
        <p className="mt-1 text-sm text-muted">
          News and announcements from GBH Capital
        </p>
      </div>

      {updates.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <Bell className="mx-auto h-12 w-12 text-muted" />
          <p className="mt-4 text-lg text-muted">No updates yet</p>
          <p className="mt-2 text-sm text-muted">
            Check back soon for news and announcements.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {updates.map((update) => {
            const cat = categoryConfig[update.category] || categoryConfig.announcement;
            const CatIcon = cat.icon;

            return (
              <div key={update.id} className="glass-card p-5 sm:p-6">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  {update.is_pinned && (
                    <span className="flex items-center gap-1 rounded-full bg-gold/10 px-2.5 py-0.5 text-xs font-medium text-gold">
                      <Pin className="h-3 w-3" />
                      Pinned
                    </span>
                  )}
                  <span
                    className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${cat.class}`}
                  >
                    <CatIcon className="h-3 w-3" />
                    {cat.label}
                  </span>
                  <span className="text-xs text-muted">
                    {timeAgo(update.created_at)}
                  </span>
                </div>

                <h2 className="text-base font-semibold text-foreground sm:text-lg">
                  {update.title}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted whitespace-pre-wrap">
                  {update.content}
                </p>

                <div className="mt-4 text-xs text-muted">
                  — {update.author_name}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
