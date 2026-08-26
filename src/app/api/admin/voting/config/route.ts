import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { requireAdmin, isAuthError } from "@/lib/auth";
import { randomUUID } from "crypto";

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

    // Get existing config (include is_active to detect toggle-on)
    const { data: existing } = await supabase
      .from("voting_config")
      .select("id, is_active, voting_session_id, vote_type")
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

    if (body.vote_type === "candidate" || body.vote_type === "decision") {
      updateData.vote_type = body.vote_type;
    }

    const willBeActive =
      typeof body.is_active === "boolean" ? body.is_active : existing.is_active;

    if (typeof body.is_active === "boolean") {
      updateData.is_active = body.is_active;

      // When voting is turned ON and was previously OFF,
      // generate a new session ID so old votes don't carry over
      if (body.is_active && !existing.is_active) {
        updateData.voting_session_id = randomUUID();
      }
    }

    // Changing the vote type while voting is live also starts a new session —
    // candidate votes and confirm/reject votes must never share a tally
    if (
      willBeActive &&
      existing.is_active &&
      updateData.vote_type &&
      updateData.vote_type !== (existing.vote_type || "candidate")
    ) {
      updateData.voting_session_id = randomUUID();
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

    // Record session metadata so history remembers what this session asked.
    // Best-effort: ignore failures (e.g. migration not yet run).
    if (data.voting_session_id) {
      await supabase.from("voting_sessions").upsert({
        session_id: data.voting_session_id,
        vote_type: data.vote_type || "candidate",
        title: data.title || "",
        description: data.description,
      });
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
