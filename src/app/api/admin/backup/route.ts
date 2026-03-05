import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { google } from "googleapis";
import { getQuotes } from "@/lib/yahoo";
import { calculatePortfolioSummary, calculateNAV } from "@/lib/calculations";
import { verifyAuth } from "@/lib/auth";

/**
 * Daily backup endpoint that:
 *   1. Calculates current NAV and stores a daily snapshot in Supabase
 *   2. Writes all fund data to a Google Sheet
 *   3. Appends NAV history to a running log in Google Sheets
 *
 * Runs nightly at 11 PM EST (4 AM UTC) via Vercel cron.
 * Protected by CRON_SECRET bearer token.
 *
 * Sheets:
 *   1. Member Investments - all investment records
 *   2. Portfolio Holdings - current stock positions
 *   3. Trade History - all trades
 *   4. Fund Summary - NAV, units, stats
 *   5. NAV History - append-only daily NAV log (NEVER overwritten)
 *
 * Required env vars:
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL
 *   GOOGLE_PRIVATE_KEY
 *   GOOGLE_SHEET_ID
 *   CRON_SECRET
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authorization: accept CRON_SECRET or admin session
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    const auth = await verifyAuth(request);
    const isAdmin = auth?.isAdmin === true;
    const hasCronSecret =
      cronSecret && authHeader === `Bearer ${cronSecret}`;

    if (!hasCronSecret && !isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createServerClient();

    // Fetch all data in parallel
    const [investmentsRes, holdingsRes, tradesRes, metadataRes] =
      await Promise.all([
        supabase
          .from("member_investments")
          .select("*")
          .order("investment_date", { ascending: true }),
        supabase
          .from("portfolio_holdings")
          .select("*")
          .order("ticker"),
        supabase
          .from("trade_history")
          .select("*")
          .order("trade_date", { ascending: false }),
        supabase.from("fund_metadata").select("*").limit(1).single(),
      ]);

    const investments = investmentsRes.data || [];
    const holdings = holdingsRes.data || [];
    const trades = tradesRes.data || [];
    const metadata = metadataRes.data;

    // ── Calculate live NAV ──────────────────────────────────────────
    const activeHoldings = holdings.filter(
      (h: { is_active: boolean }) => h.is_active
    );
    const cashHolding = activeHoldings.find(
      (h: { ticker: string }) => h.ticker === "CASH"
    );
    const stockHoldings = activeHoldings.filter(
      (h: { ticker: string }) => h.ticker !== "CASH"
    );
    const cashBalance = cashHolding?.shares || 0;

    const tickers = stockHoldings.map((h: { ticker: string }) => h.ticker);
    const quotes = tickers.length > 0 ? await getQuotes(tickers) : [];
    const summary = calculatePortfolioSummary(stockHoldings, quotes, cashBalance);

    const totalUnits = metadata?.total_units_outstanding || 0;
    const navPerUnit = calculateNAV(summary.totalValue, totalUnits);

    const now = new Date();
    const estDate = now.toLocaleDateString("en-CA", {
      timeZone: "America/New_York",
    }); // YYYY-MM-DD format
    const timestamp = now.toLocaleString("en-US", {
      timeZone: "America/New_York",
    });

    // ── Store NAV snapshot in Supabase ──────────────────────────────
    // Upsert so re-runs on the same date don't create duplicates
    const { error: navError } = await supabase
      .from("nav_history")
      .upsert(
        {
          snapshot_date: estDate,
          nav_per_unit: parseFloat(navPerUnit.toFixed(6)),
          total_value: parseFloat(summary.totalValue.toFixed(2)),
          total_units: parseFloat(totalUnits.toFixed(6)),
          total_cost: parseFloat(summary.totalCost.toFixed(2)),
          total_gain_loss: parseFloat(summary.totalGainLoss.toFixed(2)),
          total_gain_loss_percent: parseFloat(
            summary.totalGainLossPercent.toFixed(4)
          ),
          num_holdings: stockHoldings.length,
          cash_balance: parseFloat(cashBalance.toFixed(2)),
        },
        { onConflict: "snapshot_date" }
      );

    if (navError) {
      console.error("NAV snapshot error:", navError);
      // Continue with backup even if NAV insert fails
    }

    // ── Google Sheets backup ────────────────────────────────────────
    const googleAuth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth: googleAuth });
    const spreadsheetId = process.env.GOOGLE_SHEET_ID!;

    // Ensure all sheets exist
    const sheetNames = [
      "Member Investments",
      "Portfolio Holdings",
      "Trade History",
      "Fund Summary",
      "NAV History",
    ];
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const existingSheets =
      spreadsheet.data.sheets?.map((s) => s.properties?.title) || [];

    const sheetsToCreate = sheetNames.filter(
      (name) => !existingSheets.includes(name)
    );
    if (sheetsToCreate.length > 0) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: sheetsToCreate.map((title) => ({
            addSheet: { properties: { title } },
          })),
        },
      });
    }

    // 1. Member Investments sheet
    const investmentRows = [
      ["Last Updated", timestamp, "", "", "", "", ""],
      [],
      [
        "Member Name",
        "Email",
        "Memberstack ID",
        "Amount Invested",
        "Units Owned",
        "NAV at Entry",
        "Investment Date",
      ],
      ...investments.map((inv) => [
        inv.member_name,
        inv.member_email,
        inv.memberstack_id,
        inv.amount_invested,
        inv.units_owned,
        inv.units_owned !== 0
          ? (inv.amount_invested / inv.units_owned).toFixed(4)
          : "N/A",
        inv.investment_date,
      ]),
    ];

    // 2. Portfolio Holdings sheet (with live prices)
    const quoteMap = new Map(quotes.map((q) => [q.ticker, q]));
    const holdingRows = [
      ["Last Updated", timestamp, "", "", "", "", "", "", ""],
      [],
      [
        "Ticker",
        "Company Name",
        "Shares",
        "Avg Cost",
        "Cost Value",
        "Current Price",
        "Market Value",
        "Gain/Loss",
        "Active",
      ],
      ...holdings.map((h) => {
        const q = quoteMap.get(h.ticker);
        const costValue = h.shares * h.avg_cost_basis;
        const mktValue = q ? h.shares * q.price : costValue;
        return [
          h.ticker,
          h.company_name,
          h.shares,
          h.avg_cost_basis,
          costValue.toFixed(2),
          q ? q.price.toFixed(2) : "N/A",
          mktValue.toFixed(2),
          (mktValue - costValue).toFixed(2),
          h.is_active ? "Yes" : "No",
        ];
      }),
    ];

    // 3. Trade History sheet
    const tradeRows = [
      ["Last Updated", timestamp, "", "", "", "", ""],
      [],
      [
        "Date",
        "Ticker",
        "Action",
        "Shares",
        "Price Per Share",
        "Total Amount",
        "Notes",
      ],
      ...trades.map((t) => [
        t.trade_date,
        t.ticker,
        t.action,
        t.shares,
        t.price_per_share,
        t.total_amount,
        t.notes || "",
      ]),
    ];

    // 4. Fund Summary sheet (includes live NAV)
    const totalMemberInvested = investments.reduce(
      (sum, i) => sum + i.amount_invested,
      0
    );
    const totalMemberUnits = investments.reduce(
      (sum, i) => sum + i.units_owned,
      0
    );
    const summaryRows = [
      ["Last Updated", timestamp],
      [],
      ["Live Portfolio Data", ""],
      ["Total Portfolio Value", `$${summary.totalValue.toFixed(2)}`],
      ["Total Cost Basis", `$${summary.totalCost.toFixed(2)}`],
      ["Total Gain/Loss", `$${summary.totalGainLoss.toFixed(2)}`],
      ["Portfolio Return", `${summary.totalGainLossPercent.toFixed(2)}%`],
      ["Cash Balance", `$${cashBalance.toFixed(2)}`],
      [],
      ["NAV Data", ""],
      ["NAV Per Unit", `$${navPerUnit.toFixed(6)}`],
      ["Total Units Outstanding", totalUnits.toFixed(6)],
      [],
      ["Fund Metadata", ""],
      ["Fund Inception Date", metadata?.fund_inception_date || "N/A"],
      [],
      ["Member Statistics", ""],
      ["Total Investment Records", investments.length],
      [
        "Unique Members",
        new Set(investments.map((i) => i.memberstack_id)).size,
      ],
      ["Total Amount Invested", `$${totalMemberInvested.toFixed(2)}`],
      ["Total Member Units", totalMemberUnits.toFixed(4)],
      [],
      ["Holdings", ""],
      ["Active Stock Holdings", stockHoldings.length],
      ["Total Holdings (incl. inactive)", holdings.length],
      ["Total Trades", trades.length],
    ];

    // Write data sheets (overwrite)
    await Promise.all([
      sheets.spreadsheets.values.update({
        spreadsheetId,
        range: "Member Investments!A1",
        valueInputOption: "USER_ENTERED",
        requestBody: { values: investmentRows },
      }),
      sheets.spreadsheets.values.update({
        spreadsheetId,
        range: "Portfolio Holdings!A1",
        valueInputOption: "USER_ENTERED",
        requestBody: { values: holdingRows },
      }),
      sheets.spreadsheets.values.update({
        spreadsheetId,
        range: "Trade History!A1",
        valueInputOption: "USER_ENTERED",
        requestBody: { values: tradeRows },
      }),
      sheets.spreadsheets.values.update({
        spreadsheetId,
        range: "Fund Summary!A1",
        valueInputOption: "USER_ENTERED",
        requestBody: { values: summaryRows },
      }),
    ]);

    // Clear stale rows beyond current data
    await Promise.all([
      sheets.spreadsheets.values.clear({
        spreadsheetId,
        range: `Member Investments!A${investmentRows.length + 1}:Z1000`,
      }),
      sheets.spreadsheets.values.clear({
        spreadsheetId,
        range: `Portfolio Holdings!A${holdingRows.length + 1}:Z1000`,
      }),
      sheets.spreadsheets.values.clear({
        spreadsheetId,
        range: `Trade History!A${tradeRows.length + 1}:Z1000`,
      }),
      sheets.spreadsheets.values.clear({
        spreadsheetId,
        range: `Fund Summary!A${summaryRows.length + 1}:Z1000`,
      }),
    ]);

    // 5. NAV History sheet (APPEND only — never overwrite)
    // Check if header row exists
    const navSheetData = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "NAV History!A1:J1",
    });

    if (!navSheetData.data.values || navSheetData.data.values.length === 0) {
      // Write header row first time
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: "NAV History!A1",
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: [
            [
              "Date",
              "NAV Per Unit",
              "Total Value",
              "Total Units",
              "Total Cost",
              "Gain/Loss",
              "Return %",
              "# Holdings",
              "Cash",
              "Timestamp",
            ],
          ],
        },
      });
    }

    // Append today's NAV row
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "NAV History!A:J",
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [
          [
            estDate,
            navPerUnit.toFixed(6),
            summary.totalValue.toFixed(2),
            totalUnits.toFixed(6),
            summary.totalCost.toFixed(2),
            summary.totalGainLoss.toFixed(2),
            `${summary.totalGainLossPercent.toFixed(2)}%`,
            stockHoldings.length,
            cashBalance.toFixed(2),
            timestamp,
          ],
        ],
      },
    });

    return NextResponse.json({
      success: true,
      timestamp,
      nav: {
        date: estDate,
        navPerUnit: parseFloat(navPerUnit.toFixed(6)),
        totalValue: parseFloat(summary.totalValue.toFixed(2)),
        totalUnits: parseFloat(totalUnits.toFixed(6)),
        gainLossPercent: parseFloat(
          summary.totalGainLossPercent.toFixed(2)
        ),
      },
      records: {
        investments: investments.length,
        holdings: holdings.length,
        trades: trades.length,
      },
      navSnapshotSaved: !navError,
    });
  } catch (err) {
    console.error("Backup error:", err);
    return NextResponse.json(
      {
        error: "Failed to backup",
        details: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
