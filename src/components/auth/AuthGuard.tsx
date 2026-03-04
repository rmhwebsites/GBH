"use client";

import { useAuth } from "@memberstack/react";
import { useEffect, useState, useRef } from "react";
import { Loader2 } from "lucide-react";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isLoggedIn, status } = useAuth();
  const [authState, setAuthState] = useState<
    "loading" | "authenticated" | "unauthenticated"
  >("loading");
  const redirectedRef = useRef(false);

  useEffect(() => {
    // Still loading - keep waiting
    if (status === "LOADING") return;

    // Logged in - immediately show content
    if (isLoggedIn) {
      setAuthState("authenticated");
      return;
    }

    // Not logged in after status resolved - give Memberstack a moment
    // to restore session from cookies before declaring unauthenticated
    const timer = setTimeout(() => {
      setAuthState((prev) => (prev === "loading" ? "unauthenticated" : prev));
    }, 800);

    return () => clearTimeout(timer);
  }, [status, isLoggedIn]);

  // Handle redirect in useEffect (never in render)
  useEffect(() => {
    if (authState === "unauthenticated" && !redirectedRef.current) {
      redirectedRef.current = true;
      window.location.href = "/login";
    }
  }, [authState]);

  if (authState === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
          <p className="text-muted">Loading...</p>
        </div>
      </div>
    );
  }

  if (authState === "unauthenticated") {
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
