# GBH Dashboard - Development Progress

## Completed

### Phase 1: Project Setup
- [x] Next.js 16 project with App Router, TypeScript, Tailwind
- [x] Supabase integration with all database tables
- [x] Memberstack auth integration
- [x] Dark financial theme with gold accent (#CE9C5C)
- [x] Custom favicon

### Phase 2: Authentication
- [x] Memberstack React SDK integration
- [x] Login page
- [x] Auth middleware (dashboard route protection)
- [x] Admin role check for /admin routes

### Phase 3: API Routes
- [x] `/api/stocks/quotes` - Live quotes via yahoo-finance2 with 5-min cache
- [x] `/api/stocks/history/[ticker]` - Historical price data for charts
- [x] `/api/portfolio` - Portfolio holdings with live values, day change, geometric returns
- [x] `/api/portfolio/nav` - Live NAV per unit calculation
- [x] `/api/portfolio/performance` - NAV time-series with S&P 500 comparison
- [x] `/api/portfolio/value-history` - Historical fund total value for dashboard chart
- [x] `/api/portfolio/nav-history` - NAV history from Supabase
- [x] `/api/member/[id]` - Member investment data
- [x] `/api/admin/holdings` - CRUD for stock positions
- [x] `/api/admin/trades` - Record trades with auto-update holdings
- [x] `/api/admin/members` - CRUD for members with unit sync
- [x] `/api/admin/investments` - Record investments/withdrawals with NAV-based units
- [x] `/api/admin/nav-snapshot` - Daily NAV snapshot
- [x] `/api/admin/recalibrate` - Sync with Fidelity data
- [x] `/api/admin/backup` - Database backup
- [x] `/api/admin/batch-investments` - Bulk investment processing

### Phase 4: Dashboard Pages
- [x] Dashboard layout with sidebar navigation
- [x] Portfolio overview with Robinhood-style historical value chart
- [x] Interactive chart with hover-to-see-value and period selector
- [x] Live NAV per unit display
- [x] Holdings table with all columns (Price, Day Change, Shares, Value, Total Return, Weight)
- [x] Sticky first column with horizontal scroll for mobile
- [x] Allocation donut chart
- [x] Sector breakdown chart
- [x] Stock detail pages with Lightweight Charts
- [x] Member investment value page
- [x] Trade history feed
- [x] Analytics page with performance vs S&P 500, concentration metrics

### Phase 5: Admin Panel
- [x] Admin layout with navigation
- [x] Holdings management (add/edit/delete)
- [x] Trade recording form (auto-updates holdings + history)
- [x] Investment history page with invest/withdraw flow
- [x] Member management with unit editing and fund metadata sync
- [x] NAV snapshot tool
- [x] Recalibration tool

### Phase 6: Polish
- [x] Day change ($ and %) on portfolio and holdings
- [x] Geometric returns for portfolio day change
- [x] Per-share vs position-level data separation (fixed Amazon $50 bug)
- [x] Brokerage-style layout (Fidelity/Schwab-inspired)
- [x] Cash excluded from cost basis calculations
- [x] Stock logos via Clearbit/logo.dev
- [x] Mobile responsive with horizontal scroll tables
- [x] Loading states and error handling

### Phase 5: Voting, Attendance & Theming (Aug 2026)
- [x] Decision voting mode — Confirm/Reject votes on proposals
  - `vote_type` on voting_config ('candidate' | 'decision'), admin type selector
  - Decision votes stored in existing `votes` table via sentinel IDs
  - `voting_sessions` metadata table so history remembers each session's question
  - Confirm/Reject ballot UI, live tally, outcome badge (simple majority — policy in `src/lib/voting.ts`)
  - Requires: run `supabase/migration_decision_voting.sql`
- [x] Meeting attendance tracking (`/admin/attendance`)
  - Record meetings with member checklist, edit/delete past meetings
  - Per-member attendance rates and meeting history
  - Requires: run `supabase/migration_attendance.sql`
- [x] Auto light/dark theme
  - Follows system preference by default; Auto → Light → Dark toggle in sidebar
  - Light palette: warm paper + navy ink + deepened gold (WCAG-friendlier)
  - Theme-aware charts (lightweight-charts + Recharts tooltips)
  - No-flash init via `public/theme-init.js`
- [x] Voter audit log now records real member names (was hardcoded "Member")
- [x] Member investment contributions via Stripe (ACH)
  - Admin `/admin/funding`: create investment windows (open/close dates, min/max)
  - Member `/dashboard/invest`: submit amount during open window → Stripe Checkout (us_bank_account)
  - Webhook `/api/stripe/webhook` tracks ACH lifecycle (pending → processing → paid / failed)
  - Admin "Process at NAV" converts paid submissions into member_investments units
    (shared `src/lib/investments.ts` — same math as manual admin entry)
  - Requires: run `supabase/migration_investment_windows.sql`, set STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET, NEXT_PUBLIC_APP_URL; add webhook endpoint in Stripe dashboard

## In Progress

- [ ] Transaction email alerts to members
- [ ] Email formatting with GBH branding and ticker logos

## Planned

- [ ] Push notifications for large market moves
- [ ] Export portfolio data to CSV
- [ ] Performance attribution analysis
- [ ] Dividend tracking
