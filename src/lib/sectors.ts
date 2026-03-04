/**
 * S&P 500 GICS Sector classifications for common tickers.
 * Used for sector allocation analysis on the dashboard.
 */

export type GICSSector =
  | "Information Technology"
  | "Health Care"
  | "Financials"
  | "Consumer Discretionary"
  | "Communication Services"
  | "Industrials"
  | "Consumer Staples"
  | "Energy"
  | "Utilities"
  | "Real Estate"
  | "Materials";

// Comprehensive ticker-to-sector mapping
const TICKER_SECTOR_MAP: Record<string, GICSSector> = {
  // Information Technology
  AAPL: "Information Technology",
  MSFT: "Information Technology",
  NVDA: "Information Technology",
  AVGO: "Information Technology",
  ORCL: "Information Technology",
  CRM: "Information Technology",
  CSCO: "Information Technology",
  AMD: "Information Technology",
  ADBE: "Information Technology",
  ACN: "Information Technology",
  IBM: "Information Technology",
  INTC: "Information Technology",
  INTU: "Information Technology",
  TXN: "Information Technology",
  QCOM: "Information Technology",
  AMAT: "Information Technology",
  NOW: "Information Technology",
  PANW: "Information Technology",
  MU: "Information Technology",
  LRCX: "Information Technology",
  ADI: "Information Technology",
  KLAC: "Information Technology",
  SNPS: "Information Technology",
  CDNS: "Information Technology",
  MSI: "Information Technology",
  PLTR: "Information Technology",
  CRWD: "Information Technology",
  DELL: "Information Technology",
  FTNT: "Information Technology",
  HPQ: "Information Technology",
  HPE: "Information Technology",
  MRVL: "Information Technology",
  ON: "Information Technology",
  NXPI: "Information Technology",
  TEAM: "Information Technology",
  WDAY: "Information Technology",
  DDOG: "Information Technology",
  ZS: "Information Technology",
  NET: "Information Technology",
  SNOW: "Information Technology",
  SQ: "Information Technology",
  SHOP: "Information Technology",
  UBER: "Information Technology",
  COIN: "Information Technology",
  SOFI: "Information Technology",
  APP: "Information Technology",
  SMCI: "Information Technology",
  ARM: "Information Technology",
  MSTR: "Information Technology",
  TSM: "Information Technology",
  MDB: "Information Technology",

  // Health Care
  UNH: "Health Care",
  JNJ: "Health Care",
  LLY: "Health Care",
  ABBV: "Health Care",
  MRK: "Health Care",
  TMO: "Health Care",
  ABT: "Health Care",
  DHR: "Health Care",
  PFE: "Health Care",
  AMGN: "Health Care",
  BMY: "Health Care",
  MDT: "Health Care",
  GILD: "Health Care",
  ISRG: "Health Care",
  VRTX: "Health Care",
  SYK: "Health Care",
  BSX: "Health Care",
  REGN: "Health Care",
  ZTS: "Health Care",
  ELV: "Health Care",
  HCA: "Health Care",
  CI: "Health Care",
  CVS: "Health Care",
  MCK: "Health Care",
  COR: "Health Care",
  MRNA: "Health Care",
  BIIB: "Health Care",
  HUM: "Health Care",
  IQV: "Health Care",
  GEHC: "Health Care",
  DXCM: "Health Care",
  IDXX: "Health Care",
  A: "Health Care",
  EW: "Health Care",

  // Financials
  BRK: "Financials",
  "BRK.B": "Financials",
  "BRK-B": "Financials",
  JPM: "Financials",
  V: "Financials",
  MA: "Financials",
  BAC: "Financials",
  WFC: "Financials",
  GS: "Financials",
  MS: "Financials",
  C: "Financials",
  BLK: "Financials",
  SCHW: "Financials",
  AXP: "Financials",
  CB: "Financials",
  MMC: "Financials",
  PGR: "Financials",
  AON: "Financials",
  CME: "Financials",
  ICE: "Financials",
  USB: "Financials",
  PNC: "Financials",
  TFC: "Financials",
  COF: "Financials",
  BK: "Financials",
  AIG: "Financials",
  MET: "Financials",
  PRU: "Financials",
  AFL: "Financials",
  TRV: "Financials",
  ALL: "Financials",
  FIS: "Financials",
  FISV: "Financials",
  PYPL: "Financials",

  // Consumer Discretionary
  AMZN: "Consumer Discretionary",
  TSLA: "Consumer Discretionary",
  HD: "Consumer Discretionary",
  MCD: "Consumer Discretionary",
  NKE: "Consumer Discretionary",
  LOW: "Consumer Discretionary",
  SBUX: "Consumer Discretionary",
  TJX: "Consumer Discretionary",
  BKNG: "Consumer Discretionary",
  CMG: "Consumer Discretionary",
  ORLY: "Consumer Discretionary",
  AZO: "Consumer Discretionary",
  MAR: "Consumer Discretionary",
  HLT: "Consumer Discretionary",
  ROST: "Consumer Discretionary",
  GM: "Consumer Discretionary",
  F: "Consumer Discretionary",
  DHI: "Consumer Discretionary",
  LEN: "Consumer Discretionary",
  LULU: "Consumer Discretionary",
  YUM: "Consumer Discretionary",
  DARDEN: "Consumer Discretionary",
  DRI: "Consumer Discretionary",
  EBAY: "Consumer Discretionary",
  ETSY: "Consumer Discretionary",
  RCL: "Consumer Discretionary",
  CCL: "Consumer Discretionary",
  NCLH: "Consumer Discretionary",
  ABNB: "Consumer Discretionary",
  RIVN: "Consumer Discretionary",
  LCID: "Consumer Discretionary",

  // Communication Services
  GOOG: "Communication Services",
  GOOGL: "Communication Services",
  META: "Communication Services",
  NFLX: "Communication Services",
  DIS: "Communication Services",
  CMCSA: "Communication Services",
  T: "Communication Services",
  VZ: "Communication Services",
  TMUS: "Communication Services",
  CHTR: "Communication Services",
  WBD: "Communication Services",
  EA: "Communication Services",
  TTWO: "Communication Services",
  MTCH: "Communication Services",
  RBLX: "Communication Services",
  SPOT: "Communication Services",
  PINS: "Communication Services",
  SNAP: "Communication Services",
  ROKU: "Communication Services",
  ZM: "Communication Services",
  PARA: "Communication Services",

  // Industrials
  GE: "Industrials",
  CAT: "Industrials",
  UNP: "Industrials",
  HON: "Industrials",
  UPS: "Industrials",
  RTX: "Industrials",
  BA: "Industrials",
  LMT: "Industrials",
  DE: "Industrials",
  ADP: "Industrials",
  MMM: "Industrials",
  ETN: "Industrials",
  ITW: "Industrials",
  GD: "Industrials",
  NOC: "Industrials",
  WM: "Industrials",
  RSG: "Industrials",
  CSX: "Industrials",
  NSC: "Industrials",
  EMR: "Industrials",
  FDX: "Industrials",
  TT: "Industrials",
  PH: "Industrials",
  CARR: "Industrials",
  CTAS: "Industrials",
  ROK: "Industrials",
  PCAR: "Industrials",
  FAST: "Industrials",
  IR: "Industrials",
  GEV: "Industrials",
  VST: "Industrials",

  // Consumer Staples
  PG: "Consumer Staples",
  KO: "Consumer Staples",
  PEP: "Consumer Staples",
  COST: "Consumer Staples",
  WMT: "Consumer Staples",
  PM: "Consumer Staples",
  MO: "Consumer Staples",
  MDLZ: "Consumer Staples",
  CL: "Consumer Staples",
  KMB: "Consumer Staples",
  GIS: "Consumer Staples",
  SJM: "Consumer Staples",
  K: "Consumer Staples",
  HSY: "Consumer Staples",
  STZ: "Consumer Staples",
  ADM: "Consumer Staples",
  TGT: "Consumer Staples",
  KR: "Consumer Staples",
  SYY: "Consumer Staples",
  EL: "Consumer Staples",

  // Energy
  XOM: "Energy",
  CVX: "Energy",
  COP: "Energy",
  SLB: "Energy",
  EOG: "Energy",
  MPC: "Energy",
  PSX: "Energy",
  VLO: "Energy",
  PXD: "Energy",
  OXY: "Energy",
  HAL: "Energy",
  DVN: "Energy",
  HES: "Energy",
  BKR: "Energy",
  FANG: "Energy",
  KMI: "Energy",
  WMB: "Energy",
  OKE: "Energy",

  // Utilities
  NEE: "Utilities",
  SO: "Utilities",
  DUK: "Utilities",
  D: "Utilities",
  AEP: "Utilities",
  SRE: "Utilities",
  EXC: "Utilities",
  XEL: "Utilities",
  ED: "Utilities",
  WEC: "Utilities",
  ES: "Utilities",
  PCG: "Utilities",
  CEG: "Utilities",

  // Real Estate
  AMT: "Real Estate",
  PLD: "Real Estate",
  EQIX: "Real Estate",
  CCI: "Real Estate",
  SPG: "Real Estate",
  PSA: "Real Estate",
  O: "Real Estate",
  DLR: "Real Estate",
  WELL: "Real Estate",
  VICI: "Real Estate",
  AVB: "Real Estate",
  EQR: "Real Estate",

  // Materials
  LIN: "Materials",
  APD: "Materials",
  SHW: "Materials",
  ECL: "Materials",
  FCX: "Materials",
  NEM: "Materials",
  NUE: "Materials",
  DOW: "Materials",
  DD: "Materials",
  VMC: "Materials",
  MLM: "Materials",
  PPG: "Materials",
  ALB: "Materials",
};

