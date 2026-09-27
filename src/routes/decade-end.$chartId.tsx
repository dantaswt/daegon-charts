import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { computeYearEndGenerated } from "@/lib/charts.functions";
import { aggregateYecForDecade, DECADES } from "@/lib/yec-computed";
import { chartsConfig, decadeEndChartIds, slugifyArtist, songSlug, stripAlbumEdition } from "@/lib/charts-config";
import { SpotifyItemImage } from "@/components/spotify-item-image";
import { TrackArtists, stripFeatFromTitle, getFeatArtistsFromTitle } from "@/components/track-artists";
import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";

function mapDecadeChartIdToWeekly(chartId: string): string {
  const weeklyChartId = chartId.replace("decadeEnd", "").replace(/^./, (c) => c.toLowerCase());
  const weeklyMap: Record<string, string> = {
    songs: "songs", artists: "artists", albums: "albums", radio: "radioSongs",
    streamingSongs: "streamingSongs", topStreamingAlbums: "topStreamingAlbums",
    topAlbumSales: "topAlbumSales", digitalSongsSales: "digitalSongsSales",
  };
  return weeklyMap[weeklyChartId] ?? weeklyChartId;
}

export const Route = createFileRoute("/decade-end/$chartId")({
  head: () => ({ meta: [{ title: "Decade-End Charts | daegon charts" }] }),
  notFoundComponent: () => <div className="text-center py-16 gold font-bold">Not found</div>,
  component: DecadeEndChartPage,
});

function formatMetric(v: number): string {
  if (v >= 1_000_000) {
    const val = v / 1_000_000;
    return val % 1 === 0 ? `${val}B` : `${parseFloat(val.toFixed(1))}B`;
  }
  if (v >= 1_000) {
    const val = v / 1_000;
    return val % 1 === 0 ? `${val}M` : `${parseFloat(val.toFixed(1))}M`;
  }
  return v.toLocaleString("en-US");
}

function DecadeDropdown({ decades, selectedDecade, onSelect }: { decades: string[]; selectedDecade: string; onSelect: (d: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const decadeIdx = decades.indexOf(selectedDecade);
  const prevDecade = decadeIdx < decades.length - 1 ? decades[decadeIdx + 1] : null;
  const nextDecade = decadeIdx > 0 ? decades[decadeIdx - 1] : null;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="flex flex-col items-center gap-2 md:gap-3 mb-4">
      <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Decade</div>
      <div className="flex flex-wrap items-center gap-2 md:gap-3">
        {prevDecade ? (
          <button onClick={() => onSelect(prevDecade)} className="btn-gold"><i className="fas fa-chevron-left" /> Prev</button>
        ) : (
          <button className="btn-gold" disabled><i className="fas fa-chevron-left" /> Prev</button>
        )}
        <div ref={ref} className="relative">
          <button
            onClick={() => setOpen(!open)}
            className="bg-[var(--muted)] text-[var(--foreground)] border border-[var(--border)] text-sm font-bold px-4 py-2 min-w-[160px] text-center focus:outline-none cursor-pointer flex items-center justify-center gap-2"
          >
            {selectedDecade}
            <i className={`fas fa-chevron-down text-xs transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
          {open && (
            <div ref={ref} className="absolute top-full left-0 right-0 z-50 bg-[var(--card)] border border-[var(--border)] max-h-[300px] overflow-y-auto">
              {decades.map((d) => (
                <button
                  key={d}
                  data-selected={d === selectedDecade || undefined}
                  onClick={() => { setOpen(false); if (d !== selectedDecade) onSelect(d); }}
                  className={`w-full text-center text-sm font-bold px-4 py-2 border-b border-white/20 cursor-pointer transition-colors ${
                    d === selectedDecade ? "bg-[var(--accent)] text-black" : "text-[var(--foreground)] hover:bg-[var(--muted)]"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          )}
        </div>
        {nextDecade ? (
          <button onClick={() => onSelect(nextDecade)} className="btn-gold">Next <i className="fas fa-chevron-right" /></button>
        ) : (
          <button className="btn-gold" disabled>Next <i className="fas fa-chevron-right" /></button>
        )}
      </div>
    </div>
  );
}

function DecadeMobExpand({ activeId, decade }: { activeId: string; decade?: string }) {
  const [expanded, setExpanded] = useState(false);
  const visibleIds = decade && ["1960", "1970", "1980", "1990"].includes(decade)
    ? ["decadeEndSongs", "decadeEndAlbums", "decadeEndArtists"]
    : decadeEndChartIds;
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
          <Link key={id} to="/decade-end/$chartId" params={{ chartId: id }} className="w-full text-center text-sm font-bold px-4 py-2 min-h-[44px] border border-[var(--border)] cursor-pointer transition-colors uppercase tracking-wide flex items-center justify-center bg-[var(--muted)] text-[var(--foreground)] hover:bg-[var(--accent)] hover:text-black hover:border-[var(--accent)]">
            {c.title}
          </Link>
        );
      })}
    </>
  );
}

