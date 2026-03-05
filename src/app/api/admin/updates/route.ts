import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { requireAdmin, isAuthError } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (isAuthError(auth)) return auth;

  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("fund_updates")
      .select("*")
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

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (isAuthError(auth)) return auth;

  try {
    const body = await request.json();
    const { title, content, category, is_pinned, author_name } = body;

    if (!title || !content) {
      return NextResponse.json(
        { error: "Title and content are required" },
        { status: 400 }
      );
    }

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("fund_updates")
      .insert({
        title,
        content,
        category: category || "announcement",
        is_pinned: is_pinned || false,
        author_name: author_name || "GBH Capital",
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ update: data }, { status: 201 });
  } catch (err) {
    console.error("Error creating update:", err);
    return NextResponse.json(
      { error: "Failed to create update" },
      { status: 500 }
    );
  }
}
