"use client";

import useSWR from "swr";

interface AuthMe {
  memberId: string | null;
  isAdmin: boolean;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

/**
 * Server-authoritative admin check. Checks both the env-based bootstrap list
 * and the admin_members Supabase table.
 */
export function useIsAdmin() {
  const { data, isLoading } = useSWR<AuthMe>("/api/auth/me", fetcher, {
    revalidateOnFocus: true,
  });

  return {
    isAdmin: data?.isAdmin ?? false,
    memberId: data?.memberId ?? null,
    isLoading,
  };
}
