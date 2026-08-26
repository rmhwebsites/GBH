-- Decision (Confirm/Reject) voting support
-- Run in the Supabase SQL editor (like the other migration files).

-- 1. Voting mode on the config:
--    'candidate' = elect members (existing behavior)
--    'decision'  = confirm/reject a proposal
ALTER TABLE voting_config
  ADD COLUMN IF NOT EXISTS vote_type VARCHAR(20) NOT NULL DEFAULT 'candidate'
  CHECK (vote_type IN ('candidate', 'decision'));

-- 2. Per-session metadata so voting history remembers what each session asked.
--    Decision votes store their choices in the existing `votes` table using
--    sentinel candidate IDs ('decision_confirm' / 'decision_reject').
CREATE TABLE IF NOT EXISTS voting_sessions (
  session_id UUID PRIMARY KEY,
  vote_type VARCHAR(20) NOT NULL DEFAULT 'candidate'
    CHECK (vote_type IN ('candidate', 'decision')),
  title VARCHAR(255) NOT NULL DEFAULT '',
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- All access goes through API routes using the service role key (which
-- bypasses RLS), so no policies are needed — anon-key access stays blocked.
ALTER TABLE voting_sessions ENABLE ROW LEVEL SECURITY;
