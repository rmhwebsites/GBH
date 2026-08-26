// Chart colors that can't come from CSS variables — lightweight-charts and
// Recharts tooltip styles take literal color strings, so charts read the
// resolved theme and rebuild when it changes.

import type { ResolvedTheme } from "@/components/providers/ThemeProvider";

export interface ChartTheme {
  textColor: string;
  textColorSubtle: string;
  gridColor: string;
  borderColor: string;
  crosshairColor: string;
  tooltipBg: string;
  tooltipBorder: string;
  tooltipText: string;
}

const DARK: ChartTheme = {
  textColor: "rgba(255, 255, 255, 0.85)",
  textColorSubtle: "rgba(255, 255, 255, 0.4)",
  gridColor: "rgba(255, 255, 255, 0.05)",
  borderColor: "rgba(255, 255, 255, 0.1)",
  crosshairColor: "rgba(206, 156, 92, 0.4)",
  tooltipBg: "#0a1628",
  tooltipBorder: "rgba(255, 255, 255, 0.1)",
  tooltipText: "#f0f0f0",
};

const LIGHT: ChartTheme = {
  textColor: "rgba(19, 39, 67, 0.85)",
  textColorSubtle: "rgba(19, 39, 67, 0.45)",
  gridColor: "rgba(0, 35, 102, 0.06)",
  borderColor: "rgba(0, 35, 102, 0.12)",
  crosshairColor: "rgba(154, 116, 52, 0.5)",
  tooltipBg: "#ffffff",
  tooltipBorder: "rgba(0, 35, 102, 0.15)",
  tooltipText: "#132743",
};

export function getChartTheme(resolved: ResolvedTheme): ChartTheme {
  return resolved === "light" ? LIGHT : DARK;
}
