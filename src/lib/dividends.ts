import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance();

/**
 * Distribution history is used to project what the CURRENT portfolio will pay.
 * Funds distribute quarterly, so this data changes only a few times a year —
 * a long cache is appropriate and keeps the analytics page fast.
 */
const CACHE_MS = 12 * 60 * 60 * 1000;
const divCache = new Map<string, { data: DividendEvent[]; timestamp: number }>();

export interface DividendEvent {
  /** Ex-dividend date, ISO yyyy-mm-dd */
  date: string;
  /** Dividend per share */
  perShare: number;
}

export interface MonthlyIncome {
  /** yyyy-mm */
  month: string;
  label: string;
  total: number;
  /** projected income from each ticker paying in this month */
  byTicker: Record<string, number>;
}

export interface IncomeSummary {
  months: MonthlyIncome[];
  annualTotal: number;
  /** projected annual income as a share of current invested value */
  yieldPercent: number;
  perHolding: {
    ticker: string;
    shares: number;
    annualIncome: number;
    paymentsPerYear: number;
  }[];
  nonPaying: string[];
  /** soonest projected payment, for a "next payment" callout */
  nextPayment: { month: string; label: string; amount: number } | null;
}

/** Ex-dividend events for a ticker over the trailing window. */
export async function getDividendHistory(
  ticker: string,
  since: Date
): Promise<DividendEvent[]> {
  const cached = divCache.get(ticker);
  if (cached && Date.now() - cached.timestamp < CACHE_MS) {
    return cached.data;
  }

  try {
    const chart = await yahooFinance.chart(ticker, {
      period1: since,
      interval: "1d",
      events: "div",
    });
    const data: DividendEvent[] = (chart.events?.dividends || []).map((d) => ({
      date: new Date(d.date).toISOString().slice(0, 10),
      perShare: d.amount,
    }));
    divCache.set(ticker, { data, timestamp: Date.now() });
    return data;
  } catch {
    // A ticker with no distributions (or a failed lookup) simply contributes
    // no income — it must never break the whole chart.
    return [];
  }
}

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * Projected income for the NEXT 12 months from the holdings owned today.
 *
 * The portfolio was assembled recently, so what it received in the past is not
 * its income — those positions were not held. Instead each fund's distribution
 * calendar is projected forward at today's share counts.
 *
 * Projection is per calendar month, not a flat quarterly average, because
 * distributions are seasonal: AVDE paid $1.166/share in June and $0.325 in
 * September. Each future month therefore uses the most recent distribution
 * from that same month of the year, preserving the real shape of the income.
 */
export async function calculateIncome(
  holdings: { ticker: string; shares: number }[],
  portfolioValue: number,
  now: Date
): Promise<IncomeSummary> {
  // 14 months back guarantees at least one observation of every calendar
  // month a quarterly payer uses
  const since = new Date(now);
  since.setMonth(since.getMonth() - 14);

  const buckets: MonthlyIncome[] = [];
  for (let i = 1; i <= 12; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + i, 1));
    buckets.push({
      month: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`,
      label: `${MONTH_LABELS[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}`,
      total: 0,
      byTicker: {},
    });
  }

  const perHolding: IncomeSummary["perHolding"] = [];
  const nonPaying: string[] = [];

  for (const h of holdings) {
    const events = await getDividendHistory(h.ticker, since);
    if (events.length === 0) {
      nonPaying.push(h.ticker);
      continue;
    }

    // Most recent per-share amount for each calendar month this fund pays in.
    // Events arrive oldest-first, so a later year overwrites an earlier one.
    const byCalendarMonth = new Map<number, number>();
    for (const e of events) {
      byCalendarMonth.set(Number(e.date.slice(5, 7)) - 1, e.perShare);
    }

    let annual = 0;
    let payments = 0;
    for (const bucket of buckets) {
      const monthIndex = Number(bucket.month.slice(5, 7)) - 1;
      const perShare = byCalendarMonth.get(monthIndex);
      if (perShare == null) continue;
      const amount = h.shares * perShare;
      bucket.total += amount;
      bucket.byTicker[h.ticker] = (bucket.byTicker[h.ticker] || 0) + amount;
      annual += amount;
      payments++;
    }

    perHolding.push({
      ticker: h.ticker,
      shares: h.shares,
      annualIncome: annual,
      paymentsPerYear: payments,
    });
  }

  const annualTotal = buckets.reduce((s, m) => s + m.total, 0);
  const next = buckets.find((m) => m.total > 0) || null;

  return {
    months: buckets,
    annualTotal,
    yieldPercent: portfolioValue > 0 ? (annualTotal / portfolioValue) * 100 : 0,
    perHolding: perHolding.sort((a, b) => b.annualIncome - a.annualIncome),
    nonPaying,
    nextPayment: next
      ? { month: next.month, label: next.label, amount: next.total }
      : null,
  };
}
