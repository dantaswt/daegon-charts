import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { getYearEndGenerated, getYearEndNewArtists, type YECEntry } from "@/lib/charts.functions";
import { getYearEndHot100Artists, getYearEndTop100AlbumsArtists, getYearEndArtist50Male, getYearEndArtist50Female, getYearEndArtist50DuoGroup, getYearEndRadioSongsArtists, getYearEndTopLatinAlbums } from "@/lib/yec-computed";
import { chartsConfig, yearEndChartIds, slugifyArtist, songSlug, stripAlbumEdition } from "@/lib/charts-config";
import { ChartImage } from "@/components/chart-image";
import { SpotifyItemImage } from "@/components/spotify-item-image";
import { TrackArtists, stripFeatFromTitle, getFeatArtistsFromTitle } from "@/components/track-artists";
import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";

export const Route = createFileRoute("/year-end/$chartId")({
  loader: async ({ params }) => {
    const cfg = chartsConfig[params.chartId];
    if (!cfg || cfg.group !== "yearEnd") throw notFound();

    if (params.chartId === "yearEndNewArtists") {
      const data = await getYearEndNewArtists();
      return { data, chartId: params.chartId, mappedId: "artists" };
    }
    if (params.chartId === "yecHot100Artists") {
      const data = await getYearEndHot100Artists();
      return { data, chartId: params.chartId, mappedId: "artists" };
    }
    if (params.chartId === "yecTop100AlbumsArtists") {
      const data = await getYearEndTop100AlbumsArtists();
      return { data, chartId: params.chartId, mappedId: "artists" };
    }
    if (params.chartId === "yecArtist50Male") {
      const data = await getYearEndArtist50Male();
      return { data, chartId: params.chartId, mappedId: "artists" };
    }
    if (params.chartId === "yecArtist50Female") {
      const data = await getYearEndArtist50Female();
      return { data, chartId: params.chartId, mappedId: "artists" };
    }
    if (params.chartId === "yecArtist50DuoGroup") {
      const data = await getYearEndArtist50DuoGroup();
      return { data, chartId: params.chartId, mappedId: "artists" };
    }
    if (params.chartId === "yecRadioSongsArtists") {
      const data = await getYearEndRadioSongsArtists();
      return { data, chartId: params.chartId, mappedId: "artists" };
    }
    if (params.chartId === "yecTopLatinAlbums") {
      const data = await getYearEndTopLatinAlbums();
      return { data, chartId: params.chartId, mappedId: "albums" };
    }

    const weeklyId = params.chartId.replace("yearEnd", "").replace(/^./, (c) => c.toLowerCase());
    const weeklyMap: Record<string, string> = {
      songs: "songs", artists: "artists", albums: "albums", radio: "radioSongs",
      streamingSongs: "streamingSongs", topStreamingAlbums: "topStreamingAlbums",
      topAlbumSales: "topAlbumSales", digitalSongsSales: "digitalSongsSales",
    };
    const mappedId = weeklyMap[weeklyId] ?? weeklyId;
    const data = await getYearEndGenerated({ data: { chartId: mappedId } });
    return { data, chartId: params.chartId, mappedId };
  },
  head: ({ loaderData }) => {
    const t = loaderData ? chartsConfig[loaderData.chartId]?.title : "Year-End";
    return { meta: [{ title: `Year-End Charts - ${t} | daegon charts` }] };
  },
  notFoundComponent: () => <div className="text-center py-16 gold font-bold">Not found</div>,
  component: YearEndChartPage,
});

function formatMetric(v: number, metricKey: string): string {
  if (v <= 0) return "-";
  if (metricKey === "total" || metricKey === "streams") {
    if (v >= 1_000_000) {
      const val = v / 1_000_000;
      return val % 1 === 0 ? `${val}B` : `${parseFloat(val.toFixed(1))}B`;
    }
    if (v >= 1_000) {
      const val = v / 1_000;
      return val % 1 === 0 ? `${val}M` : `${parseFloat(val.toFixed(1))}M`;
    }
    return `${v}`;
  }
  return v.toLocaleString("en-US");
}

