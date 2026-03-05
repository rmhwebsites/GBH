import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { requireAuth, isAuthError } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (isAuthError(auth)) return auth;

  try {
    const supabase = createServerClient();

    // Get current voting session
    const { data: config } = await supabase
      .from("voting_config")
      .select("voting_session_id")
      .limit(1)
      .single();

    const sessionId = config?.voting_session_id || null;

    // Get voter's existing votes for the CURRENT session only
    let query = supabase
      .from("votes")
      .select("*")
      .eq("voter_memberstack_id", auth.memberId)
      .order("created_at");

    if (sessionId) {
      query = query.eq("voting_session_id", sessionId);
    } else {
      // No session — no votes for current session
      return NextResponse.json({
        hasVoted: false,
        votes: [],
      });
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      hasVoted: (data || []).length > 0,
      votes: data || [],
    });
  } catch (err) {
    console.error("Error fetching votes:", err);
    return NextResponse.json(
      { error: "Failed to fetch votes" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (isAuthError(auth)) return auth;

  try {
    const body = await request.json();
    const { candidateIds, voterName } = body as {
      candidateIds: string[];
      voterName: string;
    };

    if (!candidateIds || !Array.isArray(candidateIds) || candidateIds.length === 0) {
      return NextResponse.json(
        { error: "Must select at least one candidate" },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // 1. Check voting is active
    const { data: config } = await supabase
      .from("voting_config")
      .select("*")
      .limit(1)
      .single();

    if (!config || !config.is_active) {
      return NextResponse.json(
        { error: "Voting is not currently active" },
        { status: 403 }
      );
    }

    // Check date window
    const now = new Date();
    const startsAt = config.starts_at ? new Date(config.starts_at) : null;
    const expiresAt = config.expires_at ? new Date(config.expires_at) : null;

    if (startsAt && now < startsAt) {
      return NextResponse.json(
        { error: "Voting has not started yet" },
        { status: 403 }
      );
    }
    if (expiresAt && now >= expiresAt) {
      return NextResponse.json(
        { error: "Voting has expired" },
        { status: 403 }
      );
    }

    const sessionId = config.voting_session_id;
    if (!sessionId) {
      return NextResponse.json(
        { error: "No active voting session" },
        { status: 403 }
      );
    }

    // 2. Check max votes
    if (candidateIds.length > config.max_votes_per_member) {
      return NextResponse.json(
        {
          error: `Maximum ${config.max_votes_per_member} votes allowed`,
        },
        { status: 400 }
      );
    }

    // 3. Check voter hasn't already voted in this session
    const { data: existingVotes } = await supabase
      .from("votes")
      .select("id")
      .eq("voter_memberstack_id", auth.memberId)
      .eq("voting_session_id", sessionId)
      .limit(1);

    if (existingVotes && existingVotes.length > 0) {
      return NextResponse.json(
        { error: "You have already voted. Votes cannot be changed." },
        { status: 409 }
      );
    }

    // 4. Validate all candidates exist
    const { data: validCandidates } = await supabase
      .from("member_investments")
      .select("memberstack_id, member_name")
      .in("memberstack_id", candidateIds);

    // Build name lookup from valid candidates
    const candidateNameMap = new Map<string, string>();
    for (const c of validCandidates || []) {
      if (!candidateNameMap.has(c.memberstack_id)) {
        candidateNameMap.set(c.memberstack_id, c.member_name);
      }
    }

    const validIds = new Set(candidateNameMap.keys());
    const invalidIds = candidateIds.filter((id) => !validIds.has(id));

    if (invalidIds.length > 0) {
      return NextResponse.json(
        { error: "Some selected candidates are not valid members" },
        { status: 400 }
      );
    }

    // 5. Insert all votes with session ID
    const voteRecords = candidateIds.map((candidateId) => ({
      voter_memberstack_id: auth.memberId,
      voter_name: voterName || "Unknown",
      candidate_memberstack_id: candidateId,
      candidate_name: candidateNameMap.get(candidateId) || "Unknown",
      voting_session_id: sessionId,
    }));

    const { error: insertError } = await supabase
      .from("votes")
      .insert(voteRecords);

    if (insertError) {
      // Unique constraint violation = already voted for this candidate
      if (insertError.code === "23505") {
        return NextResponse.json(
          { error: "You have already voted. Votes cannot be changed." },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, votesCount: candidateIds.length });
  } catch (err) {
    console.error("Error submitting votes:", err);
    return NextResponse.json(
      { error: "Failed to submit votes" },
      { status: 500 }
    );
  }
}
