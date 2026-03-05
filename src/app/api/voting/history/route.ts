import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { requireAuth, isAuthError } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (isAuthError(auth)) return auth;

  try {
    const supabase = createServerClient();

    // Get current session ID to exclude it (current session shown separately)
    const { data: config } = await supabase
      .from("voting_config")
      .select("voting_session_id, is_active")
      .limit(1)
      .single();

    const currentSessionId = config?.voting_session_id || null;

    // Get ALL votes (we'll group by session)
    const { data: allVotes, error } = await supabase
      .from("votes")
      .select("candidate_memberstack_id, candidate_name, voter_memberstack_id, voting_session_id, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Group votes by session
    const sessionMap = new Map<
      string,
      {
        votes: typeof allVotes;
        earliestDate: string;
        latestDate: string;
      }
    >();

    for (const vote of allVotes || []) {
      const sid = vote.voting_session_id || "legacy";

      // Skip current active session — that's shown by /api/voting/results
      if (sid === currentSessionId && config?.is_active) continue;

      const existing = sessionMap.get(sid);
      if (existing) {
        existing.votes.push(vote);
        if (vote.created_at < existing.earliestDate) {
          existing.earliestDate = vote.created_at;
        }
        if (vote.created_at > existing.latestDate) {
          existing.latestDate = vote.created_at;
        }
      } else {
        sessionMap.set(sid, {
          votes: [vote],
          earliestDate: vote.created_at,
          latestDate: vote.created_at,
        });
      }
    }

    // Build session summaries
    const sessions = Array.from(sessionMap.entries())
      .map(([sessionId, data]) => {
        // Tally per candidate
        const tallyMap = new Map<string, { name: string; count: number }>();
        const voterSet = new Set<string>();

        for (const v of data.votes) {
          voterSet.add(v.voter_memberstack_id);
          const existing = tallyMap.get(v.candidate_memberstack_id);
          if (existing) {
            existing.count++;
          } else {
            tallyMap.set(v.candidate_memberstack_id, {
              name: v.candidate_name,
              count: 1,
            });
          }
        }

        const results = Array.from(tallyMap.entries())
          .map(([id, d]) => ({
            candidate_memberstack_id: id,
            candidate_name: d.name,
            vote_count: d.count,
          }))
          .sort((a, b) => b.vote_count - a.vote_count);

        return {
          session_id: sessionId,
          date: data.earliestDate,
          end_date: data.latestDate,
          total_voters: voterSet.size,
          total_votes: data.votes.length,
          results,
        };
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return NextResponse.json({ sessions });
  } catch (err) {
    console.error("Error fetching voting history:", err);
    return NextResponse.json(
      { error: "Failed to fetch voting history" },
      { status: 500 }
    );
  }
}
