"use client";

import { useEffect, useState, useCallback } from "react";
import useSWR from "swr";

const STORAGE_KEY = "gbh-updates-last-viewed";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useUnreadUpdates() {
  const [hasUnread, setHasUnread] = useState(false);

  const { data } = useSWR<{ latestAt: string | null }>(
    "/api/updates/latest",
    fetcher,
    { refreshInterval: 5 * 60 * 1000 } // Check every 5 minutes
  );

  useEffect(() => {
    if (!data?.latestAt) {
      setHasUnread(false);
      return;
    }

    const lastViewed = localStorage.getItem(STORAGE_KEY);
    if (!lastViewed) {
      // Never viewed — unread
      setHasUnread(true);
      return;
    }

    const latestTime = new Date(data.latestAt).getTime();
    const viewedTime = parseInt(lastViewed, 10);

    setHasUnread(latestTime > viewedTime);
  }, [data]);

  const markAsRead = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
    setHasUnread(false);
  }, []);

  return { hasUnread, markAsRead };
}
