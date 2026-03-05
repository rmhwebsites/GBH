import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { requireAdmin, isAuthError } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (isAuthError(auth)) return auth;

  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("portfolio_holdings")
      .select("*")
      .order("ticker");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ holdings: data });
  } catch (err) {
    console.error("Error fetching holdings:", err);
    return NextResponse.json(
      { error: "Failed to fetch holdings" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (isAuthError(auth)) return auth;

  try {
    const body = await request.json();
    const supabase = createServerClient();

    const { data, error } = await supabase
      .from("portfolio_holdings")
      .insert({
        ticker: body.ticker.toUpperCase(),
        company_name: body.company_name,
        shares: body.shares,
        avg_cost_basis: body.avg_cost_basis,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ holding: data }, { status: 201 });
  } catch (err) {
    console.error("Error creating holding:", err);
    return NextResponse.json(
      { error: "Failed to create holding" },
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

    const { data, error } = await supabase
      .from("portfolio_holdings")
      .update({
        ticker: body.ticker?.toUpperCase(),
        company_name: body.company_name,
        shares: body.shares,
        avg_cost_basis: body.avg_cost_basis,
        is_active: body.is_active,
      })
      .eq("id", body.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ holding: data });
  } catch (err) {
    console.error("Error updating holding:", err);
    return NextResponse.json(
      { error: "Failed to update holding" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (isAuthError(auth)) return auth;

  try {
    const { id } = await request.json();
    const supabase = createServerClient();

    const { error } = await supabase
      .from("portfolio_holdings")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error deleting holding:", err);
    return NextResponse.json(
      { error: "Failed to delete holding" },
      { status: 500 }
    );
  }
}
