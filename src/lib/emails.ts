import { getResend, EMAIL_FROM } from "./resend";

// ─── Brand colors ─────────────────────────────────────────────
const GOLD = "#CE9C5C";
const DARK_BG = "#0F1117";
const CARD_BG = "#1A1D27";
const BORDER = "#2A2D37";
const TEXT = "#E4E4E7";
const MUTED = "#71717A";
const GAIN = "#22C55E";
const LOSS = "#EF4444";

// ─── Shared layout ────────────────────────────────────────────
function emailWrapper(content: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background-color:${DARK_BG};font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:${DARK_BG};padding:24px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          <!-- Header -->
          <tr>
            <td style="padding:24px 32px;text-align:center;border-bottom:1px solid ${BORDER};">
              <span style="font-size:22px;font-weight:700;color:${GOLD};letter-spacing:1px;">GBH CAPITAL</span>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="background-color:${CARD_BG};border-radius:0 0 12px 12px;padding:32px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 32px;text-align:center;">
              <p style="margin:0;font-size:12px;color:${MUTED};">
                GBH Capital &middot; Investment Fund
              </p>
              <p style="margin:8px 0 0;font-size:11px;color:${MUTED};">
                This is an automated notification. Do not reply to this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─── Ticker logo helper ───────────────────────────────────────
function tickerLogoUrl(ticker: string): string {
  // Try logo.dev first (high quality), fallback to clearbit
  return `https://img.logo.dev/ticker/${ticker}?token=pk_X-1ZO13GSgeOoUrIuJ6GMQ&size=64&format=png`;
}

// ─── Trade alert email ────────────────────────────────────────
interface TradeAlertData {
  ticker: string;
  companyName: string;
  action: "BUY" | "SELL";
  shares: number;
  pricePerShare: number;
  totalAmount: number;
  tradeDate: string;
  notes?: string;
}

function buildTradeAlertHtml(trade: TradeAlertData): string {
  const isBuy = trade.action === "BUY";
  const actionColor = isBuy ? GAIN : LOSS;
  const actionLabel = isBuy ? "BOUGHT" : "SOLD";
  const formattedDate = new Date(trade.tradeDate).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

  const content = `
    <!-- Action Badge -->
    <div style="text-align:center;margin-bottom:24px;">
      <span style="display:inline-block;background-color:${actionColor}20;color:${actionColor};font-size:13px;font-weight:700;letter-spacing:1.5px;padding:6px 20px;border-radius:20px;">
        ${actionLabel}
      </span>
    </div>

    <!-- Ticker & Logo -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr>
        <td align="center">
          <img
            src="${tickerLogoUrl(trade.ticker)}"
            alt="${trade.ticker}"
            width="48"
            height="48"
            style="border-radius:50%;background-color:#2A2D37;display:block;margin:0 auto 12px;"
          />
          <p style="margin:0;font-size:24px;font-weight:700;color:${TEXT};">
            ${trade.ticker}
          </p>
          <p style="margin:4px 0 0;font-size:14px;color:${MUTED};">
            ${trade.companyName}
          </p>
        </td>
      </tr>
    </table>

    <!-- Trade Details Card -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:${DARK_BG};border-radius:8px;border:1px solid ${BORDER};margin-bottom:20px;">
      <tr>
        <td style="padding:16px 20px;border-bottom:1px solid ${BORDER};">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="font-size:12px;color:${MUTED};text-transform:uppercase;letter-spacing:0.5px;">Shares</td>
              <td align="right" style="font-size:16px;font-weight:600;color:${TEXT};">${trade.shares.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 4 })}</td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 20px;border-bottom:1px solid ${BORDER};">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="font-size:12px;color:${MUTED};text-transform:uppercase;letter-spacing:0.5px;">Price per Share</td>
              <td align="right" style="font-size:16px;font-weight:600;color:${TEXT};">$${trade.pricePerShare.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 20px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="font-size:12px;color:${MUTED};text-transform:uppercase;letter-spacing:0.5px;">Total Amount</td>
              <td align="right" style="font-size:18px;font-weight:700;color:${GOLD};">$${trade.totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Date -->
    <p style="margin:0 0 8px;font-size:13px;color:${MUTED};text-align:center;">
      ${formattedDate}
    </p>

    ${trade.notes ? `<p style="margin:12px 0 0;font-size:13px;color:${MUTED};text-align:center;font-style:italic;">${trade.notes}</p>` : ""}
  `;

  return emailWrapper(content);
}

// ─── Investment alert email ───────────────────────────────────
interface InvestmentAlertData {
  memberName: string;
  amount: number; // positive = invest, negative = withdraw
  unitsGranted: number;
  navPerUnit: number;
  investmentDate: string;
}

function buildInvestmentAlertHtml(data: InvestmentAlertData): string {
  const isInvest = data.amount >= 0;
  const actionColor = isInvest ? GAIN : LOSS;
  const actionLabel = isInvest ? "INVESTMENT RECORDED" : "WITHDRAWAL RECORDED";
  const absAmount = Math.abs(data.amount);
  const absUnits = Math.abs(data.unitsGranted);
  const formattedDate = new Date(data.investmentDate).toLocaleDateString(
    "en-US",
    {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    }
  );

  const content = `
    <!-- Action Badge -->
    <div style="text-align:center;margin-bottom:24px;">
      <span style="display:inline-block;background-color:${actionColor}20;color:${actionColor};font-size:13px;font-weight:700;letter-spacing:1.5px;padding:6px 20px;border-radius:20px;">
        ${actionLabel}
      </span>
    </div>

    <!-- Greeting -->
    <p style="margin:0 0 24px;font-size:16px;color:${TEXT};text-align:center;">
      Hi ${data.memberName},
    </p>

    <!-- Amount Hero -->
    <div style="text-align:center;margin-bottom:24px;">
      <p style="margin:0;font-size:36px;font-weight:700;color:${actionColor};">
        ${isInvest ? "+" : "-"}$${absAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </p>
      <p style="margin:8px 0 0;font-size:14px;color:${MUTED};">
        ${isInvest ? "invested into" : "withdrawn from"} GBH Capital Fund
      </p>
    </div>

    <!-- Details Card -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:${DARK_BG};border-radius:8px;border:1px solid ${BORDER};margin-bottom:20px;">
      <tr>
        <td style="padding:16px 20px;border-bottom:1px solid ${BORDER};">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="font-size:12px;color:${MUTED};text-transform:uppercase;letter-spacing:0.5px;">Units ${isInvest ? "Granted" : "Redeemed"}</td>
              <td align="right" style="font-size:16px;font-weight:600;color:${TEXT};">${absUnits.toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 4 })}</td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 20px;border-bottom:1px solid ${BORDER};">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="font-size:12px;color:${MUTED};text-transform:uppercase;letter-spacing:0.5px;">NAV per Unit</td>
              <td align="right" style="font-size:16px;font-weight:600;color:${TEXT};">$${data.navPerUnit.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 20px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="font-size:12px;color:${MUTED};text-transform:uppercase;letter-spacing:0.5px;">Date</td>
              <td align="right" style="font-size:14px;font-weight:600;color:${TEXT};">${formattedDate}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- CTA -->
    <div style="text-align:center;margin-top:24px;">
      <a href="https://dashboard.gbhinvestments.com/dashboard/my-investment" style="display:inline-block;background-color:${GOLD};color:#000;font-size:14px;font-weight:600;text-decoration:none;padding:12px 32px;border-radius:8px;">
        View Your Investment
      </a>
    </div>
  `;

  return emailWrapper(content);
}

// ─── Send functions ───────────────────────────────────────────

export async function sendTradeAlert(
  trade: TradeAlertData,
  recipients: { email: string; name: string }[]
) {
  if (!process.env.RESEND_API_KEY) {
    console.log("RESEND_API_KEY not set — skipping trade alert email");
    return;
  }

  const html = buildTradeAlertHtml(trade);
  const subject = `${trade.action === "BUY" ? "New Purchase" : "Position Sold"}: ${trade.ticker} — ${trade.shares} shares @ $${trade.pricePerShare.toFixed(2)}`;

  // Send to all members
  const emails = recipients.map((r) => r.email);

  try {
    await getResend().emails.send({
      from: EMAIL_FROM,
      to: emails,
      subject,
      html,
    });
    console.log(`Trade alert sent to ${emails.length} member(s)`);
  } catch (err) {
    console.error("Failed to send trade alert email:", err);
  }
}

export async function sendInvestmentAlert(
  data: InvestmentAlertData,
  recipientEmail: string
) {
  if (!process.env.RESEND_API_KEY) {
    console.log("RESEND_API_KEY not set — skipping investment alert email");
    return;
  }

  const html = buildInvestmentAlertHtml(data);
  const isInvest = data.amount >= 0;
  const absAmount = Math.abs(data.amount);
  const subject = `${isInvest ? "Investment" : "Withdrawal"} Confirmed: $${absAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  try {
    await getResend().emails.send({
      from: EMAIL_FROM,
      to: recipientEmail,
      subject,
      html,
    });
    console.log(`Investment alert sent to ${recipientEmail}`);
  } catch (err) {
    console.error("Failed to send investment alert email:", err);
  }
}
