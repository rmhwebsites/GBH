"use client";

import { AuthGuard } from "@/components/auth/AuthGuard";
import { Sidebar } from "@/components/ui/Sidebar";
import { useAuth } from "@memberstack/react";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { ShieldAlert } from "lucide-react";
import Link from "next/link";

function AdminContent({ children }: { children: React.ReactNode }) {
  const { userId, status } = useAuth();
  const { isAdmin, isLoading: adminLoading } = useIsAdmin();

  // Wait for userId and admin status to be available
  if (!userId || status === "LOADING" || adminLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <p className="text-muted">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <Sidebar isAdmin={false} />
        <main className="lg:pl-64">
          <div className="flex min-h-[80vh] items-center justify-center px-4">
            <div className="flex flex-col items-center gap-6 text-center">
              <ShieldAlert className="h-16 w-16 text-loss" />
              <div>
                <h1 className="text-xl font-semibold text-foreground">
                  Access Denied
                </h1>
                <p className="mt-2 text-sm text-muted">
                  Admin privileges required. Contact your fund manager.
                </p>
              </div>
              <Link
                href="/dashboard"
                className="rounded-lg bg-accent px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
              >
                Back to Dashboard
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar isAdmin={true} />
      <main className="lg:pl-64">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <AdminContent>{children}</AdminContent>
    </AuthGuard>
  );
}
