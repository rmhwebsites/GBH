"use client";

import { AuthGuard } from "@/components/auth/AuthGuard";
import { Sidebar } from "@/components/ui/Sidebar";
import { useAuth } from "@memberstack/react";
import { isAdmin } from "@/lib/memberstack";
import { ShieldAlert } from "lucide-react";

function AdminContent({ children }: { children: React.ReactNode }) {
  const { userId } = useAuth();
  const memberId = userId || "";
  const admin = isAdmin(memberId);

  if (!admin) {
    return (
      <div className="min-h-screen bg-background">
        <Sidebar isAdmin={false} />
        <main className="lg:pl-64">
          <div className="flex min-h-[80vh] items-center justify-center px-4">
            <div className="flex flex-col items-center gap-4 text-center">
              <ShieldAlert className="h-12 w-12 text-loss" />
              <h1 className="text-xl font-semibold text-foreground">
                Access Denied
              </h1>
              <p className="text-sm text-muted">
                You don&apos;t have admin privileges. Contact your fund
                administrator.
              </p>
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
