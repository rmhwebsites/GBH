import YahooFinance from "yahoo-finance2";
import { unstable_cache } from "next/cache";

const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

export type Region = "US" | "Developed ex-US" | "Emerging";

export interface FundProfile {
  ticker: string;
  name: string;
  /** "ETF" | "MUTUALFUND" for funds; "EQUITY" for a single company */
  quoteType: string;
  isFund: boolean;
  /** decimal, e.g. 0.0003 for 0.03% — null for single stocks */
  expenseRatio: number | null;
  category: string | null;
  /** trailing distribution yield, decimal */
  yield: number | null;
  /** display sector name -> weight, renormalised to sum to 1 */
  sectors: Record<string, number>;
  /** top holdings as reported by the fund (usually ten) */
  topHoldings: { symbol: string; name: string; weight: number }[];
  /** true price-to-book (Yahoo reports its reciprocal — see below) */
  priceToBook: number | null;
  region: Region;
}

// Yahoo's fund sector keys -> the names members recognise
const FUND_SECTORS: Record<string, string> = {
  realestate: "Real Estate",
  consumer_cyclical: "Consumer Discretionary",
  basic_materials: "Materials",
  consumer_defensive: "Consumer Staples",
  technology: "Information Technology",
  communication_services: "Communication Services",
  financial_services: "Financials",
  utilities: "Utilities",
  industrials: "Industrials",
  energy: "Energy",
  healthcare: "Health Care",
};

// Yahoo's company-profile sector names -> the same display names
const COMPANY_SECTORS: Record<string, string> = {
  "Real Estate": "Real Estate",
  "Consumer Cyclical": "Consumer Discretionary",
  "Basic Materials": "Materials",
  "Consumer Defensive": "Consumer Staples",
  Technology: "Information Technology",
  "Communication Services": "Communication Services",
  "Financial Services": "Financials",
  Utilities: "Utilities",
  Industrials: "Industrials",
  Energy: "Energy",
  Healthcare: "Health Care",
};

function regionFor(category: string | null, country: string | null): Region {
  const c = (category || "").toLowerCase();
  if (c.includes("emerging")) return "Emerging";
  if (c.includes("foreign") || c.includes("international") || c.includes("world ex"))
    return "Developed ex-US";
  if (country && country !== "United States") return "Developed ex-US";
  return "US";
}

export async function fetchFundProfile(ticker: string): Promise<FundProfile> {
  const r = await yahooFinance.quoteSummary(ticker, {
    modules: ["price", "fundProfile", "topHoldings", "summaryDetail", "summaryProfile"],
  });

  const quoteType = r.price?.quoteType || "EQUITY";
  const isFund = quoteType === "ETF" || quoteType === "MUTUALFUND";
  const category = r.fundProfile?.categoryName || null;

  const sectors: Record<string, number> = {};
  if (isFund) {
    // Yahoo returns one single-key object per sector
    for (const entry of r.topHoldings?.sectorWeightings || []) {
      for (const [key, value] of Object.entries(entry)) {
        const name = FUND_SECTORS[key];
        if (name && typeof value === "number" && value > 0) {
          sectors[name] = (sectors[name] || 0) + value;
        }
      }
    }
    // Fund sector weights frequently fall short of 1.0 because of a cash or
    // bond residual. Renormalise so a fund's equity exposure sums to 100% —
    // otherwise the portfolio look-through drifts off 100%.
    const sum = Object.values(sectors).reduce((a, b) => a + b, 0);
    if (sum > 0) for (const k of Object.keys(sectors)) sectors[k] /= sum;
  } else {
    // A single company is 100% its own sector
    const name = COMPANY_SECTORS[r.summaryProfile?.sector || ""];
    if (name) sectors[name] = 1;
  }

  const topHoldings = (r.topHoldings?.holdings || [])
    .filter((h) => h.symbol && typeof h.holdingPercent === "number")
    .map((h) => ({
      symbol: h.symbol as string,
      name: (h.holdingName as string) || (h.symbol as string),
      weight: h.holdingPercent as number,
    }));

  // Yahoo's fund priceToBook field is the reciprocal (e.g. 0.19 for an index
  // trading at 5.3x book). Invert it to the figure people actually quote.
  const rawPb = r.topHoldings?.equityHoldings?.priceToBook;
  const priceToBook =
    isFund && typeof rawPb === "number" && rawPb > 0 ? 1 / rawPb : null;

  const expense = r.fundProfile?.feesExpensesInvestment?.annualReportExpenseRatio;
  const dividendYield = r.summaryDetail?.yield;

  return {
    ticker,
    name: r.price?.longName || r.price?.shortName || ticker,
    quoteType,
    isFund,
    expenseRatio: isFund && typeof expense === "number" ? expense : null,
    category: isFund ? category : r.summaryProfile?.sector || null,
    yield: typeof dividendYield === "number" ? dividendYield : null,
    sectors,
    topHoldings,
    priceToBook,
    region: regionFor(category, isFund ? null : r.summaryProfile?.country || null),
  };
}

/**
 * Fund metadata changes monthly at most, and fetching it is slow and
 * rate-limited. unstable_cache persists across serverless invocations and
 * cold starts (unlike an in-memory Map), without needing a database table.
 *
 * A failed fetch throws and is therefore NOT cached — caching a failure for a
 * day would silently hide a holding from the look-through.
 */
export const getFundProfile = unstable_cache(fetchFundProfile, ["fund-profile-v1"], {
  revalidate: 60 * 60 * 24,
});

/** Profiles for many tickers; a failure is reported rather than guessed around. */
export async function getFundProfiles(
  tickers: string[]
): Promise<{ profiles: Map<string, FundProfile>; failed: string[] }> {
  const profiles = new Map<string, FundProfile>();
  const failed: string[] = [];
  await Promise.all(
    tickers.map(async (t) => {
      try {
        profiles.set(t, await getFundProfile(t));
      } catch (err) {
        console.error(`Fund profile lookup failed for ${t}:`, err);
        failed.push(t);
      }
    })
  );
  return { profiles, failed };
}
