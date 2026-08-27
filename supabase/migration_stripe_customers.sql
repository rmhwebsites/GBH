-- Links each member to their Stripe customer, so saved bank accounts can be
-- shown to the member at checkout and to admins for reconciliation.
--
-- Only the Stripe customer ID is stored. Bank details are never persisted
-- here — they are fetched from Stripe on demand, and Stripe only ever
-- returns masked identifiers (bank name + last 4 digits).
CREATE TABLE IF NOT EXISTS member_stripe_customers (
  memberstack_id VARCHAR(255) PRIMARY KEY,
  stripe_customer_id VARCHAR(255) NOT NULL UNIQUE,
  member_name VARCHAR(255),
  member_email VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- All access goes through API routes using the service role key (which
-- bypasses RLS), so no policies are needed — anon-key access stays blocked.
ALTER TABLE member_stripe_customers ENABLE ROW LEVEL SECURITY;

-- Make the new table visible to the API immediately
NOTIFY pgrst, 'reload schema';
