"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import type { HoldingWithQuote } from "@/types/database";
import { formatCurrency } from "@/lib/calculations";

interface Props {
  holdings: HoldingWithQuote[];
  cashBalance?: number;
}

/**
 * Company brand colors for popular tickers.
 * Falls back to a vibrant palette for unmapped tickers.
 */
const BRAND_COLORS: Record<string, string> = {
  // Technology
  AAPL: "#A2AAAD",
  MSFT: "#00A4EF",
  GOOGL: "#4285F4",
  GOOG: "#4285F4",
  AMZN: "#FF9900",
  META: "#0668E1",
  NVDA: "#76B900",
  TSLA: "#E31937",
  AVGO: "#CC092F",
  CRM: "#00A1E0",
  ORCL: "#F80000",
  CSCO: "#049FD9",
  AMD: "#ED1C24",
  ADBE: "#FF0000",
  INTC: "#0071C5",
  IBM: "#0530AD",
  QCOM: "#3253DC",
  TXN: "#CC0000",
  INTU: "#365EBF",
  NOW: "#81B5A1",
  PLTR: "#101010",
  CRWD: "#FF4438",
  PANW: "#FA582D",
  SHOP: "#96BF48",
  SQ: "#3E4348",
  UBER: "#000000",
  COIN: "#0052FF",
  SNOW: "#29B5E8",
  NET: "#F38020",
  DDOG: "#632CA6",
  ARM: "#0091BD",
  DELL: "#007DB8",
  MU: "#00549F",
  SMCI: "#5A2D82",
  TSM: "#0050A0",

  // Health Care
  UNH: "#002677",
  JNJ: "#D51920",
  LLY: "#D52B1E",
  ABBV: "#071D49",
  MRK: "#009A9B",
  PFE: "#0093D0",
  TMO: "#FF6600",
  ABT: "#0072BB",
  AMGN: "#0063BE",
  BMY: "#753BBD",
  MDT: "#004B87",
  GILD: "#C8102E",
  ISRG: "#00A3E0",
  VRTX: "#E4002B",
  CVS: "#CC0000",
  CI: "#0C2340",
  HCA: "#0D5C2E",
  MRNA: "#00B0F0",
  BIIB: "#005DAB",

  // Financials
  JPM: "#004B87",
  V: "#1A1F71",
  MA: "#EB001B",
  BAC: "#012169",
  WFC: "#D71E28",
  GS: "#6FA8DC",
  MS: "#003986",
  C: "#003DA5",
  BLK: "#000000",
  SCHW: "#00A3E0",
  AXP: "#016FD0",
  PGR: "#0060A9",
  COF: "#D03027",
  PYPL: "#003087",
  FISV: "#FF6600",

  // Consumer Discretionary
  HD: "#F96302",
  MCD: "#FFC72C",
  NKE: "#111111",
  LOW: "#004990",
  SBUX: "#00704A",
  TJX: "#E21A2C",
  BKNG: "#003580",
  CMG: "#A81612",
  LULU: "#D31334",
  GM: "#0170CE",
  F: "#003478",
  YUM: "#E21836",
  ABNB: "#FF5A5F",
  RCL: "#0065B8",

  // Communication Services
  NFLX: "#E50914",
  DIS: "#006E99",
  CMCSA: "#0080C8",
  T: "#009FDB",
  VZ: "#CD040B",
  TMUS: "#E20074",
  SPOT: "#1DB954",
  SNAP: "#FFFC00",
  PINS: "#E60023",
  ROKU: "#6C3C97",
  EA: "#000000",
  ZM: "#2D8CFF",
  RBLX: "#E2231A",

  // Industrials
  CAT: "#FFCD11",
  UNP: "#004990",
  HON: "#E4002B",
  UPS: "#351C15",
  BA: "#0033A0",
  LMT: "#000000",
  DE: "#367C2B",
  RTX: "#003DA5",
  GE: "#3B73B9",
  FDX: "#4D148C",
  WM: "#00843D",
  MMM: "#CC0000",
  GEV: "#2DBECD",

  // Consumer Staples
  PG: "#003DA5",
  KO: "#F40009",
  PEP: "#004B93",
  COST: "#E31837",
  WMT: "#0071CE",
  PM: "#6C4C3E",
  MDLZ: "#4F2170",
  CL: "#E4002B",
  TGT: "#CC0000",
  KR: "#0062AB",
  STZ: "#003057",

  // Energy
  XOM: "#ED1C24",
  CVX: "#0066B2",
  COP: "#BE1E2D",
  SLB: "#0066B2",
  OXY: "#CF202E",
  MPC: "#003B71",
  PSX: "#003D6B",
  HAL: "#CC0000",

  // Utilities / Real Estate / Materials
  NEE: "#003366",
  SO: "#00447C",
  DUK: "#00789E",
  AMT: "#1E3A5F",
  PLD: "#003B5C",
  LIN: "#003366",
  SHW: "#0A53A8",
  FCX: "#E3541B",
  NEM: "#003C72",
  CEG: "#0065A4",
};

// Vibrant fallback palette for tickers not in the brand map
const FALLBACK_COLORS = [
  "#6366F1", // indigo
  "#EC4899", // pink
  "#14B8A6", // teal
  "#F59E0B", // amber
  "#8B5CF6", // violet
  "#06B6D4", // cyan
  "#EF4444", // red
  "#84CC16", // lime
  "#F97316", // orange
  "#A855F7", // purple
  "#22D3EE", // sky
  "#FB7185", // rose
  "#34D399", // emerald
  "#FBBF24", // yellow
  "#818CF8", // periwinkle
];

const CASH_COLOR = "#CE9C5C"; // gold for cash

function getTickerColor(ticker: string, index: number): string {
  if (ticker === "CASH") return CASH_COLOR;
  return BRAND_COLORS[ticker.toUpperCase()] || FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

export function AllocationChart({ holdings, cashBalance = 0 }: Props) {
  // Calculate total including cash for proper weight calculation
  const stockTotal = holdings.reduce((sum, h) => sum + h.currentValue, 0);
  const grandTotal = stockTotal + cashBalance;

  const data = holdings.map((h, i) => ({
    name: h.ticker,
    value: h.currentValue,
    weight: grandTotal > 0 ? (h.currentValue / grandTotal) * 100 : h.weight,
    color: getTickerColor(h.ticker, i),
  }));

  // Add cash slice if there's a cash balance
  if (cashBalance > 0 && grandTotal > 0) {
    data.push({
      name: "CASH",
      value: cashBalance,
      weight: (cashBalance / grandTotal) * 100,
      color: CASH_COLOR,
    });
  }

  if (data.length === 0) return null;

  return (
    <div className="glass-card p-4 sm:p-6">
      <h2 className="mb-4 text-lg font-semibold text-foreground">
        Allocation
      </h2>
      <div className="h-52 sm:h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={2}
              dataKey="value"
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: "#0a1628",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: "8px",
                fontSize: "13px",
                padding: "8px 12px",
              }}
              itemStyle={{ color: "#f0f0f0" }}
              labelStyle={{ color: "#f0f0f0" }}
              cursor={{ fill: "rgba(206, 156, 92, 0.08)" }}
              formatter={(value) => [formatCurrency(value as number), "Value"]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      {/* Legend */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        {data.slice(0, 14).map((item) => (
          <div key={item.name} className="flex items-center gap-2">
            <div
              className="h-3 w-3 shrink-0 rounded-sm"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-xs text-muted">
              {item.name}{" "}
              <span className="text-foreground">
                {item.weight.toFixed(1)}%
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