function DecadeEndChartPage() {
  const { chartId } = Route.useParams();
  const cfg = chartsConfig[chartId];
  const [selectedDecade, setSelectedDecade] = useState<string>(DECADES[0].label);
  const [detailsOpen, setDetailsOpen] = useState<Record<string, boolean>>({});

  const weeklyId = mapDecadeChartIdToWeekly(chartId);

  const yecQuery = useQuery({
    queryKey: ["yec", weeklyId],
    queryFn: () => computeYearEndGenerated(weeklyId),
    enabled: !!cfg && cfg.group === "decadeEnd",
  });

  const metricKey = chartId === "decadeEndSongs" ? "points" : chartId === "decadeEndStreamingSongs" || chartId === "decadeEndTopStreamingAlbums" ? "streams" : chartId === "decadeEndRadio" ? "audience" : chartId === "decadeEndTopAlbumSales" || chartId === "decadeEndDigitalSongsSales" ? "sales" : "units";
  const metricLabel = metricKey === "points" ? "Points" : metricKey === "streams" ? "Streams" : metricKey === "audience" ? "Audience" : metricKey === "sales" ? "Sales" : "Units";
  const kind = cfg?.kind ?? "song";

  const decade = DECADES.find((d) => d.label === selectedDecade) ?? DECADES[0];
  const entries = useMemo(() => {
    if (!yecQuery.data) return [];
    return aggregateYecForDecade(yecQuery.data, decade.startYear, decade.endYear);
  }, [yecQuery.data, decade]);

  const isArtist = kind === "artist";

  useEffect(() => {
    document.title = `Decade-End Charts — ${cfg?.title ?? "Decade-End"} | daegon charts`;
  }, [cfg]);

  const toggleDetails = (key: string) => {
    setDetailsOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (!cfg || cfg.group !== "decadeEnd") {
    return <div className="text-center py-16 gold font-bold">Not found</div>;
  }

  return (
    <div className="max-w-7xl mx-auto w-full grid gap-6 lg:grid-cols-[280px_1fr]">
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="flex flex-col gap-2 justify-center md:justify-start mb-6">
          <div className="md:hidden">
            <Link to="/decade-end/$chartId" params={{ chartId }} className="w-full text-center text-sm font-bold px-4 py-2 min-h-[44px] border border-[var(--border)] cursor-pointer transition-colors uppercase tracking-wide flex items-center justify-center bg-[var(--accent)] text-black border-[var(--accent)]">
              {cfg.title}
            </Link>
            <DecadeMobExpand activeId={chartId} decade={selectedDecade} />
          </div>
          <div className="hidden md:flex flex-col gap-2 max-h-[calc(100vh-10rem)] overflow-y-auto pr-1">
            {(["1960", "1970", "1980", "1990"].includes(selectedDecade) ? ["decadeEndSongs", "decadeEndAlbums", "decadeEndArtists"] : decadeEndChartIds).map((id) => {
              const c = chartsConfig[id];
              return (
                <Link key={id} to="/decade-end/$chartId" params={{ chartId: id }} className={`w-full text-center text-sm font-bold px-4 py-2 border border-[var(--border)] cursor-pointer transition-colors uppercase tracking-wide ${
                  id === chartId ? "bg-[var(--accent)] text-black border-[var(--accent)]" : "bg-[var(--muted)] text-[var(--foreground)] hover:bg-[var(--accent)] hover:text-black hover:border-[var(--accent)]"
                }`}>
                  {c.title}
                </Link>
              );
            })}
          </div>
        </div>
        <Link to="/decade-end" className="sidebar-section block hover:border-[var(--accent)] transition-all">
          <div className="text-xs uppercase text-muted-foreground font-bold tracking-widest"><i className="fas fa-arrow-left mr-2" />All Decade-End</div>
        </Link>
      </aside>

      <main>
        <div className="mb-2 text-center">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex-1">
              <h1 className="text-2xl md:text-4xl font-extrabold text-[var(--foreground)] inline-flex items-center gap-2 justify-center">
                {cfg.title}
              </h1>

            </div>
          </div>
        </div>

        <DecadeDropdown decades={DECADES.map((d) => d.label)} selectedDecade={selectedDecade} onSelect={setSelectedDecade} />

        {yecQuery.isLoading && (
          <div className="text-center py-20 text-muted-foreground">Loading...</div>
        )}

        {!yecQuery.isLoading && entries.length > 0 && (
          <div className="space-y-3 max-w-4xl mx-auto">
            {entries.map((e: any) => {
              const isFirst = e.position === 1;
              const entryKey = `${selectedDecade}-${e.position}-${e.name}`;
              const isOpen = detailsOpen[entryKey] ?? false;
              return (
                <motion.div key={entryKey} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.3 }} className="chart-card w-full">
                  <div className="hidden md:grid gap-3 items-center" style={{ gridTemplateColumns: "auto auto minmax(0,1fr) auto" }}>
                    <div className="flex flex-col items-center justify-center w-16">
                      <div className={`rank-num font-black ${isFirst ? "text-4xl bg-[var(--accent)] text-black w-16 h-16 flex items-center justify-center" : "text-3xl"}`}>{e.position}</div>
                    </div>
                    <div className={`placeholder-art flex items-center justify-center overflow-hidden bg-[var(--muted)] rounded-none flex-shrink-0 ${isFirst ? "w-[180px] h-[180px] border-l-4 border-[var(--accent)]" : "w-24 h-24"}`}>
                      <SpotifyItemImage name={e.name} artist={e.artist} kind={kind} size={isFirst ? 180 : 96} />
                    </div>
                    <div className="min-w-0 flex flex-col flex-1">
                      <div className={`font-bold break-words line-clamp-2 flex flex-wrap items-center gap-1.5 ${isFirst ? "text-xl" : "text-base"}`}>
                        {isArtist ? (
                          <Link to="/artist/$slug" params={{ slug: slugifyArtist(e.name) }} className="hover:text-[var(--accent)] hover:underline">{e.name}</Link>
                        ) : kind === "album" ? (
                          <Link to="/album/$slug" params={{ slug: slugifyArtist(e.name) }} className="hover:text-[var(--accent)] hover:underline">{stripAlbumEdition(e.name)}</Link>
                        ) : (
                          <Link to="/song/$slug" params={{ slug: songSlug(e.name, e.artist) }} className="hover:text-[var(--accent)] hover:underline">{stripFeatFromTitle(e.name)}</Link>
                        )}
                      </div>
                      {!isArtist && (
                        <div className={`break-words line-clamp-2 ${isFirst ? "text-base text-[var(--muted-foreground)]" : "text-sm text-[var(--muted-foreground)]"}`}>
                          <Link to="/artist/$slug" params={{ slug: slugifyArtist(kind === "album" ? (getFeatArtistsFromTitle(e.artist)?.artists ?? e.artist) : e.artist) }} className="hover:text-[var(--accent)] hover:underline">{kind === "album" ? (getFeatArtistsFromTitle(e.artist)?.artists ?? e.artist) : e.artist}</Link>
                          {kind === "song" && <TrackArtists song={e.name} artist={e.artist} className="text-sm text-[var(--muted-foreground)]" />}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-4 flex-shrink-0">
                      <button type="button" onClick={() => toggleDetails(entryKey)} className="details-btn w-8 h-8 rounded-full bg-[var(--muted)] text-[var(--foreground)] text-sm hover:bg-[var(--border)] active:bg-[var(--accent)] active:text-white active:scale-95 transition-all duration-200 flex items-center justify-center" aria-label="Toggle details">
                        {isOpen ? "−" : "+"}
                      </button>
                    </div>
                  </div>

                  <div className="md:hidden">
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col items-center justify-center w-8 flex-shrink-0">
                        <div className="rank-num text-xl font-black leading-none">{e.position}</div>
                      </div>
                      <div className={`placeholder-art flex items-center justify-center overflow-hidden bg-[var(--muted)] flex-shrink-0 ${isFirst ? "w-[68px] h-[68px] border-l-[3px] border-[var(--accent)]" : "w-[64px] h-[64px]"}`}>
                        <SpotifyItemImage name={e.name} artist={e.artist} kind={kind} size={isFirst ? 68 : 64} />
                      </div>
                      <div className="min-w-0 flex-1 flex flex-col justify-center">
                        <div className="font-bold text-[13px] leading-tight break-words line-clamp-2 flex flex-wrap items-center gap-1.5">
                          {isArtist ? (
                            <Link to="/artist/$slug" params={{ slug: slugifyArtist(e.name) }} className="hover:text-[var(--accent)] hover:underline">{e.name}</Link>
                          ) : kind === "album" ? (
                            <Link to="/album/$slug" params={{ slug: slugifyArtist(e.name) }} className="hover:text-[var(--accent)] hover:underline">{stripAlbumEdition(e.name)}</Link>
                          ) : (
                            <Link to="/song/$slug" params={{ slug: songSlug(e.name, e.artist) }} className="hover:text-[var(--accent)] hover:underline">{stripFeatFromTitle(e.name)}</Link>
                          )}
                        </div>
                        {!isArtist && (
                          <div className="text-[11px] text-[var(--muted-foreground)] leading-tight break-words line-clamp-1">
                            <Link to="/artist/$slug" params={{ slug: slugifyArtist(kind === "album" ? (getFeatArtistsFromTitle(e.artist)?.artists ?? e.artist) : e.artist) }} className="hover:text-[var(--accent)] hover:underline">{kind === "album" ? (getFeatArtistsFromTitle(e.artist)?.artists ?? e.artist) : e.artist}</Link>
                          </div>
                        )}
                      </div>
                      <button type="button" onClick={() => toggleDetails(entryKey)} className="details-btn w-8 h-8 rounded-full bg-[var(--muted)] text-[var(--foreground)] text-xs hover:bg-[var(--border)] active:bg-[var(--accent)] active:text-white active:scale-95 transition-all duration-200 flex items-center justify-center flex-shrink-0" aria-label="Toggle details">
                        {isOpen ? "−" : "+"}
                      </button>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="details-panel mx-4 mb-4 mt-2 rounded-xl bg-[var(--muted)] p-3 border border-[var(--border)] text-sm animate-fade-in">
                      <div className="grid grid-cols-3 gap-3">
                        <div className="text-center">
                          <div className="text-[9px] uppercase font-bold tracking-wider text-[var(--accent)]">Peak</div>
                          <div className="font-black text-[var(--foreground)] text-sm mt-1">#{e.peak}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-[9px] uppercase font-bold tracking-wider text-[var(--accent)]">Weeks</div>
                          <div className="font-black text-[var(--foreground)] text-sm mt-1">{e.weeks}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-[9px] uppercase font-bold tracking-wider text-[var(--accent)]">{metricLabel}</div>
                          <div className="font-black text-[var(--foreground)] text-sm mt-1">{formatMetric(e.totalUnits)}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}

        {!yecQuery.isLoading && entries.length === 0 && (
          <div className="text-center py-16 text-muted-foreground text-sm">
            No data for this decade.
          </div>
        )}
      </main>
    </div>
  );
}
