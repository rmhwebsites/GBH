import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { requireAdmin, isAuthError } from "@/lib/auth";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if (isAuthError(auth)) return auth;

  try {
    const { id } = await params;
    const body = await request.json();
    const { title, content, category, is_pinned, author_name } = body;

    const supabase = createServerClient();
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (title !== undefined) updateData.title = title;
    if (content !== undefined) updateData.content = content;
    if (category !== undefined) updateData.category = category;
    if (is_pinned !== undefined) updateData.is_pinned = is_pinned;
    if (author_name !== undefined) updateData.author_name = author_name;

    const { data, error } = await supabase
      .from("fund_updates")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ update: data });
  } catch (err) {
    console.error("Error updating update:", err);
    return NextResponse.json(
      { error: "Failed to update" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if (isAuthError(auth)) return auth;

  try {
    const { id } = await params;
    const supabase = createServerClient();

    const { error } = await supabase
      .from("fund_updates")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error deleting update:", err);
    return NextResponse.json(
      { error: "Failed to delete update" },
      { status: 500 }
    );
  }
}
