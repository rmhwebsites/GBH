"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import type { HoldingWithQuote } from "@/types/database";
import {
  calculateSectorAllocations,
  SECTOR_COLORS,
  type GICSSector,
} from "@/lib/sectors";
import { formatCurrency } from "@/lib/calculations";

interface Props {
  holdings: HoldingWithQuote[];
}

export function SectorChart({ holdings }: Props) {
  const allocations = calculateSectorAllocations(holdings);

  if (allocations.length === 0) return null;

  const data = allocations.map((a) => ({
    name: a.sector,
    value: a.value,
    weight: a.weight,
    tickers: a.tickers.join(", "),
    count: a.holdingsCount,
  }));

  return (
    <div className="glass-card p-4 sm:p-6">
      <h2 className="mb-1 text-lg font-semibold text-foreground">
        Sector Allocation
      </h2>
      <p className="mb-4 text-xs text-muted">S&amp;P 500 GICS Classification</p>
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
                <Cell
                  key={entry.name}
                  fill={SECTOR_COLORS[entry.name as GICSSector] || "#666"}
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: "#0a1628",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "8px",
                color: "#f0f0f0",
                fontSize: "13px",
                maxWidth: "280px",
              }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={((value: any, _name: any, props: any) => {
                const entry = props.payload;
                return [
                  `${formatCurrency(value as number)} (${entry.weight.toFixed(1)}%)`,
                  entry.name,
                ];
              }) as any}
              labelFormatter={() => ""}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      {/* Legend - compact with truncated tickers */}
      <div className="mt-4 max-h-48 space-y-1.5 overflow-y-auto">
        {data.map((item) => (
          <div key={item.name} className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <div
                className="h-3 w-3 shrink-0 rounded-sm"
                style={{
                  backgroundColor:
                    SECTOR_COLORS[item.name as GICSSector] || "#666",
                }}
              />
              <span className="truncate text-xs text-muted">{item.name}</span>
            </div>
            <span className="shrink-0 text-xs font-medium text-foreground">
              {item.weight.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
