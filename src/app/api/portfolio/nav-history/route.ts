import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { requireAuth, isAuthError } from "@/lib/auth";

/**
 * Returns daily NAV history from Supabase.
 * Query params:
 *   ?days=30  — last N days (default 90)
 *   ?from=2025-05-01&to=2025-12-31  — date range
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (isAuthError(auth)) return auth;
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const days = parseInt(searchParams.get("days") || "90", 10);

    const supabase = createServerClient();

    let query = supabase
      .from("nav_history")
      .select("*")
      .order("snapshot_date", { ascending: true });

    if (from && to) {
      query = query.gte("snapshot_date", from).lte("snapshot_date", to);
    } else {
      // Last N days
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      query = query.gte(
        "snapshot_date",
        startDate.toISOString().split("T")[0]
      );
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      history: data || [],
      count: data?.length || 0,
    });
  } catch (err) {
    console.error("NAV history error:", err);
    return NextResponse.json(
      { error: "Failed to fetch NAV history" },
      { status: 500 }
    );
  }
}