function YearDropdown({ years, selectedYear, onSelect, label = "Year" }: { years: string[]; selectedYear: string; onSelect: (y: string) => void; label?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const yearIdx = years.indexOf(selectedYear);
  const prevYear = yearIdx < years.length - 1 ? years[yearIdx + 1] : null;
  const nextYear = yearIdx > 0 ? years[yearIdx - 1] : null;

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
    <div className="flex flex-col items-center gap-2 md:gap-3 mb-4">
      <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">{label}</div>
      <div className="flex flex-wrap items-center gap-2 md:gap-3">
        {prevYear ? (
          <button onClick={() => onSelect(prevYear)} className="btn-gold">
            <i className="fas fa-chevron-left" /> Prev
          </button>
        ) : (
          <button className="btn-gold" disabled><i className="fas fa-chevron-left" /> Prev</button>
        )}
        <div ref={ref} className="relative">
          <button
            onClick={() => setOpen(!open)}
            className="bg-[var(--muted)] text-[var(--foreground)] border border-[var(--border)] text-sm font-bold px-4 py-2 min-w-[160px] text-center focus:outline-none cursor-pointer flex items-center justify-center gap-2"
          >
            {selectedYear}
            <i className={`fas fa-chevron-down text-xs transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
          {open && (
            <div ref={listRef} className="absolute top-full left-0 right-0 z-50 bg-[var(--card)] border border-[var(--border)] max-h-[300px] overflow-y-auto">
              {years.map((y) => (
                <button
                  key={y}
                  data-selected={y === selectedYear || undefined}
                  onClick={() => {
                    setOpen(false);
                    if (y !== selectedYear) onSelect(y);
                  }}
                  className={`w-full text-center text-sm font-bold px-4 py-2 border-b border-white/20 cursor-pointer transition-colors ${
                    y === selectedYear
                    ? "bg-[var(--accent)] text-black"
                    : "text-[var(--foreground)] hover:bg-[var(--muted)]"
                  }`}
                >
                  {y}
                </button>
              ))}
            </div>
          )}
        </div>
        {nextYear ? (
          <button onClick={() => onSelect(nextYear)} className="btn-gold">
            Next <i className="fas fa-chevron-right" />
          </button>
        ) : (
          <button className="btn-gold" disabled>Next <i className="fas fa-chevron-right" /></button>
        )}
      </div>
    </div>
  );
}

function YearEndChartPage() {
  const { data, chartId, mappedId } = Route.useLoaderData();
  const cfg = chartsConfig[chartId];
  const lockedUntil = new Date("2026-12-31T23:59:59");
  const items = (data.years ?? []).filter((y: string) => y !== "2026" || new Date() >= lockedUntil);
  const entriesByKey = data.entriesByYear;
  const [selectedYear, setSelectedYear] = useState<string>(items[0] || "");
  const selectedKey = selectedYear;
  const [detailsOpen, setDetailsOpen] = useState<Record<string, boolean>>({});
  const entries = selectedKey ? entriesByKey[selectedKey] ?? [] : [];
  const isAlbum = data.kind === "album";
  const isArtist = data.kind === "artist";

  const isArtistChart = chartId === "yecHot100Artists" || chartId === "yecTop100AlbumsArtists" || chartId === "yecRadioSongsArtists";

  useEffect(() => {
    document.title = `Year-End Charts — ${cfg?.title ?? "Year-End"} | daegon charts`;
  }, [cfg]);

  const metricKey = chartId === "yecHot100Artists" || chartId === "yecTopLatinAlbums" ? "points" : chartId === "yecTop100AlbumsArtists" || chartId === "yecArtist50Male" || chartId === "yecArtist50Female" ? "units" : chartId === "yearEndTopStreamingAlbums" ? "total" : chartId === "yecRadioSongsArtists" ? "audience" : mappedId === "songs" ? "points" : mappedId === "streamingSongs" || mappedId === "topStreamingAlbums" ? "streams" : mappedId === "radioSongs" ? "audience" : mappedId === "topAlbumSales" || mappedId === "digitalSongsSales" ? "sales" : "units";
  const metricLabel = metricKey === "total" ? "Total Streams" : metricKey === "points" ? "Points" : metricKey === "streams" ? "Streams" : metricKey === "audience" ? "Audience" : metricKey === "sales" ? "Sales" : "Units";

  const toggleDetails = (key: string) => {
    setDetailsOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="max-w-7xl mx-auto w-full grid gap-6 lg:grid-cols-[280px_1fr]">
      {/* Fixed chart type nav sidebar */}
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="flex flex-col gap-2 justify-center md:justify-start mb-6">
          {/* Mobile: collapse */}
          <div className="md:hidden">
            <Link
              to="/year-end/$chartId"
              params={{ chartId }}
              className="w-full text-center text-sm font-bold px-4 py-2 min-h-[44px] border border-[var(--border)] cursor-pointer transition-colors uppercase tracking-wide flex items-center justify-center bg-[var(--accent)] text-black border-[var(--accent)]"
            >
              {chartsConfig[chartId]?.title ?? chartId}
            </Link>
            <YECMobExpand activeId={chartId} year={selectedYear} />
          </div>
          {/* Desktop: show all */}
          <div className="hidden md:flex flex-col gap-2 max-h-[calc(100vh-10rem)] overflow-y-auto pr-1">
            {(selectedYear && selectedYear < "2017" ? [...YEAR_END_PRE_2017] : [...yearEndChartIds]).map((id) => {
              const c = chartsConfig[id];
              return (
                <Link
                  key={id}
                  to="/year-end/$chartId"
                  params={{ chartId: id }}
                  className={`w-full text-center text-sm font-bold px-4 py-2 border border-[var(--border)] cursor-pointer transition-colors uppercase tracking-wide ${
                    id === chartId
                      ? "bg-[var(--accent)] text-black border-[var(--accent)]"
                      : "bg-[var(--muted)] text-[var(--foreground)] hover:bg-[var(--accent)] hover:text-black hover:border-[var(--accent)]"
                  }`}
                >
                  {c.title}
                </Link>
              );
            })}
          </div>
        </div>
        <Link to="/year-end" className="sidebar-section block hover:border-[var(--accent)] transition-all">
          <div className="text-xs uppercase text-muted-foreground font-bold tracking-widest"><i className="fas fa-arrow-left mr-2" />All Year-End</div>
        </Link>
      </aside>

      {/* Content */}
      <main>
        {/* Header */}
        <div className="mb-2 text-center">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex-1">
              <h1 className="text-2xl md:text-4xl font-extrabold text-[var(--foreground)] inline-flex items-center gap-2 justify-center">
                {cfg?.title ?? "Year-End"}
              </h1>

            </div>
            <div className="flex justify-center sm:justify-end">
              <ChartImage
                entries={entries.map((e) => ({ position: e.position, diff: "", name: e.name, artist: e.artist, peak: e.peak, weeks: e.weeks, weeksAt1: e.weeksAt1 }))}
                chartTitle={cfg?.title ?? "Year-End"}
                chartId={chartId}
                date={`${selectedKey}-12-31`}
                kind={data.kind}
                hideWeeksAt1
                hideLastWeek
              />
            </div>
          </div>
        </div>

        {/* Year navigator */}
        <YearDropdown years={items} selectedYear={selectedKey} onSelect={setSelectedYear} />

        {/* Entries */}
        {entries.length > 0 ? (
          <div className="space-y-3 max-w-4xl mx-auto">
            {entries.map((e: YECEntry) => {
              const isFirst = e.position === 1;
              const entryKey = `${selectedKey}-${e.position}-${e.name}`;
              const isOpen = detailsOpen[entryKey] ?? false;
              return (
                <motion.div
                  key={entryKey}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3 }}
                  className="chart-card w-full"
                >
                  {/* Desktop layout */}
                  <div className="hidden md:grid gap-3 items-center" style={{ gridTemplateColumns: "auto auto minmax(0,1fr) auto" }}>
                    <div className="flex flex-col items-center justify-center w-16">
                      <div className={`rank-num font-black ${isFirst ? "text-4xl bg-[var(--accent)] text-black w-16 h-16 flex items-center justify-center" : "text-3xl"}`}>{e.position}</div>
                    </div>
                    <div className={`placeholder-art flex items-center justify-center overflow-hidden bg-[var(--muted)] rounded-none flex-shrink-0 ${isFirst ? "w-[180px] h-[180px] border-l-4 border-[var(--accent)]" : "w-24 h-24"}`}>
                      <SpotifyItemImage name={e.name} artist={e.artist} kind={data.kind} size={isFirst ? 180 : 96} />
                    </div>
                    <div className="min-w-0 flex flex-col flex-1">
                      <div className={`font-bold break-words line-clamp-2 flex flex-wrap items-center gap-1.5 ${isFirst ? "text-xl" : "text-base"}`}>
                        {e.kind === "artist" ? (
                          <Link to="/artist/$slug" params={{ slug: slugifyArtist(e.name) }} className="hover:text-[var(--accent)] hover:underline">{e.name}</Link>
                        ) : e.kind === "album" ? (
                          <Link to="/album/$slug" params={{ slug: slugifyArtist(e.name) }} className="hover:text-[var(--accent)] hover:underline">{stripAlbumEdition(e.name)}</Link>
                        ) : (
                          <Link to="/song/$slug" params={{ slug: songSlug(e.name, e.artist) }} className="hover:text-[var(--accent)] hover:underline">{stripFeatFromTitle(e.name)}</Link>
                        )}
                      </div>
                      {e.kind !== "artist" && (
                        <div className={`break-words line-clamp-2 ${isFirst ? "text-base text-[var(--muted-foreground)]" : "text-sm text-[var(--muted-foreground)]"}`}>
                          <Link to="/artist/$slug" params={{ slug: slugifyArtist(e.kind === "album" ? (getFeatArtistsFromTitle(e.artist)?.artists ?? e.artist) : e.artist) }} className="hover:text-[var(--accent)] hover:underline">{e.kind === "album" ? (getFeatArtistsFromTitle(e.artist)?.artists ?? e.artist) : e.artist}</Link>
                          {e.kind === "song" && <TrackArtists song={e.name} artist={e.artist} className="text-sm text-[var(--muted-foreground)]" />}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-4 flex-shrink-0">
                      <button type="button" onClick={() => toggleDetails(entryKey)} className="details-btn w-8 h-8 rounded-full bg-[var(--muted)] text-[var(--foreground)] text-sm hover:bg-[var(--border)] active:bg-[var(--accent)] active:text-white active:scale-95 transition-all duration-200 flex items-center justify-center" aria-label="Toggle details">
                        {isOpen ? "−" : "+"}
                      </button>
                    </div>
                  </div>

                  {/* Mobile layout */}
                  <div className="md:hidden">
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col items-center justify-center w-8 flex-shrink-0">
                        <div className="rank-num text-xl font-black leading-none">{e.position}</div>
                      </div>
                      <div className={`placeholder-art flex items-center justify-center overflow-hidden bg-[var(--muted)] flex-shrink-0 ${isFirst ? "w-[68px] h-[68px] border-l-[3px] border-[var(--accent)]" : "w-[64px] h-[64px]"}`}>
                        <SpotifyItemImage name={e.name} artist={e.artist} kind={data.kind} size={isFirst ? 68 : 64} />
                      </div>
                      <div className="min-w-0 flex-1 flex flex-col justify-center">
                        <div className="font-bold text-[13px] leading-tight break-words line-clamp-2 flex flex-wrap items-center gap-1.5">
                          {e.kind === "artist" ? (
                            <Link to="/artist/$slug" params={{ slug: slugifyArtist(e.name) }} className="hover:text-[var(--accent)] hover:underline">{e.name}</Link>
                          ) : e.kind === "album" ? (
                            <Link to="/album/$slug" params={{ slug: slugifyArtist(e.name) }} className="hover:text-[var(--accent)] hover:underline">{stripAlbumEdition(e.name)}</Link>
                          ) : (
                            <Link to="/song/$slug" params={{ slug: songSlug(e.name, e.artist) }} className="hover:text-[var(--accent)] hover:underline">{stripFeatFromTitle(e.name)}</Link>
                          )}
                        </div>
                        {e.kind !== "artist" && (
                          <div className="text-[11px] text-[var(--muted-foreground)] leading-tight break-words line-clamp-1">
                            <Link to="/artist/$slug" params={{ slug: slugifyArtist(e.kind === "album" ? (getFeatArtistsFromTitle(e.artist)?.artists ?? e.artist) : e.artist) }} className="hover:text-[var(--accent)] hover:underline">{e.kind === "album" ? (getFeatArtistsFromTitle(e.artist)?.artists ?? e.artist) : e.artist}</Link>
                          </div>
                        )}
                      </div>
                      <button type="button" onClick={() => toggleDetails(entryKey)} className="details-btn w-8 h-8 rounded-full bg-[var(--muted)] text-[var(--foreground)] text-xs hover:bg-[var(--border)] active:bg-[var(--accent)] active:text-white active:scale-95 transition-all duration-200 flex items-center justify-center flex-shrink-0" aria-label="Toggle details">
                        {isOpen ? "−" : "+"}
                      </button>
                    </div>
                  </div>

                  {/* Details panel */}
                  {isOpen && (
                    <div className="details-panel mx-4 mb-4 mt-2 rounded-xl bg-[var(--muted)] p-3 border border-[var(--border)] text-sm animate-fade-in">
                      <div className="grid grid-cols-3 gap-3">
                        <div className="text-center">
                          <div className="text-[9px] uppercase font-bold tracking-wider text-[var(--accent)]">{isArtistChart ? "Entries" : "Peak"}</div>
                          <div className="font-black text-[var(--foreground)] text-sm mt-1">{isArtistChart ? (e.entries ?? 1) : `#${e.peak}`}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-[9px] uppercase font-bold tracking-wider text-[var(--accent)]">Weeks</div>
                          <div className="font-black text-[var(--foreground)] text-sm mt-1">{e.weeks}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-[9px] uppercase font-bold tracking-wider text-[var(--accent)]">{metricLabel}</div>
                          <div className="font-black text-[var(--foreground)] text-sm mt-1">{formatMetric(e.totalUnits, metricKey)}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-16 text-muted-foreground text-sm">
            {selectedKey ? `No data for this year.` : `Select a year.`}
          </div>
        )}

      </main>
    </div>
  );
}

