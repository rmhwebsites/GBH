# GBH Investments Dashboard

A live investment dashboard for GBH Capital's pooled investment fund. Members can view real-time portfolio data, their personal investment value, and complete trade history. Admins manage holdings, record trades, and add member investments.

**Live**: [dashboard.gbhinvestments.com](https://dashboard.gbhinvestments.com)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, TypeScript) |
| Styling | Tailwind CSS v4 |
| Auth | Memberstack React SDK |
| Database | Supabase (PostgreSQL) |
| Stock Data | yahoo-finance2 |
| Charts | Lightweight Charts v5 (TradingView OSS) |
| Backup | Google Sheets API (daily cron) |
| Hosting | Vercel |

## Features

### Member Dashboard
- **Portfolio Overview** — Live stock prices, holdings table, allocation donut chart, fund performance
- **Stock Detail** — Branded TradingView chart (1D/1W/1M/3M/1Y/ALL), key stats, fund position
- **My Investment** — Current value, total return, units owned, NAV at entry, investment history
- **Trade History** — Filterable buy/sell log with ticker and action filters
- **Fund Analytics** — Portfolio performance chart, sector allocation

### Admin Panel
- **Holdings Management** — Add/edit/remove stock positions and cash balance
- **Trade Recording** — Log buys and sells (auto-updates holdings)
- **Member Management** — Add investments, edit member records, view current values
- **Investment Tracking** — NAV-based unit allocation, multi-round support

### Automated Systems
- **Daily NAV Snapshots** — Nightly cron (11 PM EST) calculates and stores NAV history
- **Google Sheets Backup** — Full data export to 5 sheets (Members, Holdings, Trades, Summary, NAV History)
- **Live Price Caching** — 5-min cache during market hours, 1-hour after hours

## Fund Math

```
Total AUM = SUM(shares × current_price) + cash_balance
NAV per Unit = Total AUM / Total Units Outstanding
Member Value = units_owned × NAV per Unit
Units Granted = Investment Amount / Current NAV per Unit
```

## Quick Start

```bash
npm install
cp .env.local.example .env.local  # Fill in your keys
npm run dev
```

See [SETUP.md](./SETUP.md) for full setup instructions including Supabase, Memberstack, Google Sheets backup, and Vercel deployment.

## Project Structure

```
src/
├── app/
│   ├── dashboard/           # Member-facing pages
│   │   ├── page.tsx         # Portfolio overview
│   │   ├── stock/[ticker]/  # Stock detail + chart
│   │   ├── my-investment/   # Personal investment view
│   │   ├── history/         # Trade history
│   │   └── analytics/       # Fund performance charts
│   ├── admin/               # Admin pages
│   │   ├── holdings/        # Manage portfolio
│   │   ├── trades/          # Record trades
│   │   ├── members/         # Manage members
│   │   └── investments/     # Investment tracking
│   └── api/
│       ├── stocks/          # Live quotes + history
│       ├── portfolio/       # Portfolio, NAV, performance, NAV history
│       ├── member/[id]/     # Member data
│       └── admin/           # CRUD + backup + batch operations
├── components/              # Charts, UI, auth guards
├── lib/                     # Supabase, Yahoo, calculations
└── types/                   # TypeScript interfaces
```

## Database Tables

| Table | Purpose |
|-------|---------|
| `portfolio_holdings` | Stock positions (ticker, shares, cost basis) |
| `member_investments` | Investment records (member, amount, units, date) |
| `trade_history` | Buy/sell log |
| `fund_metadata` | Total units outstanding, inception date |
| `nav_history` | Daily NAV snapshots (value, units, gain/loss) |
