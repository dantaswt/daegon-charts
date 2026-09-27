import { createFileRoute, Link, notFound, redirect } from "@tanstack/react-router";
import { getTopLatinAlbums } from "@/lib/latin-albums-chart";
import { chartsConfig, slugifyArtist } from "@/lib/charts-config";
import { ChartTypeNav } from "@/components/chart-nav";
import { ChartRow } from "@/components/chart-row";
import { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { getSpotifyImage } from "@/lib/spotify.functions";

export const Route = createFileRoute("/latin-albums/$date")({
  loader: async ({ params }) => {
    const data = await getTopLatinAlbums();
    if (!data.dates.includes(params.date)) {
      const latest = data.dates[data.dates.length - 1];
      if (latest) throw redirect({ to: "/latin-albums/$date", params: { date: latest } });
      throw notFound();
    }
    return { data, date: params.date };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Top Latin Albums | daegon charts" }] };
    const label = new Date(loaderData.date + "T00:00:00").toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    const title = `Top Latin Albums — ${label} | daegon charts`;
    return {
      meta: [
        { title },
        { name: "description", content: `Top Latin Albums chart for the week of ${label}.` },
      ],
    };
  },
  notFoundComponent: () => <div className="text-center py-16 gold font-bold">Not found</div>,
  component: TopLatinAlbumsPage,
});

function formatDate(d: string) {
  try {
    return new Date(d + "T00:00:00").toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  } catch { return d; }
}

function TopLatinAlbumsPage() {
  const { data, date } = Route.useLoaderData();
  const navigate = useNavigate();
  const entries = data.entriesByDate[date] ?? [];
  const i = data.dates.indexOf(date);
  const prev = i > 0 ? data.dates[i - 1] : null;
  const next = i >= 0 && i < data.dates.length - 1 ? data.dates[i + 1] : null;
  const [filters, setFilters] = useState<Set<string>>(new Set(["all"]));
  const [diffColors, setDiffColors] = useState(false);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const toggleFilter = (key: string) => {
    setFilters((prev) => {
      const next = new Set(prev);
      if (key === "all") return new Set(["all"]);
      next.delete("all");
      if (next.has(key)) next.delete(key);
      else next.add(key);
      if (next.size === 0) next.add("all");
      return next;
    });
  };

  const dateLabel = new Date(date + "T00:00:00").toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setOpen(false);
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

  const arrowRight = <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8h10M9 4l4 4-4 4"/></svg>;
  const arrowUp = <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3v10M4 7l4-4 4 4"/></svg>;
  const arrowDown = <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 13V3M4 9l4 4 4-4"/></svg>;

  const filtersArr = [
    { key: "all", label: "ALL" },
    { key: "debut", label: "NEW" },
    { key: "re", label: "RE" },
    { key: "rising", label: arrowUp },
    { key: "falling", label: arrowDown },
    { key: "static", label: arrowRight },
  ];

  const filteredEntries = entries.filter((e) => {
    if (filters.has("all")) return true;
    const matches: string[] = [];
    if (e.diff === "NEW") matches.push("debut");
    if (e.diff === "RE") matches.push("re");
    if (e.diff.startsWith("▲")) matches.push("rising");
    if (e.diff.startsWith("▼")) matches.push("falling");
    if (e.diff === "=" || e.diff === "" || e.diff === "-") matches.push("static");
    return matches.some((m) => filters.has(m));
  });

  const dropouts = useMemo(() => {
    if (!prev) return [];
    const prevEntries = data.entriesByDate[prev] ?? [];
    return prevEntries.filter((pe) =>
      !entries.some((ce) => ce.name === pe.name && ce.artist === pe.artist)
    );
  }, [prev, entries, data.entriesByDate]);

  return (
    <div className="max-w-7xl mx-auto w-full grid gap-6 lg:grid-cols-[280px_1fr]">
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <ChartTypeNav activeId="topLatinAlbums" date={date} />
      </aside>
      <main>
        <div className="mb-2 text-center md:text-left">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-2xl md:text-4xl font-extrabold text-[var(--foreground)] inline-flex items-center gap-2 justify-center md:justify-start uppercase">
                Top Latin Albums
              </h1>
              <p className="text-xs md:text-sm text-muted-foreground mt-1">Chart week of {dateLabel}</p>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-center gap-2 md:gap-3 mb-4">
          <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Chart Week</div>
          <div className="flex flex-wrap items-center gap-2 md:gap-3">
            {prev ? (
              <Link to="/latin-albums/$date" params={{ date: prev }} className="btn-gold">
                <i className="fas fa-chevron-left" /> Prev
              </Link>
            ) : (
              <button className="btn-gold" disabled><i className="fas fa-chevron-left" /> Prev</button>
            )}
            <div ref={dropdownRef} className="relative">
              <button
                onClick={() => setOpen(!open)}
                className="bg-[var(--muted)] text-[var(--foreground)] border border-[var(--border)] text-sm font-bold px-4 py-2 min-w-[160px] text-center focus:outline-none cursor-pointer flex items-center justify-center gap-2"
              >
                {formatDate(date)}
                <i className={`fas fa-chevron-down text-xs transition-transform ${open ? "rotate-180" : ""}`} />
              </button>
              {open && (
                <div ref={listRef} className="absolute top-full left-0 right-0 z-50 bg-[var(--card)] border border-[var(--border)] max-h-[300px] overflow-y-auto">
                  {data.dates.map((d) => (
                    <button
                      key={d}
                      data-selected={d === date || undefined}
                      onClick={() => {
                        setOpen(false);
                        if (d !== date) {
                          navigate({ to: "/latin-albums/$date", params: { date: d } });
                        }
                      }}
                      className={`w-full text-center text-sm font-bold px-4 py-2 min-h-[44px] border-b border-[var(--border)] cursor-pointer transition-colors flex items-center justify-center ${
                        d === date
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
              <Link to="/latin-albums/$date" params={{ date: next }} className="btn-gold">
                Next <i className="fas fa-chevron-right" />
              </Link>
            ) : (
              <button className="btn-gold" disabled>Next <i className="fas fa-chevron-right" /></button>
            )}
          </div>
        </div>
        <div className="flex flex-wrap justify-center gap-2 mb-4 max-w-4xl mx-auto">
          {filtersArr.map((f) => (
            <button
              key={f.key}
              onClick={() => toggleFilter(f.key)}
              className={`text-[11px] font-bold uppercase tracking-wider px-3 py-2.5 border transition-all min-h-[44px] ${
                filters.has(f.key)
                  ? "bg-[var(--accent)] text-black border-[var(--accent)]"
                  : "bg-[var(--muted)] text-[var(--foreground)] border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
              }`}
            >
              {f.label}
            </button>
          ))}
          <div className="relative group">
            <button
              onClick={() => setDiffColors((v) => !v)}
              className={`text-[11px] font-bold uppercase tracking-wider px-3 py-2.5 border transition-all min-h-[44px] ${
                diffColors
                  ? "bg-[var(--accent)] text-black border-[var(--accent)]"
                  : "bg-[var(--muted)] text-[var(--foreground)] border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
              }`}
            >
              <i className="fas fa-palette" />
            </button>
            <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 hidden group-hover:block z-50 w-52 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-lg p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-2">Color Legend</div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs"><span className="w-4 h-4 rounded bg-sky-300 inline-block" /> <span className="text-[var(--foreground)]">New entry</span></div>
                <div className="flex items-center gap-2 text-xs"><span className="w-4 h-4 rounded bg-blue-300 inline-block" /> <span className="text-[var(--foreground)]">Re-entry</span></div>
                <div className="flex items-center gap-2 text-xs"><span className="w-4 h-4 rounded bg-emerald-100 border border-emerald-300 inline-block" /> <span className="text-[var(--foreground)]">Up (small)</span></div>
                <div className="flex items-center gap-2 text-xs"><span className="w-4 h-4 rounded bg-emerald-300 inline-block" /> <span className="text-[var(--foreground)]">Up (+10 or more)</span></div>
                <div className="flex items-center gap-2 text-xs"><span className="w-4 h-4 rounded bg-red-100 border border-red-300 inline-block" /> <span className="text-[var(--foreground)]">Down (small)</span></div>
                <div className="flex items-center gap-2 text-xs"><span className="w-4 h-4 rounded bg-red-300 inline-block" /> <span className="text-[var(--foreground)]">Down (-10 or more)</span></div>
              </div>
            </div>
          </div>
        </div>
        <div className="space-y-2 md:space-y-3 max-w-4xl mx-auto">
          {filteredEntries.length > 0 ? (
            filteredEntries.map((e) => (
              <ChartRow
                key={`${e.position}-${e.name}-${e.artist}`}
                entry={e}
                kind="album"
                chartId="topLatinAlbums"
                date={date}
                chartDates={data.dates}
                chartEntriesByDate={data.entriesByDate}
                diffColors={diffColors}
                hideDetailFields
              />
            ))
          ) : (
            <div className="text-center py-8 text-muted-foreground text-sm">No entries match these filters.</div>
          )}
        </div>
        {dropouts.length > 0 && (
          <div className="mt-8 max-w-4xl mx-auto rounded-xl border border-[var(--border)] bg-[var(--muted)] p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-3">DROP-OUTS</div>
            <div className="space-y-2">
              {dropouts.map((out) => (
                <LatinDropoutChip key={`${out.name}-${out.artist}`} dropout={out} />
              ))}
            </div>
          </div>
        )}
        <div className="mt-8">
          <div className="flex flex-col items-center gap-2 md:gap-3 mb-4">
            <div className="flex flex-wrap items-center gap-2 md:gap-3">
              {prev ? (
                <Link to="/latin-albums/$date" params={{ date: prev }} className="btn-gold">
                  <i className="fas fa-chevron-left" /> Prev
                </Link>
              ) : (
                <button className="btn-gold" disabled><i className="fas fa-chevron-left" /> Prev</button>
              )}
              <div className="bg-[var(--muted)] text-[var(--foreground)] border border-[var(--border)] text-sm font-bold px-4 py-2 min-w-[160px] text-center">
                {formatDate(date)}
              </div>
              {next ? (
                <Link to="/latin-albums/$date" params={{ date: next }} className="btn-gold">
                  Next <i className="fas fa-chevron-right" />
                </Link>
              ) : (
                <button className="btn-gold" disabled>Next <i className="fas fa-chevron-right" /></button>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function LatinDropoutChip({ dropout }: { dropout: any }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const query = `album:"${dropout.name}" artist:"${dropout.artist}"`;

  useEffect(() => {
    let active = true;
    getSpotifyImage({ data: { query, type: "album" } }).then((url) => {
      if (active && url) setImageUrl(url);
    });
    return () => { active = false; };
  }, [query]);

  return (
    <Link
      to="/artist/$slug"
      params={{ slug: slugifyArtist(dropout.artist) }}
      className="flex items-start gap-3 rounded-lg border border-[var(--border-dark)] bg-[var(--muted)] p-3 text-xs text-muted-foreground transition hover:border-[var(--accent)] w-full"
    >
      <div className="w-14 h-14 overflow-hidden rounded-lg bg-[var(--muted)] flex items-center justify-center flex-shrink-0">
        {imageUrl ? (
          <img src={imageUrl} alt={dropout.artist} className="w-full h-full object-cover animate-fade-in" />
        ) : (
          <i className="fas fa-compact-disc text-xl text-[var(--muted-foreground)] animate-pulse" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-[var(--foreground)] break-words">{dropout.name}</div>
        <div className="text-[11px] text-[var(--muted-foreground)] break-words">{dropout.artist}</div>
        <div className="mt-1 text-[10px] text-[var(--muted-foreground)] flex flex-wrap gap-x-2">
          <span>LW: <span className="font-semibold">#{dropout.position}</span></span>
          {dropout.peak && <span>Peak: <span className="font-semibold">#{dropout.peak}</span></span>}
          {dropout.weeks && <span>Weeks: <span className="font-semibold">{dropout.weeks}</span></span>}
        </div>
      </div>
    </Link>
  );
}
