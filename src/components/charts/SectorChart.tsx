"use client";

import useSWR from "swr";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import type { HoldingWithQuote } from "@/types/database";
import {
  calculateSectorAllocations,
  SECTOR_COLORS,
  type GICSSector,
} from "@/lib/sectors";
import { formatCurrency } from "@/lib/calculations";
import { useTheme } from "@/components/providers/ThemeProvider";
import { getChartTheme } from "@/lib/chartTheme";

interface Props {
  holdings: HoldingWithQuote[];
}

interface LookThroughSector {
  sector: string;
  weight: number;
  value: number;
  tickers: string[];
}

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error("sector look-through unavailable");
    return r.json();
  });

export function SectorChart({ holdings }: Props) {
  const { resolvedTheme } = useTheme();
  const chartColors = getChartTheme(resolvedTheme);

  // Index funds hold every sector, so a per-ticker classification is
  // meaningless for them. Prefer the look-through, which splits each fund
  // into its own sectors. Only if that is unavailable fall back to the
  // per-ticker map — which now reports unknowns as Unclassified.
  const { data: lookThrough, error } = useSWR<{ sectors: LookThroughSector[] }>(
    "/api/portfolio/sectors",
    fetcher
  );

  const data =
    lookThrough && !error && lookThrough.sectors.length > 0
      ? lookThrough.sectors.map((s) => ({
          name: s.sector,
          value: s.value,
          weight: s.weight,
          tickers: s.tickers.join(", "),
          count: s.tickers.length,
        }))
      : calculateSectorAllocations(holdings).map((a) => ({
          name: a.sector,
          value: a.value,
          weight: a.weight,
          tickers: a.tickers.join(", "),
          count: a.holdingsCount,
        }));

  if (data.length === 0) return null;

  return (
    <div className="glass-card p-4 sm:p-6">
      <h2 className="mb-1 text-lg font-semibold text-foreground">
        Sector Allocation
      </h2>
      <p className="mb-4 text-xs text-muted">
        Seen through the funds &mdash; what the underlying companies do
      </p>
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
                backgroundColor: chartColors.tooltipBg,
                border: `1px solid ${chartColors.tooltipBorder}`,
                borderRadius: "8px",
                fontSize: "13px",
                maxWidth: "280px",
                padding: "8px 12px",
              }}
              itemStyle={{ color: chartColors.tooltipText }}
              labelStyle={{ color: chartColors.tooltipText }}
              cursor={{ fill: "rgba(206, 156, 92, 0.08)" }}
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
