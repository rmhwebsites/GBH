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
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const navy = "#0A1628";
  const gold = "#CE9C5C";
  const gray = "#6B7280";
  const darkText = "#1F2937";

  // ── Header ──
  doc.setFontSize(22);
  doc.setTextColor(navy);
  doc.setFont("helvetica", "bold");
  doc.text("GBH Capital", margin, y + 7);

  // Gold rule line
  doc.setDrawColor(gold);
  doc.setLineWidth(0.8);
  y += 14;
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  // Statement info
  doc.setFontSize(14);
  doc.setTextColor(darkText);
  doc.setFont("helvetica", "bold");
  doc.text("Investment Statement", margin, y);
  y += 7;

  doc.setFontSize(9);
  doc.setTextColor(gray);
  doc.setFont("helvetica", "normal");
  const today = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  doc.text(`Prepared for: ${memberName}`, margin, y);
  y += 5;
  doc.text(`Generated: ${today}`, margin, y);
  y += 12;

  // ── Account Summary ──
  doc.setFontSize(11);
  doc.setTextColor(darkText);
  doc.setFont("helvetica", "bold");
  doc.text("Account Summary", margin, y);
  y += 2;

  const gainLossSign = memberData.totalGainLoss >= 0 ? "+" : "";
  const returnSign = memberData.totalGainLossPercent >= 0 ? "+" : "";

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: "plain",
    styles: {
      fontSize: 9,
      cellPadding: { top: 3, bottom: 3, left: 4, right: 4 },
      textColor: darkText,
    },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: contentWidth * 0.5 },
      1: { halign: "right", cellWidth: contentWidth * 0.5 },
    },
    body: [
      ["Total Invested", formatUSD(memberData.totalInvested)],
      ["Current Value", formatUSD(memberData.currentValue)],
      ["Units Owned", memberData.totalUnits.toFixed(4)],
      ["NAV per Unit", formatUSD(memberData.navPerUnit)],
      ["Avg Entry NAV", formatUSD(memberData.avgEntryNav)],
      [
        "Gain / Loss",
        `${gainLossSign}${formatUSD(memberData.totalGainLoss)}`,
      ],
      [
        "Total Return",
        `${returnSign}${memberData.totalGainLossPercent.toFixed(2)}%`,
      ],
    ],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    didParseCell: (data: any) => {
      // Alternate row shading
      if (data.row.index % 2 === 0) {
        data.cell.styles.fillColor = [248, 249, 250];
      }
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 10;

  // ── Investment History ──
  if (memberData.investments.length > 0) {
    doc.setFontSize(11);
    doc.setTextColor(darkText);
    doc.setFont("helvetica", "bold");
    doc.text("Investment History", margin, y);
    y += 2;

    const investmentRows = memberData.investments.map((inv) => {
      const entryNav =
        inv.units_owned > 0
          ? inv.amount_invested / inv.units_owned
          : 0;
      const currentInvValue = inv.units_owned * memberData.navPerUnit;
      return [
        new Date(inv.investment_date).toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
          timeZone: "UTC",
        }),
        formatUSD(inv.amount_invested),
        entryNav > 0 ? formatUSD(entryNav) : "N/A",
        inv.units_owned.toFixed(4),
        formatUSD(currentInvValue),
      ];
    });

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      theme: "striped",
      headStyles: {
        fillColor: [10, 22, 40],
        textColor: [255, 255, 255],
        fontSize: 8,
        fontStyle: "bold",
      },
      bodyStyles: { fontSize: 8, textColor: darkText },
      columnStyles: {
        1: { halign: "right" },
        2: { halign: "right" },
        3: { halign: "right" },
        4: { halign: "right" },
      },
      head: [["Date", "Amount", "NAV at Entry", "Units", "Current Value"]],
      body: investmentRows,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // ── Portfolio Overview (top 10) ──
  if (portfolio && portfolio.holdings.length > 0) {
    // Check if we need a new page
    if (y > 230) {
      doc.addPage();
      y = margin;
    }

    doc.setFontSize(11);
    doc.setTextColor(darkText);
    doc.setFont("helvetica", "bold");
    doc.text("Portfolio Overview (Top 10 Holdings)", margin, y);
    y += 2;

    const top10 = portfolio.holdings.slice(0, 10);
    const holdingRows = top10.map((h) => [
      h.ticker,
      h.company_name.length > 30
        ? h.company_name.substring(0, 28) + "..."
        : h.company_name,
      `${h.weight.toFixed(1)}%`,
    ]);

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      theme: "striped",
      headStyles: {
        fillColor: [10, 22, 40],
        textColor: [255, 255, 255],
        fontSize: 8,
        fontStyle: "bold",
      },
      bodyStyles: { fontSize: 8, textColor: darkText },
      columnStyles: {
        2: { halign: "right" },
      },
      head: [["Ticker", "Company", "Weight"]],
      body: holdingRows,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // ── Footer / Disclaimer ──
  // Check if we need a new page for footer
  if (y > 260) {
    doc.addPage();
    y = margin;
  }

  // Gold rule before disclaimer
  doc.setDrawColor(gold);
  doc.setLineWidth(0.4);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  doc.setFontSize(7);
  doc.setTextColor(gray);
  doc.setFont("helvetica", "italic");

  const disclaimer =
    "This statement is provided for informational purposes only and does not constitute investment advice. " +
    "Past performance is not indicative of future results. Values are calculated based on the most recent NAV " +
    "and may fluctuate. Please consult with a qualified financial advisor before making investment decisions.";

  const lines = doc.splitTextToSize(disclaimer, contentWidth);
  doc.text(lines, margin, y);
  y += lines.length * 3.5 + 4;

  doc.setFont("helvetica", "normal");
  doc.text(
    `GBH Capital | Statement generated ${today}`,
    margin,
    y
  );

  // Save
  const dateStr = new Date().toISOString().split("T")[0];
  doc.save(`GBH-Statement-${dateStr}.pdf`);
}

function formatUSD(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}
