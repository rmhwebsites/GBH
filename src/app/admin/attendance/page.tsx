"use client";

import { useMemo, useState } from "react";
import useSWR, { mutate } from "swr";
import {
  Loader2,
  Save,
  Users,
  CalendarCheck,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Pencil,
  Trash2,
  X,
  TrendingUp,
} from "lucide-react";
import type {
  MeetingWithAttendance,
  MemberInvestment,
} from "@/types/database";
import { MemberAvatar } from "@/components/ui/MemberAvatar";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function todayInput(): string {
  const d = new Date();
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 10);
}

function formatMeetingDate(dateStr: string): string {
  // DATE column — parse as local, not UTC midnight
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function AdminAttendancePage() {
  const { data: attendanceData, isLoading: loadingMeetings } = useSWR<{
    meetings: MeetingWithAttendance[];
  }>("/api/admin/attendance", fetcher);

  const { data: membersData, isLoading: loadingMembers } = useSWR<{
    members: MemberInvestment[];
  }>("/api/admin/members", fetcher);

  const [meetingDate, setMeetingDate] = useState(todayInput());
  const [title, setTitle] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Deduplicate members (multiple investment rows per member)
  const members = useMemo(() => {
    const seen = new Set<string>();
    return (membersData?.members || [])
      .filter((m) => {
        if (seen.has(m.memberstack_id)) return false;
        seen.add(m.memberstack_id);
        return true;
      })
      .sort((a, b) => a.member_name.localeCompare(b.member_name));
  }, [membersData]);

  const meetings = useMemo(
    () => attendanceData?.meetings || [],
    [attendanceData]
  );

  // Per-member attendance rates across all meetings
  const memberStats = useMemo(() => {
    if (meetings.length === 0) return [];
    const counts = new Map<string, { name: string; attended: number }>();
    for (const member of members) {
      counts.set(member.memberstack_id, {
        name: member.member_name,
        attended: 0,
      });
    }
    for (const meeting of meetings) {
      for (const attendee of meeting.attendees) {
        const entry = counts.get(attendee.memberstack_id);
        if (entry) {
          entry.attended++;
        } else {
          // Member no longer in member_investments — still show them
          counts.set(attendee.memberstack_id, {
            name: attendee.member_name,
            attended: 1,
          });
        }
      }
    }
    return Array.from(counts.entries())
      .map(([id, s]) => ({
        memberstack_id: id,
        name: s.name,
        attended: s.attended,
        rate: (s.attended / meetings.length) * 100,
      }))
      .sort((a, b) => b.attended - a.attended || a.name.localeCompare(b.name));
  }, [meetings, members]);

  const avgAttendance =
    meetings.length > 0
      ? meetings.reduce((sum, m) => sum + m.attendees.length, 0) /
        meetings.length
      : 0;

  const toggleMember = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const resetForm = () => {
    setEditingId(null);
    setMeetingDate(todayInput());
    setTitle("");
    setSelectedIds(new Set());
  };

  const startEditing = (meeting: MeetingWithAttendance) => {
    setEditingId(meeting.id);
    setMeetingDate(meeting.meeting_date);
    setTitle(meeting.title || "");
    setSelectedIds(new Set(meeting.attendees.map((a) => a.memberstack_id)));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSave = async () => {
    if (!meetingDate) {
      setMessage("Error: Meeting date is required");
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const payload = {
        meeting_date: meetingDate,
        title: title || null,
        attendeeIds: Array.from(selectedIds),
      };

      const res = await fetch(
        editingId ? `/api/admin/attendance/${editingId}` : "/api/admin/attendance",
        {
          method: editingId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (!res.ok) {
        const data = await res.json();
        setMessage(`Error: ${data.error}`);
        return;
      }

      setMessage(editingId ? "Meeting updated!" : "Attendance recorded!");
      resetForm();
      mutate("/api/admin/attendance");
      setTimeout(() => setMessage(null), 3000);
    } catch {
      setMessage("Error: Failed to save meeting");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/attendance/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        if (editingId === id) resetForm();
        mutate("/api/admin/attendance");
      }
    } finally {
      setDeletingId(null);
    }
  };

  if (loadingMeetings || loadingMembers) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          Meeting Attendance
        </h1>
        <p className="mt-1 text-sm text-muted">
          Record who shows up to each meeting and track attendance over time
        </p>
      </div>

      {/* Record / Edit Meeting */}
      <div className="glass-card p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarCheck className="h-4 w-4 text-gold" />
            <h2 className="text-lg font-semibold text-foreground">
              {editingId ? "Edit Meeting" : "Record Meeting"}
            </h2>
          </div>
          {editingId && (
            <button
              onClick={resetForm}
              className="flex items-center gap-1 text-xs text-muted hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
              Cancel edit
            </button>
          )}
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">
                Meeting Date
              </label>
              <input
                type="date"
                value={meetingDate}
                onChange={(e) => setMeetingDate(e.target.value)}
                className="w-full rounded-lg border border-card-border bg-card px-3 py-2 text-sm text-foreground focus:border-gold focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">
                Title <span className="text-muted">(optional)</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Weekly partner meeting"
                className="w-full rounded-lg border border-card-border bg-card px-3 py-2 text-sm text-foreground placeholder-muted focus:border-gold focus:outline-none"
              />
            </div>
          </div>

          {/* Member checklist */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium text-foreground">
                Who attended?
              </label>
              <div className="flex items-center gap-3 text-xs">
                <span className="font-medium text-gold">
                  {selectedIds.size}/{members.length} present
                </span>
                <button
                  onClick={() =>
                    setSelectedIds(
                      new Set(members.map((m) => m.memberstack_id))
                    )
                  }
                  className="text-muted hover:text-foreground"
                >
                  Select all
                </button>
                <button
                  onClick={() => setSelectedIds(new Set())}
                  className="text-muted hover:text-foreground"
                >
                  Clear
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {members.map((member) => {
                const isSelected = selectedIds.has(member.memberstack_id);
                return (
                  <button
                    key={member.memberstack_id}
                    onClick={() => toggleMember(member.memberstack_id)}
                    className={`flex items-center gap-2.5 rounded-lg border p-2.5 text-left transition-all ${
                      isSelected
                        ? "border-gain/50 bg-gain/10 ring-1 ring-gain/30"
                        : "border-card-border bg-card hover:bg-highlight"
                    }`}
                  >
                    <MemberAvatar name={member.member_name} size="sm" />
                    <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
                      {member.member_name}
                    </span>
                    {isSelected && (
                      <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-gain" />
                    )}
                  </button>
                );
              })}
            </div>
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
              {saving
                ? "Saving..."
                : editingId
                ? "Update Meeting"
                : "Save Attendance"}
            </button>
            {message && (
              <span
                className={`flex items-center gap-1 text-sm ${
                  message.startsWith("Error") ? "text-loss" : "text-gain"
                }`}
              >
                {message.startsWith("Error") ? (
                  <AlertCircle className="h-3.5 w-3.5" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                )}
                {message}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="glass-card p-5">
          <div className="flex items-center gap-2">
            <CalendarCheck className="h-4 w-4 text-gold" />
            <p className="text-sm text-muted">Meetings Recorded</p>
          </div>
          <p className="mt-1 text-2xl font-semibold text-foreground">
            {meetings.length}
          </p>
        </div>
        <div className="glass-card p-5">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-gold" />
            <p className="text-sm text-muted">Avg Attendance</p>
          </div>
          <p className="mt-1 text-2xl font-semibold text-foreground">
            {avgAttendance.toFixed(1)}{" "}
            <span className="text-sm font-normal text-muted">
              of {members.length} members
            </span>
          </p>
        </div>
        <div className="glass-card p-5">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-gold" />
            <p className="text-sm text-muted">Best Attendance</p>
          </div>
          <p className="mt-1 truncate text-lg font-semibold text-foreground">
            {memberStats[0]?.name || "—"}
          </p>
          {memberStats[0] && (
            <p className="text-xs text-muted">
              {memberStats[0].attended} of {meetings.length} meetings
            </p>
          )}
        </div>
      </div>

      {/* Member attendance rates */}
      {memberStats.length > 0 && (
        <div className="glass-card p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <Users className="h-4 w-4 text-gold" />
            <h2 className="text-lg font-semibold text-foreground">
              Attendance Rates
            </h2>
          </div>
          <div className="space-y-4">
            {memberStats.map((stat) => (
              <div key={stat.memberstack_id} className="flex items-center gap-3">
                <MemberAvatar name={stat.name} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="truncate text-sm font-medium text-foreground">
                      {stat.name}
                    </span>
                    <div className="flex flex-shrink-0 items-center gap-2">
                      <span className="text-sm font-bold text-gold">
                        {stat.attended}/{meetings.length}
                      </span>
                      <span className="text-xs text-muted">
                        ({stat.rate.toFixed(0)}%)
                      </span>
                    </div>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-card-border">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-gold/80 to-gold transition-all"
                      style={{ width: `${stat.rate}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Meeting history */}
      <div className="glass-card overflow-hidden">
        <div className="border-b border-card-border px-4 py-3 sm:px-6 sm:py-4">
          <h2 className="text-lg font-semibold text-foreground">
            Meeting History
          </h2>
        </div>

        {meetings.length === 0 ? (
          <div className="p-8 text-center">
            <CalendarCheck className="mx-auto h-10 w-10 text-muted/50" />
            <p className="mt-3 text-muted">
              No meetings recorded yet. Record your first one above.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-card-border/50">
            {meetings.map((meeting) => {
              const isExpanded = expandedId === meeting.id;
              return (
                <div key={meeting.id}>
                  <div className="flex items-center gap-3 px-4 py-3.5 sm:px-6">
                    <button
                      onClick={() =>
                        setExpandedId(isExpanded ? null : meeting.id)
                      }
                      className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {meeting.title || formatMeetingDate(meeting.meeting_date)}
                        </p>
                        <p className="mt-0.5 flex items-center gap-2 text-xs text-muted">
                          {meeting.title && (
                            <span>{formatMeetingDate(meeting.meeting_date)}</span>
                          )}
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {meeting.attendees.length} of {members.length}{" "}
                            attended
                          </span>
                        </p>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 flex-shrink-0 text-muted" />
                      ) : (
                        <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted" />
                      )}
                    </button>
                    <div className="flex flex-shrink-0 items-center gap-1">
                      <button
                        onClick={() => startEditing(meeting)}
                        className="rounded-lg p-2 text-muted transition-colors hover:bg-card hover:text-gold"
                        title="Edit meeting"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(meeting.id)}
                        disabled={deletingId === meeting.id}
                        className="rounded-lg p-2 text-muted transition-colors hover:bg-card hover:text-loss disabled:opacity-50"
                        title="Delete meeting"
                      >
                        {deletingId === meeting.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-card-border/30 bg-card/50 px-4 py-3 sm:px-6">
                      {meeting.attendees.length === 0 ? (
                        <p className="text-sm text-muted">
                          No attendees recorded.
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {meeting.attendees.map((attendee) => (
                            <span
                              key={attendee.memberstack_id}
                              className="inline-flex items-center gap-1.5 rounded-full bg-gain/10 px-2.5 py-1 text-xs font-medium text-gain"
                            >
                              <CheckCircle2 className="h-3 w-3" />
                              {attendee.member_name}
                            </span>
                          ))}
                        </div>
                      )}
                      {meeting.notes && (
                        <p className="mt-2 text-xs text-muted">{meeting.notes}</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
