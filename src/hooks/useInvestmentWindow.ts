"use client";

import useSWR from "swr";
import type { InvestmentWindow } from "@/types/database";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface WindowStatusResponse {
  window: (InvestmentWindow & { is_open: boolean; is_upcoming: boolean }) | null;
}

export function useInvestmentWindow() {
  const { data, isLoading } = useSWR<WindowStatusResponse>(
    "/api/investment-window",
    fetcher,
    { refreshInterval: 60 * 1000 }
  );

  return {
    isOpen: data?.window?.is_open ?? false,
    isUpcoming: data?.window?.is_upcoming ?? false,
    window: data?.window ?? null,
    isLoading,
  };
}
