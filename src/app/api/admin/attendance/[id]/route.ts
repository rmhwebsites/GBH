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
    const { meeting_date, title, notes, attendeeIds } = body as {
      meeting_date?: string;
      title?: string | null;
      notes?: string | null;
      attendeeIds?: string[];
    };

    const supabase = createServerClient();

    const updateData: Record<string, unknown> = {};
    if (meeting_date !== undefined) updateData.meeting_date = meeting_date;
    if (title !== undefined) updateData.title = title || null;
    if (notes !== undefined) updateData.notes = notes || null;

    if (Object.keys(updateData).length > 0) {
      const { error: updateError } = await supabase
        .from("meetings")
        .update(updateData)
        .eq("id", id);

      if (updateError) {
        return NextResponse.json(
          { error: updateError.message },
          { status: 500 }
        );
      }
    }

    // Replace the attendee list when provided
    if (Array.isArray(attendeeIds)) {
      const { error: deleteError } = await supabase
        .from("meeting_attendance")
        .delete()
        .eq("meeting_id", id);

      if (deleteError) {
        return NextResponse.json(
          { error: deleteError.message },
          { status: 500 }
        );
      }

      if (attendeeIds.length > 0) {
        const { data: members } = await supabase
          .from("member_investments")
          .select("memberstack_id, member_name")
          .in("memberstack_id", attendeeIds);

        const nameMap = new Map<string, string>();
        for (const m of members || []) {
          if (!nameMap.has(m.memberstack_id)) {
            nameMap.set(m.memberstack_id, m.member_name);
          }
        }

        const rows = attendeeIds
          .filter((mid) => nameMap.has(mid))
          .map((mid) => ({
            meeting_id: id,
            memberstack_id: mid,
            member_name: nameMap.get(mid)!,
          }));

        if (rows.length > 0) {
          const { error: insertError } = await supabase
            .from("meeting_attendance")
            .insert(rows);

          if (insertError) {
            return NextResponse.json(
              { error: insertError.message },
              { status: 500 }
            );
          }
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error updating meeting:", err);
    return NextResponse.json(
      { error: "Failed to update meeting" },
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

    // Attendance rows cascade with the meeting
    const { error } = await supabase.from("meetings").delete().eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error deleting meeting:", err);
    return NextResponse.json(
      { error: "Failed to delete meeting" },
      { status: 500 }
    );
  }
}
