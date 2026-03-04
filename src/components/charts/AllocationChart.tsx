"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import type { HoldingWithQuote } from "@/types/database";
import { formatCurrency } from "@/lib/calculations";

interface Props {
  holdings: HoldingWithQuote[];
}

const GOLD_SHADES = [
  "#CE9C5C",
  "#D9B37A",
  "#B58844",
  "#E5C99A",
  "#A07736",
  "#F0D9B0",
  "#8B6628",
  "#C4A870",
  "#7A571C",
  "#D4BF90",
  "#695010",
  "#BFA660",
  "#584404",
  "#AA9050",
  "#472F00",
];

export function AllocationChart({ holdings }: Props) {
  const data = holdings.map((h) => ({
    name: h.ticker,
    value: h.currentValue,
    weight: h.weight,
  }));

  if (data.length === 0) return null;

  return (
    <div className="glass-card p-6">
      <h2 className="mb-4 text-lg font-semibold text-foreground">
        Allocation
      </h2>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={2}
              dataKey="value"
            >
              {data.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={GOLD_SHADES[index % GOLD_SHADES.length]}
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
              }}
              formatter={(value) => [formatCurrency(value as number), "Value"]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      {/* Legend */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        {data.slice(0, 10).map((item, index) => (
          <div key={item.name} className="flex items-center gap-2">
            <div
              className="h-3 w-3 rounded-sm"
              style={{
                backgroundColor: GOLD_SHADES[index % GOLD_SHADES.length],
              }}
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
