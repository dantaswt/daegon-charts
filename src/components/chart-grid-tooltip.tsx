import React, { useState } from "react";

interface ChartGridTooltipProps {
  date: string;
  position: number;
  chartTitle: string;
  children: React.ReactNode;
}

function formatDateFull(date: string): string {
  const d = new Date(date + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export function ChartGridTooltip({ date, position, chartTitle, children }: ChartGridTooltipProps) {
  const [show, setShow] = useState(false);

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 pointer-events-none">
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 shadow-xl text-xs whitespace-nowrap">
            <div className="font-bold text-[var(--foreground)]">{chartTitle}</div>
            <div className="text-muted-foreground mt-0.5">{formatDateFull(date)}</div>
            <div className="mt-1 font-bold text-[var(--accent)]">#{position}</div>
          </div>
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-[var(--border)]" />
        </div>
      )}
    </div>
  );
}
