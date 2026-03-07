import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { requireAdmin, isAuthError } from "@/lib/auth";

/**
 * Lightweight endpoint to check backup status.
 * Returns:
 *   - Latest NAV snapshot date and data
 *   - Google Sheets configuration status
 *   - Data freshness indicator
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (isAuthError(auth)) return auth;

  try {
    const supabase = createServerClient();

    // Get the latest NAV snapshot
    const { data: latestNav } = await supabase
      .from("nav_history")
      .select("snapshot_date, nav_per_unit, total_value, total_units, created_at")
      .order("snapshot_date", { ascending: false })
      .limit(1)
      .single();

    // Get total NAV history count
    const { count: navCount } = await supabase
      .from("nav_history")
      .select("*", { count: "exact", head: true });

    // Check Google Sheets configuration
    const hasGoogleConfig = !!(
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
      process.env.GOOGLE_PRIVATE_KEY &&
      process.env.GOOGLE_SHEET_ID
    );
    const hasCronSecret = !!process.env.CRON_SECRET;

    // Calculate freshness
    const now = new Date();
    const todayEST = now.toLocaleDateString("en-CA", {
      timeZone: "America/New_York",
    });

    let daysSinceLastSnapshot: number | null = null;
    let freshness: "fresh" | "stale" | "warning" | "none" = "none";

    if (latestNav?.snapshot_date) {
      const lastDate = new Date(latestNav.snapshot_date + "T00:00:00");
      const today = new Date(todayEST + "T00:00:00");
      daysSinceLastSnapshot = Math.floor(
        (today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysSinceLastSnapshot <= 0) {
        freshness = "fresh"; // backed up today
      } else if (daysSinceLastSnapshot <= 2) {
        freshness = "warning"; // 1-2 days old (could be weekend)
      } else {
        freshness = "stale"; // 3+ days old
      }
    }

    return NextResponse.json({
      lastSnapshot: latestNav
        ? {
            date: latestNav.snapshot_date,
            navPerUnit: latestNav.nav_per_unit,
            totalValue: latestNav.total_value,
            totalUnits: latestNav.total_units,
            createdAt: latestNav.created_at,
          }
        : null,
      navSnapshotCount: navCount || 0,
      daysSinceLastSnapshot,
      freshness,
      config: {
        googleSheets: hasGoogleConfig,
        cronSecret: hasCronSecret,
        fullyConfigured: hasGoogleConfig && hasCronSecret,
      },
    });
  } catch (err) {
    console.error("Error checking backup status:", err);
    return NextResponse.json(
      { error: "Failed to check backup status" },
      { status: 500 }
    );
  }
}
