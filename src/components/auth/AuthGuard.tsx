"use client";

import { useMemberstackModal, useAuth } from "@memberstack/react";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isLoggedIn, userId, status } = useAuth();
  const { openModal } = useMemberstackModal();
  const [hasChecked, setHasChecked] = useState(false);

  const isLoading = status === "LOADING" || (!hasChecked && !isLoggedIn);

  useEffect(() => {
    if (status !== "LOADING") {
      setHasChecked(true);
    }
  }, [status]);

  useEffect(() => {
    if (hasChecked && !isLoggedIn) {
      openModal({ type: "LOGIN" });
    }
  }, [hasChecked, isLoggedIn, openModal]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
          <p className="text-muted">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
          <p className="text-muted">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
