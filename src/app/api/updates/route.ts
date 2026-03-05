import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { requireAuth, isAuthError } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (isAuthError(auth)) return auth;

  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("fund_updates")
      .select("*")
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ updates: data || [] });
  } catch (err) {
    console.error("Error fetching updates:", err);
    return NextResponse.json(
      { error: "Failed to fetch updates" },
      { status: 500 }
    );
  }
}
