import yahooFinance from "yahoo-finance2";
import type { StockQuote, ChartDataPoint } from "@/types/database";

// Cache for stock quotes (5 min during market hours, 1 hour after)
const quoteCache = new Map<string, { data: StockQuote; timestamp: number }>();

function isMarketOpen(): boolean {
  const now = new Date();
  const eastern = new Date(
    now.toLocaleString("en-US", { timeZone: "America/New_York" })
  );
  const day = eastern.getDay();
  const hour = eastern.getHours();
  const minute = eastern.getMinutes();
  const timeNum = hour * 100 + minute;
  // Market open: Mon-Fri, 9:30 AM - 4:00 PM ET
  return day >= 1 && day <= 5 && timeNum >= 930 && timeNum < 1600;
}

function getCacheDuration(): number {
  return isMarketOpen() ? 5 * 60 * 1000 : 60 * 60 * 1000;
}

export async function getQuote(ticker: string): Promise<StockQuote> {
  const cached = quoteCache.get(ticker);
  if (cached && Date.now() - cached.timestamp < getCacheDuration()) {
    return cached.data;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: any = await yahooFinance.quote(ticker);

  const quote: StockQuote = {
    ticker: result.symbol,
    name: result.shortName || result.longName || result.symbol,
    price: result.regularMarketPrice ?? 0,
    change: result.regularMarketChange ?? 0,
    changePercent: result.regularMarketChangePercent ?? 0,
    previousClose: result.regularMarketPreviousClose ?? 0,
    open: result.regularMarketOpen ?? 0,
    dayHigh: result.regularMarketDayHigh ?? 0,
    dayLow: result.regularMarketDayLow ?? 0,
    volume: result.regularMarketVolume ?? 0,
    marketCap: result.marketCap ?? 0,
    peRatio: result.trailingPE ?? null,
    week52High: result.fiftyTwoWeekHigh ?? 0,
    week52Low: result.fiftyTwoWeekLow ?? 0,
  };

  quoteCache.set(ticker, { data: quote, timestamp: Date.now() });
  return quote;
}

export async function getQuotes(tickers: string[]): Promise<StockQuote[]> {
  return Promise.all(tickers.map((t) => getQuote(t)));
}

export async function getHistoricalData(
  ticker: string,
  period: "1d" | "5d" | "1mo" | "3mo" | "1y" | "5y" | "max"
): Promise<ChartDataPoint[]> {
  const intervalMap: Record<string, "1m" | "5m" | "1h" | "1d" | "1wk"> = {
    "1d": "5m",
    "5d": "15m" as "5m", // will use 5m as fallback
    "1mo": "1h",
    "3mo": "1d",
    "1y": "1d",
    "5y": "1wk",
    max: "1wk",
  };

  const interval = intervalMap[period] || "1d";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: any = await yahooFinance.chart(ticker, {
    period1: getStartDate(period),
    interval,
  });

  if (!result.quotes) return [];

  return result.quotes
    .filter((q: any) => q.open != null && q.close != null)
    .map((q: any) => ({
      time: new Date(q.date).toISOString().split("T")[0],
      open: q.open!,
      high: q.high!,
      low: q.low!,
      close: q.close!,
      volume: q.volume ?? undefined,
    }));
}

function getStartDate(period: string): Date {
  const now = new Date();
  switch (period) {
    case "1d":
      return new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
    case "5d":
      return new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
    case "1mo":
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case "3mo":
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    case "1y":
      return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    case "5y":
      return new Date(now.getTime() - 5 * 365 * 24 * 60 * 60 * 1000);
    case "max":
      return new Date("2000-01-01");
    default:
      return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
  }
}
