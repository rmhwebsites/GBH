"use client";

import { useEffect, useRef, useCallback } from "react";
import {
  createChart,
  type IChartApi,
  ColorType,
  AreaSeries,
} from "lightweight-charts";

interface DataPoint {
  time: string;
  value: number;
}

interface Props {
  data: DataPoint[];
  isPositive: boolean;
  onCrosshairMove?: (value: number | null, time: string | null) => void;
}

export function FundValueChart({ data, isPositive, onCrosshairMove }: Props) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  const handleCrosshairMove = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (param: any) => {
      if (!onCrosshairMove) return;

      if (!param?.time || !param?.seriesData?.size) {
        onCrosshairMove(null, null);
        return;
      }

      const entries = Array.from(param.seriesData.values());
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const point = entries[0] as any;

      if (point?.value !== undefined) {
        // Convert BusinessDay { year, month, day } to string
        const t = param.time as { year: number; month: number; day: number };
        const dateStr = `${t.year}-${String(t.month).padStart(2, "0")}-${String(t.day).padStart(2, "0")}`;
        onCrosshairMove(point.value, dateStr);
      }
    },
    [onCrosshairMove]
  );

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Clean up previous chart
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const gainColor = "#22C55E";
    const lossColor = "#EF4444";
    const lineColor = isPositive ? gainColor : lossColor;

    const isMobile = window.innerWidth < 640;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "rgba(255, 255, 255, 0.4)",
        fontFamily: "'Inter', 'Roboto', sans-serif",
        fontSize: isMobile ? 9 : 11,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { visible: false },
      },
      crosshair: {
        vertLine: {
          color: "rgba(255, 255, 255, 0.15)",
          width: 1,
          style: 0, // Solid
          labelVisible: false,
        },
        horzLine: {
          visible: false,
          labelVisible: false,
        },
      },
      rightPriceScale: {
        visible: false,
      },
      timeScale: {
        borderVisible: false,
        fixLeftEdge: true,
        fixRightEdge: true,
        timeVisible: false,
      },
      handleScroll: { mouseWheel: false, pressedMouseMove: true },
      handleScale: false,
      width: chartContainerRef.current.clientWidth,
      height: isMobile ? 160 : 200,
    });

    chartRef.current = chart;

    const areaSeries = chart.addSeries(AreaSeries, {
      lineColor,
      topColor: isPositive
        ? "rgba(34, 197, 94, 0.28)"
        : "rgba(239, 68, 68, 0.28)",
      bottomColor: isPositive
        ? "rgba(34, 197, 94, 0.0)"
        : "rgba(239, 68, 68, 0.0)",
      lineWidth: 2,
      lineType: 2, // Curved
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 5,
      crosshairMarkerBorderColor: lineColor,
      crosshairMarkerBackgroundColor: "#ffffff",
      crosshairMarkerBorderWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    if (data.length > 0) {
      areaSeries.setData(data);
    }

    chart.timeScale().fitContent();

    // Subscribe to crosshair movement
    chart.subscribeCrosshairMove(handleCrosshairMove);

    // Handle window resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        const newIsMobile = window.innerWidth < 640;
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: newIsMobile ? 160 : 200,
        });
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (chartRef.current) {
        chartRef.current.unsubscribeCrosshairMove(handleCrosshairMove);
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [data, isPositive, handleCrosshairMove]);

  if (data.length === 0) {
    return (
      <div className="flex h-[160px] items-center justify-center sm:h-[200px]">
        <p className="text-xs text-muted">No historical data available</p>
      </div>
    );
  }

  return <div ref={chartContainerRef} className="w-full" style={{ touchAction: "pan-y" }} />;
}
