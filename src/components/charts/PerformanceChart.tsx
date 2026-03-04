"use client";

import { useEffect, useRef, useState } from "react";
import {
  createChart,
  type IChartApi,
  ColorType,
  LineSeries,
} from "lightweight-charts";

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

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Clean up previous chart
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "rgba(255, 255, 255, 0.55)",
        fontFamily: "'Roboto', sans-serif",
      },
      grid: {
        vertLines: { color: "rgba(255, 255, 255, 0.05)" },
        horzLines: { color: "rgba(255, 255, 255, 0.05)" },
      },
      crosshair: {
        vertLine: { color: "rgba(206, 156, 92, 0.3)" },
        horzLine: { color: "rgba(206, 156, 92, 0.3)" },
      },
      rightPriceScale: {
        borderColor: "rgba(255, 255, 255, 0.1)",
      },
      timeScale: {
        borderColor: "rgba(255, 255, 255, 0.1)",
        timeVisible: false,
      },
      width: chartContainerRef.current.clientWidth,
      height: 400,
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
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
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
  }, [portfolio, sp500, period]);

  return <div ref={chartContainerRef} />;
}
