# GBH Investments Dashboard - Setup Guide

## Project Overview

A live investment dashboard for GBH Capital's pooled investment fund. Members can view real-time portfolio data, their personal investment value, and trade history. Admins can manage holdings, record trades, and add members.

**Live URL**: `dashboard.gbhinvestments.com`

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
| Backup | Google Sheets API + googleapis | Free |
| Hosting | Vercel | Free tier |

---

## Step 1: Set Up Supabase

1. Go to [supabase.com](https://supabase.com) and sign in to your account
2. Create a new project (or use your existing one)
3. Go to **SQL Editor** in the left sidebar
4. Copy the contents of `supabase/migration.sql` and run it — this creates the core tables:
   - `portfolio_holdings` - Stocks the fund owns
   - `member_investments` - Each member's investment records
   - `trade_history` - Buy/sell transaction log
   - `fund_metadata` - Fund-level settings (total units, inception date)
5. **Create the NAV History table** — run this SQL:

```sql
CREATE TABLE IF NOT EXISTS nav_history (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  snapshot_date date NOT NULL UNIQUE,
  nav_per_unit decimal(15,6) NOT NULL,
  total_value decimal(15,2) NOT NULL,
  total_units decimal(15,6) NOT NULL,
  total_cost decimal(15,2) NOT NULL,
  total_gain_loss decimal(15,2) NOT NULL,
  total_gain_loss_percent decimal(10,4) NOT NULL,
  num_holdings integer NOT NULL DEFAULT 0,
  cash_balance decimal(15,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Index for efficient date queries
CREATE INDEX IF NOT EXISTS idx_nav_history_date ON nav_history(snapshot_date);
```

6. Go to **Settings > API** to find your credentials:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon (public) key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY`

## Step 2: Set Up Memberstack

1. Go to [memberstack.com](https://memberstack.com) and sign in
2. In your app settings, go to **Settings > API Keys**
3. Copy the **Public Key** → `NEXT_PUBLIC_MEMBERSTACK_PUBLIC_KEY`
4. Note your admin member ID (visible in the Members section when you click on a member)
   → `ADMIN_MEMBER_IDS`

## Step 3: Set Up Google Sheets Backup

The dashboard backs up all data to Google Sheets every night at 11 PM EST, including a running NAV history log.

### Create a Google Cloud Service Account

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or use existing)
3. Enable the **Google Sheets API**:
   - Go to **APIs & Services > Library**
   - Search for "Google Sheets API"
   - Click **Enable**
4. Create a service account:
   - Go to **APIs & Services > Credentials**
   - Click **Create Credentials > Service Account**
   - Name it something like `gbh-backup`
   - Click **Create and Continue** (skip optional steps)
   - Click **Done**
5. Create a key for the service account:
   - Click on the service account you just created
   - Go to the **Keys** tab
   - Click **Add Key > Create new key > JSON**
   - Save the downloaded JSON file securely
6. From the JSON file, note:
   - `client_email` → `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `private_key` → `GOOGLE_PRIVATE_KEY`

### Create and Share the Google Sheet

1. Create a new Google Sheet in your Google Drive
2. Name it "GBH Investments Backup" (or whatever you prefer)
3. Copy the spreadsheet ID from the URL:
   - URL format: `https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit`
   - → `GOOGLE_SHEET_ID`
4. **Share the sheet** with the service account email (the `client_email` from the JSON):
   - Click **Share** in the top right
   - Paste the service account email
   - Give it **Editor** access
   - Click **Send**

### Generate a Cron Secret

Generate a random secret for authorizing the cron job:
```bash
openssl rand -hex 32
```
→ `CRON_SECRET`

## Step 4: Configure Environment Variables

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

# Google Sheets Backup
GOOGLE_SERVICE_ACCOUNT_EMAIL=gbh-backup@your-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_KEY_HERE\n-----END PRIVATE KEY-----\n"
GOOGLE_SHEET_ID=your_spreadsheet_id_here
CRON_SECRET=your_random_secret_here
```

**Important**: When adding `GOOGLE_PRIVATE_KEY` to Vercel, paste the entire key including `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`. Vercel handles the `\n` characters automatically.

## Step 5: Run Locally

```bash
cd gbh-dashboard
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Test the Backup Locally

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" http://localhost:3000/api/admin/backup
```

## Step 6: Deploy to Vercel

1. Push the project to a GitHub repository
2. Go to [vercel.com](https://vercel.com) and import the repository
3. Add all environment variables from `.env.local` to the Vercel project settings
4. Deploy
5. In your domain registrar, add a CNAME record:
   - `dashboard.gbhinvestments.com` → `cname.vercel-dns.com`
6. In Vercel project settings, add `dashboard.gbhinvestments.com` as a custom domain

### Verify Cron Job

After deploying, the `vercel.json` cron configuration will automatically schedule:
- **Daily backup at 11 PM EST** (4 AM UTC) → `GET /api/admin/backup`

To verify it's working:
- Go to Vercel dashboard → your project → **Cron Jobs** tab
- You should see the `/api/admin/backup` cron listed
- Check the Google Sheet after the first run for data

---

## Pages & Features

### Member Pages
| Route | Description |
|-------|-------------|
| `/login` | Memberstack login page |
| `/dashboard` | Portfolio overview - total value, holdings table, allocation chart |
| `/dashboard/stock/[ticker]` | Stock detail - branded chart, key stats, fund position |
| `/dashboard/my-investment` | Personal investment - current value, gain/loss, NAV at entry, history |
| `/dashboard/history` | Trade history - filterable buy/sell records |
| `/dashboard/analytics` | Fund performance charts |

### Admin Pages (requires admin member ID)
| Route | Description |
|-------|-------------|
| `/admin` | Admin dashboard - AUM, members, quick links |
| `/admin/holdings` | Add/edit/remove stock positions |
| `/admin/trades` | Record buy/sell trades (auto-updates holdings) |
| `/admin/members` | Add members, set investment amounts |
| `/admin/investments` | Investment tracking with NAV-based units |

### API Endpoints
| Route | Description |
|-------|-------------|
| `/api/stocks/quotes` | Live stock quotes (cached 5min/1hr) |
| `/api/stocks/history/[ticker]` | Historical chart data |
| `/api/portfolio` | Full portfolio summary |
| `/api/portfolio/nav` | Current NAV per unit |
| `/api/portfolio/nav-history` | Daily NAV history (query: `?days=90` or `?from=&to=`) |
| `/api/portfolio/performance` | Performance data for charts |
| `/api/member/[id]` | Member investment data |
| `/api/admin/backup` | Daily backup (cron-triggered) |

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
1. Go to `/admin/members` or `/admin/investments`
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
Total AUM = SUM(shares_held x current_stock_price) + cash_balance
NAV per Unit = Total AUM / Total Units Outstanding
Member Value = member.units_owned x NAV per Unit
Member Gain/Loss = Member Value - member.amount_invested
```

When a new member invests:
- Units Granted = Investment Amount / Current NAV per Unit
- Total Units Outstanding increases by units granted

### Investment Rounds
- **Round 1 (May 2025)**: NAV = $1.00 (initial), units = dollars invested
- **Round 2 (Sep 2025)**: NAV = $1.1356 (portfolio had grown), units = dollars / $1.1356
- Future rounds: NAV calculated live at time of investment

---

## Data Refresh

- Stock quotes refresh every **5 minutes** during market hours (9:30 AM - 4:00 PM ET)
- After hours, quotes are cached for **1 hour**
- Client-side SWR also refreshes every 5 minutes
- Manual refresh button available on dashboard
- NAV snapshot taken daily at **11 PM EST** (includes after-hours prices)

---

## Database Tables

| Table | Purpose |
|-------|---------|
| `portfolio_holdings` | Stock positions (ticker, shares, cost basis, active flag) |
| `member_investments` | Investment records (member ID, amount, units, date) |
| `trade_history` | Buy/sell transaction log |
| `fund_metadata` | Total units outstanding, fund inception date |
| `nav_history` | Daily NAV snapshots (date, NAV, value, units, gain/loss) |

---

## Google Sheets Backup Tabs

| Sheet | Behavior | Contents |
|-------|----------|----------|
| Member Investments | Overwrite daily | All member records with NAV at entry |
| Portfolio Holdings | Overwrite daily | All positions with live prices and market values |
| Trade History | Overwrite daily | All buy/sell trades |
| Fund Summary | Overwrite daily | Live NAV, AUM, portfolio stats |
| NAV History | **Append only** | Running daily log — never overwritten |

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
│   │   ├── history/            # Trade history
│   │   └── analytics/          # Fund performance
│   ├── admin/
│   │   ├── layout.tsx          # Admin guard
│   │   ├── page.tsx            # Admin dashboard
│   │   ├── holdings/           # Manage holdings
│   │   ├── trades/             # Record trades
│   │   ├── members/            # Manage members
│   │   └── investments/        # Investment tracking
│   └── api/
│       ├── stocks/quotes/      # Live stock quotes
│       ├── stocks/history/     # Historical chart data
│       ├── portfolio/          # Portfolio summary
│       ├── portfolio/nav/      # NAV calculation
│       ├── portfolio/nav-history/ # Daily NAV history
│       ├── portfolio/performance/ # Performance data
│       ├── member/[id]/        # Member data
│       └── admin/              # CRUD, backup, batch operations
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

### Backup not running
- Verify `CRON_SECRET` is set in Vercel environment variables
- Check the Vercel Cron Jobs tab for the schedule
- Test manually: `curl -H "Authorization: Bearer YOUR_SECRET" https://dashboard.gbhinvestments.com/api/admin/backup`
- Ensure the Google Sheet is shared with the service account email as Editor

### Build warnings about CSS @import
- This is a non-breaking warning about font import order in CSS
- It does not affect functionality
