-- Richer contribution records, so a member's history is self-contained and
-- meaningful without re-querying Stripe: which bank was debited, when the
-- money settled, and what it bought in fund units.
ALTER TABLE investment_submissions
  ADD COLUMN IF NOT EXISTS bank_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS bank_last4 VARCHAR(4),
  ADD COLUMN IF NOT EXISTS settled_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS units_granted NUMERIC(20, 8),
  ADD COLUMN IF NOT EXISTS nav_per_unit NUMERIC(12, 4);

-- Keep API privileges in place for the altered table
GRANT ALL ON investment_submissions TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
