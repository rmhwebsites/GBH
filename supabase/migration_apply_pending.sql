-- ============================================================================
-- Applies the two migrations that were never run. Paste the WHOLE file into
-- the Supabase SQL editor and run it in one go. Safe to re-run.
--
-- Right now investment submissions fail with:
--   "Could not find the 'processing_fee' column of 'investment_submissions'"
-- ============================================================================

-- migration_submission_resolution.sql
ALTER TABLE investment_submissions
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS reversal_flagged_at TIMESTAMP WITH TIME ZONE;

-- migration_processing_fee.sql
ALTER TABLE investment_submissions
  ADD COLUMN IF NOT EXISTS processing_fee NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_charged NUMERIC(12, 2);

-- Existing rows all predate the fee (verified: no submissions were created
-- while the fee code was deployed but this migration was missing), so what
-- they were charged equals what they invested.
UPDATE investment_submissions
   SET total_charged = amount
 WHERE total_charged IS NULL;

GRANT ALL ON investment_submissions TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';

-- Verification: every row should say 'present'
SELECT c.column_name,
       CASE WHEN i.column_name IS NULL THEN 'MISSING' ELSE 'present' END AS status
FROM (VALUES ('processing_fee'), ('total_charged'),
             ('resolved_at'), ('reversal_flagged_at')) AS c(column_name)
LEFT JOIN information_schema.columns i
  ON i.table_schema = 'public'
 AND i.table_name = 'investment_submissions'
 AND i.column_name = c.column_name;
