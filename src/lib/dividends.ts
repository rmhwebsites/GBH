import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance();

/**
 * Distribution history is used to show what the CURRENT portfolio yields month
 * by month. Funds distribute quarterly, so this data changes a few times a year
 * — a long cache is appropriate and keeps the analytics page fast.
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
  /** income contributed by each ticker that paid in this month */
  byTicker: Record<string, number>;
}

export interface IncomeSummary {
  months: MonthlyIncome[];
  annualTotal: number;
  /** annual income as a share of the portfolio's current market value */
  yieldPercent: number;
  perHolding: {
    ticker: string;
    shares: number;
    annualIncome: number;
    paymentsPerYear: number;
  }[];
  nonPaying: string[];
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
 * Income the CURRENT holdings generate, month by month.
 *
 * Each fund's own distribution history over the trailing year is applied to the
 * shares held today, so the result answers "what does this portfolio pay, and
 * when" rather than "what did we historically receive" — the portfolio was only
 * recently assembled, so actual receipts would be nearly empty and misleading.
 *
 * Distributions are quarterly and uneven, so the monthly shape matters: an
 * average would hide that December pays roughly double March.
 */
export async function calculateIncome(
  holdings: { ticker: string; shares: number }[],
  portfolioValue: number,
  now: Date
): Promise<IncomeSummary> {
  // 13 months back so the trailing four quarters are always fully covered
  const since = new Date(now);
  since.setMonth(since.getMonth() - 13);

  const buckets = new Map<string, MonthlyIncome>();
  const perHolding: IncomeSummary["perHolding"] = [];
  const nonPaying: string[] = [];

  // Twelve month buckets ending with the current month, so the chart always
  // spans a full year even for funds that skip a quarter
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    buckets.set(key, {
      month: key,
      label: `${MONTH_LABELS[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}`,
      total: 0,
      byTicker: {},
    });
  }

  for (const h of holdings) {
    const events = await getDividendHistory(h.ticker, since);
    if (events.length === 0) {
      nonPaying.push(h.ticker);
      continue;
    }

    let annual = 0;
    let payments = 0;
    for (const e of events) {
      const key = e.date.slice(0, 7);
      const bucket = buckets.get(key);
      if (!bucket) continue; // outside the 12-month window
      const amount = h.shares * e.perShare;
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

  const months = [...buckets.values()];
  const annualTotal = months.reduce((s, m) => s + m.total, 0);

  return {
    months,
    annualTotal,
    yieldPercent: portfolioValue > 0 ? (annualTotal / portfolioValue) * 100 : 0,
    perHolding: perHolding.sort((a, b) => b.annualIncome - a.annualIncome),
    nonPaying,
  };
}
