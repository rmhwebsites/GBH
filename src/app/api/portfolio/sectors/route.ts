import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { requireAuth, isAuthError } from "@/lib/auth";
import { getQuotes } from "@/lib/yahoo";
import { getFundProfiles } from "@/lib/fundProfiles";
import { computeWeights } from "@/lib/analytics";

/**
 * Sector exposure seen through the funds, for the main dashboard's sector
 * chart. Each fund contributes its own sector split weighted by its size, so
 * an S&P 500 fund shows up across all eleven sectors instead of as one ticker.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (isAuthError(auth)) return auth;

  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("portfolio_holdings")
      .select("ticker, shares")
      .eq("is_active", true);
    if (error) throw error;

    const stocks = (data || []).filter((h) => h.ticker !== "CASH" && Number(h.shares) > 0);
    const tickers = stocks.map((h) => h.ticker);
    if (tickers.length === 0) return NextResponse.json({ sectors: [] });

    const quotes = await getQuotes(tickers);
    const priceOf = new Map(quotes.map((q) => [q.ticker, q.price]));
    const positions = stocks
      .filter((h) => Number(priceOf.get(h.ticker)) > 0)
      .map((h) => {
        const price = Number(priceOf.get(h.ticker));
        return { ticker: h.ticker, shares: Number(h.shares), price, value: Number(h.shares) * price };
      });

    const { profiles } = await getFundProfiles(tickers);
    const { rows, equities } = computeWeights(positions, 0, profiles);

    const acc = new Map<string, { weight: number; via: Set<string> }>();
    for (const r of rows) {
      const sectors = profiles.get(r.ticker)?.sectors;
      const split =
        sectors && Object.keys(sectors).length > 0 ? sectors : { Unclassified: 1 };
      for (const [sector, w] of Object.entries(split)) {
        const e = acc.get(sector) || { weight: 0, via: new Set<string>() };
        e.weight += w * r.pctOfEquities;
        e.via.add(r.ticker);
        acc.set(sector, e);
      }
    }

    const sectors = [...acc.entries()]
      .map(([sector, e]) => ({
        sector,
        weight: e.weight * 100, // percent, matching the chart's existing convention
        value: e.weight * equities,
        tickers: [...e.via],
      }))
      .sort((a, b) => b.weight - a.weight);

    return NextResponse.json({ sectors });
  } catch (err) {
    console.error("Sector look-through failed:", err);
    return NextResponse.json({ error: "Failed to build sectors" }, { status: 500 });
  }
}
