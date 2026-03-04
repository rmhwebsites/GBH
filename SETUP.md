# GBH Investments Dashboard - Setup Guide

## Project Overview

A live investment dashboard for GBH Capital's pooled investment fund. Members can view real-time portfolio data, their personal investment value, and trade history. Admins can manage holdings, record trades, and add members.

**Live URL**: `dashboard.gbhinvestments.com` (after deployment)

---

## Tech Stack

| Layer | Technology | Cost |
|-------|-----------|------|
| Framework | Next.js 16 (App Router) | Free |
| Styling | Tailwind CSS v4 | Free |
| Auth | Memberstack React SDK | Existing plan |
| Database | Supabase (PostgreSQL) | Free tier |
| Stock Data | yahoo-finance2 (npm) | Free |
| Charts | Lightweight Charts v5 (TradingView OSS) | Free |
| Hosting | Vercel | Free tier |

---

## Step 1: Set Up Supabase

1. Go to [supabase.com](https://supabase.com) and sign in to your account
2. Create a new project (or use your existing one)
3. Go to **SQL Editor** in the left sidebar
4. Copy the contents of `supabase/migration.sql` and run it — this creates all 4 tables:
   - `portfolio_holdings` - Stocks the fund owns
   - `member_investments` - Each member's investment records
   - `trade_history` - Buy/sell transaction log
   - `fund_metadata` - Fund-level settings (total units, inception date)
5. Go to **Settings > API** to find your credentials:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon (public) key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY`

## Step 2: Set Up Memberstack

1. Go to [memberstack.com](https://memberstack.com) and sign in
2. In your app settings, go to **Settings > API Keys**
3. Copy the **Public Key** → `NEXT_PUBLIC_MEMBERSTACK_PUBLIC_KEY`
4. Note your admin member ID (visible in the Members section when you click on a member)
   → `ADMIN_MEMBER_IDS`

## Step 3: Configure Environment Variables

Edit the `.env.local` file in the project root:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Memberstack
NEXT_PUBLIC_MEMBERSTACK_PUBLIC_KEY=pk_your_key_here

# Admin member IDs (comma-separated Memberstack member IDs)
ADMIN_MEMBER_IDS=mem_your_admin_id_here
```

## Step 4: Run Locally

```bash
cd gbh-dashboard
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Step 5: Deploy to Vercel

1. Push the project to a GitHub repository
2. Go to [vercel.com](https://vercel.com) and import the repository
3. Add all environment variables from `.env.local` to the Vercel project settings
4. Deploy
5. In your domain registrar, add a CNAME record:
   - `dashboard.gbhinvestments.com` → `cname.vercel-dns.com`
6. In Vercel project settings, add `dashboard.gbhinvestments.com` as a custom domain

---

## Pages & Features

### Member Pages
| Route | Description |
|-------|-------------|
| `/login` | Memberstack login page |
| `/dashboard` | Portfolio overview - total value, holdings table, allocation chart |
| `/dashboard/stock/[ticker]` | Stock detail - branded chart, key stats, fund position |
| `/dashboard/my-investment` | Personal investment - current value, gain/loss, history |
| `/dashboard/history` | Trade history - filterable buy/sell records |

### Admin Pages (requires admin member ID)
| Route | Description |
|-------|-------------|
| `/admin` | Admin dashboard - AUM, members, quick links |
| `/admin/holdings` | Add/edit/remove stock positions |
| `/admin/trades` | Record buy/sell trades (auto-updates holdings) |
| `/admin/members` | Add members, set investment amounts |

---

## Admin Workflow

### Adding a New Stock Position
1. Go to `/admin/holdings`
2. Click "Add Holding"
3. Enter ticker, company name, shares, and average cost
4. Click Save

### Recording a Trade
1. Go to `/admin/trades`
2. Select BUY or SELL
3. For BUY: enter ticker, shares, price (creates new holding or updates existing)
4. For SELL: select from existing holdings, enter shares and price
5. Click "Record Trade" — holdings are auto-updated

### Adding a New Member Investment
1. Go to `/admin/members`
2. Click "Add Investment"
3. Enter their Memberstack ID, name, email, and investment amount
4. Units are auto-calculated based on current NAV
5. Click "Add Investment"

### Finding Memberstack IDs
1. Log in to [app.memberstack.com](https://app.memberstack.com)
2. Go to Members
3. Click on a member
4. The member ID is shown (format: `mem_xxx...`)

---

## How the Fund Math Works

```
Total AUM = SUM(shares_held x current_stock_price) for all active holdings
NAV per Unit = Total AUM / Total Units Outstanding
Member Value = member.units_owned x NAV per Unit
Member Gain/Loss = Member Value - member.amount_invested
```

When a new member invests:
- Units Granted = Investment Amount / Current NAV per Unit
- Total Units Outstanding increases by units granted

---

## Data Refresh

- Stock quotes refresh every **5 minutes** during market hours (9:30 AM - 4:00 PM ET)
- After hours, quotes are cached for **1 hour**
- Client-side SWR also refreshes every 5 minutes
- Manual refresh button available on dashboard

---

## Project Structure

```
src/
├── app/
│   ├── layout.tsx              # Root layout with MemberstackProvider
│   ├── page.tsx                # Redirects to /dashboard
│   ├── globals.css             # GBH brand theme + glass effects
│   ├── login/page.tsx          # Login with Memberstack modal
│   ├── dashboard/
│   │   ├── layout.tsx          # Auth guard + sidebar
│   │   ├── page.tsx            # Portfolio overview
│   │   ├── stock/[ticker]/     # Stock detail + chart
│   │   ├── my-investment/      # Member's personal view
│   │   └── history/            # Trade history
│   ├── admin/
│   │   ├── layout.tsx          # Admin guard
│   │   ├── page.tsx            # Admin dashboard
│   │   ├── holdings/           # Manage holdings
│   │   ├── trades/             # Record trades
│   │   └── members/            # Manage members
│   └── api/
│       ├── stocks/quotes/      # Live stock quotes
│       ├── stocks/history/     # Historical chart data
│       ├── portfolio/          # Portfolio summary
│       ├── portfolio/nav/      # NAV calculation
│       ├── member/[id]/        # Member data
│       └── admin/              # Admin CRUD routes
├── components/
│   ├── auth/AuthGuard.tsx      # Auth wrapper
│   ├── ui/Sidebar.tsx          # Navigation sidebar
│   ├── charts/
│   │   ├── StockChart.tsx      # Lightweight Charts (branded)
│   │   └── AllocationChart.tsx # Donut chart
│   └── dashboard/
│       ├── PortfolioSummary.tsx # Summary cards
│       └── HoldingsTable.tsx   # Holdings table
├── lib/
│   ├── supabase.ts             # Supabase clients
│   ├── yahoo.ts                # Yahoo Finance + caching
│   ├── calculations.ts         # NAV, returns, formatting
│   └── memberstack.ts          # Admin check
└── types/
    └── database.ts             # All TypeScript interfaces
```

---

## Brand Colors

| Color | Hex | Usage |
|-------|-----|-------|
| Gold | #CE9C5C | Primary accent, buttons, charts |
| Gold Light | #D9B37A | Hover states |
| Navy | #002366 | Secondary accent |
| Background | #000d1a | Page background |
| Card | rgba(255,255,255,0.06) | Glass card effect |
| Gain | #22c55e | Positive returns |
| Loss | #ef4444 | Negative returns |

Fonts: **Raleway** (headings), **Roboto** (body)

---

## Troubleshooting

### "Access Denied" on admin pages
- Ensure your Memberstack member ID is in the `ADMIN_MEMBER_IDS` env variable
- Multiple admin IDs can be comma-separated: `mem_id1,mem_id2`

### Stock data not loading
- yahoo-finance2 requires a server-side environment (not browser)
- Check that API routes are working: visit `/api/stocks/quotes` directly
- Some tickers may not be available on Yahoo Finance

### Member can't see their investment
- Ensure the member's Memberstack ID matches exactly in the database
- Add an investment record via `/admin/members`

### Build warnings about CSS @import
- This is a non-breaking warning about font import order in CSS
- It does not affect functionality
