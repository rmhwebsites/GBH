import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type {
  MemberDashboardData,
  PortfolioSummary,
} from "@/types/database";

interface StatementOptions {
  memberName: string;
  memberData: MemberDashboardData;
  portfolio?: PortfolioSummary;
}

export function generateStatement({
  memberName,
  memberData,
  portfolio,
}: StatementOptions) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // ── Colors ──
  const navy = "#0D2137";
  const darkText = "#1a1a1a";
  const mediumText = "#4a4a4a";
  const lightText = "#7a7a7a";
  const ruleColor = "#d0d0d0";
  const accentGold = "#B8860B";
  const greenText = "#006600";
  const redText = "#CC0000";

  const today = new Date();
  const statementDate = today.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Determine statement period from investments
  const investmentDates = memberData.investments.map(
    (i) => new Date(i.investment_date)
  );
  const earliestDate =
    investmentDates.length > 0
      ? new Date(Math.min(...investmentDates.map((d) => d.getTime())))
      : today;

  const periodStart = earliestDate.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  // ════════════════════════════════════════════
  // PAGE HEADER
  // ════════════════════════════════════════════
  // Firm name
  doc.setFontSize(18);
  doc.setTextColor(navy);
  doc.setFont("helvetica", "bold");
  doc.text("GBH Capital", margin, y + 6);

  // Statement type label on right
  doc.setFontSize(9);
  doc.setTextColor(lightText);
  doc.setFont("helvetica", "normal");
  doc.text("Investment Account Statement", pageWidth - margin, y + 3, {
    align: "right",
  });
  doc.text(statementDate, pageWidth - margin, y + 7, { align: "right" });

  y += 12;

  // Heavy top rule
  doc.setDrawColor(navy);
  doc.setLineWidth(0.6);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  // ════════════════════════════════════════════
  // ACCOUNT INFORMATION BAR
  // ════════════════════════════════════════════
  doc.setFontSize(8);
  doc.setTextColor(mediumText);
  doc.setFont("helvetica", "normal");

  const col1x = margin;
  const col2x = margin + contentWidth * 0.35;
  const col3x = margin + contentWidth * 0.7;

  doc.setFont("helvetica", "bold");
  doc.setTextColor(darkText);
  doc.text("Account Holder", col1x, y);
  doc.text("Statement Period", col2x, y);
  doc.text("Account Type", col3x, y);

  y += 4;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(mediumText);
  doc.text(memberName, col1x, y);
  doc.text(`${periodStart} - ${statementDate}`, col2x, y);
  doc.text("Pooled Investment Fund", col3x, y);

  y += 7;

  // Light rule
  doc.setDrawColor(ruleColor);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  // ════════════════════════════════════════════
  // ACCOUNT AT A GLANCE
  // ════════════════════════════════════════════
  doc.setFontSize(11);
  doc.setTextColor(navy);
  doc.setFont("helvetica", "bold");
  doc.text("Account at a Glance", margin, y);
  y += 6;

  // Summary box with light background
  const boxHeight = 32;
  doc.setFillColor(247, 248, 250);
  doc.setDrawColor(ruleColor);
  doc.setLineWidth(0.2);
  doc.roundedRect(margin, y, contentWidth, boxHeight, 2, 2, "FD");

  const boxPadding = 5;
  const innerY = y + boxPadding + 3;
  const colWidth = contentWidth / 4;

  // Column 1: Total Invested
  drawSummaryColumn(doc, margin + boxPadding, innerY, "Total Invested", formatUSD(memberData.totalInvested), darkText, darkText);

  // Column 2: Current Value
  drawSummaryColumn(doc, margin + colWidth + boxPadding, innerY, "Current Value", formatUSD(memberData.currentValue), darkText, navy);

  // Column 3: Gain/Loss
  const glColor = memberData.totalGainLoss >= 0 ? greenText : redText;
  const glSign = memberData.totalGainLoss >= 0 ? "+" : "";
  drawSummaryColumn(
    doc,
    margin + colWidth * 2 + boxPadding,
    innerY,
    "Unrealized Gain/Loss",
    `${glSign}${formatUSD(memberData.totalGainLoss)}`,
    darkText,
    glColor
  );

  // Column 4: Return
  const retSign = memberData.totalGainLossPercent >= 0 ? "+" : "";
  drawSummaryColumn(
    doc,
    margin + colWidth * 3 + boxPadding,
    innerY,
    "Total Return",
    `${retSign}${memberData.totalGainLossPercent.toFixed(2)}%`,
    darkText,
    glColor
  );

  y += boxHeight + 10;

  // ════════════════════════════════════════════
  // ACCOUNT VALUE SUMMARY
  // ════════════════════════════════════════════
  doc.setFontSize(11);
  doc.setTextColor(navy);
  doc.setFont("helvetica", "bold");
  doc.text("Account Value Summary", margin, y);
  y += 2;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: "plain",
    styles: {
      fontSize: 9,
      cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 },
      textColor: darkText,
      lineColor: [220, 220, 220],
      lineWidth: 0.1,
    },
    columnStyles: {
      0: { fontStyle: "normal", cellWidth: contentWidth * 0.55, textColor: mediumText },
      1: { halign: "right", cellWidth: contentWidth * 0.45, fontStyle: "bold" },
    },
    body: [
      ["Total Amount Invested", formatUSD(memberData.totalInvested)],
      ["Current Market Value", formatUSD(memberData.currentValue)],
      ["NAV per Unit (Current)", formatUSD(memberData.navPerUnit)],
      ["NAV per Unit (Avg Entry)", formatUSD(memberData.avgEntryNav)],
      ["Total Units Held", memberData.totalUnits.toFixed(4)],
    ],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    didParseCell: (data: any) => {
      if (data.row.index % 2 === 0) {
        data.cell.styles.fillColor = [250, 250, 252];
      }
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 3;

  // Gain/Loss summary row
  doc.setFillColor(memberData.totalGainLoss >= 0 ? 240 : 255, memberData.totalGainLoss >= 0 ? 248 : 240, memberData.totalGainLoss >= 0 ? 240 : 240);
  doc.roundedRect(margin, y, contentWidth, 9, 1, 1, "F");

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(darkText);
  doc.text("Unrealized Gain/Loss", margin + 3, y + 6);

  doc.setTextColor(glColor);
  const glText = `${glSign}${formatUSD(memberData.totalGainLoss)} (${retSign}${memberData.totalGainLossPercent.toFixed(2)}%)`;
  doc.text(glText, pageWidth - margin - 3, y + 6, { align: "right" });

  y += 16;

  // ════════════════════════════════════════════
  // INVESTMENT ACTIVITY
  // ════════════════════════════════════════════
  if (memberData.investments.length > 0) {
    if (y > pageHeight - 60) {
      doc.addPage();
      y = margin;
    }

    doc.setFontSize(11);
    doc.setTextColor(navy);
    doc.setFont("helvetica", "bold");
    doc.text("Investment Activity", margin, y);
    y += 2;

    const investmentRows = memberData.investments.map((inv) => {
      const entryNav =
        inv.units_owned > 0 ? inv.amount_invested / inv.units_owned : 0;
      const currentInvValue = inv.units_owned * memberData.navPerUnit;
      const gain = currentInvValue - inv.amount_invested;
      const gainPct =
        inv.amount_invested > 0
          ? (gain / inv.amount_invested) * 100
          : 0;
      const sign = gain >= 0 ? "+" : "";

      return [
        new Date(inv.investment_date).toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
          timeZone: "UTC",
        }),
        "Contribution",
        formatUSD(inv.amount_invested),
        entryNav > 0 ? formatUSD(entryNav) : "N/A",
        inv.units_owned.toFixed(4),
        formatUSD(currentInvValue),
        `${sign}${formatUSD(gain)} (${sign}${gainPct.toFixed(1)}%)`,
      ];
    });

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      theme: "grid",
      headStyles: {
        fillColor: [13, 33, 55],
        textColor: [255, 255, 255],
        fontSize: 7.5,
        fontStyle: "bold",
        cellPadding: { top: 2.5, bottom: 2.5, left: 2, right: 2 },
      },
      bodyStyles: {
        fontSize: 7.5,
        textColor: darkText,
        cellPadding: { top: 2, bottom: 2, left: 2, right: 2 },
      },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 22 },
        2: { halign: "right", cellWidth: 22 },
        3: { halign: "right", cellWidth: 20 },
        4: { halign: "right", cellWidth: 20 },
        5: { halign: "right", cellWidth: 24 },
        6: { halign: "right" },
      },
      head: [
        [
          "Date",
          "Type",
          "Amount",
          "NAV at Entry",
          "Units",
          "Market Value",
          "Gain/Loss",
        ],
      ],
      body: investmentRows,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      didParseCell: (data: any) => {
        // Color gain/loss column
        if (data.section === "body" && data.column.index === 6) {
          const text = data.cell.raw as string;
          if (text.startsWith("+")) {
            data.cell.styles.textColor = greenText;
          } else if (text.startsWith("-")) {
            data.cell.styles.textColor = redText;
          }
        }
        // Alternate row shading
        if (data.section === "body" && data.row.index % 2 === 0) {
          data.cell.styles.fillColor = [248, 249, 252];
        }
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // ════════════════════════════════════════════
  // PORTFOLIO HOLDINGS
  // ════════════════════════════════════════════
  if (portfolio && portfolio.holdings.length > 0) {
    if (y > pageHeight - 60) {
      doc.addPage();
      y = margin;
    }

    doc.setFontSize(11);
    doc.setTextColor(navy);
    doc.setFont("helvetica", "bold");
    doc.text("Portfolio Holdings", margin, y);

    // Smaller note
    doc.setFontSize(7);
    doc.setTextColor(lightText);
    doc.setFont("helvetica", "normal");
    doc.text(`  As of ${statementDate}`, margin + 37, y);
    y += 2;

    const holdingRows = portfolio.holdings.map((h) => {
      const costBasis = h.shares * h.avg_cost_basis;
      const unrealized = h.currentValue - costBasis;
      const unrealizedPct = costBasis > 0 ? (unrealized / costBasis) * 100 : 0;
      const sign = unrealized >= 0 ? "+" : "";

      return [
        h.ticker,
        h.company_name.length > 25
          ? h.company_name.substring(0, 23) + "..."
          : h.company_name,
        formatNumber(h.shares),
        formatUSD(h.avg_cost_basis),
        formatUSD(costBasis),
        formatUSD(h.quote.price),
        formatUSD(h.currentValue),
        `${sign}${formatUSD(unrealized)}`,
        `${h.weight.toFixed(1)}%`,
      ];
    });

    // Cash row
    if (portfolio.cashBalance > 0) {
      holdingRows.push([
        "CASH",
        "Cash & Equivalents",
        "—",
        "—",
        formatUSD(portfolio.cashBalance),
        "—",
        formatUSD(portfolio.cashBalance),
        "—",
        `${((portfolio.cashBalance / portfolio.totalValue) * 100).toFixed(1)}%`,
      ]);
    }

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      theme: "grid",
      headStyles: {
        fillColor: [13, 33, 55],
        textColor: [255, 255, 255],
        fontSize: 7,
        fontStyle: "bold",
        cellPadding: { top: 2, bottom: 2, left: 1.5, right: 1.5 },
      },
      bodyStyles: {
        fontSize: 7,
        textColor: darkText,
        cellPadding: { top: 1.5, bottom: 1.5, left: 1.5, right: 1.5 },
      },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 15 },
        1: { cellWidth: 30 },
        2: { halign: "right", cellWidth: 17 },
        3: { halign: "right", cellWidth: 18 },
        4: { halign: "right", cellWidth: 22 },
        5: { halign: "right", cellWidth: 18 },
        6: { halign: "right", cellWidth: 22 },
        7: { halign: "right", cellWidth: 22 },
        8: { halign: "right" },
      },
      head: [
        [
          "Symbol",
          "Description",
          "Quantity",
          "Avg Cost",
          "Cost Basis",
          "Price",
          "Mkt Value",
          "Gain/Loss",
          "Weight",
        ],
      ],
      body: holdingRows,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      didParseCell: (data: any) => {
        // Color gain/loss column
        if (data.section === "body" && data.column.index === 7) {
          const text = data.cell.raw as string;
          if (text.startsWith("+")) {
            data.cell.styles.textColor = greenText;
          } else if (text.startsWith("-")) {
            data.cell.styles.textColor = redText;
          }
        }
        // Alternate row shading
        if (data.section === "body" && data.row.index % 2 === 0) {
          data.cell.styles.fillColor = [248, 249, 252];
        }
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 4;

    // Total row
    doc.setFillColor(13, 33, 55);
    doc.roundedRect(margin, y, contentWidth, 8, 1, 1, "F");

    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor("#ffffff");
    doc.text("Total Portfolio Value", margin + 3, y + 5.5);
    doc.text(formatUSD(portfolio.totalValue), pageWidth - margin - 3, y + 5.5, {
      align: "right",
    });

    y += 14;
  }

  // ════════════════════════════════════════════
  // IMPORTANT DISCLOSURES
  // ════════════════════════════════════════════
  if (y > pageHeight - 40) {
    doc.addPage();
    y = margin;
  }

  // Rule before disclosures
  doc.setDrawColor(ruleColor);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  doc.setFontSize(8);
  doc.setTextColor(navy);
  doc.setFont("helvetica", "bold");
  doc.text("Important Disclosures", margin, y);
  y += 4;

  doc.setFontSize(6.5);
  doc.setTextColor(lightText);
  doc.setFont("helvetica", "normal");

  const disclosures = [
    "This statement is provided for informational purposes only and does not constitute an offer, solicitation, or recommendation to buy or sell any security.",
    "Past performance is not indicative of future results. The value of investments may fluctuate, and investors may receive back less than their original investment.",
    "All values are calculated based on the most recently available NAV and market data. Actual values may differ due to market conditions and timing of transactions.",
    "GBH Capital is not a registered broker-dealer or investment adviser. This document does not constitute personalized investment advice.",
  ];

  for (const disc of disclosures) {
    const lines = doc.splitTextToSize(`• ${disc}`, contentWidth);
    doc.text(lines, margin, y);
    y += lines.length * 2.8 + 1;
  }

  y += 3;

  // ════════════════════════════════════════════
  // PAGE FOOTER
  // ════════════════════════════════════════════
  doc.setDrawColor(navy);
  doc.setLineWidth(0.4);
  doc.line(margin, y, pageWidth - margin, y);
  y += 4;

  doc.setFontSize(7);
  doc.setTextColor(mediumText);
  doc.setFont("helvetica", "normal");
  doc.text("GBH Capital", margin, y);
  doc.text(
    `Statement generated ${today.toLocaleDateString("en-US")} | Confidential`,
    pageWidth - margin,
    y,
    { align: "right" }
  );

  // Save
  const dateStr = today.toISOString().split("T")[0];
  doc.save(`GBH-Capital-Statement-${dateStr}.pdf`);
}

// ── Helper Functions ──

function drawSummaryColumn(
  doc: jsPDF,
  x: number,
  y: number,
  label: string,
  value: string,
  labelColor: string,
  valueColor: string
) {
  doc.setFontSize(7);
  doc.setTextColor(labelColor);
  doc.setFont("helvetica", "normal");
  doc.text(label, x, y);

  doc.setFontSize(11);
  doc.setTextColor(valueColor);
  doc.setFont("helvetica", "bold");
  doc.text(value, x, y + 6);
}

function formatUSD(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value);
}
