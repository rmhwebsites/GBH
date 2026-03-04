"use client";

import useSWR from "swr";
import Link from "next/link";
import { Loader2, TrendingUp, History, Users, ArrowRight } from "lucide-react";
import { formatCurrency } from "@/lib/calculations";
import type { PortfolioSummary } from "@/types/database";
import type { MemberInvestment } from "@/types/database";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function AdminDashboard() {
  const { data: portfolio, isLoading: loadingPortfolio } =
    useSWR<PortfolioSummary>("/api/portfolio", fetcher);
  const { data: membersData, isLoading: loadingMembers } = useSWR<{
    members: MemberInvestment[];
  }>("/api/admin/members", fetcher);

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

  const quickLinks = [
    {
      href: "/admin/holdings",
      icon: TrendingUp,
      label: "Manage Holdings",
      desc: `${portfolio?.holdings.length || 0} active stocks`,
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
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          Admin Dashboard
        </h1>
        <p className="mt-1 text-sm text-muted">
          Manage portfolio holdings, trades, and members
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="glass-card p-5">
          <p className="text-sm text-muted">Total AUM</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">
            {formatCurrency(portfolio?.totalValue || 0)}
          </p>
        </div>
        <div className="glass-card p-5">
          <p className="text-sm text-muted">Total Invested by Members</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">
            {formatCurrency(totalInvested)}
          </p>
        </div>
        <div className="glass-card p-5">
          <p className="text-sm text-muted">Active Members</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">
            {totalMembers}
          </p>
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {quickLinks.map((link) => {
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className="glass-card group flex items-center justify-between p-5 transition-colors hover:border-gold/30"
            >
              <div className="flex items-center gap-4">
                <div className="rounded-lg bg-gold/10 p-3">
                  <Icon className="h-5 w-5 text-gold" />
                </div>
                <div>
                  <p className="font-medium text-foreground">{link.label}</p>
                  <p className="text-xs text-muted">{link.desc}</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted transition-colors group-hover:text-gold" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
