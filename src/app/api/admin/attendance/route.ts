import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { requireAdmin, isAuthError } from "@/lib/auth";
import type { MeetingAttendee } from "@/types/database";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (isAuthError(auth)) return auth;

  try {
    const supabase = createServerClient();

    const { data: meetings, error: meetingsError } = await supabase
      .from("meetings")
      .select("*")
      .order("meeting_date", { ascending: false });

    if (meetingsError) {
      return NextResponse.json(
        { error: meetingsError.message },
        { status: 500 }
      );
    }

    const { data: attendance, error: attendanceError } = await supabase
      .from("meeting_attendance")
      .select("meeting_id, memberstack_id, member_name")
      .order("member_name");

    if (attendanceError) {
      return NextResponse.json(
        { error: attendanceError.message },
        { status: 500 }
      );
    }

    const attendanceByMeeting = new Map<string, MeetingAttendee[]>();
    for (const row of attendance || []) {
      const list = attendanceByMeeting.get(row.meeting_id) || [];
      list.push({
        memberstack_id: row.memberstack_id,
        member_name: row.member_name,
      });
      attendanceByMeeting.set(row.meeting_id, list);
    }

    return NextResponse.json({
      meetings: (meetings || []).map((m) => ({
        ...m,
        attendees: attendanceByMeeting.get(m.id) || [],
      })),
    });
  } catch (err) {
    console.error("Error fetching attendance:", err);
    return NextResponse.json(
      { error: "Failed to fetch attendance" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (isAuthError(auth)) return auth;

  try {
    const body = await request.json();
    const { meeting_date, title, notes, attendeeIds } = body as {
      meeting_date?: string;
      title?: string;
      notes?: string;
      attendeeIds?: string[];
    };

    if (!meeting_date) {
      return NextResponse.json(
        { error: "Meeting date is required" },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    const { data: meeting, error: meetingError } = await supabase
      .from("meetings")
      .insert({
        meeting_date,
        title: title || null,
        notes: notes || null,
      })
      .select()
      .single();

    if (meetingError) {
      return NextResponse.json(
        { error: meetingError.message },
        { status: 500 }
      );
    }

    const ids = Array.isArray(attendeeIds) ? attendeeIds : [];
    if (ids.length > 0) {
      // Resolve names server-side from member records
      const { data: members } = await supabase
        .from("member_investments")
        .select("memberstack_id, member_name")
        .in("memberstack_id", ids);

      const nameMap = new Map<string, string>();
      for (const m of members || []) {
        if (!nameMap.has(m.memberstack_id)) {
          nameMap.set(m.memberstack_id, m.member_name);
        }
      }

      const rows = ids
        .filter((id) => nameMap.has(id))
        .map((id) => ({
          meeting_id: meeting.id,
          memberstack_id: id,
          member_name: nameMap.get(id)!,
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

    return NextResponse.json({ success: true, meeting });
  } catch (err) {
    console.error("Error creating meeting:", err);
    return NextResponse.json(
      { error: "Failed to create meeting" },
      { status: 500 }
    );
  }
}
