import { createFileRoute, Link } from "@tanstack/react-router";
import { getWeeklyChart } from "@/lib/charts.functions";
import { weeklyChartIds, chartsConfig, slugifyArtist, songSlug, stripAlbumEdition } from "@/lib/charts-config";
import { TrackArtists, stripFeatFromTitle } from "@/components/track-artists";
import { SpotifyItemImage } from "@/components/spotify-item-image";
import { useState, useMemo, useRef, useEffect } from "react";
import { motion } from "framer-motion";

export const Route = createFileRoute("/number-ones")({
  loader: async () => {
    const allData = await Promise.all(
      weeklyChartIds.map(id => getWeeklyChart({ data: { chartId: id } }))
    );
    return { charts: allData };
  },
  head: () => ({
    meta: [
      { title: "#1's | daegon charts" },
      { name: "description", content: "See the #1 hit on every chart for any given week." }
    ]
  }),
  component: NumberOnesPage,
});

function formatDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function WeekDropdown({ dates, selectedDate, onSelect }: { dates: string[]; selectedDate: string; onSelect: (d: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const idx = dates.indexOf(selectedDate);
  const prevDate = idx < dates.length - 1 ? dates[idx + 1] : null;
  const nextDate = idx > 0 ? dates[idx - 1] : null;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (open && listRef.current) {
      const selected = listRef.current.querySelector("[data-selected]");
      if (selected) selected.scrollIntoView({ block: "center" });
    }
  }, [open]);

  return (
    <div className="flex flex-col items-center gap-2 md:gap-3 mb-8">
      <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Week</div>
      <div className="flex flex-wrap items-center gap-2 md:gap-3">
        {prevDate ? (
          <button onClick={() => onSelect(prevDate)} className="btn-gold">
            <i className="fas fa-chevron-left" /> Prev
          </button>
        ) : (
          <button className="btn-gold" disabled><i className="fas fa-chevron-left" /> Prev</button>
        )}
        <div ref={ref} className="relative">
          <button
            onClick={() => setOpen(!open)}
            className="bg-[var(--muted)] text-[var(--foreground)] border border-[var(--border)] text-sm font-bold px-4 py-2 min-w-[200px] text-center focus:outline-none cursor-pointer flex items-center justify-center gap-2"
          >
            {formatDate(selectedDate)}
            <i className={`fas fa-chevron-down text-xs transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
          {open && (
            <div ref={listRef} className="absolute top-full left-0 right-0 z-50 bg-[var(--card)] border border-[var(--border)] max-h-[300px] overflow-y-auto">
              {dates.map((d) => (
                <button
                  key={d}
                  data-selected={d === selectedDate || undefined}
                  onClick={() => {
                    setOpen(false);
                    if (d !== selectedDate) onSelect(d);
                  }}
                  className={`w-full text-center text-sm font-bold px-4 py-2 border-b border-[var(--border)] cursor-pointer transition-colors ${
                    d === selectedDate
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
        {nextDate ? (
          <button onClick={() => onSelect(nextDate)} className="btn-gold">
            Next <i className="fas fa-chevron-right" />
          </button>
        ) : (
          <button className="btn-gold" disabled>Next <i className="fas fa-chevron-right" /></button>
        )}
      </div>
    </div>
  );
}

function NumberOnesPage() {
  const { charts } = Route.useLoaderData();

  // Find the latest date across all charts
  const allDates = useMemo(() => {
    const dateSet = new Set<string>();
    for (const chart of charts) {
      for (const d of chart.dates) dateSet.add(d);
    }
    return Array.from(dateSet).sort().reverse();
  }, [charts]);

  const [selectedDate, setSelectedDate] = useState<string>(allDates[0] || "");

  // Get #1 for each chart on the selected date
  const numberOnes = useMemo(() => {
    return charts.map(chart => {
      const entries = chart.entriesByDate[selectedDate] || [];
      const no1 = entries.find((e: any) => e.position === 1);
      const cfg = chartsConfig[chart.chartId];
      return { chartId: chart.chartId, title: cfg.title, kind: cfg.kind, icon: cfg.icon, entry: no1 ?? null };
    });
  }, [charts, selectedDate]);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-16">
      <div className="relative text-center py-10 md:py-14 mb-8 overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
          <span className="text-[6rem] md:text-[10rem] font-black font-sans text-[var(--foreground)] opacity-[0.06] uppercase tracking-tighter leading-none">#1'S</span>
        </div>
        <h1 className="text-4xl sm:text-5xl md:text-7xl font-black gold tracking-tight relative z-10 uppercase">#1's</h1>
        <p className="text-muted-foreground text-sm md:text-base mt-3 relative z-10">The #1 hit on every chart this week</p>
      </div>

      <WeekDropdown dates={allDates} selectedDate={selectedDate} onSelect={setSelectedDate} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {numberOnes.map((n, i) => (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.3, delay: i * 0.05 }}
            key={`${n.chartId}-${selectedDate}`}
            className="bg-[var(--card)] rounded-xl border border-[var(--border)] overflow-hidden hover:border-[var(--accent)] transition-all flex flex-col h-full shadow-sm"
          >
            {n.entry ? (
              <>
                <div className="flex items-center gap-3 p-4 flex-grow">
                  <div className="w-16 h-16 shrink-0">
                    <SpotifyItemImage
                      name={n.entry.name}
                      artist={n.entry.artist}
                      kind={n.kind}
                      size={64}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] uppercase text-muted-foreground font-bold tracking-widest mb-1">{n.title}</div>
                    <div className="font-bold text-sm whitespace-normal break-words">
                      {n.kind === "artist" ? (
                        <Link to="/artist/$slug" params={{ slug: slugifyArtist(n.entry.name) }} className="hover:underline hover:text-[var(--accent)]">
                          {n.entry.name}
                        </Link>
                      ) : n.kind === "album" ? (
                        <Link to="/album/$slug" params={{ slug: slugifyArtist(n.entry.name) }} className="hover:underline hover:text-[var(--accent)]">
                          {stripAlbumEdition(stripFeatFromTitle(n.entry.name))}
                        </Link>
                      ) : (
                        <Link to="/song/$slug" params={{ slug: songSlug(n.entry.name, n.entry.artist) }} className="hover:underline hover:text-[var(--accent)]">
                          {stripFeatFromTitle(n.entry.name)}
                        </Link>
                      )}
                    </div>
                    {n.kind !== "artist" && n.entry.artist && (
                      <div className="text-xs text-muted-foreground whitespace-normal break-words">
                        <Link to="/artist/$slug" params={{ slug: slugifyArtist(n.entry.artist) }} className="hover:text-[var(--accent)] hover:underline">
                          {n.entry.artist}
                        </Link>
                        <TrackArtists song={n.entry.name} artist={n.entry.artist} className="text-xs text-muted-foreground" />
                      </div>
                    )}
                  </div>
                </div>
                <Link to="/chart/$chartId/$date" params={{ chartId: n.chartId, date: selectedDate }} className="block text-center text-xs text-[var(--accent)] font-semibold py-2 border-t border-[var(--border)] hover:bg-[rgba(255,109,0,0.05)] transition-colors mt-auto">
                  View Chart →
                </Link>
              </>
            ) : (
              <div className="p-4 text-center text-muted-foreground text-sm">No data</div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
