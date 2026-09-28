"use client";

import { useState, type ReactNode } from "react";
import { Info, type LucideIcon } from "lucide-react";
import { GLOSSARY, type GlossaryKey } from "@/lib/glossary";

/**
 * Tappable info button. A 44px hit area (the minimum comfortable touch target)
 * around a small icon, toggling an inline explanation — hover tooltips don't
 * exist on phones, which is where most members read this page.
 */
export function InfoButton({
  open,
  onToggle,
  label,
}: {
  open: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-label={`What does ${label} mean?`}
      className={`-my-3 inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full transition-colors ${
        open ? "text-gold" : "text-muted hover:text-gold"
      }`}
    >
      <Info className="h-3.5 w-3.5" />
    </button>
  );
}

export function Explainer({ term }: { term: GlossaryKey }) {
  return (
    <p className="mt-2 rounded-lg bg-highlight px-3 py-2 text-xs leading-relaxed text-muted">
      {GLOSSARY[term]}
    </p>
  );
}

/** Card wrapper used by every analytics section. */
export function Section({
  icon: Icon,
  title,
  subtitle,
  info,
  children,
  action,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: ReactNode;
  info?: GlossaryKey;
  children: ReactNode;
  /** optional control rendered at the right of the header */
  action?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <section className="glass-card p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Icon className="h-4 w-4 flex-shrink-0 text-gold" />
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          {info && (
            <InfoButton open={open} onToggle={() => setOpen(!open)} label={title} />
          )}
        </div>
        {action}
      </div>
      {subtitle && <p className="mt-1 text-xs text-muted">{subtitle}</p>}
      {info && open && <Explainer term={info} />}
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** A single labelled figure, optionally with its own explanation. */
export function Stat({
  label,
  value,
  sub,
  info,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  info?: GlossaryKey;
  tone?: "default" | "gold" | "gain" | "loss";
}) {
  const [open, setOpen] = useState(false);
  const toneClass = {
    default: "text-foreground",
    gold: "text-gold",
    gain: "text-gain",
    loss: "text-loss",
  }[tone];
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-0.5">
        <p className="text-xs text-muted">{label}</p>
        {info && (
          <InfoButton open={open} onToggle={() => setOpen(!open)} label={label} />
        )}
      </div>
      <p className={`text-lg font-semibold tabular-nums ${toneClass}`}>{value}</p>
      {sub && <p className="text-xs text-muted">{sub}</p>}
      {info && open && <Explainer term={info} />}
    </div>
  );
}
