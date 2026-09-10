-- Flat processing fee charged on top of a member's investment.
--
-- `amount` stays the INVESTMENT amount — it is what fund units are granted
-- from. The fee is charged in addition and must never be converted into
-- units, so it is tracked in its own columns.
ALTER TABLE investment_submissions
  ADD COLUMN IF NOT EXISTS processing_fee NUMERIC(12, 2) NOT NULL DEFAULT 0,
  -- amount + processing_fee: what the member's bank was actually debited
  ADD COLUMN IF NOT EXISTS total_charged NUMERIC(12, 2);

-- Backfill existing rows, which predate the fee
UPDATE investment_submissions
   SET total_charged = amount
 WHERE total_charged IS NULL;

GRANT ALL ON investment_submissions TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
