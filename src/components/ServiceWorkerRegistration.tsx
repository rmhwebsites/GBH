"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    // Register service worker after page load for best performance
    window.addEventListener("load", registerSW);

    return () => {
      window.removeEventListener("load", registerSW);
    };
  }, []);

  return null;
}

async function registerSW() {
  try {
    const registration = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
    });

    // Check for updates periodically (every 60 minutes)
    setInterval(() => {
      registration.update();
    }, 60 * 60 * 1000);

    // Handle updates: when a new SW is waiting, activate it
    registration.addEventListener("updatefound", () => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      newWorker.addEventListener("statechange", () => {
        if (
          newWorker.state === "installed" &&
          navigator.serviceWorker.controller
        ) {
          // New version available — it will activate on next page load
          console.log("[GBH] New version available. Refresh to update.");
        }
      });
    });
  } catch (err) {
    console.error("[GBH] Service worker registration failed:", err);
  }
}
