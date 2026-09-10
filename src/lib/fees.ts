/**
 * Flat processing fee added on top of every member contribution.
 *
 * It covers the payment processor's cost (Stripe caps ACH at $5), and is
 * charged IN ADDITION to the investment: a member entering $250 is debited
 * $255. The fee is never converted into fund units — only the investment
 * amount buys units — so the two figures are always tracked separately.
 */
export const PROCESSING_FEE_USD = 5;

export interface ContributionTotals {
  /** What the member invests, and what units are granted from */
  investment: number;
  /** Flat processing fee charged on top */
  fee: number;
  /** What the member's bank is actually debited */
  total: number;
}

/** Split a requested investment into its investment, fee, and charged total. */
export function calculateContribution(investment: number): ContributionTotals {
  // Work in cents so the total never picks up floating-point dust
  const investmentCents = Math.round(investment * 100);
  const feeCents = Math.round(PROCESSING_FEE_USD * 100);
  return {
    investment: investmentCents / 100,
    fee: feeCents / 100,
    total: (investmentCents + feeCents) / 100,
  };
}

export function formatFeeNote(): string {
  return `Includes a $${PROCESSING_FEE_USD} processing fee`;
}
