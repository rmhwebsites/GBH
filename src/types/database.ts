export interface Database {
  public: {
    Tables: {
      portfolio_holdings: {
        Row: PortfolioHolding;
        Insert: Omit<PortfolioHolding, "id" | "date_added">;
        Update: Partial<Omit<PortfolioHolding, "id">>;
      };
      member_investments: {
        Row: MemberInvestment;
        Insert: Omit<MemberInvestment, "id" | "investment_date">;
        Update: Partial<Omit<MemberInvestment, "id">>;
      };
      trade_history: {
        Row: TradeRecord;
        Insert: Omit<TradeRecord, "id" | "trade_date">;
        Update: Partial<Omit<TradeRecord, "id">>;
      };
      fund_metadata: {
        Row: FundMetadata;
        Insert: Omit<FundMetadata, "id" | "updated_at">;
        Update: Partial<Omit<FundMetadata, "id">>;
      };
    };
  };
}

export interface PortfolioHolding {
  id: string;
  ticker: string;
  company_name: string;
  shares: number;
  avg_cost_basis: number;
  date_added: string;
  is_active: boolean;
}

export interface MemberInvestment {
  id: string;
  memberstack_id: string;
  member_name: string;
  member_email: string;
  amount_invested: number;
  units_owned: number;
  investment_date: string;
}

export interface TradeRecord {
  id: string;
  ticker: string;
  action: "BUY" | "SELL";
  shares: number;
  price_per_share: number;
  total_amount: number;
  trade_date: string;
  notes: string | null;
}

export interface FundMetadata {
  id: string;
  total_units_outstanding: number;
  fund_inception_date: string;
  updated_at: string;
}

// Live data types (from Yahoo Finance)
export interface StockQuote {
  ticker: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  previousClose: number;
  open: number;
  dayHigh: number;
  dayLow: number;
  volume: number;
  marketCap: number;
  peRatio: number | null;
  week52High: number;
  week52Low: number;
}

export interface HoldingWithQuote extends PortfolioHolding {
  quote: StockQuote;
  currentValue: number;
  gainLoss: number;
  gainLossPercent: number;
  weight: number;
}

export interface PortfolioSummary {
  totalValue: number;
  totalCost: number;
  totalGainLoss: number;
  totalGainLossPercent: number;
  holdings: HoldingWithQuote[];
}

export interface MemberDashboardData {
  investments: MemberInvestment[];
  totalInvested: number;
  totalUnits: number;
  currentValue: number;
  totalGainLoss: number;
  totalGainLossPercent: number;
}

export interface ChartDataPoint {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}
