"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  TrendingUp,
  Wallet,
  History,
  Settings,
  LogOut,
  Shield,
  Menu,
  X,
  BarChart3,
  DollarSign,
} from "lucide-react";
import { useAuth } from "@memberstack/react";
import { useState } from "react";

const memberLinks = [
  { href: "/dashboard", label: "Portfolio", icon: LayoutDashboard },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/dashboard/my-investment", label: "My Investment", icon: Wallet },
  { href: "/dashboard/history", label: "Trade History", icon: History },
];

const adminLinks = [
  { href: "/admin", label: "Admin", icon: Shield },
  { href: "/admin/holdings", label: "Holdings", icon: TrendingUp },
  { href: "/admin/trades", label: "Record Trade", icon: History },
  { href: "/admin/members", label: "Members", icon: Settings },
  { href: "/admin/investments", label: "Investments", icon: DollarSign },
];

export function Sidebar({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  const { signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-50 rounded-lg bg-card p-2 text-muted lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 flex h-full w-64 flex-col border-r border-card-border bg-sidebar transition-transform lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between border-b border-card-border px-4 py-4">
          <Link href="/dashboard" className="flex items-center">
            <img src="/logo.avif" alt="GBH Capital" className="h-10" />
          </Link>
          <button
            onClick={() => setMobileOpen(false)}
            className="text-muted lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <div className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted">
            Dashboard
          </div>
          {memberLinks.map((link) => {
            const Icon = link.icon;
            const isActive =
              pathname === link.href ||
              (link.href !== "/dashboard" && pathname.startsWith(link.href));
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={`mb-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-accent/10 text-accent"
                    : "text-muted hover:bg-card hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {link.label}
              </Link>
            );
          })}

          {isAdmin && (
            <>
              <div className="mb-2 mt-6 px-3 text-xs font-semibold uppercase tracking-wider text-muted">
                Admin
              </div>
              {adminLinks.map((link) => {
                const Icon = link.icon;
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className={`mb-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-accent/10 text-accent"
                        : "text-muted hover:bg-card hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {link.label}
                  </Link>
                );
              })}
            </>
          )}
        </nav>

        {/* Logout */}
        <div className="border-t border-card-border px-3 py-4">
          <button
            onClick={() => signOut().then(() => window.location.href = "/login")}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-card hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}
