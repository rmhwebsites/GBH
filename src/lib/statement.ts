import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type {
  MemberDashboardData,
  PortfolioSummary,
  NavSnapshot,
} from "@/types/database";
import { calculateRiskMetrics } from "@/lib/risk";

interface StatementOptions {
  memberName: string;
  memberData: MemberDashboardData;
  portfolio?: PortfolioSummary;
  navHistory?: NavSnapshot[];
}

export function generateStatement({
  memberName,
  memberData,
  portfolio,
  navHistory,
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

  // Monthly period framing
  const monthName = today.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthStartStr = monthStart.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  // Inception date from investments
  const investmentDates = memberData.investments.map(
    (i) => new Date(i.investment_date)
  );
  const inceptionDate =
    investmentDates.length > 0
      ? new Date(Math.min(...investmentDates.map((d) => d.getTime())))
      : today;
  const inceptionStr = inceptionDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  // NAV history filtering
  const sortedNav = (navHistory || [])
    .slice()
    .sort((a, b) => new Date(a.snapshot_date).getTime() - new Date(b.snapshot_date).getTime());

  const monthNavSnapshots = sortedNav.filter((s) => {
    const d = new Date(s.snapshot_date);
    return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth();
  });

  // Previous month data for MoM comparison
  const prevMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const prevMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
  const prevMonthNav = sortedNav.filter((s) => {
    const d = new Date(s.snapshot_date);
    return d >= prevMonthStart && d <= prevMonthEnd;
  });

  // YTD data
  const ytdStart = new Date(today.getFullYear(), 0, 1);
  const ytdNavSnapshots = sortedNav.filter(
    (s) => new Date(s.snapshot_date) >= ytdStart
  );

  // ════════════════════════════════════════════
  // PAGE HEADER
  // ════════════════════════════════════════════
  doc.setFontSize(18);
  doc.setTextColor(navy);
  doc.setFont("helvetica", "bold");
  doc.text("GBH Capital", margin, y + 6);

  // Report label on right
  doc.setFontSize(9);
  doc.setTextColor(accentGold);
  doc.setFont("helvetica", "bold");
  doc.text("Monthly Investment Report", pageWidth - margin, y + 3, {
    align: "right",
  });
  doc.setFontSize(8);
  doc.setTextColor(lightText);
  doc.setFont("helvetica", "normal");
  doc.text(monthName, pageWidth - margin, y + 7, { align: "right" });

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

  const col1x = margin;
  const col2x = margin + contentWidth * 0.25;
  const col3x = margin + contentWidth * 0.5;
  const col4x = margin + contentWidth * 0.75;

  doc.setFont("helvetica", "bold");
  doc.setTextColor(darkText);
  doc.text("Account Holder", col1x, y);
  doc.text("Report Period", col2x, y);
  doc.text("Inception Date", col3x, y);
  doc.text("Account Type", col4x, y);

  y += 4;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(mediumText);
  doc.text(memberName, col1x, y);
  doc.text(`${monthStartStr} - ${statementDate}`, col2x, y);
  doc.text(inceptionStr, col3x, y);
  doc.text("Pooled Investment Fund", col4x, y);

  y += 7;

  doc.setDrawColor(ruleColor);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  // ════════════════════════════════════════════
  // ACCOUNT AT A GLANCE (5 columns now)
  // ════════════════════════════════════════════
  doc.setFontSize(11);
  doc.setTextColor(navy);
  doc.setFont("helvetica", "bold");
  doc.text("Account at a Glance", margin, y);
  y += 6;

  const boxHeight = 32;
  doc.setFillColor(247, 248, 250);
  doc.setDrawColor(ruleColor);
  doc.setLineWidth(0.2);
  doc.roundedRect(margin, y, contentWidth, boxHeight, 2, 2, "FD");

  const boxPadding = 5;
  const innerY = y + boxPadding + 3;
  const glanceColW = contentWidth / 5;

  const glColor = memberData.totalGainLoss >= 0 ? greenText : redText;
  const glSign = memberData.totalGainLoss >= 0 ? "+" : "";
  const retSign = memberData.totalGainLossPercent >= 0 ? "+" : "";

  drawSummaryColumn(doc, margin + boxPadding, innerY, "Total Invested", formatUSD(memberData.totalInvested), darkText, darkText);
  drawSummaryColumn(doc, margin + glanceColW + boxPadding, innerY, "Current Value", formatUSD(memberData.currentValue), darkText, navy);
  drawSummaryColumn(doc, margin + glanceColW * 2 + boxPadding, innerY, "Unrealized G/L", `${glSign}${formatUSD(memberData.totalGainLoss)}`, darkText, glColor);
  drawSummaryColumn(doc, margin + glanceColW * 3 + boxPadding, innerY, "Total Return", `${retSign}${memberData.totalGainLossPercent.toFixed(2)}%`, darkText, glColor);
  drawSummaryColumn(doc, margin + glanceColW * 4 + boxPadding, innerY, "NAV / Unit", formatUSD(memberData.navPerUnit), darkText, navy);

  y += boxHeight + 10;

  // ════════════════════════════════════════════
  // MONTHLY PERFORMANCE SUMMARY
  // ════════════════════════════════════════════
  if (monthNavSnapshots.length >= 2 || prevMonthNav.length > 0 || ytdNavSnapshots.length > 0) {
    doc.setFontSize(11);
    doc.setTextColor(navy);
    doc.setFont("helvetica", "bold");
    doc.text("Monthly Performance Summary", margin, y);

    doc.setFontSize(7);
    doc.setTextColor(lightText);
    doc.setFont("helvetica", "normal");
    doc.text(`  ${monthName}`, margin + 58, y);
    y += 6;

    // Performance summary box
    const perfBoxH = 24;
    doc.setFillColor(247, 248, 250);
    doc.setDrawColor(ruleColor);
    doc.setLineWidth(0.2);
    doc.roundedRect(margin, y, contentWidth, perfBoxH, 2, 2, "FD");

    const perfInnerY = y + 7;
    const perfCol = contentWidth / 4;

    // Opening NAV
    const openingNav = monthNavSnapshots.length > 0 ? monthNavSnapshots[0].nav_per_unit : memberData.navPerUnit;
    const closingNav = monthNavSnapshots.length > 0 ? monthNavSnapshots[monthNavSnapshots.length - 1].nav_per_unit : memberData.navPerUnit;
    const monthlyReturn = openingNav > 0 ? ((closingNav - openingNav) / openingNav) * 100 : 0;
    const monthlyRetSign = monthlyReturn >= 0 ? "+" : "";
    const monthlyRetColor = monthlyReturn >= 0 ? greenText : redText;

    drawSummaryColumn(doc, margin + boxPadding, perfInnerY, "Opening NAV", formatUSD(openingNav), darkText, darkText);
    drawSummaryColumn(doc, margin + perfCol + boxPadding, perfInnerY, "Closing NAV", formatUSD(closingNav), darkText, navy);
    drawSummaryColumn(doc, margin + perfCol * 2 + boxPadding, perfInnerY, "Monthly Return", `${monthlyRetSign}${monthlyReturn.toFixed(2)}%`, darkText, monthlyRetColor);

    // MoM or YTD
    if (prevMonthNav.length > 0) {
      const prevClose = prevMonthNav[prevMonthNav.length - 1].nav_per_unit;
      const prevOpen = prevMonthNav[0].nav_per_unit;
      const prevReturn = prevOpen > 0 ? ((prevClose - prevOpen) / prevOpen) * 100 : 0;
      const prevRetSign = prevReturn >= 0 ? "+" : "";
      const prevMonthName = prevMonthStart.toLocaleDateString("en-US", { month: "short" });
      drawSummaryColumn(doc, margin + perfCol * 3 + boxPadding, perfInnerY, `vs ${prevMonthName}`, `${prevRetSign}${prevReturn.toFixed(2)}%`, darkText, prevReturn >= 0 ? greenText : redText);
    } else if (ytdNavSnapshots.length > 0) {
      const ytdOpen = ytdNavSnapshots[0].nav_per_unit;
      const ytdReturn = ytdOpen > 0 ? ((closingNav - ytdOpen) / ytdOpen) * 100 : 0;
      const ytdRetSign = ytdReturn >= 0 ? "+" : "";
      drawSummaryColumn(doc, margin + perfCol * 3 + boxPadding, perfInnerY, "YTD Return", `${ytdRetSign}${ytdReturn.toFixed(2)}%`, darkText, ytdReturn >= 0 ? greenText : redText);
    }

    y += perfBoxH + 10;
  }

  // ════════════════════════════════════════════
  // ACCOUNT VALUE SUMMARY
  // ════════════════════════════════════════════
  doc.setFontSize(11);
  doc.setTextColor(navy);
  doc.setFont("helvetica", "bold");
  doc.text("Account Value Summary", margin, y);
  y += 2;

  const fundTotalValue = portfolio ? formatUSD(portfolio.totalValue) : "N/A";
  const ownershipPct = portfolio && portfolio.totalValue > 0
    ? ((memberData.currentValue / portfolio.totalValue) * 100).toFixed(3)
    : "N/A";

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
      ["Fund Total Value", fundTotalValue],
      ["Ownership Stake", ownershipPct !== "N/A" ? `${ownershipPct}%` : "N/A"],
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
        if (data.section === "body" && data.column.index === 6) {
          const text = data.cell.raw as string;
          if (text.startsWith("+")) {
            data.cell.styles.textColor = greenText;
          } else if (text.startsWith("-")) {
            data.cell.styles.textColor = redText;
          }
        }
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
  // Only include active holdings with live share quantities; excludes fully sold positions.
  const activeHoldings = (portfolio?.holdings || []).filter(
    (h) => h.is_active !== false && h.shares > 0
  );

  if (portfolio && activeHoldings.length > 0) {
    if (y > pageHeight - 60) {
      doc.addPage();
      y = margin;
    }

    doc.setFontSize(11);
    doc.setTextColor(navy);
    doc.setFont("helvetica", "bold");
    doc.text("Portfolio Holdings", margin, y);

    doc.setFontSize(7);
    doc.setTextColor(lightText);
    doc.setFont("helvetica", "normal");
    doc.text(`  As of ${statementDate}`, margin + 37, y);
    y += 2;

    const holdingRows = activeHoldings.map((h) => {
      const costBasis = h.shares * h.avg_cost_basis;
      const unrealized = h.currentValue - costBasis;
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
        "\u2014",
        "\u2014",
        formatUSD(portfolio.cashBalance),
        "\u2014",
        formatUSD(portfolio.cashBalance),
        "\u2014",
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
        if (data.section === "body" && data.column.index === 7) {
          const text = data.cell.raw as string;
          if (text.startsWith("+")) {
            data.cell.styles.textColor = greenText;
          } else if (text.startsWith("-")) {
            data.cell.styles.textColor = redText;
          }
        }
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
  // KEY POSITIONS (Top 5 Holdings)
  // ════════════════════════════════════════════
  if (portfolio && activeHoldings.length > 0) {
    if (y > pageHeight - 50) {
      doc.addPage();
      y = margin;
    }

    doc.setFontSize(11);
    doc.setTextColor(navy);
    doc.setFont("helvetica", "bold");
    doc.text("Key Positions", margin, y);

    doc.setFontSize(7);
    doc.setTextColor(lightText);
    doc.setFont("helvetica", "normal");
    doc.text("  Top 5 holdings by portfolio weight", margin + 30, y);
    y += 6;

    // Take top 5 by weight
    const topHoldings = [...activeHoldings]
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 5);

    const keyPosBoxH = 18;
    const keyPosColW = contentWidth / 5;

    doc.setFillColor(247, 248, 250);
    doc.setDrawColor(ruleColor);
    doc.setLineWidth(0.2);
    doc.roundedRect(margin, y, contentWidth, keyPosBoxH, 2, 2, "FD");

    topHoldings.forEach((h, i) => {
      const x = margin + keyPosColW * i + 4;
      const costBasis = h.shares * h.avg_cost_basis;
      const unrealized = h.currentValue - costBasis;
      const unrealizedPct = costBasis > 0 ? (unrealized / costBasis) * 100 : 0;
      const sign = unrealized >= 0 ? "+" : "";

      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(navy);
      doc.text(h.ticker, x, y + 5);

      doc.setFontSize(6.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(mediumText);
      doc.text(`${h.weight.toFixed(1)}% of fund`, x, y + 9);

      doc.setTextColor(unrealized >= 0 ? greenText : redText);
      doc.text(`${sign}${unrealizedPct.toFixed(1)}% return`, x, y + 13);
    });

    y += keyPosBoxH + 10;
  }

  // ════════════════════════════════════════════
  // NAV HISTORY TABLE
  // ════════════════════════════════════════════
  if (monthNavSnapshots.length > 0) {
    if (y > pageHeight - 60) {
      doc.addPage();
      y = margin;
    }

    doc.setFontSize(11);
    doc.setTextColor(navy);
    doc.setFont("helvetica", "bold");
    doc.text(`Daily NAV History`, margin, y);

    doc.setFontSize(7);
    doc.setTextColor(lightText);
    doc.setFont("helvetica", "normal");
    doc.text(`  ${monthName}`, margin + 36, y);
    y += 2;

    const navRows = monthNavSnapshots.map((snap, i) => {
      const prevNav = i > 0 ? monthNavSnapshots[i - 1].nav_per_unit : snap.nav_per_unit;
      const dailyChange = snap.nav_per_unit - prevNav;
      const dailyChangePct = prevNav > 0 ? (dailyChange / prevNav) * 100 : 0;
      const sign = dailyChange >= 0 ? "+" : "";

      return [
        new Date(snap.snapshot_date).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          timeZone: "UTC",
        }),
        formatUSD(snap.nav_per_unit),
        i > 0 ? `${sign}${formatUSD(dailyChange)}` : "\u2014",
        i > 0 ? `${sign}${dailyChangePct.toFixed(2)}%` : "\u2014",
        formatUSD(snap.total_value),
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
        cellPadding: { top: 2, bottom: 2, left: 2, right: 2 },
      },
      bodyStyles: {
        fontSize: 7.5,
        textColor: darkText,
        cellPadding: { top: 1.5, bottom: 1.5, left: 2, right: 2 },
      },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { halign: "right", cellWidth: 30 },
        2: { halign: "right", cellWidth: 30 },
        3: { halign: "right", cellWidth: 28 },
        4: { halign: "right" },
      },
      head: [
        ["Date", "NAV / Unit", "Daily Change", "Daily %", "Fund Total Value"],
      ],
      body: navRows,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      didParseCell: (data: any) => {
        // Color change columns
        if (data.section === "body" && (data.column.index === 2 || data.column.index === 3)) {
          const text = data.cell.raw as string;
          if (text.startsWith("+")) {
            data.cell.styles.textColor = greenText;
          } else if (text.startsWith("-")) {
            data.cell.styles.textColor = redText;
          }
        }
        if (data.section === "body" && data.row.index % 2 === 0) {
          data.cell.styles.fillColor = [248, 249, 252];
        }
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // ════════════════════════════════════════════
  // RISK SNAPSHOT
  // ════════════════════════════════════════════
  const riskMetrics = sortedNav.length >= 20 ? calculateRiskMetrics(sortedNav) : null;

  if (riskMetrics) {
    if (y > pageHeight - 45) {
      doc.addPage();
      y = margin;
    }

    doc.setFontSize(11);
    doc.setTextColor(navy);
    doc.setFont("helvetica", "bold");
    doc.text("Risk & Performance Snapshot", margin, y);

    doc.setFontSize(7);
    doc.setTextColor(lightText);
    doc.setFont("helvetica", "normal");
    doc.text(`  Based on ${riskMetrics.totalDays} trading days`, margin + 56, y);
    y += 6;

    // 2x3 grid
    const riskBoxH = 36;
    doc.setFillColor(247, 248, 250);
    doc.setDrawColor(ruleColor);
    doc.setLineWidth(0.2);
    doc.roundedRect(margin, y, contentWidth, riskBoxH, 2, 2, "FD");

    const rCol = contentWidth / 3;
    const rRow1Y = y + 7;
    const rRow2Y = y + 22;

    // Row 1
    drawSummaryColumn(doc, margin + 5, rRow1Y, "Sharpe Ratio", riskMetrics.sharpeRatio.toFixed(2), darkText, riskMetrics.sharpeRatio >= 1 ? greenText : riskMetrics.sharpeRatio >= 0 ? accentGold : redText);
    drawSummaryColumn(doc, margin + rCol + 5, rRow1Y, "Annualized Volatility", `${riskMetrics.volatility.toFixed(1)}%`, darkText, darkText);
    drawSummaryColumn(doc, margin + rCol * 2 + 5, rRow1Y, "Max Drawdown", `-${riskMetrics.maxDrawdown.toFixed(1)}%`, darkText, redText);

    // Row 2
    drawSummaryColumn(doc, margin + 5, rRow2Y, "Annualized Return", `${riskMetrics.annualizedReturn >= 0 ? "+" : ""}${riskMetrics.annualizedReturn.toFixed(1)}%`, darkText, riskMetrics.annualizedReturn >= 0 ? greenText : redText);
    drawSummaryColumn(doc, margin + rCol + 5, rRow2Y, "Win Rate", `${riskMetrics.winRate.toFixed(0)}%`, darkText, riskMetrics.winRate >= 50 ? greenText : redText);
    drawSummaryColumn(doc, margin + rCol * 2 + 5, rRow2Y, "Sortino Ratio", riskMetrics.sortinoRatio.toFixed(2), darkText, riskMetrics.sortinoRatio >= 1 ? greenText : riskMetrics.sortinoRatio >= 0 ? accentGold : redText);

    y += riskBoxH + 10;
  }

  // ════════════════════════════════════════════
  // IMPORTANT DISCLOSURES
  // ════════════════════════════════════════════
  if (y > pageHeight - 40) {
    doc.addPage();
    y = margin;
  }

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
    "This report is provided for informational purposes only and does not constitute an offer, solicitation, or recommendation to buy or sell any security.",
    "Past performance is not indicative of future results. The value of investments may fluctuate, and investors may receive back less than their original investment.",
    "All values are calculated based on the most recently available NAV and market data. Actual values may differ due to market conditions and timing of transactions.",
    "Risk metrics are calculated using historical data and may not be indicative of future risk. Sharpe and Sortino ratios use a 5% risk-free rate assumption.",
    "GBH Capital is not a registered broker-dealer or investment adviser. This document does not constitute personalized investment advice.",
  ];

  for (const disc of disclosures) {
    if (y > pageHeight - 12) {
      doc.addPage();
      y = margin;
    }
    const lines = doc.splitTextToSize(`\u2022 ${disc}`, contentWidth);
    doc.text(lines, margin, y);
    y += lines.length * 2.8 + 1;
  }

  y += 3;

  // ════════════════════════════════════════════
  // PAGE FOOTER
  // ════════════════════════════════════════════
  if (y > pageHeight - 12) {
    doc.addPage();
    y = margin;
  }

  doc.setDrawColor(navy);
  doc.setLineWidth(0.4);
  doc.line(margin, y, pageWidth - margin, y);
  y += 4;

  doc.setFontSize(7);
  doc.setTextColor(mediumText);
  doc.setFont("helvetica", "normal");
  doc.text("GBH Capital", margin, y);
  doc.text(
    `Monthly report generated ${today.toLocaleDateString("en-US")} | Confidential`,
    pageWidth - margin,
    y,
    { align: "right" }
  );

  // Save with monthly naming
  const yearMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  doc.save(`GBH-Monthly-Report-${yearMonth}.pdf`);
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
