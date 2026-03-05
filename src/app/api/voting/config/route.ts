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
        is_visible: false,
        title: "Investment Team Vote",
        description: null,
        max_votes_per_member: 5,
        starts_at: null,
        expires_at: null,
      });
    }

    // Compute effective visibility: is_active + within date window
    const now = new Date();
    const startsAt = data.starts_at ? new Date(data.starts_at) : null;
    const expiresAt = data.expires_at ? new Date(data.expires_at) : null;

    const withinWindow =
      (!startsAt || now >= startsAt) && (!expiresAt || now < expiresAt);

    return NextResponse.json({
      ...data,
      is_visible: data.is_active && withinWindow,
    });
  } catch {
    return NextResponse.json({
      is_active: false,
      is_visible: false,
      title: "Investment Team Vote",
      description: null,
      max_votes_per_member: 5,
      starts_at: null,
      expires_at: null,
    });
  }
}
