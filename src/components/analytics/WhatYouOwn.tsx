"use client";

import { useState, type ReactNode } from "react";
import { Layers } from "lucide-react";
import type { AnalyticsPayload } from "@/types/analytics";
import type { Concentration } from "@/lib/analytics";
import type { Region } from "@/lib/fundProfiles";
import type { GlossaryKey } from "@/lib/glossary";
import { Section, Stat, InfoButton, Explainer } from "./Section";
import { pct, money } from "./format";

/**
 * The look-through: what the club owns once you see inside each fund.
 *
 * Colour scheme is about HOW the money is held, never how it performed:
 * gold = spread across a fund, foreground = riding on one company.
 */

type TopName = Concentration["topNames"][number];

const DIRECT = "held directly";

const REGIONS: Region[] = ["US", "Developed ex-US", "Emerging"];

const REGION_LABEL: Record<Region | "Unclassified", { label: string; hint?: string }> = {
  US: { label: "United States" },
  "Developed ex-US": { label: "Other developed markets", hint: "Europe, Japan, Canada, Australia" },
  Emerging: { label: "Emerging markets", hint: "China, India, Taiwan, Brazil" },
  Unclassified: { label: "Unclassified", hint: "No region data for these holdings" },
};

const COUNT_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];

function countWord(n: number): string {
  return COUNT_WORDS[n] ?? String(n);
}

/** ["A","B","C"] -> "A, B and C" */
function joinList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function isDirect(n: TopName): boolean {
  return n.via.includes(DIRECT);
}

function viaLabel(via: string[]): string {
  const funds = via.filter((v) => v !== DIRECT);
  const parts: string[] = [];
  if (via.includes(DIRECT)) parts.push("Held directly");
  if (funds.length > 0) parts.push(`via ${funds.join(", ")}`);
  return parts.join(" · ");
}

/** Bar width as a CSS percentage, clamped so rounding never overflows the track. */
function barWidth(value: number, scale: number): string {
  if (!(scale > 0) || !(value > 0)) return "0%";
  return `${Math.min(100, (value / scale) * 100)}%`;
}

