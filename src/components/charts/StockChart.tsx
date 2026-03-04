"use client";

import { useEffect, useRef, useState } from "react";
import { createChart, type IChartApi, ColorType, AreaSeries } from "lightweight-charts";
import type { ChartDataPoint } from "@/types/database";

interface Props {
  ticker: string;
}

const PERIODS = [
  { label: "1M", value: "1mo" },
  { label: "3M", value: "3mo" },
  { label: "1Y", value: "1y" },
  { label: "5Y", value: "5y" },
  { label: "All", value: "max" },
] as const;

export function StockChart({ ticker }: Props) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [period, setPeriod] = useState<string>("1y");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Clean up previous chart
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const isMobile = window.innerWidth < 640;
    const chartHeight = isMobile ? 280 : 400;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "rgba(255, 255, 255, 0.85)",
        fontFamily: "'Roboto', sans-serif",
        fontSize: isMobile ? 10 : 12,
      },
      grid: {
        vertLines: { color: "rgba(255, 255, 255, 0.05)" },
        horzLines: { color: "rgba(255, 255, 255, 0.05)" },
      },
      crosshair: {
        vertLine: {
          color: "rgba(206, 156, 92, 0.4)",
          labelBackgroundColor: "#CE9C5C",
        },
        horzLine: {
          color: "rgba(206, 156, 92, 0.4)",
          labelBackgroundColor: "#CE9C5C",
        },
      },
      rightPriceScale: {
        borderColor: "rgba(255, 255, 255, 0.1)",
      },
      timeScale: {
        borderColor: "rgba(255, 255, 255, 0.1)",
        timeVisible: true,
      },
      width: chartContainerRef.current.clientWidth,
      height: chartHeight,
    });

    chartRef.current = chart;

    const areaSeries = chart.addSeries(AreaSeries, {
      topColor: "rgba(206, 156, 92, 0.3)",
      bottomColor: "rgba(206, 156, 92, 0.02)",
      lineColor: "#CE9C5C",
      lineWidth: 2,
    });

    // Fetch data
    setLoading(true);
    fetch(`/api/stocks/history/${ticker}?period=${period}`)
      .then((r) => r.json())
      .then((response) => {
        if (response.data && response.data.length > 0) {
          // Deduplicate by time
          const seen = new Set<string>();
          const unique = response.data.filter((d: ChartDataPoint) => {
            if (seen.has(d.time)) return false;
            seen.add(d.time);
            return true;
          });
          areaSeries.setData(
            unique.map((d: ChartDataPoint) => ({
              time: d.time,
              value: d.close,
            }))
          );
          chart.timeScale().fitContent();
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));

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
  }, [ticker, period]);

  return (
    <div className="glass-card p-4 sm:p-6">
      {/* Period selector */}
      <div className="mb-4 flex items-center gap-1 sm:gap-2">
        {PERIODS.map((p) => (
          <button
            key={p.value}
            onClick={() => setPeriod(p.value)}
            className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors sm:px-3 ${
              period === p.value
                ? "bg-gold/20 text-gold"
                : "text-muted hover:bg-card-glass hover:text-foreground"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="relative">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-gold border-t-transparent" />
          </div>
        )}
        <div ref={chartContainerRef} />
      </div>
    </div>
  );
}
