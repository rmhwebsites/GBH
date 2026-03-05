"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import {
  Loader2,
  Pin,
  Bell,
  TrendingUp,
  FileText,
  Megaphone,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { FundUpdate } from "@/types/database";
import { useUnreadUpdates } from "@/hooks/useUnreadUpdates";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const PREVIEW_LENGTH = 120; // characters for collapsed preview

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

function truncateContent(content: string, maxLen: number): string {
  if (content.length <= maxLen) return content;
  // Cut at last space before maxLen to avoid mid-word break
  const trimmed = content.substring(0, maxLen);
  const lastSpace = trimmed.lastIndexOf(" ");
  return (lastSpace > 0 ? trimmed.substring(0, lastSpace) : trimmed) + "...";
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

function UpdateCard({ update }: { update: FundUpdate }) {
  const [expanded, setExpanded] = useState(false);
  const cat = categoryConfig[update.category] || categoryConfig.announcement;
  const CatIcon = cat.icon;
  const isLong = update.content.length > PREVIEW_LENGTH;

  return (
    <div
      className={`glass-card p-5 sm:p-6 transition-all duration-200 ${
        isLong ? "cursor-pointer hover:border-gold/20" : ""
      }`}
      onClick={() => isLong && setExpanded(!expanded)}
    >
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

      <div className="flex items-start justify-between gap-3">
        <h2 className="text-base font-semibold text-foreground sm:text-lg">
          {update.title}
        </h2>
        {isLong && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className="mt-0.5 flex-shrink-0 text-muted hover:text-foreground transition-colors"
            aria-label={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? (
              <ChevronUp className="h-5 w-5" />
            ) : (
              <ChevronDown className="h-5 w-5" />
            )}
          </button>
        )}
      </div>

      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          expanded ? "max-h-[2000px] opacity-100" : isLong ? "max-h-20 opacity-100" : "max-h-[2000px] opacity-100"
        }`}
      >
        <p className="mt-2 text-sm leading-relaxed text-muted whitespace-pre-wrap">
          {expanded || !isLong
            ? update.content
            : truncateContent(update.content, PREVIEW_LENGTH)}
        </p>
      </div>

      {isLong && !expanded && (
        <p className="mt-2 text-xs font-medium text-gold/70">
          Tap to read more
        </p>
      )}

      <div className="mt-4 flex items-center justify-between">
        <span className="text-xs text-muted">— {update.author_name}</span>
        {expanded && (
          <span className="text-xs text-muted">
            {new Date(update.created_at).toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
              year: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </span>
        )}
      </div>
    </div>
  );
}

export default function UpdatesPage() {
  const { markAsRead } = useUnreadUpdates();
  const { data, isLoading } = useSWR<{ updates: FundUpdate[] }>(
    "/api/updates",
    fetcher,
    { refreshInterval: 5 * 60 * 1000 }
  );

  // Mark updates as read when user visits this page
  useEffect(() => {
    markAsRead();
  }, [markAsRead]);

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
          {updates.map((update) => (
            <UpdateCard key={update.id} update={update} />
          ))}
        </div>
      )}
    </div>
  );
}
