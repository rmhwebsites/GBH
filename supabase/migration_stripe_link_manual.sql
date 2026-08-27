-- Track whether a member's Stripe customer link was made by an admin, so the
-- automatic email-matching path never silently overwrites a manual decision.
ALTER TABLE member_stripe_customers
  ADD COLUMN IF NOT EXISTS linked_manually BOOLEAN NOT NULL DEFAULT FALSE;

NOTIFY pgrst, 'reload schema';
