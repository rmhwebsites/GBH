"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  type IChartApi,
  ColorType,
  LineSeries,
} from "lightweight-charts";
import { useTheme } from "@/components/providers/ThemeProvider";
import { getChartTheme } from "@/lib/chartTheme";

interface PerformancePoint {
  time: string;
  value: number;
}

interface Props {
  portfolio: PerformancePoint[];
  sp500: PerformancePoint[];
  period: string;
}

export function PerformanceChart({ portfolio, sp500, period }: Props) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    if (!chartContainerRef.current) return;
    const colors = getChartTheme(resolvedTheme);

    // Clean up previous chart
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    // Responsive height: smaller on mobile
    const isMobile = window.innerWidth < 640;
    const chartHeight = isMobile ? 280 : 400;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: colors.textColor,
        fontFamily: "'Roboto', sans-serif",
        fontSize: isMobile ? 10 : 12,
      },
      grid: {
        vertLines: { color: colors.gridColor },
        horzLines: { color: colors.gridColor },
      },
      crosshair: {
        vertLine: {
          color: colors.crosshairColor,
          labelBackgroundColor: "#CE9C5C",
        },
        horzLine: {
          color: colors.crosshairColor,
          labelBackgroundColor: "#CE9C5C",
        },
      },
      rightPriceScale: {
        borderColor: colors.borderColor,
      },
      timeScale: {
        borderColor: colors.borderColor,
        timeVisible: false,
      },
      width: chartContainerRef.current.clientWidth,
      height: chartHeight,
    });

    chartRef.current = chart;

    // Portfolio line (gold)
    const portfolioSeries = chart.addSeries(LineSeries, {
      color: "#CE9C5C",
      lineWidth: 2,
      title: "GBH Fund",
    });

    // S&P 500 line (blue)
    const sp500Series = chart.addSeries(LineSeries, {
      color: "#5CA0CE",
      lineWidth: 2,
      title: "S&P 500",
    });

    if (portfolio.length > 0) {
      portfolioSeries.setData(portfolio);
    }
    if (sp500.length > 0) {
      sp500Series.setData(sp500);
    }

    chart.timeScale().fitContent();

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        const newIsMobile = window.innerWidth < 640;
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: newIsMobile ? 280 : 400,
        });
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [portfolio, sp500, period, resolvedTheme]);

  return <div ref={chartContainerRef} />;
}
