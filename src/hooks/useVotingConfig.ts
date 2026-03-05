"use client";

import useSWR from "swr";
import type { VotingConfig } from "@/types/database";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface VotingConfigResponse extends VotingConfig {
  is_visible: boolean;
}

export function useVotingConfig() {
  const { data, isLoading } = useSWR<VotingConfigResponse>(
    "/api/voting/config",
    fetcher,
    { refreshInterval: 60 * 1000 } // Check every minute for schedule changes
  );

  return {
    isActive: data?.is_visible ?? false,
    isLoading,
    config: data,
  };
}
