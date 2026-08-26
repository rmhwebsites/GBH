import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { requireAdmin, isAuthError } from "@/lib/auth";
import { syncTotalUnits } from "@/lib/units";
import { recordInvestment } from "@/lib/investments";

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (isAuthError(auth)) return auth;

  try {
    const body = await request.json();
    const supabase = createServerClient();

    const result = await recordInvestment(supabase, {
      memberstack_id: body.memberstack_id,
      member_name: body.member_name,
      member_email: body.member_email,
      amount: body.amount, // positive = invest, negative = withdraw
      investment_date: body.investment_date,
    });

    return NextResponse.json(
      {
        investment: result.investment,
        navPerUnit: result.navPerUnit,
        unitsGranted: result.unitsGranted,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Error recording investment:", err);
    const message =
      err instanceof Error ? err.message : "Failed to record investment";
    // Validation failures (e.g. insufficient units) carry their own message
    const status = message.startsWith("Insufficient units") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (isAuthError(auth)) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const supabase = createServerClient();

    // Get the investment record first to know how many units to remove
    const { data: investment, error: fetchError } = await supabase
      .from("member_investments")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !investment) {
      return NextResponse.json(
        { error: "Investment record not found" },
        { status: 404 }
      );
    }

    // Delete the record
    const { error: deleteError } = await supabase
      .from("member_investments")
      .delete()
      .eq("id", id);

    if (deleteError) {
      return NextResponse.json(
        { error: deleteError.message },
        { status: 500 }
      );
    }

    // Sync total units from source of truth (member_investments table)
    await syncTotalUnits(supabase);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error deleting investment:", err);
    return NextResponse.json(
      { error: "Failed to delete investment" },
      { status: 500 }
    );
  }
}
