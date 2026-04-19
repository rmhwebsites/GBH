import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import {
  requireAdmin,
  isAuthError,
  isBootstrapAdmin,
  invalidateAdminCache,
} from "@/lib/auth";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (isAuthError(auth)) return auth;

  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("admin_members")
      .select("memberstack_id, added_at, added_by");
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ admins: data || [] });
  } catch (err) {
    console.error("Error fetching admin members:", err);
    return NextResponse.json(
      { error: "Failed to fetch admin members" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (isAuthError(auth)) return auth;

  try {
    const body = await request.json();
    const memberstackId = (body.memberstack_id || "").trim();
    if (!memberstackId) {
      return NextResponse.json(
        { error: "memberstack_id is required" },
        { status: 400 }
      );
    }

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("admin_members")
      .upsert(
        {
          memberstack_id: memberstackId,
          added_by: auth.memberId,
        },
        { onConflict: "memberstack_id" }
      )
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    invalidateAdminCache();
    return NextResponse.json({ admin: data }, { status: 201 });
  } catch (err) {
    console.error("Error adding admin member:", err);
    return NextResponse.json(
      { error: "Failed to add admin member" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (isAuthError(auth)) return auth;

  try {
    const body = await request.json();
    const memberstackId = (body.memberstack_id || "").trim();
    if (!memberstackId) {
      return NextResponse.json(
        { error: "memberstack_id is required" },
        { status: 400 }
      );
    }

    if (isBootstrapAdmin(memberstackId)) {
      return NextResponse.json(
        {
          error:
            "This admin is configured via NEXT_PUBLIC_ADMIN_MEMBER_IDS and cannot be removed from the UI.",
        },
        { status: 400 }
      );
    }

    if (memberstackId === auth.memberId) {
      return NextResponse.json(
        { error: "You cannot remove your own admin access." },
        { status: 400 }
      );
    }

    const supabase = createServerClient();
    const { error } = await supabase
      .from("admin_members")
      .delete()
      .eq("memberstack_id", memberstackId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    invalidateAdminCache();
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error removing admin member:", err);
    return NextResponse.json(
      { error: "Failed to remove admin member" },
      { status: 500 }
    );
  }
}
