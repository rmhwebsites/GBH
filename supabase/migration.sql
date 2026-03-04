-- GBH Capital Dashboard - Supabase Database Setup
-- Run this in the Supabase SQL Editor (https://supabase.com/dashboard)

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Portfolio Holdings: What stocks the fund currently owns
CREATE TABLE portfolio_holdings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticker VARCHAR(10) NOT NULL,
  company_name VARCHAR(255) NOT NULL DEFAULT '',
  shares DECIMAL(15,6) NOT NULL DEFAULT 0,
  avg_cost_basis DECIMAL(15,4) NOT NULL DEFAULT 0,
  date_added TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE
);

-- Member Investments: Each member's investment records
CREATE TABLE member_investments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  memberstack_id VARCHAR(255) NOT NULL,
  member_name VARCHAR(255) NOT NULL DEFAULT '',
  member_email VARCHAR(255) NOT NULL DEFAULT '',
  amount_invested DECIMAL(15,2) NOT NULL DEFAULT 0,
  units_owned DECIMAL(15,6) NOT NULL DEFAULT 0,
  investment_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trade History: Log of buys and sells
CREATE TABLE trade_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticker VARCHAR(10) NOT NULL,
  action VARCHAR(10) NOT NULL CHECK (action IN ('BUY', 'SELL')),
  shares DECIMAL(15,6) NOT NULL DEFAULT 0,
  price_per_share DECIMAL(15,4) NOT NULL DEFAULT 0,
  total_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  trade_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT
);

-- Fund Metadata: Fund-level settings
CREATE TABLE fund_metadata (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  total_units_outstanding DECIMAL(15,6) NOT NULL DEFAULT 0,
  fund_inception_date DATE DEFAULT CURRENT_DATE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX idx_holdings_ticker ON portfolio_holdings(ticker);
CREATE INDEX idx_holdings_active ON portfolio_holdings(is_active);
CREATE INDEX idx_member_investments_memberstack ON member_investments(memberstack_id);
CREATE INDEX idx_trade_history_date ON trade_history(trade_date DESC);
CREATE INDEX idx_trade_history_ticker ON trade_history(ticker);

-- Enable Row Level Security (RLS)
ALTER TABLE portfolio_holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE fund_metadata ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (used by our Next.js API routes)
CREATE POLICY "Service role full access" ON portfolio_holdings FOR ALL
  USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON member_investments FOR ALL
  USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON trade_history FOR ALL
  USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON fund_metadata FOR ALL
  USING (true) WITH CHECK (true);

-- Insert initial fund metadata
INSERT INTO fund_metadata (total_units_outstanding, fund_inception_date)
VALUES (0, CURRENT_DATE);
