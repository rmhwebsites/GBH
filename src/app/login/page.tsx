"use client";

import { useMemberstackModal, useAuth } from "@memberstack/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  const { isLoggedIn, status } = useAuth();
  const { openModal } = useMemberstackModal();
  const router = useRouter();
  const [hasChecked, setHasChecked] = useState(false);

  const isLoading = status === "LOADING";

  useEffect(() => {
    if (!isLoading) {
      setHasChecked(true);
    }
  }, [isLoading]);

  useEffect(() => {
    if (hasChecked && isLoggedIn) {
      router.push("/dashboard");
    }
  }, [hasChecked, isLoggedIn, router]);

  useEffect(() => {
    if (hasChecked && !isLoggedIn) {
      openModal({ type: "LOGIN" }).then(({ data }) => {
        if (data?.id) {
          router.push("/dashboard");
        }
      });
    }
  }, [hasChecked, isLoggedIn, openModal, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-6">
        <h1 className="text-3xl font-bold text-foreground">GBH Investments</h1>
        {isLoading ? (
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-accent" />
            <p className="text-muted">Loading...</p>
          </div>
        ) : (
          <button
            onClick={() =>
              openModal({ type: "LOGIN" }).then(({ data }) => {
                if (data?.id) router.push("/dashboard");
              })
            }
            className="rounded-lg bg-accent px-6 py-3 font-medium text-white transition-colors hover:bg-accent-hover"
          >
            Sign In to Dashboard
          </button>
        )}
      </div>
    </div>
  );
}
