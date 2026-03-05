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
  onCrosshairMove?: (value: number | null, time: string | null) => void;
}

export function NavHistoryChart({ data, onCrosshairMove }: Props) {
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
        const t = param.time as { year: number; month: number; day: number };
        const dateStr = `${t.year}-${String(t.month).padStart(2, "0")}-${String(t.day).padStart(2, "0")}`;
        onCrosshairMove(point.value, dateStr);
      }
    },
    [onCrosshairMove]
  );

  useEffect(() => {
    if (!chartContainerRef.current) return;

    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const goldColor = "#CE9C5C";
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
        horzLines: {
          color: "rgba(255, 255, 255, 0.04)",
          style: 1,
        },
      },
      crosshair: {
        vertLine: {
          color: "rgba(206, 156, 92, 0.3)",
          width: 1,
          style: 0,
          labelVisible: false,
        },
        horzLine: {
          color: "rgba(206, 156, 92, 0.3)",
          width: 1,
          style: 2,
          labelVisible: true,
          labelBackgroundColor: goldColor,
        },
      },
      rightPriceScale: {
        visible: true,
        borderVisible: false,
        scaleMargins: { top: 0.1, bottom: 0.1 },
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
      height: isMobile ? 280 : 400,
    });

    chartRef.current = chart;

    const areaSeries = chart.addSeries(AreaSeries, {
      lineColor: goldColor,
      topColor: "rgba(206, 156, 92, 0.25)",
      bottomColor: "rgba(206, 156, 92, 0.0)",
      lineWidth: 2,
      lineType: 2,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 5,
      crosshairMarkerBorderColor: goldColor,
      crosshairMarkerBackgroundColor: "#ffffff",
      crosshairMarkerBorderWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
      priceFormat: {
        type: "price",
        precision: 2,
        minMove: 0.01,
      },
    });

    if (data.length > 0) {
      areaSeries.setData(data);
    }

    chart.timeScale().fitContent();
    chart.subscribeCrosshairMove(handleCrosshairMove);

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
        chartRef.current.unsubscribeCrosshairMove(handleCrosshairMove);
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [data, handleCrosshairMove]);

  if (data.length === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center sm:h-[400px]">
        <p className="text-xs text-muted">No NAV history available</p>
      </div>
    );
  }

  return <div ref={chartContainerRef} className="w-full" />;
}
