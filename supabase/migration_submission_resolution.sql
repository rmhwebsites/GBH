-- Resolution tracking for failed contributions, and a flag for ACH returns
-- that arrive after units were already granted.
ALTER TABLE investment_submissions
  -- Set when a failed contribution no longer needs attention, so it drops
  -- out of the active history
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP WITH TIME ZONE,
  -- Set when a payment is returned by the bank AFTER it was processed into
  -- fund units. Never adjusts units automatically — it raises it for review.
  ADD COLUMN IF NOT EXISTS reversal_flagged_at TIMESTAMP WITH TIME ZONE;

GRANT ALL ON investment_submissions TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
