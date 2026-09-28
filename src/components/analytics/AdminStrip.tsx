"use client";

import { useId, useState, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, ChevronDown, ShieldCheck } from "lucide-react";
import type { AnalyticsPayload } from "@/types/analytics";
import { Section } from "./Section";
import { shortDate } from "./format";

type Admin = NonNullable<AnalyticsPayload["admin"]>;

/** Units carry fractional precision; format.ts has no helper for them. */
function unitCount(x: number): string {
  return x.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

interface Check {
  key: string;
  label: string;
  ok: boolean;
  detail: ReactNode;
}

function TickerList({ tickers }: { tickers: string[] }) {
  return (
    <ul className="mt-1.5 flex flex-wrap gap-1.5">
      {tickers.map((t) => (
        <li
          key={t}
          className="rounded bg-highlight px-1.5 py-0.5 font-mono text-xs text-foreground"
        >
          {t}
        </li>
      ))}
    </ul>
  );
}

function buildChecks(admin: Admin): Check[] {
  const unitsGap = admin.unitsInLedger - admin.unitsInMetadata;
  return [
    {
      key: "units",
      label: "Units reconcile",
      ok: admin.unitsReconcile,
      detail: (
        <>
          <span className="tabular-nums">{unitCount(admin.unitsInLedger)}</span> in
          the ledger vs{" "}
          <span className="tabular-nums">{unitCount(admin.unitsInMetadata)}</span> on
          record
          {!admin.unitsReconcile && (
            <>
              {" "}
              — off by{" "}
              <span className="tabular-nums">{unitCount(Math.abs(unitsGap))}</span>{" "}
              units
            </>
          )}
        </>
      ),
    },
    {
      key: "snapshot",
      label: "Last NAV snapshot",
      ok: admin.lastSnapshotDate !== null,
      detail: admin.lastSnapshotDate ? (
        <span className="tabular-nums">{shortDate(admin.lastSnapshotDate)}</span>
      ) : (
        "No snapshot has been recorded"
      ),
    },
    {
      key: "pending",
      label: "Contributions awaiting processing",
      ok: admin.pendingSubmissions === 0,
      detail:
        admin.pendingSubmissions === 0 ? (
          "None waiting"
        ) : (
          <>
            <span className="tabular-nums">
              {admin.pendingSubmissions.toLocaleString("en-US")}
            </span>{" "}
            {plural(admin.pendingSubmissions, "submission is", "submissions are")}{" "}
            waiting to be turned into units
          </>
        ),
    },
    {
      key: "profiles",
      label: "Holdings without fund data",
      ok: admin.failedProfiles.length === 0,
      detail:
        admin.failedProfiles.length === 0 ? (
          "Every holding has sector and region data"
        ) : (
          <>
            Fund data failed to load — these show as Unclassified in the sector
            and region breakdowns
            <TickerList tickers={admin.failedProfiles} />
          </>
        ),
    },
    {
      key: "unpriced",
      label: "Holdings without a live price",
      ok: admin.unpriced.length === 0,
      detail:
        admin.unpriced.length === 0 ? (
          "Every holding is priced"
        ) : (
          <>
            Excluded from the fund&apos;s value until a price comes through, so
            the value shown is understated
            <TickerList tickers={admin.unpriced} />
          </>
        ),
    },
  ];
}

/**
 * System health checks for admins. Collapsed by default, but the number of
 * problems is always visible in the header — failures surface instead of
 * being hidden behind a quiet fallback.
 */
export function AdminStrip({ admin }: { admin: AnalyticsPayload["admin"] }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  if (!admin) return null;

  const checks = buildChecks(admin);
  const attention = checks.filter((c) => !c.ok).length;

  const status =
    attention > 0 ? (
      <span className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-full bg-highlight px-2.5 py-1 text-xs font-medium text-loss">
        <AlertCircle aria-hidden className="h-3.5 w-3.5" />
        <span className="tabular-nums">{attention}</span>{" "}
        {plural(attention, "needs", "need")} attention
      </span>
    ) : (
      <span className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-full bg-highlight px-2.5 py-1 text-xs font-medium text-gain">
        <CheckCircle2 aria-hidden className="h-3.5 w-3.5" />
        All clear
      </span>
    );

  return (
    <Section
      icon={ShieldCheck}
      title="Admin checks"
      subtitle="Only admins see this. Problems show up here instead of being hidden."
      action={status}
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg bg-highlight px-4 py-3 text-left text-sm font-medium text-foreground transition-colors hover:text-gold"
      >
        <span>
          {open ? "Hide" : "Show"}{" "}
          <span className="tabular-nums">{checks.length}</span> checks
        </span>
        <ChevronDown
          aria-hidden
          className={`h-4 w-4 flex-shrink-0 text-muted transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      <ul id={panelId} hidden={!open} className="mt-3 divide-y divide-card-border">
        {checks.map((c) => (
          <li key={c.key} className="flex items-start gap-3 py-3">
            {c.ok ? (
              <CheckCircle2 aria-hidden className="mt-0.5 h-4 w-4 flex-shrink-0 text-gain" />
            ) : (
              <AlertCircle aria-hidden className="mt-0.5 h-4 w-4 flex-shrink-0 text-loss" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">
                {c.label}
                <span className="sr-only">{c.ok ? " — OK" : " — needs attention"}</span>
              </p>
              <div className="mt-0.5 break-words text-xs leading-relaxed text-muted">
                {c.detail}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}
