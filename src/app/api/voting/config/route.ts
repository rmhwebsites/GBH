import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { requireAuth, isAuthError } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (isAuthError(auth)) return auth;

  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("voting_config")
      .select("*")
      .limit(1)
      .single();

    if (error) {
      return NextResponse.json({
        is_active: false,
        title: "Investment Team Vote",
        description: null,
        max_votes_per_member: 5,
      });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({
      is_active: false,
      title: "Investment Team Vote",
      description: null,
      max_votes_per_member: 5,
    });
  }
}
