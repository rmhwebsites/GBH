"use client";

import { useState } from "react";
import { Puzzle } from "lucide-react";
import type { PositionWeight } from "@/lib/analytics";
import { Section, Stat, InfoButton, Explainer } from "@/components/analytics/Section";
import { pct } from "@/components/analytics/format";
import type { GlossaryKey } from "@/lib/glossary";

/**
 * "What each holding is for" — replaces the old Top/Bottom Performers
 * leaderboard. Every holding is described by the job it does, never by how it
 * has performed: no returns, no gain/loss colours, and the order is exactly the
 * one received (largest first), never re-sorted.
 */

const JOBS: Record<string, string> = {
  VOO: "The core: the 500 largest US companies in one fund, at almost no cost.",
  SCHD: "US companies with a record of paying and growing dividends. Steadier, and a big income source.",
  AVUV: "Smaller, cheaper US companies. Historically rewarding for patient investors, with bigger swings.",
  AVDE: "Companies in developed countries outside the US: Europe, Japan, Canada, Australia.",
  AVEM: "Companies in emerging economies such as Taiwan, India, China and Brazil. More growth potential, more swings.",
  SPCX: "A single company (SpaceX). Unlike the funds, its outcome rests on one business.",
  VG: "A single company (Venture Global). Unlike the funds, its outcome rests on one business.",
};

/** One plain-English sentence for the holding's job, falling back to its category. */
function jobFor(p: PositionWeight): string {
  const known = JOBS[p.ticker.toUpperCase()];
  if (known) return known;

  if (!p.isFund) {
    const who = p.name && p.name !== p.ticker ? ` (${p.name})` : "";
    return `A single company${who}. Unlike the funds, its outcome rests on one business.`;
  }

  const c = (p.category || "").toLowerCase();
  const isUS = p.region === "US";
  const companies = isUS ? "US companies" : "companies";
  const Companies = isUS ? "US companies" : "Companies";

  if (/bond|treasury|fixed income|muni/.test(c))
    return "Loans to governments or companies. Steadier than stocks, and it pays regular interest.";
  if (c.includes("emerging") || p.region === "Emerging")
    return "Companies in emerging economies. More growth potential, more swings.";
  if (
    p.region === "Developed ex-US" ||
    c.includes("foreign") ||
    c.includes("international") ||
    c.includes("ex-us") ||
    c.includes("world ex")
  )
    return "Companies in developed countries outside the US.";
  if (c.includes("world") || c.includes("global"))
    return "Companies from all over the world, in one fund.";
  if (c.includes("real estate"))
    return "Property companies that earn rent from buildings. Often a steady income source.";
  if (c.includes("small"))
    return `Smaller ${companies}. Room to grow, with bigger swings.`;
  if (c.includes("mid"))
    return `Medium-sized ${companies}, between the giants and the small ones.`;
  if (c.includes("dividend"))
    return `${Companies} that pay regular dividends. A source of income for the fund.`;
  if (c.includes("value"))
    return `${Companies} priced cheaply compared with what they earn. Often steadier, and a source of dividends.`;
  if (c.includes("growth"))
    return `${Companies} expected to grow faster than average, with bigger swings.`;
  if (c.includes("large") || c.includes("blend"))
    return `A broad slice of large ${companies} in one fund.`;
  return "A diversified fund that spreads money across many companies.";
}

function HoldingCard({ position: p }: { position: PositionWeight }) {
  const hasYield = p.yield != null && p.yield > 0;
  const feeSub =
    p.expenseRatio != null ? undefined : p.isFund ? "not reported" : "not a fund";
  const barWidth = Math.min(100, Math.max(0, p.pctOfFund * 100));

  return (
    <li className="flex min-w-0 flex-col rounded-xl border border-card-border bg-highlight p-4">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-base font-semibold text-foreground">{p.ticker}</span>
        {!p.isFund && (
          <span className="rounded-full border border-card-border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted">
            Single company
          </span>
        )}
      </div>
      {p.name && p.name !== p.ticker && (
        <p className="mt-0.5 truncate text-xs text-muted" title={p.name}>
          {p.name}
        </p>
      )}

      <p className="mt-3 flex-1 text-sm leading-relaxed text-foreground">{jobFor(p)}</p>

      <div className="mt-4 grid grid-cols-3 gap-3 border-t border-card-border pt-3">
        <Stat label="Share of fund" value={pct(p.pctOfFund)} />
        <Stat
          label="Yearly fee"
          value={p.expenseRatio != null ? pct(p.expenseRatio, 2) : "—"}
          sub={feeSub}
        />
        {hasYield && <Stat label="Yield" value={pct(p.yield as number)} />}
      </div>

      {/* Size only — the share of the whole fund this holding makes up */}
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-card-border" aria-hidden="true">
        <div className="h-full rounded-full bg-gold" style={{ width: `${barWidth}%` }} />
      </div>
    </li>
  );
}

/** A one-line definition with its own info button, shared by every card below. */
function TermNote({ text, term, label }: { text: string; term: GlossaryKey; label: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <div className="flex items-center gap-0.5">
        <p className="text-xs text-muted">{text}</p>
        <InfoButton open={open} onToggle={() => setOpen(!open)} label={label} />
      </div>
      {open && <Explainer term={term} />}
    </div>
  );
}

export function FundRoles({ positions }: { positions: PositionWeight[] }) {
  return (
    <Section
      icon={Puzzle}
      title="What each holding is for"
      subtitle="Largest first, as a share of the whole fund (cash included)."
    >
      <p className="border-l-2 border-gold pl-3 text-sm leading-relaxed text-foreground">
        In a diversified portfolio something is always lagging — usually it&apos;s the part
        doing its job.
      </p>

      {positions.length === 0 ? (
        <p className="mt-4 text-sm text-muted">No holdings to show yet.</p>
      ) : (
        <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {positions.map((p) => (
            <HoldingCard key={p.ticker} position={p} />
          ))}
        </ul>
      )}

      {/* Definitions live here once, not on every card — an info button won't fit a phone-width card */}
      <div className="mt-4 space-y-1">
        <TermNote
          text="Yearly fee is what a fund charges each year, as a share of what's held in it."
          term="expenseRatio"
          label="yearly fee"
        />
        <TermNote
          text="Yield is the yearly dividend income a holding pays, as a share of its price."
          term="yield"
          label="yield"
        />
      </div>
    </Section>
  );
}