// Sector colors for charts
export const SECTOR_COLORS: Record<GICSSector, string> = {
  "Information Technology": "#CE9C5C",
  "Health Care": "#5CA0CE",
  Financials: "#5CCE7A",
  "Consumer Discretionary": "#CE5C5C",
  "Communication Services": "#9B5CCE",
  Industrials: "#CE8F5C",
  "Consumer Staples": "#5CCEB8",
  Energy: "#CE5C9B",
  Utilities: "#8FCE5C",
  "Real Estate": "#5C6ECE",
  Materials: "#CEC45C",
};

export function getSector(ticker: string): GICSSector {
  const upper = ticker.toUpperCase();
  return TICKER_SECTOR_MAP[upper] || "Information Technology"; // fallback
}

export interface SectorAllocation {
  sector: GICSSector;
  value: number;
  weight: number;
  tickers: string[];
  holdingsCount: number;
}

export function calculateSectorAllocations(
  holdings: { ticker: string; currentValue: number }[]
): SectorAllocation[] {
  const totalValue = holdings.reduce((sum, h) => sum + h.currentValue, 0);
  const sectorMap = new Map<GICSSector, { value: number; tickers: string[] }>();

  for (const holding of holdings) {
    const sector = getSector(holding.ticker);
    const existing = sectorMap.get(sector) || { value: 0, tickers: [] };
    existing.value += holding.currentValue;
    existing.tickers.push(holding.ticker);
    sectorMap.set(sector, existing);
  }

  const allocations: SectorAllocation[] = [];
  for (const [sector, data] of sectorMap.entries()) {
    allocations.push({
      sector,
      value: data.value,
      weight: totalValue > 0 ? (data.value / totalValue) * 100 : 0,
      tickers: data.tickers,
      holdingsCount: data.tickers.length,
    });
  }

  // Sort by weight descending
  allocations.sort((a, b) => b.weight - a.weight);
  return allocations;
}