function BlockHeading({
  title,
  aside,
  info,
}: {
  title: string;
  aside?: ReactNode;
  info?: GlossaryKey;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-0.5">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {info && <InfoButton open={open} onToggle={() => setOpen(!open)} label={title} />}
        </div>
        {aside && <span className="flex-shrink-0 text-xs text-muted">{aside}</span>}
      </div>
      {info && open && <Explainer term={info} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 1. Sectors                                                           */
/* ------------------------------------------------------------------ */

function Sectors({ sectors }: { sectors: AnalyticsPayload["sectors"] }) {
  const max = sectors.reduce((m, s) => Math.max(m, s.weight), 0);
  const hasUnclassified = sectors.some((s) => s.sector === "Unclassified" && s.weight > 0);

  return (
    <div className="min-w-0">
      <BlockHeading title="Sectors, seen through the funds" aside="% of invested money" />
      {sectors.length === 0 ? (
        <p className="mt-3 text-sm text-muted">No sector data is available yet.</p>
      ) : (
        <>
          <ul className="mt-3 space-y-2.5">
            {sectors.map((s) => {
              const unclassified = s.sector === "Unclassified";
              return (
                <li key={s.sector} className="min-w-0">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span
                      className={`min-w-0 truncate ${unclassified ? "italic text-muted" : "text-foreground"}`}
                    >
                      {s.sector}
                    </span>
                    <span className="flex-shrink-0 tabular-nums text-foreground">{pct(s.weight)}</span>
                  </div>
                  <div className="mt-1 h-1.5" aria-hidden="true">
                    <div
                      className={`h-full rounded-full ${unclassified ? "bg-muted" : "bg-gold"}`}
                      style={{ width: barWidth(s.weight, max) }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-xs leading-relaxed text-muted">
            Each fund&apos;s own sector split, weighted by how much of the invested money sits in
            that fund. Bars are drawn relative to the largest sector.
            {hasUnclassified &&
              " “Unclassified” is money in holdings with no sector data — shown rather than guessed, so the total still adds up."}
          </p>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 2. Geography                                                         */
/* ------------------------------------------------------------------ */

function CompareBar({
  label,
  value,
  barClass,
  approx = false,
}: {
  label: string;
  value: number | null;
  barClass: string;
  approx?: boolean;
}) {
  return (
    <div className="grid grid-cols-[5.75rem_minmax(0,1fr)_3.25rem] items-center gap-2 text-xs">
      <span className="text-muted">{label}</span>
      <div className="h-1.5 overflow-hidden rounded-full bg-card-border" aria-hidden="true">
        {value != null && (
          <div className={`h-full rounded-full ${barClass}`} style={{ width: barWidth(value, 1) }} />
        )}
      </div>
      <span className="text-right tabular-nums text-foreground">
        {value == null ? "—" : approx ? `~${pct(value, 0)}` : pct(value)}
      </span>
    </div>
  );
}

function Geography({
  geography,
  globalRegionWeights,
}: {
  geography: AnalyticsPayload["geography"];
  globalRegionWeights: AnalyticsPayload["globalRegionWeights"];
}) {
  const ours = (r: Region | "Unclassified") =>
    geography.find((g) => g.region === r)?.weight ?? 0;

  // Every world region is listed, even ones the fund holds none of.
  const rows: { region: Region | "Unclassified"; ours: number; world: number | null }[] =
    REGIONS.map((r) => ({ region: r, ours: ours(r), world: globalRegionWeights[r] ?? null }));
  const unclassified = ours("Unclassified");
  if (unclassified > 0) rows.push({ region: "Unclassified", ours: unclassified, world: null });

  const usOurs = ours("US");
  const usWorld = globalRegionWeights.US;
  const gap = usOurs - usWorld;
  // One percentage point either way counts as "in line" — the world weights are approximate.
  const note =
    geography.length === 0
      ? null
      : gap > 0.01
        ? `The fund holds more US companies than the world market does: ${pct(usOurs)} here against roughly ${pct(usWorld, 0)} of the world. That is a choice, not an error — plenty of investors deliberately lean toward their home market.`
        : gap < -0.01
          ? `The fund holds fewer US companies than the world market does: ${pct(usOurs)} here against roughly ${pct(usWorld, 0)} of the world. That is a choice, not an error.`
          : `The fund's US share is close to the world market's: ${pct(usOurs)} here against roughly ${pct(usWorld, 0)} of the world.`;

  return (
    <div className="min-w-0">
      <BlockHeading title="Where the companies are based" aside="% of invested money" />
      {geography.length === 0 ? (
        <p className="mt-3 text-sm text-muted">No region data is available yet.</p>
      ) : (
        <>
          <ul className="mt-3 space-y-4">
            {rows.map((row) => {
              const meta = REGION_LABEL[row.region];
              return (
                <li key={row.region} className="min-w-0">
                  <p className="text-sm text-foreground">
                    {meta.label}
                    {meta.hint && <span className="ml-1.5 text-xs text-muted">{meta.hint}</span>}
                  </p>
                  <div className="mt-1.5 space-y-1">
                    <CompareBar label="Us" value={row.ours} barClass="bg-gold" />
                    <CompareBar
                      label="World market"
                      value={row.world}
                      barClass="bg-muted"
                      approx
                    />
                  </div>
                </li>
              );
            })}
          </ul>
          {note && <p className="mt-4 text-sm leading-relaxed tabular-nums text-foreground">{note}</p>}
          <p className="mt-2 text-xs leading-relaxed text-muted">
            World-market weights are approximate shares of all listed companies by value, shown for
            context only.
          </p>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 3. Concentration                                                     */
/* ------------------------------------------------------------------ */

function TopNamesTable({ topNames }: { topNames: TopName[] }) {
  const max = topNames.reduce((m, n) => Math.max(m, n.pctOfEquities), 0);
  const cols = "sm:grid-cols-[minmax(0,1fr)_6.5rem_5.5rem_9rem]";

  return (
    <div className="mt-3" role="table" aria-label="Largest single-company exposures">
      <div
        role="row"
        className={`hidden gap-x-3 border-b border-card-border pb-2 text-xs text-muted sm:grid ${cols}`}
      >
        <span role="columnheader">Company</span>
        <span role="columnheader" className="text-right">
          % of invested
        </span>
        <span role="columnheader" className="text-right">
          Value
        </span>
        <span role="columnheader">Held through</span>
      </div>
      <div role="rowgroup" className="divide-y divide-card-border">
        {topNames.map((n) => {
          const direct = isDirect(n);
          return (
            <div
              key={n.symbol}
              role="row"
              className={`grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5 py-2.5 ${cols} ${
                direct ? "-mx-2 rounded-lg bg-highlight px-2" : ""
              }`}
            >
              <div role="cell" className="col-start-1 row-start-1 flex min-w-0 items-baseline gap-1.5">
                <span className="min-w-0 truncate text-sm text-foreground">{n.name}</span>
                <span className="flex-shrink-0 text-xs text-muted">{n.symbol}</span>
              </div>
              <span
                role="cell"
                className="col-start-2 row-start-1 text-right text-sm font-semibold tabular-nums text-foreground"
              >
                {pct(n.pctOfEquities)}
              </span>
              <span
                role="cell"
                className="col-start-2 row-start-2 text-right text-xs tabular-nums text-muted sm:col-start-3 sm:row-start-1 sm:text-sm"
              >
                {money(n.value, 0)}
              </span>
              <span
                role="cell"
                className="col-start-1 row-start-2 min-w-0 text-xs sm:col-start-4 sm:row-start-1 sm:self-center"
              >
                {direct ? (
                  <span className="inline-flex items-center rounded-full border border-foreground px-2 py-0.5 text-[11px] font-medium text-foreground">
                    {viaLabel(n.via)}
                  </span>
                ) : (
                  <span className="text-muted">{viaLabel(n.via)}</span>
                )}
              </span>
              <div
                className="col-span-2 row-start-3 mt-1 h-1 sm:col-span-4 sm:row-start-2"
                aria-hidden="true"
              >
                <div
                  className={`h-full rounded-full ${direct ? "bg-foreground" : "bg-gold"}`}
                  style={{ width: barWidth(n.pctOfEquities, max) }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ConcentrationBlock({
  concentration,
  positions,
}: {
  concentration: Concentration;
  positions?: AnalyticsPayload["positions"];
}) {
  const { inFunds, inSingleStocks, singleStocks, topNames, coverage } = concentration;
  const nSingle = singleStocks.length;

  // Which of the largest exposures are single stocks rather than names inside a fund?
  const firstInFundIdx = topNames.findIndex((n) => !isDirect(n));
  const leadingDirect = firstInFundIdx === -1 ? topNames : topNames.slice(0, firstInFundIdx);
  const largestInFund = firstInFundIdx === -1 ? null : topNames[firstInFundIdx];

  let leadNote: string | null = null;
  if (leadingDirect.length > 0) {
    const symbols = joinList(leadingDirect.map((n) => n.symbol));
    leadNote =
      leadingDirect.length === 1
        ? `The largest single-company exposure is ${symbols}, a stock the club holds directly — not one of the giant companies inside the funds.`
        : `The ${countWord(leadingDirect.length)} largest single-company exposures are ${symbols}, stocks the club holds directly — not the giant companies inside the funds.`;
    if (largestInFund) {
      leadNote += ` The biggest company inside the funds, ${largestInFund.name}, is ${pct(largestInFund.pctOfEquities)} of invested money.`;
    }
  } else if (largestInFund) {
    const funds = largestInFund.via.filter((v) => v !== DIRECT);
    leadNote = `The largest single-company exposure is ${largestInFund.name} at ${pct(largestInFund.pctOfEquities)} of invested money, reached through ${joinList(funds)}.`;
  }

  // VOO: large as a position, but ~500 companies. Only mentioned if the fund holds it.
  const voo = positions?.find((p) => p.ticker === "VOO");
  const holdsVoo = !!voo || topNames.some((n) => n.via.includes("VOO"));
  // The lead note above the table already quotes the biggest company inside the
  // funds, so the VOO note makes the point without repeating the figure.
  const vooNote = holdsVoo
    ? `${voo ? `VOO is ${pct(voo.pctOfEquities)} of invested money, but that` : "A large holding in VOO"} isn’t a concentration risk: VOO holds about 500 of the largest US companies in one fund, so no single company inside it carries much weight.`
    : null;

  if (nSingle === 0 && topNames.length === 0) {
    return (
      <div className="min-w-0">
        <BlockHeading title="How much rides on one company?" info="concentration" />
        <p className="mt-3 text-sm text-muted">No holdings data is available to look through yet.</p>
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <BlockHeading title="How much rides on one company?" info="concentration" />

      <p className="mt-2 text-base leading-relaxed text-foreground">
        <span className="font-semibold tabular-nums text-gold">{pct(inFunds)}</span> of the invested
        money is spread across funds holding thousands of companies.{" "}
        {nSingle > 0 ? (
          <>
            <span className="font-semibold tabular-nums">{pct(inSingleStocks)}</span> is in{" "}
            <span className="tabular-nums">{nSingle}</span> individual{" "}
            {nSingle === 1 ? "company" : "companies"}.
          </>
        ) : (
          "None of it rests on an individual company."
        )}
      </p>

      {/* Funds vs single companies */}
      <div
        className="mt-3 flex h-2.5 w-full overflow-hidden rounded-full bg-card-border"
        aria-hidden="true"
      >
        <div className="h-full bg-gold" style={{ width: barWidth(inFunds, 1) }} />
        <div className="h-full bg-foreground" style={{ width: barWidth(inSingleStocks, 1) }} />
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-gold" aria-hidden="true" />
          In funds <span className="tabular-nums text-foreground">{pct(inFunds)}</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-foreground" aria-hidden="true" />
          Individual companies{" "}
          <span className="tabular-nums text-foreground">{pct(inSingleStocks)}</span>
        </span>
      </div>

      {nSingle > 0 && (
        <div className="mt-4 rounded-xl border border-card-border bg-highlight p-4">
          <p className="text-sm font-medium text-foreground">
            Held directly: {joinList(singleStocks.map((s) => `${s.name} (${s.ticker})`))}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            {nSingle === 1
              ? "This is the one place where the club’s money rides entirely on a single company. If it has a bad year, there’s nothing else inside it to soften the fall."
              : "These are the places where the club’s money rides entirely on a single company. If one has a bad year, there’s nothing else inside it to soften the fall — inside a fund, one company’s trouble is a small slice of the whole."}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {singleStocks.map((s) => (
              <Stat
                key={s.ticker}
                label={s.ticker}
                value={pct(s.pctOfEquities)}
                sub={`${money(s.value, 0)} of invested money`}
              />
            ))}
          </div>
        </div>
      )}

      {topNames.length > 0 && (
        <div className="mt-5">
          <BlockHeading title="Largest single-company exposures" aside="% of invested money" />
          <p className="mt-1 text-xs leading-relaxed text-muted">
            Each company counted once, whether owned directly or through a fund. Ranked by size.
          </p>
          {leadNote && (
            <p className="mt-3 text-sm leading-relaxed tabular-nums text-foreground">{leadNote}</p>
          )}
          <TopNamesTable topNames={topNames} />
        </div>
      )}

      {vooNote && (
        <p className="mt-4 text-sm leading-relaxed tabular-nums text-foreground">{vooNote}</p>
      )}

      <p className="mt-3 text-xs leading-relaxed text-muted">
        Built from the largest holdings each fund reports (usually its top 10)
        {nSingle > 0 ? " plus the stocks the club holds directly" : ""}, which account for{" "}
        <span className="tabular-nums">{pct(coverage)}</span> of invested money. The rest is spread
        across thousands of smaller positions.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function WhatYouOwn({
  sectors,
  geography,
  globalRegionWeights,
  concentration,
  positions,
}: {
  sectors: AnalyticsPayload["sectors"];
  geography: AnalyticsPayload["geography"];
  globalRegionWeights: AnalyticsPayload["globalRegionWeights"];
  concentration: Concentration;
  /** Optional: lets the VOO note quote VOO's actual share of invested money. */
  positions?: AnalyticsPayload["positions"];
}) {
  return (
    <Section
      icon={Layers}
      title="What you actually own"
      info="lookThrough"
      subtitle="Looking through each fund to the companies, sectors and countries inside it. Percentages are of invested money — cash is left out."
    >
      <div className="grid gap-8 lg:grid-cols-2">
        <Sectors sectors={sectors} />
        <Geography geography={geography} globalRegionWeights={globalRegionWeights} />
      </div>
      <div className="mt-8 border-t border-card-border pt-6">
        <ConcentrationBlock concentration={concentration} positions={positions} />
      </div>
    </Section>
  );
}
