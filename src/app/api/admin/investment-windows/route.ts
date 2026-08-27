import { NextRequest, NextResponse } from "next/server";
import { createServerClient, withSchemaRetry } from "@/lib/supabase";
import { requireAdmin, isAuthError } from "@/lib/auth";
import type { InvestmentSubmission } from "@/types/database";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (isAuthError(auth)) return auth;

  try {
    const { data: windows, error: windowError } = await withSchemaRetry((c) =>
      c.from("investment_windows").select("*").order("opens_at", { ascending: false })
    );

    if (windowError) {
      return NextResponse.json({ error: windowError.message }, { status: 500 });
    }

    const supabase = createServerClient();
    const { data: submissions, error: subError } = await supabase
      .from("investment_submissions")
      .select("*")
      .order("created_at", { ascending: false });

    if (subError) {
      return NextResponse.json({ error: subError.message }, { status: 500 });
    }

    const byWindow = new Map<string, InvestmentSubmission[]>();
    for (const sub of (submissions || []) as InvestmentSubmission[]) {
      const list = byWindow.get(sub.window_id) || [];
      list.push(sub);
      byWindow.set(sub.window_id, list);
    }

    return NextResponse.json({
      windows: (windows || []).map((w) => ({
        ...w,
        submissions: byWindow.get(w.id) || [],
      })),
    });
  } catch (err) {
    console.error("Error fetching investment windows:", err);
    return NextResponse.json(
      { error: "Failed to fetch investment windows" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (isAuthError(auth)) return auth;

  try {
    const body = await request.json();
    const { title, description, opens_at, closes_at, min_amount, max_amount } =
      body;

    if (!opens_at || !closes_at) {
      return NextResponse.json(
        { error: "Open and close dates are required" },
        { status: 400 }
      );
    }
    if (new Date(opens_at) >= new Date(closes_at)) {
      return NextResponse.json(
        { error: "Open date must be before close date" },
        { status: 400 }
      );
    }

    const { data, error } = await withSchemaRetry((c) =>
      c
        .from("investment_windows")
        .insert({
          title: title || "Investment Window",
          description: description || null,
          opens_at,
          closes_at,
          min_amount: Number(min_amount) > 0 ? Number(min_amount) : 100,
          max_amount: Number(max_amount) > 0 ? Number(max_amount) : null,
        })
        .select()
        .single()
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ window: data }, { status: 201 });
  } catch (err) {
    console.error("Error creating investment window:", err);
    return NextResponse.json(
      { error: "Failed to create investment window" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (isAuthError(auth)) return auth;

  try {
    const body = await request.json();
    const { id } = body;
    if (!id) {
      return NextResponse.json({ error: "Missing window id" }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (body.title !== undefined) updateData.title = body.title;
    if (body.description !== undefined)
      updateData.description = body.description || null;
    if (body.opens_at !== undefined) updateData.opens_at = body.opens_at;
    if (body.closes_at !== undefined) updateData.closes_at = body.closes_at;
    if (body.min_amount !== undefined)
      updateData.min_amount = Number(body.min_amount) > 0 ? Number(body.min_amount) : 100;
    if (body.max_amount !== undefined)
      updateData.max_amount =
        Number(body.max_amount) > 0 ? Number(body.max_amount) : null;
    if (typeof body.is_active === "boolean")
      updateData.is_active = body.is_active;

    if (
      updateData.opens_at &&
      updateData.closes_at &&
      new Date(updateData.opens_at as string) >=
        new Date(updateData.closes_at as string)
    ) {
      return NextResponse.json(
        { error: "Open date must be before close date" },
        { status: 400 }
      );
    }

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("investment_windows")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ window: data });
  } catch (err) {
    console.error("Error updating investment window:", err);
    return NextResponse.json(
      { error: "Failed to update investment window" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (isAuthError(auth)) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Missing window id" }, { status: 400 });
    }

    const supabase = createServerClient();

    // Refuse to delete a window that has money attached to it
    const { data: moneySubs } = await supabase
      .from("investment_submissions")
      .select("id")
      .eq("window_id", id)
      .in("status", ["processing", "paid", "processed"])
      .limit(1);

    if (moneySubs && moneySubs.length > 0) {
      return NextResponse.json(
        {
          error:
            "This window has payments attached. Deactivate it instead of deleting.",
        },
        { status: 409 }
      );
    }

    const { error } = await supabase
      .from("investment_windows")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error deleting investment window:", err);
    return NextResponse.json(
      { error: "Failed to delete investment window" },
      { status: 500 }
    );
  }
}
