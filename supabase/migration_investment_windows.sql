-- Investment windows + member contribution submissions (Stripe-backed)
-- Run in the Supabase SQL editor (like the other migration files).

CREATE TABLE IF NOT EXISTS investment_windows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255) NOT NULL DEFAULT 'Investment Window',
  description TEXT,
  opens_at TIMESTAMP WITH TIME ZONE NOT NULL,
  closes_at TIMESTAMP WITH TIME ZONE NOT NULL,
  min_amount NUMERIC(12, 2) NOT NULL DEFAULT 100,
  max_amount NUMERIC(12, 2),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- One row per member contribution attempt. Status lifecycle:
--   pending_payment -> processing (ACH initiated) -> paid -> processed
--   (or failed / canceled). 'processed' means an admin converted it into
--   a member_investments record at the day's NAV.
CREATE TABLE IF NOT EXISTS investment_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- All access goes through API routes using the service role key (which
-- bypasses RLS), so no policies are needed — anon-key access stays blocked.
ALTER TABLE investment_windows ENABLE ROW LEVEL SECURITY;
ALTER TABLE investment_submissions ENABLE ROW LEVEL SECURITY;
