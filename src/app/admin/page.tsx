"use client";

import useSWR from "swr";
import Link from "next/link";
import {
  Loader2,
  TrendingUp,
  History,
  Users,
  ArrowRight,
  DollarSign,
  Wallet,
  Megaphone,
  Vote,
  Calendar,
  FileText,
} from "lucide-react";
import { formatCurrency } from "@/lib/calculations";
import type { PortfolioSummary, TradeRecord, FundUpdate } from "@/types/database";
import type { MemberInvestment } from "@/types/database";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function AdminDashboard() {
  const { data: portfolio, isLoading: loadingPortfolio } =
    useSWR<PortfolioSummary>("/api/portfolio", fetcher);
  const { data: membersData, isLoading: loadingMembers } = useSWR<{
    members: MemberInvestment[];
  }>("/api/admin/members", fetcher);
  const { data: tradesData } = useSWR<{ trades: TradeRecord[] }>(
    "/api/admin/trades",
    fetcher
  );
  const { data: updatesData } = useSWR<{ updates: FundUpdate[] }>(
    "/api/admin/updates",
    fetcher
  );

  const isLoading = loadingPortfolio || loadingMembers;

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
      </div>
    );
  }

  const totalMembers = new Set(
    membersData?.members?.map((m) => m.memberstack_id) || []
  ).size;
  const totalInvested =
    membersData?.members?.reduce((sum, m) => sum + m.amount_invested, 0) || 0;
  const cashBalance = portfolio?.cashBalance || 0;

  const quickLinks = [
    {
      href: "/admin/holdings",
      icon: TrendingUp,
      label: "Manage Holdings",
      desc: `${portfolio?.holdings?.length || 0} active stocks`,
    },
    {
      href: "/admin/trades",
      icon: History,
      label: "Record a Trade",
      desc: "Log a buy or sell",
    },
    {
      href: "/admin/members",
      icon: Users,
      label: "Manage Members",
      desc: `${totalMembers} active members`,
    },
    {
      href: "/admin/investments",
      icon: Wallet,
      label: "Investments",
      desc: "Track member capital",
    },
    {
      href: "/admin/updates",
      icon: Megaphone,
      label: "Fund Updates",
      desc: "Post announcements",
    },
    {
      href: "/admin/voting",
      icon: Vote,
      label: "Voting",
      desc: "Manage team voting",
    },
  ];

  // Recent trades (last 3)
  const recentTrades = (tradesData?.trades || []).slice(0, 3);
  // Recent updates (last 3)
  const recentUpdates = (updatesData?.updates || []).slice(0, 3);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          Admin Dashboard
        </h1>
        <p className="mt-1 text-sm text-muted">
          Manage portfolio, members, and fund operations
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="glass-card p-5">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-gold/10 p-2">
              <TrendingUp className="h-4 w-4 text-gold" />
            </div>
            <p className="text-sm text-muted">Total AUM</p>
          </div>
          <p className="mt-2 text-2xl font-semibold text-foreground">
            {formatCurrency(portfolio?.totalValue || 0)}
          </p>
        </div>
        <div className="glass-card p-5">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-gold/10 p-2">
              <DollarSign className="h-4 w-4 text-gold" />
            </div>
            <p className="text-sm text-muted">Total Invested</p>
          </div>
          <p className="mt-2 text-2xl font-semibold text-foreground">
            {formatCurrency(totalInvested)}
          </p>
        </div>
        <div className="glass-card p-5">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-gold/10 p-2">
              <Users className="h-4 w-4 text-gold" />
            </div>
            <p className="text-sm text-muted">Active Members</p>
          </div>
          <p className="mt-2 text-2xl font-semibold text-foreground">
            {totalMembers}
          </p>
        </div>
        <div className="glass-card p-5">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-gold/10 p-2">
              <Wallet className="h-4 w-4 text-gold" />
            </div>
            <p className="text-sm text-muted">Cash Balance</p>
          </div>
          <p className="mt-2 text-2xl font-semibold text-foreground">
            {formatCurrency(cashBalance)}
          </p>
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted">
          Quick Actions
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {quickLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className="glass-card group flex items-center justify-between p-4 transition-colors hover:border-gold/30"
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-gold/10 p-2.5">
                    <Icon className="h-4 w-4 text-gold" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {link.label}
                    </p>
                    <p className="text-xs text-muted">{link.desc}</p>
                  </div>
                </div>
                <ArrowRight className="hidden h-4 w-4 text-muted transition-colors group-hover:text-gold sm:block" />
              </Link>
            );
          })}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Recent Trades */}
        <div className="glass-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-card-border px-4 py-3 sm:px-5">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-gold" />
              <h3 className="text-sm font-semibold text-foreground">
                Recent Trades
              </h3>
            </div>
            <Link
              href="/admin/trades"
              className="text-xs font-medium text-gold hover:text-gold/80"
            >
              View All &rarr;
            </Link>
          </div>
          {recentTrades.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted">
              No trades recorded yet.
            </div>
          ) : (
            <div className="divide-y divide-card-border/50">
              {recentTrades.map((trade) => (
                <div
                  key={trade.id}
                  className="flex items-center justify-between px-4 py-3 sm:px-5"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        trade.action === "BUY"
                          ? "bg-gain/10 text-gain"
                          : "bg-loss/10 text-loss"
                      }`}
                    >
                      {trade.action}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {trade.ticker}
                      </p>
                      <p className="text-xs text-muted">
                        {trade.shares} shares @ $
                        {trade.price_per_share.toFixed(2)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted">
                    <Calendar className="h-3 w-3" />
                    {new Date(trade.trade_date).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      timeZone: "UTC",
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Updates */}
        <div className="glass-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-card-border px-4 py-3 sm:px-5">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-gold" />
              <h3 className="text-sm font-semibold text-foreground">
                Recent Updates
              </h3>
            </div>
            <Link
              href="/admin/updates"
              className="text-xs font-medium text-gold hover:text-gold/80"
            >
              View All &rarr;
            </Link>
          </div>
          {recentUpdates.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted">
              No updates posted yet.
            </div>
          ) : (
            <div className="divide-y divide-card-border/50">
              {recentUpdates.map((update) => (
                <div
                  key={update.id}
                  className="flex items-center justify-between px-4 py-3 sm:px-5"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        update.category === "trade"
                          ? "bg-blue-500/10 text-blue-400"
                          : update.category === "report"
                          ? "bg-purple-500/10 text-purple-400"
                          : "bg-gold/10 text-gold"
                      }`}
                    >
                      {update.category}
                    </span>
                    <p className="text-sm font-medium text-foreground truncate max-w-[200px]">
                      {update.title}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted">
                    <Calendar className="h-3 w-3" />
                    {new Date(update.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
