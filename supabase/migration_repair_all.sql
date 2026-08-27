-- ============================================================================
-- REPAIR SCRIPT — run this once in the Supabase SQL editor.
--
-- Run the WHOLE file in one go (do not highlight part of it).
--
-- Safe to re-run: every statement is idempotent. It creates anything that is
-- missing, adds missing columns, and — importantly — re-applies the table
-- privileges PostgREST needs. PostgREST only exposes tables the API roles
-- hold privileges on; a table missing those grants is reported as
-- "Could not find the table 'public.X' in the schema cache" even though the
-- table exists in Postgres.
-- ============================================================================

-- ── Decision voting ─────────────────────────────────────────────────────────
ALTER TABLE voting_config
  ADD COLUMN IF NOT EXISTS vote_type VARCHAR(20) NOT NULL DEFAULT 'candidate';

DO $$
BEGIN
  ALTER TABLE voting_config
    ADD CONSTRAINT voting_config_vote_type_check
    CHECK (vote_type IN ('candidate', 'decision'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS voting_sessions (
  session_id UUID PRIMARY KEY,
  vote_type VARCHAR(20) NOT NULL DEFAULT 'candidate'
    CHECK (vote_type IN ('candidate', 'decision')),
  title VARCHAR(255) NOT NULL DEFAULT '',
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── Meeting attendance ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_date DATE NOT NULL,
  title VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS meeting_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  memberstack_id VARCHAR(255) NOT NULL,
  member_name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (meeting_id, memberstack_id)
);

CREATE INDEX IF NOT EXISTS idx_meetings_date ON meetings(meeting_date DESC);
CREATE INDEX IF NOT EXISTS idx_meeting_attendance_meeting
  ON meeting_attendance(meeting_id);

-- ── Investment windows (Stripe contributions) ───────────────────────────────
CREATE TABLE IF NOT EXISTS investment_windows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL DEFAULT 'Investment Window',
  description TEXT,
  opens_at TIMESTAMP WITH TIME ZONE NOT NULL,
  closes_at TIMESTAMP WITH TIME ZONE NOT NULL,
  min_amount NUMERIC(12, 2) NOT NULL DEFAULT 100,
  max_amount NUMERIC(12, 2),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS investment_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  window_id UUID NOT NULL REFERENCES investment_windows(id) ON DELETE CASCADE,
  memberstack_id VARCHAR(255) NOT NULL,
  member_name VARCHAR(255) NOT NULL,
  member_email VARCHAR(255),
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  status VARCHAR(30) NOT NULL DEFAULT 'pending_payment'
    CHECK (status IN ('pending_payment', 'processing', 'paid', 'failed', 'canceled', 'processed')),
  stripe_session_id VARCHAR(255) UNIQUE,
  stripe_payment_intent VARCHAR(255),
  failure_reason TEXT,
  processed_investment_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_investment_submissions_window
  ON investment_submissions(window_id);
CREATE INDEX IF NOT EXISTS idx_investment_submissions_member
  ON investment_submissions(memberstack_id);
CREATE INDEX IF NOT EXISTS idx_investment_windows_dates
  ON investment_windows(opens_at, closes_at);

-- ── Stripe customer links ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS member_stripe_customers (
  memberstack_id VARCHAR(255) PRIMARY KEY,
  stripe_customer_id VARCHAR(255) NOT NULL UNIQUE,
  member_name VARCHAR(255),
  member_email VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE member_stripe_customers
  ADD COLUMN IF NOT EXISTS linked_manually BOOLEAN NOT NULL DEFAULT FALSE;

-- ── Row Level Security ──────────────────────────────────────────────────────
-- Enabled with no policies: the app reaches these tables only through API
-- routes using the service role key, which bypasses RLS. Browser (anon)
-- access therefore returns no rows.
ALTER TABLE voting_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE investment_windows ENABLE ROW LEVEL SECURITY;
ALTER TABLE investment_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_stripe_customers ENABLE ROW LEVEL SECURITY;

-- ── Privileges (the actual fix for the schema-cache errors) ─────────────────
-- PostgREST builds its schema cache from tables the API roles can access.
-- Without these grants a table is invisible to the API regardless of how
-- many times the cache is reloaded. RLS above still governs row access.
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

-- Apply the same defaults to anything created later
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;

-- ── Schema cache reload helper ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION reload_schema_cache()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NOTIFY pgrst, 'reload schema';
END;
$$;

REVOKE ALL ON FUNCTION reload_schema_cache() FROM PUBLIC;
REVOKE ALL ON FUNCTION reload_schema_cache() FROM anon;
REVOKE ALL ON FUNCTION reload_schema_cache() FROM authenticated;
GRANT EXECUTE ON FUNCTION reload_schema_cache() TO service_role;

-- ── Rebuild the API schema cache ────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';

-- ── Verification: every row below should report 'present' ───────────────────
SELECT
  t.name AS table_name,
  CASE WHEN c.oid IS NULL THEN 'MISSING' ELSE 'present' END AS status,
  COALESCE(
    (SELECT string_agg(DISTINCT rtg.grantee, ', ')
       FROM information_schema.role_table_grants rtg
      WHERE rtg.table_schema = 'public'
        AND rtg.table_name = t.name
        AND rtg.grantee IN ('anon', 'authenticated', 'service_role')),
    'NO GRANTS'
  ) AS api_roles_granted
FROM (VALUES
  ('voting_sessions'), ('meetings'), ('meeting_attendance'),
  ('investment_windows'), ('investment_submissions'),
  ('member_stripe_customers')
) AS t(name)
LEFT JOIN pg_class c
  ON c.relname = t.name
 AND c.relnamespace = 'public'::regnamespace
ORDER BY t.name;
