"use client";

import { useState, useCallback } from "react";
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
  Database,
  Shield,
  CheckCircle,
  AlertTriangle,
  XCircle,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import { formatCurrency } from "@/lib/calculations";
import type { PortfolioSummary, TradeRecord, FundUpdate } from "@/types/database";
import type { MemberInvestment } from "@/types/database";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface BackupStatus {
  lastSnapshot: {
    date: string;
    navPerUnit: number;
    totalValue: number;
    totalUnits: number;
    createdAt: string;
  } | null;
  navSnapshotCount: number;
  daysSinceLastSnapshot: number | null;
  freshness: "fresh" | "stale" | "warning" | "none";
  config: {
    googleSheets: boolean;
    cronSecret: boolean;
    fullyConfigured: boolean;
  };
}

interface BackupResult {
  success?: boolean;
  timestamp?: string;
  nav?: { navPerUnit: number; totalValue: number };
  records?: {
    investments: number;
    holdings: number;
    trades: number;
    fundUpdates: number;
    votes: number;
  };
  sheetsBackedUp?: boolean;
  sheetsError?: string | null;
  error?: string;
}

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
  const {
    data: backupStatus,
    mutate: refreshBackupStatus,
  } = useSWR<BackupStatus>("/api/admin/backup/status", fetcher);

  const [backupRunning, setBackupRunning] = useState(false);
  const [backupResult, setBackupResult] = useState<BackupResult | null>(null);

  const runBackup = useCallback(async () => {
    setBackupRunning(true);
    setBackupResult(null);
    try {
      const res = await fetch("/api/admin/backup");
      const data = await res.json();
      setBackupResult(data);
      // Refresh backup status after running
      refreshBackupStatus();
    } catch {
      setBackupResult({ error: "Network error — backup may not have completed" });
    } finally {
      setBackupRunning(false);
    }
  }, [refreshBackupStatus]);

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

      {/* Data Backup & Security */}
      <div className="glass-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-card-border px-5 py-3">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-gold" />
            <h3 className="text-sm font-semibold text-foreground">
              Data Backup & Security
            </h3>
          </div>
          <button
            onClick={runBackup}
            disabled={backupRunning}
            className="flex items-center gap-1.5 rounded-lg bg-gold/10 px-3 py-1.5 text-xs font-medium text-gold transition-colors hover:bg-gold/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {backupRunning ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                Running Backup…
              </>
            ) : (
              <>
                <RefreshCw className="h-3 w-3" />
                Run Backup Now
              </>
            )}
          </button>
        </div>

        <div className="p-5">
          {/* Config warning banner */}
          {backupStatus && !backupStatus.config.fullyConfigured && (
            <div className="mb-4 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                <div className="text-xs text-amber-200/80">
                  <p className="font-medium text-amber-300">
                    Backup not fully configured
                  </p>
                  <div className="mt-1.5 space-y-1">
                    {!backupStatus.config.googleSheets && (
                      <p>
                        <span className="font-mono text-amber-400">
                          GOOGLE_SERVICE_ACCOUNT_EMAIL
                        </span>
                        ,{" "}
                        <span className="font-mono text-amber-400">
                          GOOGLE_PRIVATE_KEY
                        </span>
                        , and{" "}
                        <span className="font-mono text-amber-400">
                          GOOGLE_SHEET_ID
                        </span>{" "}
                        are not set. Google Sheets backup is disabled.
                      </p>
                    )}
                    {!backupStatus.config.cronSecret && (
                      <p>
                        <span className="font-mono text-amber-400">
                          CRON_SECRET
                        </span>{" "}
                        is not set. Automated cron backups won&apos;t authenticate.
                      </p>
                    )}
                  </div>
                  <details className="mt-2">
                    <summary className="cursor-pointer font-medium text-amber-300 hover:text-amber-200">
                      Setup Instructions
                    </summary>
                    <div className="mt-2 space-y-2 text-xs leading-relaxed">
                      <p className="font-medium text-foreground">
                        Google Sheets Setup:
                      </p>
                      <ol className="list-decimal space-y-1 pl-4">
                        <li>
                          Go to{" "}
                          <a
                            href="https://console.cloud.google.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gold underline"
                          >
                            Google Cloud Console
                            <ExternalLink className="mb-0.5 ml-0.5 inline h-2.5 w-2.5" />
                          </a>{" "}
                          → Create project → Enable Google Sheets API
                        </li>
                        <li>
                          Create a Service Account → Download JSON key file
                        </li>
                        <li>
                          Create a Google Sheet → Share with the service account email
                          (Editor access)
                        </li>
                        <li>
                          Copy the Sheet ID from the URL (between /d/ and /edit)
                        </li>
                      </ol>
                      <p className="font-medium text-foreground">
                        Add to Vercel Environment Variables:
                      </p>
                      <div className="rounded bg-background/50 p-2 font-mono text-[10px] leading-relaxed">
                        <p>GOOGLE_SERVICE_ACCOUNT_EMAIL=...@...iam.gserviceaccount.com</p>
                        <p>GOOGLE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...</p>
                        <p>GOOGLE_SHEET_ID=1abc...</p>
                        <p>CRON_SECRET=(run: openssl rand -hex 32)</p>
                      </div>
                    </div>
                  </details>
                </div>
              </div>
            </div>
          )}

          {/* Status grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {/* NAV Snapshot Status */}
            <div className="flex items-start gap-3">
              <div className="mt-0.5">
                {backupStatus?.freshness === "fresh" ? (
                  <CheckCircle className="h-5 w-5 text-gain" />
                ) : backupStatus?.freshness === "warning" ? (
                  <AlertTriangle className="h-5 w-5 text-amber-400" />
                ) : backupStatus?.freshness === "stale" ? (
                  <XCircle className="h-5 w-5 text-loss" />
                ) : (
                  <Database className="h-5 w-5 text-muted" />
                )}
              </div>
              <div>
                <p className="text-xs text-muted">Last NAV Snapshot</p>
                <p className="text-sm font-medium text-foreground">
                  {backupStatus?.lastSnapshot
                    ? new Date(
                        backupStatus.lastSnapshot.date + "T12:00:00"
                      ).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        timeZone: "UTC",
                      })
                    : "No snapshots yet"}
                </p>
                {backupStatus?.daysSinceLastSnapshot !== null &&
                  backupStatus?.daysSinceLastSnapshot !== undefined && (
                    <p
                      className={`text-[10px] ${
                        backupStatus.freshness === "fresh"
                          ? "text-gain"
                          : backupStatus.freshness === "warning"
                          ? "text-amber-400"
                          : "text-loss"
                      }`}
                    >
                      {backupStatus.daysSinceLastSnapshot === 0
                        ? "Updated today"
                        : `${backupStatus.daysSinceLastSnapshot} day${backupStatus.daysSinceLastSnapshot > 1 ? "s" : ""} ago`}
                    </p>
                  )}
              </div>
            </div>

            {/* Google Sheets */}
            <div className="flex items-start gap-3">
              <div className="mt-0.5">
                {backupStatus?.config.googleSheets ? (
                  <CheckCircle className="h-5 w-5 text-gain" />
                ) : (
                  <XCircle className="h-5 w-5 text-loss" />
                )}
              </div>
              <div>
                <p className="text-xs text-muted">Google Sheets</p>
                <p className="text-sm font-medium text-foreground">
                  {backupStatus?.config.googleSheets
                    ? "Connected"
                    : "Not configured"}
                </p>
                <p className="text-[10px] text-muted">
                  {backupStatus?.config.googleSheets
                    ? "8 sheets synced"
                    : "Credentials needed"}
                </p>
              </div>
            </div>

            {/* History Count */}
            <div className="flex items-start gap-3">
              <div className="mt-0.5">
                <Database className="h-5 w-5 text-gold" />
              </div>
              <div>
                <p className="text-xs text-muted">NAV History</p>
                <p className="text-sm font-medium text-foreground">
                  {backupStatus?.navSnapshotCount || 0} snapshots
                </p>
                <p className="text-[10px] text-muted">
                  {backupStatus?.lastSnapshot
                    ? `NAV: $${backupStatus.lastSnapshot.navPerUnit.toFixed(2)}`
                    : "Run backup to start"}
                </p>
              </div>
            </div>
          </div>

          {/* Backup result */}
          {backupResult && (
            <div
              className={`mt-4 rounded-lg border p-3 ${
                backupResult.success
                  ? "border-gain/20 bg-gain/5"
                  : "border-loss/20 bg-loss/5"
              }`}
            >
              {backupResult.success ? (
                <div className="text-xs text-gain/90">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle className="h-3.5 w-3.5" />
                    <span className="font-medium">
                      Backup completed at {backupResult.timestamp}
                    </span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 pl-5 text-[10px] text-muted">
                    <span>
                      NAV: ${backupResult.nav?.navPerUnit.toFixed(4)}
                    </span>
                    <span>
                      AUM: ${backupResult.nav?.totalValue.toLocaleString()}
                    </span>
                    <span>
                      Records: {backupResult.records?.investments} investments,{" "}
                      {backupResult.records?.holdings} holdings,{" "}
                      {backupResult.records?.trades} trades
                    </span>
                    {backupResult.sheetsBackedUp ? (
                      <span className="text-gain">Sheets: Synced</span>
                    ) : (
                      <span className="text-amber-400">
                        Sheets: {backupResult.sheetsError || "Skipped"}
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-xs text-loss/90">
                  <XCircle className="h-3.5 w-3.5" />
                  <span>
                    Backup failed: {backupResult.error || "Unknown error"}
                  </span>
                </div>
              )}
            </div>
          )}
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
