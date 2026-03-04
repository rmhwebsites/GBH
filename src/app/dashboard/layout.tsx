"use client";

import { AuthGuard } from "@/components/auth/AuthGuard";
import { Sidebar } from "@/components/ui/Sidebar";
import { useAuth } from "@memberstack/react";
import { isAdmin } from "@/lib/memberstack";

function DashboardContent({ children }: { children: React.ReactNode }) {
  const { userId } = useAuth();
  const memberId = userId || "";
  const admin = isAdmin(memberId);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar isAdmin={admin} />
      <main className="lg:pl-64">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <DashboardContent>{children}</DashboardContent>
    </AuthGuard>
  );
}
