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

    if (!sessionId) {
      return NextResponse.json({
        results: [],
        totalVoters: 0,
        totalVotes: 0,
      });
    }

    // Get all votes for the current session only
    const { data: allVotes, error } = await supabase
      .from("votes")
      .select("candidate_memberstack_id, candidate_name, voter_memberstack_id")
      .eq("voting_session_id", sessionId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Tally votes per candidate
    const tallyMap = new Map<
      string,
      { candidate_name: string; vote_count: number }
    >();

    for (const vote of allVotes || []) {
      const existing = tallyMap.get(vote.candidate_memberstack_id);
      if (existing) {
        existing.vote_count++;
      } else {
        tallyMap.set(vote.candidate_memberstack_id, {
          candidate_name: vote.candidate_name,
          vote_count: 1,
        });
      }
    }

    // Sort by vote count desc
    const results = Array.from(tallyMap.entries())
      .map(([candidate_memberstack_id, data]) => ({
        candidate_memberstack_id,
        candidate_name: data.candidate_name,
        vote_count: data.vote_count,
      }))
      .sort((a, b) => b.vote_count - a.vote_count);

    // Count unique voters
    const uniqueVoters = new Set(
      (allVotes || []).map((v) => v.voter_memberstack_id)
    ).size;

    return NextResponse.json({
      results,
      totalVoters: uniqueVoters,
      totalVotes: (allVotes || []).length,
    });
  } catch (err) {
    console.error("Error fetching results:", err);
    return NextResponse.json(
      { error: "Failed to fetch results" },
      { status: 500 }
    );
  }
}
