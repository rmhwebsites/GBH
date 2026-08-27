import { NextRequest, NextResponse } from "next/server";
import { createServerClient, withSchemaRetry } from "@/lib/supabase";
import { requireAuth, isAuthError } from "@/lib/auth";
import type { InvestmentWindow } from "@/types/database";

export interface WindowStatusResponse {
  window: (InvestmentWindow & { is_open: boolean; is_upcoming: boolean }) | null;
  submissions: unknown[];
}

/**
 * Member view: the most relevant active window (open first, then upcoming,
 * then the most recently closed) plus this member's submissions for it.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (isAuthError(auth)) return auth;

  try {
    const supabase = createServerClient();

    const { data: windows, error } = await withSchemaRetry((c) =>
      c
        .from("investment_windows")
        .select("*")
        .eq("is_active", true)
        .order("opens_at", { ascending: false })
    );

    if (error) {
      // Table may not exist yet (migration not run) — degrade gracefully
      return NextResponse.json({ window: null, submissions: [] });
    }

    const now = new Date();
    const all = (windows || []) as InvestmentWindow[];

    const open = all.find(
      (w) => new Date(w.opens_at) <= now && now < new Date(w.closes_at)
    );
    const upcoming = [...all]
      .filter((w) => new Date(w.opens_at) > now)
      .sort(
        (a, b) => new Date(a.opens_at).getTime() - new Date(b.opens_at).getTime()
      )[0];
    const recent = all.find((w) => new Date(w.closes_at) <= now);

    const current = open || upcoming || recent || null;

    if (!current) {
      return NextResponse.json({ window: null, submissions: [] });
    }

    const { data: submissions } = await supabase
      .from("investment_submissions")
      .select(
        "id, window_id, amount, status, failure_reason, created_at, updated_at"
      )
      .eq("window_id", current.id)
      .eq("memberstack_id", auth.memberId)
      .order("created_at", { ascending: false });

    return NextResponse.json({
      window: {
        ...current,
        is_open: current === open,
        is_upcoming: current === upcoming && !open,
      },
      submissions: submissions || [],
    });
  } catch (err) {
    console.error("Error fetching investment window:", err);
    return NextResponse.json({ window: null, submissions: [] });
  }
}
