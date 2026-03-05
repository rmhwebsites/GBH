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
      fund_updates: {
        Row: FundUpdate;
        Insert: Omit<FundUpdate, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<FundUpdate, "id">>;
      };
      voting_config: {
        Row: VotingConfig;
        Insert: Omit<VotingConfig, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<VotingConfig, "id">>;
      };
      votes: {
        Row: Vote;
        Insert: Omit<Vote, "id" | "created_at">;
        Update: Partial<Omit<Vote, "id">>;
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
  dayChange: number;
  dayChangePercent: number;
  weight: number;
}

export interface PortfolioSummary {
  totalValue: number;
  totalCost: number;
  totalGainLoss: number;
  totalGainLossPercent: number;
  totalDayChange: number;
  totalDayChangePercent: number;
  holdings: HoldingWithQuote[];
  cashBalance: number;
}

export interface MemberDashboardData {
  investments: MemberInvestment[];
  totalInvested: number;
  totalUnits: number;
  currentValue: number;
  totalGainLoss: number;
  totalGainLossPercent: number;
  navPerUnit: number;
  avgEntryNav: number;
}

export interface NavSnapshot {
  id: string;
  snapshot_date: string;
  nav_per_unit: number;
  total_value: number;
  total_units: number;
  total_cost: number;
  total_gain_loss: number;
  total_gain_loss_percent: number;
  num_holdings: number;
  cash_balance: number;
  created_at: string;
}

export interface ChartDataPoint {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface FundUpdate {
  id: string;
  title: string;
  content: string;
  category: "trade" | "announcement" | "report";
  author_name: string;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

export interface VotingConfig {
  id: string;
  is_active: boolean;
  title: string;
  description: string | null;
  max_votes_per_member: number;
  created_at: string;
  updated_at: string;
}

export interface Vote {
  id: string;
  voter_memberstack_id: string;
  voter_name: string;
  candidate_memberstack_id: string;
  candidate_name: string;
  created_at: string;
}

export interface VotingCandidate {
  memberstack_id: string;
  name: string;
}

export interface VotingResult {
  candidate_memberstack_id: string;
  candidate_name: string;
  vote_count: number;
}
