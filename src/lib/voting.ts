// Decision (Confirm/Reject) voting shares the `votes` table with candidate
// voting. A decision vote stores a sentinel in candidate_memberstack_id so
// all existing tally, results, and history queries work unchanged.

export const DECISION_CONFIRM_ID = "decision_confirm";
export const DECISION_REJECT_ID = "decision_reject";

export const DECISION_CHOICES = {
  confirm: { id: DECISION_CONFIRM_ID, label: "Confirm" },
  reject: { id: DECISION_REJECT_ID, label: "Reject" },
} as const;

export type DecisionChoice = keyof typeof DECISION_CHOICES;

export type DecisionOutcome = "confirmed" | "rejected" | "tied";

export interface DecisionTally {
  confirm: number;
  reject: number;
}

export function isDecisionChoice(value: unknown): value is DecisionChoice {
  return value === "confirm" || value === "reject";
}

/** True when a result set came from a decision (Confirm/Reject) session. */
export function isDecisionResults(
  results: { candidate_memberstack_id: string }[]
): boolean {
  return (
    results.length > 0 &&
    results.every(
      (r) =>
        r.candidate_memberstack_id === DECISION_CONFIRM_ID ||
        r.candidate_memberstack_id === DECISION_REJECT_ID
    )
  );
}

export function getDecisionTally(
  results: { candidate_memberstack_id: string; vote_count: number }[]
): DecisionTally {
  const count = (id: string) =>
    results.find((r) => r.candidate_memberstack_id === id)?.vote_count ?? 0;
  return {
    confirm: count(DECISION_CONFIRM_ID),
    reject: count(DECISION_REJECT_ID),
  };
}

/**
 * Outcome policy: simple majority of votes cast.
 * Adjust here if the club adopts a quorum or supermajority rule.
 */
export function getDecisionOutcome(tally: DecisionTally): DecisionOutcome {
  if (tally.confirm > tally.reject) return "confirmed";
  if (tally.reject > tally.confirm) return "rejected";
  return "tied";
}
