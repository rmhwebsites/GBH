"use client";

import { useState } from "react";
import useSWR, { mutate } from "swr";
import { useAuth } from "@memberstack/react";
import {
  Loader2,
  Vote as VoteIcon,
  CheckCircle2,
  AlertCircle,
  Users,
  Trophy,
} from "lucide-react";
import type {
  VotingConfig,
  VotingCandidate,
  Vote,
  VotingResult,
} from "@/types/database";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// Consistent color from name
function getAvatarColor(name: string): string {
  const colors = [
    "bg-blue-600",
    "bg-emerald-600",
    "bg-purple-600",
    "bg-amber-600",
    "bg-rose-600",
    "bg-cyan-600",
    "bg-indigo-600",
    "bg-teal-600",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export default function VotePage() {
  const { userId } = useAuth();
  const memberId = userId || "";

  const [selectedCandidates, setSelectedCandidates] = useState<Set<string>>(
    new Set()
  );
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { data: config, isLoading: loadingConfig } = useSWR<VotingConfig>(
    "/api/voting/config",
    fetcher,
    { refreshInterval: 30 * 1000 }
  );

  const { data: candidatesData, isLoading: loadingCandidates } = useSWR<{
    candidates: VotingCandidate[];
  }>(config?.is_active ? "/api/voting/candidates" : null, fetcher);

  const { data: voteStatus, isLoading: loadingVotes } = useSWR<{
    hasVoted: boolean;
    votes: Vote[];
  }>(memberId ? "/api/voting/vote" : null, fetcher);

  const { data: resultsData } = useSWR<{
    results: VotingResult[];
    totalVoters: number;
    totalVotes: number;
  }>(
    config?.is_active || voteStatus?.hasVoted
      ? "/api/voting/results"
      : null,
    fetcher,
    { refreshInterval: 15 * 1000 } // Refresh results every 15s
  );

  const isLoading = loadingConfig || loadingCandidates || loadingVotes;

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-gold" />
          <p className="text-muted">Loading voting...</p>
        </div>
      </div>
    );
  }

  // Voting not active
  if (!config?.is_active) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Vote</h1>
          <p className="mt-1 text-sm text-muted">
            Investment team voting
          </p>
        </div>
        <div className="glass-card p-8 text-center">
          <VoteIcon className="mx-auto h-12 w-12 text-muted/50" />
          <h2 className="mt-4 text-lg font-medium text-foreground">
            No Active Vote
          </h2>
          <p className="mt-2 text-sm text-muted">
            There is no voting session currently active. Check back later.
          </p>
        </div>
      </div>
    );
  }

  const candidates = candidatesData?.candidates || [];
  const hasVoted = voteStatus?.hasVoted || false;
  const myVotes = voteStatus?.votes || [];
  const maxVotes = config.max_votes_per_member || 5;

  const toggleCandidate = (candidateId: string) => {
    setSelectedCandidates((prev) => {
      const next = new Set(prev);
      if (next.has(candidateId)) {
        next.delete(candidateId);
      } else if (next.size < maxVotes) {
        next.add(candidateId);
      }
      return next;
    });
    setSubmitError(null);
  };

  const handleSubmit = async () => {
    if (selectedCandidates.size === 0) {
      setSubmitError("Please select at least one candidate.");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch("/api/voting/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateIds: Array.from(selectedCandidates),
          voterName: "Member",
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setSubmitError(data.error || "Failed to submit vote.");
        return;
      }

      // Refresh vote status and results
      mutate("/api/voting/vote");
      mutate("/api/voting/results");
    } catch {
      setSubmitError("Failed to submit vote. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          {config.title}
        </h1>
        {config.description && (
          <p className="mt-1 text-sm text-muted">{config.description}</p>
        )}
      </div>

      {/* Already voted confirmation */}
      {hasVoted && (
        <div className="glass-card border-gain/20 p-5">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-gain" />
            <div>
              <h3 className="font-medium text-foreground">
                Vote Submitted
              </h3>
              <p className="mt-1 text-sm text-muted">
                You voted for:{" "}
                {myVotes.map((v) => v.candidate_name).join(", ")}
              </p>
              <p className="mt-1 text-xs text-muted/70">
                Votes are final and cannot be changed.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Voting form (only if not voted yet) */}
      {!hasVoted && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted">
              Select up to {maxVotes} candidates
            </p>
            <span
              className={`text-sm font-medium ${
                selectedCandidates.size === maxVotes
                  ? "text-gold"
                  : "text-muted"
              }`}
            >
              {selectedCandidates.size}/{maxVotes} selected
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {candidates.map((candidate) => {
              const isSelected = selectedCandidates.has(
                candidate.memberstack_id
              );
              const isDisabled =
                !isSelected && selectedCandidates.size >= maxVotes;

              return (
                <button
                  key={candidate.memberstack_id}
                  onClick={() =>
                    toggleCandidate(candidate.memberstack_id)
                  }
                  disabled={isDisabled}
                  className={`glass-card flex flex-col items-center gap-3 p-4 transition-all sm:p-5 ${
                    isSelected
                      ? "border-gold/50 bg-gold/10 ring-1 ring-gold/30"
                      : isDisabled
                      ? "cursor-not-allowed opacity-40"
                      : "cursor-pointer hover:border-card-border/80 hover:bg-white/[0.04]"
                  }`}
                >
                  {/* Avatar */}
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold text-white sm:h-14 sm:w-14 sm:text-base ${getAvatarColor(
                      candidate.name
                    )}`}
                  >
                    {getInitials(candidate.name)}
                  </div>

                  {/* Name */}
                  <span className="text-center text-xs font-medium text-foreground sm:text-sm">
                    {candidate.name}
                  </span>

                  {/* Checkmark indicator */}
                  {isSelected && (
                    <CheckCircle2 className="h-4 w-4 text-gold" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Error */}
          {submitError && (
            <div className="flex items-center gap-2 rounded-lg bg-loss/10 px-4 py-3 text-sm text-loss">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {submitError}
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={submitting || selectedCandidates.size === 0}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-gold px-6 py-3 text-sm font-semibold text-black transition-colors hover:bg-gold/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <VoteIcon className="h-4 w-4" />
            )}
            {submitting
              ? "Submitting..."
              : `Submit Vote (${selectedCandidates.size}/${maxVotes})`}
          </button>

          <p className="text-center text-xs text-muted/60">
            Your vote is final and cannot be changed after submission.
          </p>
        </div>
      )}

      {/* Live Results (visible after voting or always if voted) */}
      {(hasVoted || resultsData) && resultsData && (
        <div className="glass-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-card-border px-4 py-3 sm:px-6 sm:py-4">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-gold" />
              <h2 className="text-lg font-semibold text-foreground">
                Live Results
              </h2>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-muted">
              <Users className="h-3.5 w-3.5" />
              {resultsData.totalVoters} voted
            </div>
          </div>

          <div className="p-4 sm:p-6">
            {resultsData.results.length === 0 ? (
              <p className="text-center text-sm text-muted">
                No votes yet. Be the first to vote!
              </p>
            ) : (
              <div className="space-y-3">
                {resultsData.results.map((result, index) => {
                  const maxVoteCount = resultsData.results[0]?.vote_count || 1;
                  const barWidth = (result.vote_count / maxVoteCount) * 100;
                  const isMyVote = myVotes.some(
                    (v) =>
                      v.candidate_memberstack_id ===
                      result.candidate_memberstack_id
                  );

                  return (
                    <div key={result.candidate_memberstack_id}>
                      <div className="mb-1 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {index === 0 && (
                            <Trophy className="h-3.5 w-3.5 text-gold" />
                          )}
                          <span
                            className={`text-sm font-medium ${
                              isMyVote ? "text-gold" : "text-foreground"
                            }`}
                          >
                            {result.candidate_name}
                          </span>
                          {isMyVote && (
                            <span className="text-[10px] text-gold/70">
                              (your vote)
                            </span>
                          )}
                        </div>
                        <span className="text-sm font-medium text-muted">
                          {result.vote_count}{" "}
                          {result.vote_count === 1 ? "vote" : "votes"}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-card-border">
                        <div
                          className="h-full rounded-full bg-gold transition-all duration-500"
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
