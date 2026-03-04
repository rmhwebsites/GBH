"use client";

import { AuthGuard } from "@/components/auth/AuthGuard";
import { Sidebar } from "@/components/ui/Sidebar";
import { useAuth } from "@memberstack/react";
import { isAdmin } from "@/lib/memberstack";

function DashboardContent({ children }: { children: React.ReactNode }) {
  const { userId } = useAuth();
  const admin = userId ? isAdmin(userId) : false;

  return (
    <div className="min-h-screen bg-background">
      <Sidebar isAdmin={admin} />
      <main className="lg:pl-64">
        <div className="mx-auto max-w-7xl px-4 pt-16 pb-8 sm:px-6 lg:px-8 lg:pt-8">
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
