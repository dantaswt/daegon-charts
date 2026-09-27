import { Link, useNavigate } from "@tanstack/react-router";
import React from "react";
import { chartsConfig, weeklyChartIds } from "@/lib/charts-config";

const PRE_2017_CHARTS = ["songs", "artists", "albums"] as const;

export function ChartTypeNav({ activeId, date }: { activeId: string; date?: string }) {
  const [expanded, setExpanded] = React.useState(false);
  const activeCfg = chartsConfig[activeId];

  const visibleChartIds = React.useMemo(() => {
    if (date && date < "2017-01-01") return PRE_2017_CHARTS;
    return weeklyChartIds;
  }, [date]);

  return (
    <div className="flex flex-col gap-2 justify-center md:justify-start mb-6">
      {/* Mobile: show only selected + expand button */}
      <div className="md:hidden">
        <Link
          to={date ? "/chart/$chartId/$date" : "/chart/$chartId"}
          params={date ? { chartId: activeId, date } : { chartId: activeId }}
          className="w-full text-center text-sm font-bold px-4 py-2 min-h-[44px] border border-[var(--border)] cursor-pointer transition-colors uppercase tracking-wide flex items-center justify-center bg-[var(--accent)] text-black border-[var(--accent)]"
        >
          {activeCfg?.title ?? activeId}
        </Link>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="w-full text-center text-sm font-bold px-4 py-2 min-h-[44px] border border-[var(--border)] cursor-pointer transition-colors uppercase tracking-wide flex items-center justify-center gap-2 bg-[var(--muted)] text-[var(--foreground)] hover:bg-[var(--accent)] hover:text-black hover:border-[var(--accent)]"
        >
          {expanded ? "− Less" : "+ More Charts"}
        </button>
        {expanded && (
          <>
            {visibleChartIds.filter((id) => id !== activeId).map((id) => {
              const cfg = chartsConfig[id];
              return (
                <Link
                  key={id}
                  to={date ? "/chart/$chartId/$date" : "/chart/$chartId"}
                  params={date ? { chartId: id, date } : { chartId: id }}
                  className="w-full text-center text-sm font-bold px-4 py-2 min-h-[44px] border border-[var(--border)] cursor-pointer transition-colors uppercase tracking-wide flex items-center justify-center bg-[var(--muted)] text-[var(--foreground)] hover:bg-[var(--accent)] hover:text-black hover:border-[var(--accent)]"
                >
                  {cfg.title}
                </Link>
              );
            })}
            <div className="border-t border-[var(--border)] my-1" />
          </>
        )}
      </div>

      {/* Desktop: show all */}
      <div className="hidden md:flex flex-col gap-2">
        {visibleChartIds.map((id) => {
          const cfg = chartsConfig[id];
          return (
            <Link
              key={id}
              to={date ? "/chart/$chartId/$date" : "/chart/$chartId"}
              params={date ? { chartId: id, date } : { chartId: id }}
              className={`w-full text-center text-sm font-bold px-4 py-2 min-h-[44px] border border-[var(--border)] cursor-pointer transition-colors uppercase tracking-wide flex items-center justify-center ${
                activeId === id
                  ? "bg-[var(--accent)] text-black border-[var(--accent)]"
                  : "bg-[var(--muted)] text-[var(--foreground)] hover:bg-[var(--accent)] hover:text-black hover:border-[var(--accent)]"
              }`}
            >
              {cfg.title}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

interface WeekNavProps {
  chartId: string;
  dates: string[];
  currentDate: string;
}

function formatDate(d: string) {
  try {
    return new Date(d + "T00:00:00").toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return d;
  }
}

export function WeekNavigator({ chartId, dates, currentDate }: WeekNavProps) {
  const navigate = useNavigate();
  const i = dates.indexOf(currentDate);
  const prev = i > 0 ? dates[i - 1] : null;
  const next = i >= 0 && i < dates.length - 1 ? dates[i + 1] : null;
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  React.useEffect(() => {
    if (open && listRef.current) {
      const selected = listRef.current.querySelector("[data-selected]");
      if (selected) {
        selected.scrollIntoView({ block: "center" });
      }
    }
  }, [open]);

  return (
    <div className="flex flex-col items-center gap-2 md:gap-3 mb-4">
      <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Chart Week</div>
      <div className="flex flex-wrap items-center gap-2 md:gap-3">
        {prev ? (
          <Link to="/chart/$chartId/$date" params={{ chartId, date: prev }} className="btn-gold">
            <i className="fas fa-chevron-left" /> Prev
          </Link>
        ) : (
          <button className="btn-gold" disabled><i className="fas fa-chevron-left" /> Prev</button>
        )}
        <div ref={ref} className="relative">
          <button
            onClick={() => setOpen(!open)}
            className="bg-[var(--muted)] text-[var(--foreground)] border border-[var(--border)] text-sm font-bold px-4 py-2 min-w-[160px] text-center focus:outline-none cursor-pointer flex items-center justify-center gap-2"
          >
            {formatDate(currentDate)}
            <i className={`fas fa-chevron-down text-xs transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
          {open && (
            <div ref={listRef} className="absolute top-full left-0 right-0 z-50 bg-[var(--card)] border border-[var(--border)] max-h-[300px] overflow-y-auto">
              {dates.map((d) => (
                <button
                  key={d}
                  data-selected={d === currentDate || undefined}
                  onClick={() => {
                    setOpen(false);
                    if (d !== currentDate) {
                      navigate({ to: "/chart/$chartId/$date", params: { chartId, date: d } });
                    }
                  }}
                   className={`w-full text-center text-sm font-bold px-4 py-2 min-h-[44px] border-b border-[var(--border)] cursor-pointer transition-colors flex items-center justify-center ${
                    d === currentDate
                      ? "bg-[var(--accent)] text-black"
                      : "text-[var(--foreground)] hover:bg-[var(--muted)]"
                  }`}
                >
                  {formatDate(d)}
                </button>
              ))}
            </div>
          )}
        </div>
        {next ? (
          <Link to="/chart/$chartId/$date" params={{ chartId, date: next }} className="btn-gold">
            Next <i className="fas fa-chevron-right" />
          </Link>
        ) : (
          <button className="btn-gold" disabled>Next <i className="fas fa-chevron-right" /></button>
        )}
      </div>
    </div>
  );
}

export function BackToTop() {
  const [show, setShow] = React.useState(false);
  React.useEffect(() => {
    const handleScroll = () => setShow(window.scrollY > 300);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);
  
  if (!show) return null;
  
  return (
    <button 
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="fixed right-4 md:right-6 w-12 h-12 rounded-full bg-[var(--accent)] text-black flex items-center justify-center shadow-lg hover:brightness-95 transition-all z-[120] cursor-pointer touch-manipulation"
      style={{ bottom: "calc(1.25rem + env(safe-area-inset-bottom, 0px) + var(--audio-player-offset, 0px))" }}
      aria-label="Back to top"
    >
      <i className="fas fa-arrow-up text-xl" />
    </button>
  );
}
