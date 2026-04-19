import type {
  PortfolioHolding,
  StockQuote,
  HoldingWithQuote,
  PortfolioSummary,
  MemberInvestment,
  MemberDashboardData,
} from "@/types/database";

export function calculatePortfolioSummary(
  holdings: PortfolioHolding[],
  quotes: StockQuote[],
  cashBalance: number = 0
): PortfolioSummary {
  const quoteMap = new Map(quotes.map((q) => [q.ticker, q]));

  let totalValue = 0;
  let totalCost = 0;
  let totalDayChange = 0;

  const enrichedHoldings: HoldingWithQuote[] = holdings
    .filter((h) => h.is_active && h.shares > 0 && h.ticker !== "CASH")
    .map((holding) => {
      const quote = quoteMap.get(holding.ticker);
      const currentValue = quote ? holding.shares * quote.price : 0;
      const costBasis = holding.shares * holding.avg_cost_basis;
      const gainLoss = currentValue - costBasis;
      const gainLossPercent = costBasis > 0 ? (gainLoss / costBasis) * 100 : 0;

      // Day change: dollar amount and percent from quote
      const dayChange = quote ? holding.shares * quote.change : 0;
      const dayChangePercent = quote?.changePercent || 0;

      totalValue += currentValue;
      totalCost += costBasis;
      totalDayChange += dayChange;

      return {
        ...holding,
        quote: quote || createEmptyQuote(holding.ticker),
        currentValue,
        gainLoss,
        gainLossPercent,
        dayChange,
        dayChangePercent,
        weight: 0, // calculated below
      };
    });

  // Gain/loss is stocks only (like Fidelity/Schwab)
  const totalGainLoss = totalValue - totalCost;
  const totalGainLossPercent =
    totalCost > 0 ? (totalGainLoss / totalCost) * 100 : 0;

  // Total AUM includes cash
  const totalAUM = totalValue + cashBalance;

  // Geometric day change % — use previous day portfolio value as denominator
  // Previous value = current stock value - day change + cash (cash doesn't change intraday)
  const previousPortfolioValue = totalAUM - totalDayChange;
  const totalDayChangePercent =
    previousPortfolioValue > 0
      ? (totalDayChange / previousPortfolioValue) * 100
      : 0;

  // Calculate weights based on total AUM (including cash in denominator)
  enrichedHoldings.forEach((h) => {
    h.weight = totalAUM > 0 ? (h.currentValue / totalAUM) * 100 : 0;
  });

  // Sort by weight descending
  enrichedHoldings.sort((a, b) => b.weight - a.weight);

  return {
    totalValue: totalAUM,
    totalCost,
    totalGainLoss,
    totalGainLossPercent,
    totalDayChange,
    totalDayChangePercent,
    holdings: enrichedHoldings,
    cashBalance,
  };
}

export function calculateNAV(
  totalValue: number,
  totalUnitsOutstanding: number
): number {
  if (totalUnitsOutstanding <= 0) return 0;
  return totalValue / totalUnitsOutstanding;
}

export function calculateMemberData(
  investments: MemberInvestment[],
  navPerUnit: number
): MemberDashboardData {
  const totalInvested = investments.reduce(
    (sum, inv) => sum + inv.amount_invested,
    0
  );
  const totalUnits = investments.reduce(
    (sum, inv) => sum + inv.units_owned,
    0
  );
  const currentValue = totalUnits * navPerUnit;
  const totalGainLoss = currentValue - totalInvested;
  const totalGainLossPercent =
    totalInvested > 0 ? (totalGainLoss / totalInvested) * 100 : 0;

  // Weighted average NAV at entry = total invested / total units
  const avgEntryNav = totalUnits > 0 ? totalInvested / totalUnits : 0;

  return {
    investments,
    totalInvested,
    totalUnits,
    currentValue,
    totalGainLoss,
    totalGainLossPercent,
    navPerUnit,
    avgEntryNav,
  };
}

export function formatCurrency(value: number | undefined | null): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value ?? 0);
}

export function formatPercent(value: number | undefined | null): string {
  const v = value ?? 0;
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}

export function formatNumber(value: number | undefined | null, decimals = 2): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value ?? 0);
}

export function formatLargeNumber(value: number | undefined | null): string {
  const v = value ?? 0;
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  return formatCurrency(v);
}

function createEmptyQuote(ticker: string): StockQuote {
  return {
    ticker,
    name: ticker,
    price: 0,
    change: 0,
    changePercent: 0,
    previousClose: 0,
    open: 0,
    dayHigh: 0,
    dayLow: 0,
    volume: 0,
    marketCap: 0,
    peRatio: null,
    week52High: 0,
    week52Low: 0,
  };
}
