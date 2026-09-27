import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";

interface ChartRunEntry {
  date: string;
  position: number;
  peak: number;
  weeks: number;
  chartTitle?: string;
}

interface PositionChartProps {
  data: ChartRunEntry[];
  chartTitle?: string;
  maxPosition?: number;
}

function formatDateShort(date: string): string {
  const d = new Date(date + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDateFull(date: string): string {
  const d = new Date(date + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const entry = payload[0].payload as ChartRunEntry;
  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 shadow-xl text-xs">
      <div className="font-bold text-[var(--foreground)]">{formatDateFull(entry.date)}</div>
      <div className="mt-1 space-y-0.5">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Position</span>
          <span className="font-bold text-[var(--accent)]">#{entry.position}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Peak</span>
          <span className="font-semibold text-[var(--foreground)]">#{entry.peak}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Weeks</span>
          <span className="font-semibold text-[var(--foreground)]">{entry.weeks}</span>
        </div>
      </div>
    </div>
  );
}

export function PositionChart({ data, chartTitle, maxPosition }: PositionChartProps) {
  const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
  const maxY = maxPosition || Math.max(...sorted.map((d) => d.position), 100);
  const chartMax = Math.min(maxY + 5, 100);

  const chartData = sorted.map((entry) => ({
    ...entry,
    label: formatDateShort(entry.date),
  }));

  return (
    <div className="w-full">
      {chartTitle && (
        <div className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">{chartTitle}</div>
      )}
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <XAxis
            dataKey="label"
            tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
            interval="preserveStartEnd"
          />
          <YAxis
            reversed
            domain={[1, chartMax]}
            tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
            width={35}
            tickFormatter={(v: number) => `#${v}`}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine
            y={1}
            stroke="#FFD600"
            strokeDasharray="4 4"
            strokeOpacity={0.5}
          />
          <Line
            type="monotone"
            dataKey="position"
            stroke="var(--accent)"
            strokeWidth={2.5}
            dot={(props: any) => {
              const { cx, cy, payload } = props;
              const isTop = payload.position <= 10;
              const isPeak = payload.position === payload.peak;
              return (
                <circle
                  cx={cx}
                  cy={cy}
                  r={isTop ? 5 : 3.5}
                  fill={isPeak ? "#A855F7" : isTop ? "var(--accent)" : "var(--card)"}
                  stroke={isPeak ? "#A855F7" : "var(--accent)"}
                  strokeWidth={2}
                />
              );
            }}
            activeDot={{
              r: 7,
              fill: "var(--accent)",
              stroke: "var(--card)",
              strokeWidth: 3,
            }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
