-- Fund Updates: Admin-posted announcements visible to all members
CREATE TABLE fund_updates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  category VARCHAR(50) NOT NULL DEFAULT 'announcement'
    CHECK (category IN ('trade', 'announcement', 'report')),
  author_name VARCHAR(255) NOT NULL DEFAULT 'GBH Capital',
  is_pinned BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_fund_updates_created ON fund_updates(created_at DESC);
CREATE INDEX idx_fund_updates_pinned ON fund_updates(is_pinned);

ALTER TABLE fund_updates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON fund_updates FOR ALL
  USING (true) WITH CHECK (true);
