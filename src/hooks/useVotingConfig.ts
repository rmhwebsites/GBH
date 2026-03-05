"use client";

import useSWR from "swr";
import type { VotingConfig } from "@/types/database";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useVotingConfig() {
  const { data, isLoading } = useSWR<VotingConfig>(
    "/api/voting/config",
    fetcher,
    { refreshInterval: 5 * 60 * 1000 } // Check every 5 minutes
  );

  return {
    isActive: data?.is_active ?? false,
    isLoading,
    config: data,
  };
}