const YEAR_END_PRE_2017 = ["yearEndSongs", "yearEndArtists", "yearEndAlbums", "yecHot100Artists", "yecArtist50Female", "yecArtist50Male", "yecArtist50DuoGroup", "yearEndNewArtists", "yecTop100AlbumsArtists"] as const;

function YECMobExpand({ activeId, year }: { activeId: string; year?: string }) {
  const [expanded, setExpanded] = useState(false);
  const visibleIds = year && year < "2017" ? YEAR_END_PRE_2017 : yearEndChartIds;
  return (
    <>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-center text-sm font-bold px-4 py-2 min-h-[44px] border border-[var(--border)] cursor-pointer transition-colors uppercase tracking-wide flex items-center justify-center gap-2 bg-[var(--muted)] text-[var(--foreground)] hover:bg-[var(--accent)] hover:text-black hover:border-[var(--accent)]"
      >
        {expanded ? "− Less" : "+ More Charts"}
      </button>
      {expanded && visibleIds.filter((id) => id !== activeId).map((id) => {
        const c = chartsConfig[id];
        return (
          <Link
            key={id}
            to="/year-end/$chartId"
            params={{ chartId: id }}
            className="w-full text-center text-sm font-bold px-4 py-2 min-h-[44px] border border-[var(--border)] cursor-pointer transition-colors uppercase tracking-wide flex items-center justify-center bg-[var(--muted)] text-[var(--foreground)] hover:bg-[var(--accent)] hover:text-black hover:border-[var(--accent)]"
          >
            {c.title}
          </Link>
        );
      })}
    </>
  );
}
