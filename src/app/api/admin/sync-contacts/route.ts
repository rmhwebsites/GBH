import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { getResend } from "@/lib/resend";
import { requireAdmin, isAuthError } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (isAuthError(auth)) return auth;

  try {
    const resend = getResend();
    const supabase = createServerClient();

    // 1. Get all members from database (deduplicated)
    const { data: memberRows, error: dbError } = await supabase
      .from("member_investments")
      .select("memberstack_id, member_name, member_email")
      .order("member_name");

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    // Deduplicate by memberstack_id
    const seen = new Set<string>();
    const members: { id: string; name: string; email: string }[] = [];
    for (const row of memberRows || []) {
      if (!seen.has(row.memberstack_id)) {
        seen.add(row.memberstack_id);
        members.push({
          id: row.memberstack_id,
          name: row.member_name,
          email: row.member_email,
        });
      }
    }

    if (members.length === 0) {
      return NextResponse.json({ message: "No members to sync", synced: 0 });
    }

    // 2. Get or create Resend audience
    let audienceId = process.env.RESEND_AUDIENCE_ID || "";

    if (!audienceId) {
      // Create a new audience
      const { data: audience, error: audienceError } =
        await resend.audiences.create({ name: "GBH Capital Members" });

      if (audienceError) {
        return NextResponse.json(
          { error: `Failed to create audience: ${audienceError.message}` },
          { status: 500 }
        );
      }

      audienceId = audience!.id;
      console.log(
        `Created Resend audience: ${audienceId} — add RESEND_AUDIENCE_ID=${audienceId} to .env`
      );
    }

    // 3. Sync each member as a contact
    let synced = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const member of members) {
      try {
        const [firstName, ...lastParts] = member.name.split(" ");
        const lastName = lastParts.join(" ") || "";

        await resend.contacts.create({
          audienceId,
          email: member.email,
          firstName: firstName || member.name,
          lastName,
          unsubscribed: false,
        });
        synced++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        // Resend returns 409 if contact already exists — that's fine, count as synced
        if (msg.includes("already exists")) {
          skipped++;
        } else {
          errors.push(`${member.email}: ${msg}`);
        }
      }
    }

    return NextResponse.json({
      message: `Synced ${synced} contacts, ${skipped} already existed`,
      synced,
      skipped,
      total: members.length,
      audienceId,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    console.error("Error syncing contacts:", err);
    return NextResponse.json(
      { error: "Failed to sync contacts to Resend" },
      { status: 500 }
    );
  }
}
