import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { requireAuth, isAuthError } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (isAuthError(auth)) return auth;

  try {
    const supabase = createServerClient();

    // Get all members from member_investments, deduplicated by memberstack_id
    const { data, error } = await supabase
      .from("member_investments")
      .select("memberstack_id, member_name")
      .order("member_name");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Deduplicate by memberstack_id (a member may have multiple investment records)
    const seen = new Set<string>();
    const candidates = (data || [])
      .filter((m) => {
        if (seen.has(m.memberstack_id)) return false;
        seen.add(m.memberstack_id);
        return true;
      })
      .map((m) => ({
        memberstack_id: m.memberstack_id,
        name: m.member_name,
      }));

    return NextResponse.json({ candidates });
  } catch (err) {
    console.error("Error fetching candidates:", err);
    return NextResponse.json(
      { error: "Failed to fetch candidates" },
      { status: 500 }
    );
  }
}
