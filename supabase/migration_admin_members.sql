-- Admin Members: Runtime-managed list of admins (editable from the UI)
-- The NEXT_PUBLIC_ADMIN_MEMBER_IDS env var still works as a bootstrap admin list;
-- this table is checked in addition to that list.

CREATE TABLE admin_members (
  memberstack_id VARCHAR(255) PRIMARY KEY,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  added_by VARCHAR(255)
);

ALTER TABLE admin_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON admin_members FOR ALL
  USING (true) WITH CHECK (true);
