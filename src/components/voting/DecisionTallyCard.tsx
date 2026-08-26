"use client";

import { Users, Scale, CheckCircle2, XCircle } from "lucide-react";
import {
  getDecisionOutcome,
  type DecisionChoice,
  type DecisionTally,
} from "@/lib/voting";

const OUTCOME_STYLES = {
  confirmed: { label: "Confirmed", classes: "bg-gain/10 text-gain" },
  rejected: { label: "Rejected", classes: "bg-loss/10 text-loss" },
  tied: { label: "Tied", classes: "bg-highlight text-muted" },
} as const;

/** Confirm vs Reject tally for decision votes — live and historical. */
export function DecisionTallyCard({
  tally,
  totalVoters,
  title,
  description,
  isLive,
  showOutcome,
  myChoice,
}: {
  tally: DecisionTally;
  totalVoters: number;
  title: string;
  description?: string | null;
  isLive?: boolean;
  /** Show the Confirmed/Rejected/Tied badge (for closed votes). */
  showOutcome?: boolean;
  myChoice?: DecisionChoice | null;
}) {
  const totalCast = tally.confirm + tally.reject;
  const outcome = OUTCOME_STYLES[getDecisionOutcome(tally)];

  const rows = [
    {
      choice: "confirm" as const,
      label: "Confirm",
      count: tally.confirm,
      icon: CheckCircle2,
      textColor: "text-gain",
      barColor: "bg-gradient-to-r from-gain/80 to-gain",
    },
    {
      choice: "reject" as const,
      label: "Reject",
      count: tally.reject,
      icon: XCircle,
      textColor: "text-loss",
      barColor: "bg-gradient-to-r from-loss/80 to-loss",
    },
  ];

  return (
    <div className="glass-card p-5 sm:p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Scale className="h-4 w-4 flex-shrink-0 text-gold" />
            <h2 className="truncate text-lg font-semibold text-foreground">
              {title}
            </h2>
          </div>
          {description && (
            <p className="mt-1 text-sm text-muted">{description}</p>
          )}
        </div>
        <div className="flex flex-shrink-0 items-center gap-3">
          {showOutcome && totalCast > 0 && (
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${outcome.classes}`}
            >
              {outcome.label}
            </span>
          )}
          {isLive && (
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 animate-pulse rounded-full bg-gain" />
              <span className="text-xs text-muted">Live</span>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-5">
        {rows.map((row) => {
          const pct = totalCast > 0 ? (row.count / totalCast) * 100 : 0;
          const isMyChoice = myChoice === row.choice;
          const Icon = row.icon;

          return (
            <div key={row.choice}>
              <div className="mb-1.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon className={`h-4 w-4 ${row.textColor}`} />
                  <span className="text-sm font-semibold text-foreground">
                    {row.label}
                  </span>
                  {isMyChoice && (
                    <span className="text-[10px] text-gold/70">
                      (your vote)
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-bold ${row.textColor}`}>
                    {row.count}
                  </span>
                  <span className="text-xs text-muted">
                    ({pct.toFixed(0)}%)
                  </span>
                </div>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-card-border">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${row.barColor}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-center gap-1 text-xs text-muted">
        <Users className="h-3 w-3" />
        {totalVoters} {totalVoters === 1 ? "member" : "members"} voted
      </div>
    </div>
  );
}
