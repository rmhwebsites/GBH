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
  Clock,
  History,
} from "lucide-react";
import Image from "next/image";
import type {
  VotingConfig,
  VotingCandidate,
  Vote,
  VotingResult,
} from "@/types/database";
import {
  getMemberPhotoUrl,
  getInitials,
  getAvatarColor,
} from "@/lib/memberPhotos";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

/** Avatar component — shows photo if available, else initials */
function MemberAvatar({
  name,
  size = "md",
  className = "",
}: {
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const photoUrl = getMemberPhotoUrl(name);
  const sizeClasses = {
    sm: "h-7 w-7 text-[10px]",
    md: "h-12 w-12 sm:h-14 sm:w-14 text-sm sm:text-base",
    lg: "h-16 w-16 text-lg",
  };

  if (photoUrl) {
    return (
      <div
        className={`relative overflow-hidden rounded-full ${sizeClasses[size]} ${className}`}
      >
        <Image
          src={photoUrl}
          alt={name}
          fill
          className="object-cover"
          sizes={size === "sm" ? "28px" : size === "md" ? "56px" : "64px"}
          unoptimized
        />
      </div>
    );
  }

  const color = getAvatarColor(name);
  return (
    <div
      className={`flex items-center justify-center rounded-full font-bold text-white ${sizeClasses[size]} ${className}`}
      style={{ backgroundColor: color }}
    >
      {getInitials(name)}
    </div>
  );
}

interface ConfigWithVisibility extends VotingConfig {
  is_visible: boolean;
}

interface HistorySession {
  session_id: string;
  date: string;
  end_date: string;
  total_voters: number;
  total_votes: number;
  results: VotingResult[];
}

/** Reusable Top-5 tally chart */
function TallyChart({
  results,
  totalVoters,
  myVotes,
  title,
  isLive,
}: {
  results: VotingResult[];
  totalVoters: number;
  myVotes?: Vote[];
  title: string;
  isLive?: boolean;
}) {
  const top5 = results.slice(0, 5);
  if (top5.length === 0) return null;

  return (
    <div className="glass-card p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-gold" />
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        </div>
        {isLive && (
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 animate-pulse rounded-full bg-gain" />
            <span className="text-xs text-muted">Live</span>
          </div>
        )}
      </div>

      <div className="space-y-5">
        {top5.map((result, index) => {
          const maxCount = top5[0]?.vote_count || 1;
          const barWidth = (result.vote_count / maxCount) * 100;
          const pctOfVoters =
            totalVoters > 0
              ? ((result.vote_count / totalVoters) * 100).toFixed(0)
              : "0";
          const isMyVote = myVotes?.some(
            (v) =>
              v.candidate_memberstack_id === result.candidate_memberstack_id
          );

          const medals = ["🥇", "🥈", "🥉"];
          const medal = medals[index] || "";

          return (
            <div
              key={result.candidate_memberstack_id}
              className="flex items-center gap-3"
            >
              <MemberAvatar name={result.candidate_name} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="mb-1.5 flex items-center justify-between">
                  <div className="flex min-w-0 items-center gap-2">
                    {medal ? (
                      <span className="flex-shrink-0 text-base">{medal}</span>
                    ) : (
                      <span className="w-6 flex-shrink-0 text-center text-xs font-bold text-muted">
                        #{index + 1}
                      </span>
                    )}
                    <span
                      className={`truncate text-sm font-semibold ${
                        isMyVote ? "text-gold" : "text-foreground"
                      }`}
                    >
                      {result.candidate_name}
                    </span>
                    {isMyVote && (
                      <span className="flex-shrink-0 text-[10px] text-gold/70">
                        (your vote)
                      </span>
                    )}
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-2">
                    <span className="text-sm font-bold text-gold">
                      {result.vote_count}
                    </span>
                    <span className="text-xs text-muted">({pctOfVoters}%)</span>
                  </div>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-card-border">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-gold/80 to-gold transition-all duration-700"
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-center gap-1 text-xs text-muted">
        <Users className="h-3 w-3" />
        {totalVoters} {totalVoters === 1 ? "member" : "members"} voted
      </div>

      {/* Overflow list for ranks 6+ */}
      {results.length > 5 && (
        <div className="mt-4 border-t border-card-border/50 pt-3">
          <div className="space-y-2">
            {results.slice(5).map((result, i) => {
              const isMyVote = myVotes?.some(
                (v) =>
                  v.candidate_memberstack_id ===
                  result.candidate_memberstack_id
              );
              return (
                <div
                  key={result.candidate_memberstack_id}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-6 text-center text-xs text-muted">
                      #{i + 6}
                    </span>
                    <MemberAvatar name={result.candidate_name} size="sm" />
                    <span
                      className={`text-sm ${
                        isMyVote
                          ? "font-medium text-gold"
                          : "text-foreground"
                      }`}
                    >
                      {result.candidate_name}
                    </span>
                  </div>
                  <span className="text-sm text-muted">
                    {result.vote_count}{" "}
                    {result.vote_count === 1 ? "vote" : "votes"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function VotePage() {
  const { userId } = useAuth();
  const memberId = userId || "";

  const [selectedCandidates, setSelectedCandidates] = useState<Set<string>>(
    new Set()
  );
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { data: config, isLoading: loadingConfig } =
    useSWR<ConfigWithVisibility>("/api/voting/config", fetcher, {
      refreshInterval: 30 * 1000,
    });

  const isVisible = config?.is_visible ?? false;
  const isExpired =
    config?.expires_at ? new Date() >= new Date(config.expires_at) : false;
  const isActiveButNotStarted =
    config?.is_active &&
    config?.starts_at &&
    new Date() < new Date(config.starts_at);

  // Fetch candidates when visible OR when expired (to show history)
  const { data: candidatesData, isLoading: loadingCandidates } = useSWR<{
    candidates: VotingCandidate[];
  }>(
    config?.is_active || isExpired ? "/api/voting/candidates" : null,
    fetcher
  );

  const { data: voteStatus, isLoading: loadingVotes } = useSWR<{
    hasVoted: boolean;
    votes: Vote[];
  }>(memberId ? "/api/voting/vote" : null, fetcher);

  // Fetch results when visible, expired, or already voted
  const { data: resultsData } = useSWR<{
    results: VotingResult[];
    totalVoters: number;
    totalVotes: number;
  }>(
    isVisible || isExpired || voteStatus?.hasVoted
      ? "/api/voting/results"
      : null,
    fetcher,
    { refreshInterval: 15 * 1000 }
  );

  // Always fetch voting history (shows past sessions)
  const { data: historyData } = useSWR<{ sessions: HistorySession[] }>(
    "/api/voting/history",
    fetcher
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

  const pastSessions = historyData?.sessions || [];

  // ==========================================
  // INACTIVE STATE — Show voting history
  // ==========================================
  if (!config?.is_active && !isExpired) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Vote</h1>
          <p className="mt-1 text-sm text-muted">Investment team voting</p>
        </div>

        {/* No active vote banner */}
        <div className="glass-card p-6 text-center">
          <VoteIcon className="mx-auto h-10 w-10 text-muted/50" />
          <h2 className="mt-3 text-lg font-medium text-foreground">
            No Active Vote
          </h2>
          <p className="mt-1 text-sm text-muted">
            There is no voting session currently active. Check back later.
          </p>
        </div>

        {/* Past voting history */}
        {pastSessions.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-gold" />
              <h2 className="text-lg font-semibold text-foreground">
                Voting History
              </h2>
            </div>

            {pastSessions.map((session) => {
              const sessionDate = new Date(session.date).toLocaleDateString(
                "en-US",
                { month: "long", year: "numeric" }
              );
              return (
                <TallyChart
                  key={session.session_id}
                  results={session.results}
                  totalVoters={session.total_voters}
                  title={sessionDate}
                />
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // SCHEDULED BUT NOT STARTED
  // ==========================================
  if (isActiveButNotStarted) {
    const startsDate = new Date(config!.starts_at!).toLocaleString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            {config?.title || "Vote"}
          </h1>
          {config?.description && (
            <p className="mt-1 text-sm text-muted">{config.description}</p>
          )}
        </div>
        <div className="glass-card p-8 text-center">
          <Clock className="mx-auto h-12 w-12 text-gold/50" />
          <h2 className="mt-4 text-lg font-medium text-foreground">
            Voting Opens Soon
          </h2>
          <p className="mt-2 text-sm text-muted">
            Voting begins on {startsDate}
          </p>
        </div>

        {/* Show history below scheduled notice */}
        {pastSessions.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-gold" />
              <h2 className="text-lg font-semibold text-foreground">
                Past Results
              </h2>
            </div>
            {pastSessions.map((session) => {
              const sessionDate = new Date(session.date).toLocaleDateString(
                "en-US",
                { month: "long", year: "numeric" }
              );
              return (
                <TallyChart
                  key={session.session_id}
                  results={session.results}
                  totalVoters={session.total_voters}
                  title={sessionDate}
                />
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // ACTIVE VOTING STATE
  // ==========================================
  const candidates = candidatesData?.candidates || [];
  const hasVoted = voteStatus?.hasVoted || false;
  const myVotes = voteStatus?.votes || [];
  const maxVotes = config?.max_votes_per_member || 5;
  const canVote = isVisible && !isExpired && !hasVoted;

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

      mutate("/api/voting/vote");
      mutate("/api/voting/results");
    } catch {
      setSubmitError("Failed to submit vote. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Expiration time display
  const expiresAtStr = config?.expires_at
    ? new Date(config.expires_at).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          {config?.title || "Vote"}
        </h1>
        {config?.description && (
          <p className="mt-1 text-sm text-muted">{config.description}</p>
        )}
      </div>

      {/* Expired banner */}
      {isExpired && (
        <div className="glass-card border-loss/20 p-4">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-loss" />
            <p className="text-sm font-medium text-foreground">
              Voting has ended
            </p>
          </div>
          <p className="mt-1 text-xs text-muted">
            The voting period has expired. Results are shown below.
          </p>
        </div>
      )}

      {/* Expiration countdown (if active and has expiration) */}
      {!isExpired && expiresAtStr && (
        <div className="flex items-center gap-1.5 text-xs text-muted">
          <Clock className="h-3 w-3" />
          Voting closes {expiresAtStr}
        </div>
      )}

      {/* Already voted confirmation */}
      {hasVoted && (
        <div className="glass-card border-gain/20 p-5">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-gain" />
            <div>
              <h3 className="font-medium text-foreground">Vote Submitted</h3>
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

      {/* Voting form (only if can vote) */}
      {canVote && (
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
                  onClick={() => toggleCandidate(candidate.memberstack_id)}
                  disabled={isDisabled}
                  className={`glass-card flex flex-col items-center gap-3 p-4 transition-all sm:p-5 ${
                    isSelected
                      ? "border-gold/50 bg-gold/10 ring-1 ring-gold/30"
                      : isDisabled
                      ? "cursor-not-allowed opacity-40"
                      : "cursor-pointer hover:border-card-border/80 hover:bg-white/[0.04]"
                  }`}
                >
                  <MemberAvatar name={candidate.name} size="md" />
                  <span className="text-center text-xs font-medium text-foreground sm:text-sm">
                    {candidate.name}
                  </span>
                  {isSelected && (
                    <CheckCircle2 className="h-4 w-4 text-gold" />
                  )}
                </button>
              );
            })}
          </div>

          {submitError && (
            <div className="flex items-center gap-2 rounded-lg bg-loss/10 px-4 py-3 text-sm text-loss">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {submitError}
            </div>
          )}

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

      {/* Current session results */}
      {resultsData && resultsData.results.length > 0 && (
        <TallyChart
          results={resultsData.results}
          totalVoters={resultsData.totalVoters}
          myVotes={myVotes}
          title={isExpired ? "Final Results" : "Live Results"}
          isLive={!isExpired}
        />
      )}

      {/* Past voting history (below current results) */}
      {pastSessions.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-muted" />
            <h2 className="text-sm font-semibold text-muted">Past Votes</h2>
          </div>
          {pastSessions.map((session) => {
            const sessionDate = new Date(session.date).toLocaleDateString(
              "en-US",
              { month: "long", year: "numeric" }
            );
            return (
              <TallyChart
                key={session.session_id}
                results={session.results}
                totalVoters={session.total_voters}
                title={sessionDate}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
