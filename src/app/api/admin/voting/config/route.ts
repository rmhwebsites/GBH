import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { requireAdmin, isAuthError } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (isAuthError(auth)) return auth;

  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("voting_config")
      .select("*")
      .limit(1)
      .single();

    if (error) {
      return NextResponse.json(
        { error: "No voting config found" },
        { status: 404 }
      );
    }

    // Compute effective visibility for display
    const now = new Date();
    const startsAt = data.starts_at ? new Date(data.starts_at) : null;
    const expiresAt = data.expires_at ? new Date(data.expires_at) : null;
    const withinWindow =
      (!startsAt || now >= startsAt) && (!expiresAt || now < expiresAt);

    return NextResponse.json({
      ...data,
      is_visible: data.is_active && withinWindow,
    });
  } catch (err) {
    console.error("Error fetching voting config:", err);
    return NextResponse.json(
      { error: "Failed to fetch voting config" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (isAuthError(auth)) return auth;

  try {
    const body = await request.json();
    const supabase = createServerClient();

    // Get existing config
    const { data: existing } = await supabase
      .from("voting_config")
      .select("id")
      .limit(1)
      .single();

    if (!existing) {
      return NextResponse.json(
        { error: "No voting config found" },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (typeof body.is_active === "boolean") {
      updateData.is_active = body.is_active;
    }
    if (typeof body.title === "string") {
      updateData.title = body.title;
    }
    if (body.description !== undefined) {
      updateData.description = body.description;
    }
    if (typeof body.max_votes_per_member === "number") {
      updateData.max_votes_per_member = Math.max(
        1,
        Math.min(20, body.max_votes_per_member)
      );
    }
    if (body.starts_at !== undefined) {
      updateData.starts_at = body.starts_at || null;
    }
    if (body.expires_at !== undefined) {
      updateData.expires_at = body.expires_at || null;
    }

    const { data, error } = await supabase
      .from("voting_config")
      .update(updateData)
      .eq("id", existing.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("Error updating voting config:", err);
    return NextResponse.json(
      { error: "Failed to update voting config" },
      { status: 500 }
    );
  }
}
