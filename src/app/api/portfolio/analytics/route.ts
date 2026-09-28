import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { createServerClient } from "@/lib/supabase";
import { requireAuth, isAuthError } from "@/lib/auth";
import { getQuotes, getTotalReturnSeries } from "@/lib/yahoo";
import { getFundProfiles } from "@/lib/fundProfiles";
import { calculateIncome } from "@/lib/dividends";
import {
  computeWeights,
  computeCosts,
  computeLookThroughSectors,
  computeGeography,
  computeConcentration,
  computeDownside,
  computeDrawdown,
  computeVolatility,
  GLOBAL_REGION_WEIGHTS,
  type NavPoint,
} from "@/lib/analytics";

/** Benchmark for a globally diversified portfolio: the whole world market. */
const BENCHMARK = "VT";

// Cached so a page view never refetches a daily series that changes once a day
const benchmarkSeries = unstable_cache(
  (ticker: string, sinceIso: string) =>
    getTotalReturnSeries(ticker, new Date(sinceIso)),
  ["benchmark-series-v1"],
  { revalidate: 60 * 60 }
);

function daysBetween(a: string, b: string) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}

/**
 * Index the fund's NAV and the benchmark to 100 on the SAME start date.
 * The previous chart started each line on a different date, which made the
 * comparison meaningless.
 */
