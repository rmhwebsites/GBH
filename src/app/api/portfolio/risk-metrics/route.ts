import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { requireAuth, isAuthError } from "@/lib/auth";
import { calculateRiskMetrics } from "@/lib/risk";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (isAuthError(auth)) return auth;

  try {
    const supabase = createServerClient();

    const { data, error } = await supabase
      .from("nav_history")
      .select("*")
      .order("snapshot_date", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const snapshots = data || [];

    if (snapshots.length < 20) {
      return NextResponse.json({
        metrics: null,
        message: `Need at least 20 NAV snapshots for risk calculations (have ${snapshots.length})`,
      });
    }

    const metrics = calculateRiskMetrics(snapshots, 0.05);

    return NextResponse.json({ metrics });
  } catch (err) {
    console.error("Risk metrics error:", err);
    return NextResponse.json(
      { error: "Failed to calculate risk metrics" },
      { status: 500 }
    );
  }
}
