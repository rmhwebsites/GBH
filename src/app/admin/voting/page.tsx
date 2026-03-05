"use client";

import { useState, useEffect } from "react";
import useSWR, { mutate } from "swr";
import {
  Loader2,
  Save,
  Users,
  Trophy,
  BarChart3,
  CheckCircle2,
} from "lucide-react";
import type { VotingConfig, VotingResult } from "@/types/database";
import type { MemberInvestment } from "@/types/database";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function AdminVotingPage() {
  const { data: config, isLoading: loadingConfig } = useSWR<VotingConfig>(
    "/api/admin/voting/config",
    fetcher
  );

  const { data: resultsData, isLoading: loadingResults } = useSWR<{
    results: VotingResult[];
    totalVoters: number;
    totalVotes: number;
  }>("/api/voting/results", fetcher, { refreshInterval: 10 * 1000 });

  const { data: membersData } = useSWR<{ members: MemberInvestment[] }>(
    "/api/admin/members",
    fetcher
  );

  const [isActive, setIsActive] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [maxVotes, setMaxVotes] = useState(5);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Sync form state with fetched config
  useEffect(() => {
    if (config) {
      setIsActive(config.is_active);
      setTitle(config.title);
      setDescription(config.description || "");
      setMaxVotes(config.max_votes_per_member);
    }
  }, [config]);

  const totalMembers = membersData
    ? new Set(membersData.members.map((m) => m.memberstack_id)).size
    : 0;

  const handleSave = async () => {
    setSaving(true);
    setSaveMessage(null);

    try {
      const res = await fetch("/api/admin/voting/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          is_active: isActive,
          title,
          description: description || null,
          max_votes_per_member: maxVotes,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setSaveMessage(`Error: ${data.error}`);
        return;
      }

      setSaveMessage("Settings saved successfully!");
      mutate("/api/admin/voting/config");
      mutate("/api/voting/config");
      setTimeout(() => setSaveMessage(null), 3000);
    } catch {
      setSaveMessage("Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  if (loadingConfig || loadingResults) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
      </div>
    );
  }

  const results = resultsData?.results || [];
  const totalVoters = resultsData?.totalVoters || 0;
  const participationRate =
    totalMembers > 0 ? ((totalVoters / totalMembers) * 100).toFixed(1) : "0";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          Voting Management
        </h1>
        <p className="mt-1 text-sm text-muted">
          Configure and monitor investment team voting
        </p>
      </div>

      {/* Config Card */}
      <div className="glass-card p-5 sm:p-6">
        <h2 className="mb-4 text-lg font-semibold text-foreground">
          Voting Settings
        </h2>

        <div className="space-y-4">
          {/* Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">
                Voting Active
              </p>
              <p className="text-xs text-muted">
                Members can see and submit votes when active
              </p>
            </div>
            <button
              onClick={() => setIsActive(!isActive)}
              className={`relative h-6 w-11 rounded-full transition-colors ${
                isActive ? "bg-gain" : "bg-card-border"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                  isActive ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* Title */}
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-card-border bg-card px-3 py-2 text-sm text-foreground placeholder-muted focus:border-gold focus:outline-none"
              placeholder="Investment Team Vote"
            />
          </div>

          {/* Description */}
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-card-border bg-card px-3 py-2 text-sm text-foreground placeholder-muted focus:border-gold focus:outline-none"
              placeholder="Vote for up to 5 members to join the investment team."
            />
          </div>

          {/* Max votes */}
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">
              Max Votes Per Member
            </label>
            <input
              type="number"
              min={1}
              max={20}
              value={maxVotes}
              onChange={(e) =>
                setMaxVotes(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))
              }
              className="w-32 rounded-lg border border-card-border bg-card px-3 py-2 text-sm text-foreground focus:border-gold focus:outline-none"
            />
          </div>

          {/* Save */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-gold px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-gold/90 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {saving ? "Saving..." : "Save Settings"}
            </button>

            {saveMessage && (
              <span
                className={`flex items-center gap-1 text-sm ${
                  saveMessage.startsWith("Error")
                    ? "text-loss"
                    : "text-gain"
                }`}
              >
                {!saveMessage.startsWith("Error") && (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                )}
                {saveMessage}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="glass-card p-5">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-gold" />
            <p className="text-sm text-muted">Participation</p>
          </div>
          <p className="mt-1 text-2xl font-semibold text-foreground">
            {totalVoters}{" "}
            <span className="text-sm font-normal text-muted">
              of {totalMembers} ({participationRate}%)
            </span>
          </p>
        </div>
        <div className="glass-card p-5">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-gold" />
            <p className="text-sm text-muted">Total Votes Cast</p>
          </div>
          <p className="mt-1 text-2xl font-semibold text-foreground">
            {resultsData?.totalVotes || 0}
          </p>
        </div>
        <div className="glass-card p-5">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-gold" />
            <p className="text-sm text-muted">Leading Candidate</p>
          </div>
          <p className="mt-1 text-lg font-semibold text-foreground truncate">
            {results[0]?.candidate_name || "—"}
          </p>
          {results[0] && (
            <p className="text-xs text-muted">
              {results[0].vote_count}{" "}
              {results[0].vote_count === 1 ? "vote" : "votes"}
            </p>
          )}
        </div>
      </div>

      {/* Results Table */}
      <div className="glass-card overflow-hidden">
        <div className="border-b border-card-border px-4 py-3 sm:px-6 sm:py-4">
          <h2 className="text-lg font-semibold text-foreground">
            Voting Results
          </h2>
        </div>

        {results.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-muted">No votes have been cast yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-card-border text-left text-xs uppercase tracking-wider text-muted">
                  <th className="px-4 py-3 font-medium sm:px-6">Rank</th>
                  <th className="px-4 py-3 font-medium sm:px-6">
                    Candidate
                  </th>
                  <th className="px-4 py-3 font-medium text-right sm:px-6">
                    Votes
                  </th>
                  <th className="px-4 py-3 font-medium text-right sm:px-6">
                    % of Voters
                  </th>
                  <th className="hidden px-4 py-3 font-medium sm:table-cell sm:px-6" />
                </tr>
              </thead>
              <tbody>
                {results.map((result, index) => {
                  const pctOfVoters =
                    totalVoters > 0
                      ? ((result.vote_count / totalVoters) * 100).toFixed(1)
                      : "0";
                  const maxCount = results[0]?.vote_count || 1;
                  const barWidth = (result.vote_count / maxCount) * 100;

                  return (
                    <tr
                      key={result.candidate_memberstack_id}
                      className="border-b border-card-border/50"
                    >
                      <td className="px-4 py-3 sm:px-6">
                        <span
                          className={`text-sm font-bold ${
                            index === 0
                              ? "text-gold"
                              : index === 1
                              ? "text-foreground"
                              : index === 2
                              ? "text-muted"
                              : "text-muted/70"
                          }`}
                        >
                          #{index + 1}
                        </span>
                      </td>
                      <td className="px-4 py-3 sm:px-6">
                        <span className="text-sm font-medium text-foreground">
                          {result.candidate_name}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right sm:px-6">
                        <span className="text-sm font-semibold text-foreground">
                          {result.vote_count}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right sm:px-6">
                        <span className="text-sm text-muted">
                          {pctOfVoters}%
                        </span>
                      </td>
                      <td className="hidden w-40 px-4 py-3 sm:table-cell sm:px-6">
                        <div className="h-2 overflow-hidden rounded-full bg-card-border">
                          <div
                            className="h-full rounded-full bg-gold transition-all"
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