function buildComparison(nav: NavPoint[], bench: { date: string; value: number }[], start: string) {
  const fundPts = nav.filter((p) => p.date >= start);
  if (fundPts.length < 2 || bench.length === 0) return null;

  // Benchmark value on each NAV date: that day's close, or the last one before
  const benchAt = (date: string) => {
    let v: number | null = null;
    for (const b of bench) {
      if (b.date <= date) v = b.value;
      else break;
    }
    return v;
  };

  const base = benchAt(fundPts[0].date);
  if (!base) return null;
  const fund = fundPts.map((p) => ({ date: p.date, value: (p.nav / fundPts[0].nav) * 100 }));
  const benchmark = fundPts
    .map((p) => {
      const v = benchAt(p.date);
      return v ? { date: p.date, value: (v / base) * 100 } : null;
    })
    .filter((x): x is { date: string; value: number } => x !== null);

  return {
    startDate: fundPts[0].date,
    fund,
    benchmark,
    fundReturn: fund[fund.length - 1].value / 100 - 1,
    benchmarkReturn: benchmark.length ? benchmark[benchmark.length - 1].value / 100 - 1 : 0,
  };
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (isAuthError(auth)) return auth;

  try {
    const supabase = createServerClient();
    const [holdingsRes, navRes, investmentsRes, tradesRes, metaRes, subsRes] =
      await Promise.all([
        supabase.from("portfolio_holdings").select("ticker, shares").eq("is_active", true),
        supabase
          .from("nav_history")
          .select("snapshot_date, nav_per_unit, total_value, cash_balance")
          .order("snapshot_date", { ascending: true }),
        supabase.from("member_investments").select("memberstack_id, amount_invested, units_owned, investment_date"),
        supabase.from("trade_history").select("ticker, action, trade_date"),
        supabase.from("fund_metadata").select("total_units_outstanding").limit(1).single(),
        supabase.from("investment_submissions").select("status"),
      ]);

    if (holdingsRes.error) throw holdingsRes.error;
    const holdings = holdingsRes.data || [];
    const cash = Number(holdings.find((h) => h.ticker === "CASH")?.shares || 0);
    const stockRows = holdings.filter((h) => h.ticker !== "CASH" && Number(h.shares) > 0);
    const tickers = stockRows.map((h) => h.ticker);

    // ── Prices: a missing price must never silently count as $0 ───────
    const quotes = tickers.length ? await getQuotes(tickers) : [];
    const priceOf = new Map(quotes.map((q) => [q.ticker, q.price]));
    const unpriced = tickers.filter((t) => !(Number(priceOf.get(t)) > 0));
    const positions = stockRows
      .filter((h) => !unpriced.includes(h.ticker))
      .map((h) => {
        const price = Number(priceOf.get(h.ticker));
        return { ticker: h.ticker, shares: Number(h.shares), price, value: Number(h.shares) * price };
      });

    const { profiles, failed } = await getFundProfiles(tickers);

    // ── Composition ────────────────────────────────────────────────────
    const investments = investmentsRes.data || [];
    const memberCount = new Set(investments.map((i) => i.memberstack_id)).size;
    const units = investments.reduce((s, i) => s + Number(i.units_owned), 0);
    const contributed = investments.reduce((s, i) => s + Number(i.amount_invested), 0);

    const { rows, equities, fundValue } = computeWeights(positions, cash, profiles);
    const nav = units > 0 ? fundValue / units : 0;

    // ── History ────────────────────────────────────────────────────────
    const navSeries: NavPoint[] = (navRes.data || []).map((n) => ({
      date: n.snapshot_date,
      nav: Number(n.nav_per_unit),
    }));
    // Today's live point, keyed by the New York date the snapshots use
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
    if (nav > 0) {
      if (navSeries.length && navSeries[navSeries.length - 1].date === today) {
        navSeries[navSeries.length - 1].nav = nav;
      } else {
        navSeries.push({ date: today, nav });
      }
    }

    // The switch to index funds: earliest purchase of a fund held today
    const fundTickers = new Set(rows.filter((r) => r.isFund).map((r) => r.ticker));
    const rebuildDate =
      (tradesRes.data || [])
        .filter((t) => t.action === "BUY" && fundTickers.has(t.ticker))
        .map((t) => String(t.trade_date).slice(0, 10))
        .sort()[0] || null;

    // Contribution dates that fall inside the charted history
    const firstNavDate = navSeries[0]?.date || today;
    const contributionDates = [
      ...new Map(
        investments
          .map((i) => String(i.investment_date).slice(0, 10))
          .filter((d) => d >= firstNavDate)
          .map((d) => [d, d])
      ).values(),
    ].sort();

    // ── Most recent contribution batch — the cash waiting to be invested
    const byDate = new Map<string, number>();
    for (const i of investments) {
      const d = String(i.investment_date).slice(0, 10);
      byDate.set(d, (byDate.get(d) || 0) + Number(i.amount_invested));
    }
    const lastBatchDate = [...byDate.keys()].sort().pop() || null;

    // ── Benchmark ─────────────────────────────────────────────────────
    let comparison: Record<string, unknown> = {};
    try {
      const bench = await benchmarkSeries(BENCHMARK, firstNavDate);
      const threeMonths = new Date();
      threeMonths.setMonth(threeMonths.getMonth() - 3);
      comparison = {
        "3m": buildComparison(navSeries, bench, threeMonths.toISOString().slice(0, 10)),
        rebuild: rebuildDate ? buildComparison(navSeries, bench, rebuildDate) : null,
        all: buildComparison(navSeries, bench, firstNavDate),
      };
    } catch (err) {
      console.error("Benchmark series failed:", err);
    }

    const income = await calculateIncome(
      positions.map((p) => ({ ticker: p.ticker, shares: p.shares })),
      equities,
      new Date()
    );

    const payload = {
      asOf: new Date().toISOString(),
      fund: {
        value: fundValue,
        equities,
        cash,
        cashPct: fundValue > 0 ? cash / fundValue : 0,
        units,
        nav,
        memberCount,
        contributed,
        // Two DIFFERENT returns, both correct — labelled so they are not confused
        gainOnContributions: contributed > 0 ? fundValue / contributed - 1 : 0,
        navSinceFirstSnapshot:
          navSeries.length > 1 ? nav / navSeries[0].nav - 1 : 0,
        firstSnapshotDate: navSeries[0]?.date || null,
      },
      cashWaiting: {
        amount: cash,
        pctOfFund: fundValue > 0 ? cash / fundValue : 0,
        lastContributionDate: lastBatchDate,
        lastContributionAmount: lastBatchDate ? byDate.get(lastBatchDate) || 0 : 0,
        daysSince: lastBatchDate ? daysBetween(lastBatchDate, today) : null,
      },
      positions: rows,
      costs: computeCosts(rows, equities, fundValue, memberCount),
      sectors: computeLookThroughSectors(rows, profiles),
      geography: computeGeography(rows),
      globalRegionWeights: GLOBAL_REGION_WEIGHTS,
      concentration: computeConcentration(rows, profiles, equities),
      downside: computeDownside(equities, fundValue),
      drawdown: computeDrawdown(navSeries),
      volatility: computeVolatility(navSeries),
      navSeries,
      rebuildDate,
      contributionDates,
      benchmark: { ticker: BENCHMARK, comparison },
      income,
      admin: auth.isAdmin
        ? {
            unitsInLedger: units,
            unitsInMetadata: Number(metaRes.data?.total_units_outstanding || 0),
            unitsReconcile:
              Math.abs(units - Number(metaRes.data?.total_units_outstanding || 0)) < 1e-6,
            lastSnapshotDate: (navRes.data || []).slice(-1)[0]?.snapshot_date || null,
            pendingSubmissions: (subsRes.data || []).filter((s) =>
              ["pending_payment", "processing", "paid"].includes(s.status)
            ).length,
            // Surfaced rather than silently falling back — a quiet fallback is
            // exactly how the "100% Information Technology" chart survived
            failedProfiles: failed,
            unpriced,
          }
        : null,
    };

    return NextResponse.json(payload);
  } catch (err) {
    console.error("Analytics error:", err);
    return NextResponse.json({ error: "Failed to build analytics" }, { status: 500 });
  }
}
