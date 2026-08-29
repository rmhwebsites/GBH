import { NextRequest, NextResponse } from "next/server";
import { withSchemaRetry } from "@/lib/supabase";
import { requireAuth, isAuthError } from "@/lib/auth";
import type { InvestmentWindow } from "@/types/database";
import { isFailureResolved } from "@/lib/investments";

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
    const { data: windows, error } = await withSchemaRetry((c) =>
      c
        .from("investment_windows")
        .select("*")
        .order("opens_at", { ascending: false })
    );

    if (error) {
      // Table may not exist yet (migration not run) — degrade gracefully
      return NextResponse.json({ window: null, submissions: [] });
    }

    const now = new Date();
    const all = (windows || []) as InvestmentWindow[];

    const active = all.filter((w) => w.is_active);
    const open = active.find(
      (w) => new Date(w.opens_at) <= now && now < new Date(w.closes_at)
    );
    const upcoming = [...active]
      .filter((w) => new Date(w.opens_at) > now)
      .sort(
        (a, b) => new Date(a.opens_at).getTime() - new Date(b.opens_at).getTime()
      )[0];
    const recent = active.find((w) => new Date(w.closes_at) <= now);

    const current = open || upcoming || recent || null;

    if (!current) {
      return NextResponse.json({ window: null, submissions: [] });
    }

    // The member's full contribution history, across every window, so the
    // page can show one coherent record rather than per-window fragments
    const { data: submissions } = await withSchemaRetry((c) =>
      c
        .from("investment_submissions")
        .select("*")
        .eq("memberstack_id", auth.memberId)
        .order("created_at", { ascending: false })
    );

    const windowTitles = new Map(all.map((w) => [w.id, w.title]));

    return NextResponse.json({
      window: {
        ...current,
        is_open: current === open,
        is_upcoming: current === upcoming && !open,
      },
      submissions: (submissions || []).map((s) => ({
        ...s,
        window_title: windowTitles.get(s.window_id) || null,
        is_resolved: isFailureResolved(s, submissions || []),
      })),
    });
  } catch (err) {
    console.error("Error fetching investment window:", err);
    return NextResponse.json({ window: null, submissions: [] });
  }
}
