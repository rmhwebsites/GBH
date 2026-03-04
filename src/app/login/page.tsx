"use client";

import { useMemberstackModal, useAuth } from "@memberstack/react";
import { useEffect, useState, useRef } from "react";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  const { isLoggedIn, status } = useAuth();
  const { openModal } = useMemberstackModal();
  const [authReady, setAuthReady] = useState(false);
  const redirectedRef = useRef(false);

  useEffect(() => {
    if (status === "LOADING") return;

    // If logged in, mark ready immediately
    if (isLoggedIn) {
      setAuthReady(true);
      return;
    }

    // Give Memberstack time to restore session before showing login UI
    const timer = setTimeout(() => {
      setAuthReady(true);
    }, 800);

    return () => clearTimeout(timer);
  }, [status, isLoggedIn]);

  // If already logged in, redirect to dashboard (in useEffect, not render)
  useEffect(() => {
    if (authReady && isLoggedIn && !redirectedRef.current) {
      redirectedRef.current = true;
      window.location.href = "/dashboard";
    }
  }, [authReady, isLoggedIn]);

  const handleSignIn = () => {
    openModal({ type: "LOGIN" })
      .then(({ data }) => {
        if (data?.id) {
          window.location.href = "/dashboard";
        }
      })
      .catch(() => {
        // User closed the modal - do nothing
      });
  };

  // Still loading
  if (!authReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  // Logged in - show redirecting state
  if (isLoggedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-accent" />
          <p className="text-muted">Redirecting to dashboard...</p>
        </div>
      </div>
    );
  }

  // Not logged in - show login UI
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-2">
          <div className="text-5xl font-bold text-accent">GBH</div>
          <h1 className="text-2xl font-semibold text-foreground">
            Investment Dashboard
          </h1>
          <p className="text-sm text-muted">
            Sign in to view your portfolio
          </p>
        </div>
        <button
          onClick={handleSignIn}
          className="rounded-lg bg-accent px-8 py-3 font-medium text-white transition-colors hover:bg-accent-hover"
        >
          Sign In
        </button>
      </div>
    </div>
  );
}
