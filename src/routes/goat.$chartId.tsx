import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { getGoatGenerated, type GOATEntry } from "@/lib/charts.functions";
import { chartsConfig, goatChartIds, slugifyArtist, songSlug, stripAlbumEdition } from "@/lib/charts-config";
import { ChartImage } from "@/components/chart-image";
import { SpotifyItemImage } from "@/components/spotify-item-image";
import { useState, useMemo, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { TrackArtists, stripFeatFromTitle } from "@/components/track-artists";

export const Route = createFileRoute("/goat/$chartId")({
  loader: async ({ params }) => {
    if (!goatChartIds.includes(params.chartId)) throw notFound();
    const data = await getGoatGenerated({ data: { chartId: params.chartId } });
    return { data, chartId: params.chartId };
  },
  head: ({ loaderData }) => {
    const t = loaderData ? chartsConfig[loaderData.chartId]?.title : "Greatest of All Time";
    return { meta: [{ title: `${t} | daegon charts` }, { name: "description", content: `${t} — greatest of all time.` }] };
  },
  notFoundComponent: () => <div className="text-center py-16 gold font-bold">Not found</div>,
  component: GoatPage,
});

function formatMetric(n: number, useStreamFormat: boolean): string {
  if (n <= 0) return "0";
  if (useStreamFormat) {
    if (n >= 1_000_000) {
      const val = n / 1_000_000;
      return val % 1 === 0 ? `${val}B` : `${parseFloat(val.toFixed(1))}B`;
    }
    if (n >= 1_000) {
      const val = n / 1_000;
      return val % 1 === 0 ? `${val}M` : `${parseFloat(val.toFixed(1))}M`;
    }
    return `${n}`;
  }
  return n.toLocaleString("en-US");
}

function GoatPage() {
  const { data, chartId } = Route.useLoaderData();
  const cfg = chartsConfig[chartId];
  const isAlbum = data.kind === "album";
  const isRadio = chartId === "goatRadio";
  const defaultSort = chartId === "goatSongs" ? "points" : isRadio ? "audience" : "units";
  const [sortBy, setSortBy] = useState<"weeks" | "units" | "streams" | "sales" | "audience" | "points">(defaultSort);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortOpen, setSortOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState<Record<string, boolean>>({});
  const sortRef = useRef<HTMLDivElement>(null);
  const PAGE_SIZE = 50;

  const sorted = useMemo(() => {
    let list = [...data.entries];
    if (sortBy === "units") list.sort((a, b) => b.totalUnits - a.totalUnits || a.peak - b.peak);
    else if (sortBy === "streams") list.sort((a, b) => b.totalStreams - a.totalStreams || a.peak - b.peak);
    else if (sortBy === "sales") list.sort((a, b) => b.totalSales - a.totalSales || a.peak - b.peak);
    else if (sortBy === "audience") list.sort((a, b) => b.totalAudience - a.totalAudience || a.peak - b.peak);
    else if (sortBy === "points") list.sort((a, b) => b.totalPoints - a.totalPoints || a.peak - b.peak);
    else list.sort((a, b) => b.weeks - a.weeks || a.peak - b.peak);
    return list.map((e, i) => ({ ...e, position: i + 1 }));
  }, [data.entries, sortBy]);

  const filtered = useMemo(() => {
    if (!search.trim()) return sorted;
    const q = search.toLowerCase();
    return sorted.filter((e) => e.name.toLowerCase().includes(q) || e.artist.toLowerCase().includes(q));
  }, [sorted, search]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const displayed = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const top3 = sorted.slice(0, 3);
  const showWeeksCol = sortBy !== "weeks";
  const imageSize = isAlbum ? 56 : 40;

  const sortOptions = [
    ...(chartId === "goatSongs" ? [{ key: "points" as const, label: "Total Points", icon: "fa-star" }] : []),
    ...(isRadio ? [{ key: "audience" as const, label: "Total Audience", icon: "fa-broadcast-tower" }] : []),
    { key: "units" as const, label: "Total Units", icon: "fa-chart-bar" },
    ...(chartId === "goatSongs" || chartId === "goatAlbums" ? [{ key: "sales" as const, label: "Total Sales", icon: "fa-shopping-cart" }] : []),
    ...(chartId === "goatSongs" || chartId === "goatAlbums" ? [{ key: "streams" as const, label: "Total Streams", icon: "fa-headphones" }] : []),
    { key: "weeks" as const, label: "Weeks on Chart", icon: "fa-calendar-week" },
  ];

  const metricLabel = sortBy === "units" ? "Units" : sortBy === "streams" ? "Streams" : sortBy === "sales" ? "Sales" : sortBy === "audience" ? "Audience" : sortBy === "points" ? "Points" : "Weeks";
  const metricIcon = sortBy === "units" ? "fa-chart-bar" : sortBy === "streams" ? "fa-headphones" : sortBy === "sales" ? "fa-shopping-cart" : sortBy === "audience" ? "fa-broadcast-tower" : sortBy === "points" ? "fa-star" : "fa-calendar-week";

  const toggleDetails = (key: string) => {
    setDetailsOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setSortOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-16">
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar */}
        <div className="w-full lg:w-72 shrink-0 lg:sticky lg:top-8 lg:h-fit">
          <aside className="space-y-4">
            <div className="sidebar-section">
              <div className="text-xs uppercase text-muted-foreground font-bold tracking-widest mb-3">Sort By</div>
              <div ref={sortRef} className="relative">
                <button
                  onClick={() => setSortOpen(!sortOpen)}
                  className="w-full bg-[var(--card)] text-[var(--foreground)] border border-[var(--border)] text-sm font-bold px-3 py-2 text-left focus:outline-none cursor-pointer flex items-center justify-between gap-2"
                >
                  <span>{sortOptions.find((o) => o.key === sortBy)?.label}</span>
                  <i className={`fas fa-chevron-down text-xs transition-transform ${sortOpen ? "rotate-180" : ""}`} />
                </button>
                {sortOpen && (
                  <div className="absolute top-full left-0 right-0 z-50 bg-[var(--card)] border border-[var(--border)] max-h-[300px] overflow-y-auto">
                    {sortOptions.map((opt) => (
                      <button
                        key={opt.key}
                        onClick={() => {
                          setSortBy(opt.key);
                          setSortOpen(false);
                          setCurrentPage(1);
                        }}
                        className={`w-full text-left text-sm font-bold px-3 py-2 border-b border-white/20 cursor-pointer transition-colors ${
                          sortBy === opt.key
                            ? "bg-[var(--accent)] text-black"
                            : "text-[var(--foreground)] hover:bg-[var(--muted)]"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="sidebar-section">
              <div className="text-xs uppercase text-muted-foreground font-bold tracking-widest mb-3">Charts</div>
              {/* Mobile: collapse */}
              <div className="md:hidden space-y-1">
                <Link
                  to="/goat/$chartId"
                  params={{ chartId }}
                  className="sidebar-link active"
                >
                  <i className={`fas ${chartsConfig[chartId]?.icon} text-xs text-muted-foreground w-4`} />
                  {chartsConfig[chartId]?.title ?? chartId}
                </Link>
                <GOATMobExpand activeId={chartId} />
              </div>
              {/* Desktop: show all */}
              <div className="hidden md:block space-y-1">
                {goatChartIds.map((id) => {
                  const c = chartsConfig[id];
                  return (
                    <Link
                      key={id}
                      to="/goat/$chartId"
                      params={{ chartId: id }}
                      className={`sidebar-link ${id === chartId ? "active" : ""}`}
                    >
                      <i className={`fas ${c.icon} text-xs text-muted-foreground w-4`} />
                      {c.title}
                    </Link>
                  );
                })}
              </div>
            </div>

            <Link to="/goat" className="sidebar-section block hover:border-[var(--accent)] transition-all">
              <div className="text-xs uppercase text-muted-foreground font-bold tracking-widest"><i className="fas fa-arrow-left mr-2" />All Greatest of All Time</div>
            </Link>
          </aside>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="relative text-center py-8 md:py-10 mb-6 overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
              <span className="text-[4rem] md:text-[6rem] font-black text-[var(--foreground)] opacity-[0.06] font-sans uppercase tracking-tighter leading-none">Greatest of All Time</span>
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black gold tracking-tight relative z-10 uppercase">
              {cfg?.title ?? "Greatest of All Time"}
            </h1>
            <p className="text-muted-foreground text-sm mt-2 relative z-10">
              {sorted.length} greatest of all time
            </p>
            <div className="flex justify-center mt-4 relative z-10">
              <ChartImage
                entries={sorted.slice(0, 50).map((e) => ({ position: e.position, diff: "", name: e.name, artist: e.artist, peak: e.peak, weeks: e.weeks, weeksAt1: e.weeksAt1 }))}
                chartTitle={cfg?.title ?? "Greatest of All Time"}
                chartId={chartId}
                date="2025-12-31"
                kind={data.kind}
                hideWeeksAt1
                hideLastWeek
                displayTitle={chartId === "goatSongs" ? "Greatest Songs of All Time" : undefined}
              />
            </div>
          </div>

          {/* Top 3 Podium */}
          {top3.length >= 3 && (
            <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-8">
              {[1, 0, 2].map((idx) => {
                const item = top3[idx];
                const isFirst = idx === 0;
                return (
                  <motion.div
                    key={`${item.name}-${idx}`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: idx === 0 ? 0.2 : idx === 1 ? 0 : 0.4 }}
                    className={`relative text-center p-4 sm:p-6 rounded-2xl border overflow-hidden ${isFirst ? "border-[var(--accent)] bg-[rgba(255,109,0,0.05)]" : "border-[var(--border)] bg-[var(--card)]"}`}
                  >
                    {isFirst && <div className="absolute top-0 left-0 right-0 h-1 bg-[var(--accent)]" />}
                    <div className={`w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 rounded-full flex items-center justify-center font-black text-xl sm:text-2xl ${isFirst ? "bg-[var(--accent)] text-black" : "bg-[var(--muted)] text-[var(--foreground)]"}`}>
                      {idx + 1}
                    </div>
                    <div className="font-bold text-sm sm:text-base break-words">{data.kind === "artist" ? (
                      <Link to="/artist/$slug" params={{ slug: slugifyArtist(item.name) }} className="hover:underline">{stripFeatFromTitle(item.name)}</Link>
                    ) : data.kind === "album" ? (
                      <Link to="/album/$slug" params={{ slug: slugifyArtist(item.name) }} className="hover:underline">{stripAlbumEdition(item.name)}</Link>
                    ) : (
                      <Link to="/song/$slug" params={{ slug: songSlug(item.name, item.artist) }} className="hover:underline">{stripFeatFromTitle(item.name)}</Link>
                    )}</div>
                    {data.kind !== "artist" && (
                      <div className="text-xs text-muted-foreground break-words">
                        {item.artist}
                        <TrackArtists song={item.name} artist={item.artist} className="text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex items-center justify-center gap-1.5 mt-2 text-sm font-black gold">
                      <i className={`fas ${metricIcon} text-xs`} />
                      {sortBy === "units" ? `${formatMetric(item.totalUnits, false)} units` : sortBy === "streams" ? `${formatMetric(item.totalStreams, true)} streams` : sortBy === "sales" ? `${formatMetric(item.totalSales, false)} sales` : sortBy === "audience" ? `${formatMetric(item.totalAudience, false)} audience` : sortBy === "points" ? `${formatMetric(item.totalPoints, false)} points` : `${item.weeks} weeks`}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* Search */}
          <div className="relative mb-6">
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              className="w-full bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent)] transition-colors pr-8"
            />
            {search && (
              <button onClick={() => { setSearch(""); setCurrentPage(1); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-[var(--accent)]">
                <i className="fas fa-times text-xs" />
              </button>
            )}
          </div>

          {/* Results count */}
          <div className="text-xs text-muted-foreground mb-3">
            {filtered.length} item{filtered.length !== 1 ? "s" : ""} found
            {search && ` matching "${search}"`}
          </div>

          {/* List */}
          <section className="space-y-3">
            {displayed.length > 0 ? (
              displayed.map((e, i) => {
                const entryKey = `${e.name}-${e.artist}`;
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
                        <div className={`rank-num font-black ${e.position === 1 ? "text-4xl bg-[var(--accent)] text-black w-16 h-16 flex items-center justify-center" : "text-3xl"}`}>{e.position}</div>
                      </div>
                      <div className={`placeholder-art flex items-center justify-center overflow-hidden bg-[var(--muted)] rounded-none flex-shrink-0 ${e.position === 1 ? "w-[180px] h-[180px] border-l-4 border-[var(--accent)]" : "w-24 h-24"}`}>
                        <SpotifyItemImage name={e.name} artist={e.artist} kind={data.kind} size={e.position === 1 ? 180 : 96} />
                      </div>
                      <div className="min-w-0 flex flex-col flex-1">
                        <div className={`font-bold break-words line-clamp-2 flex flex-wrap items-center gap-1.5 ${e.position === 1 ? "text-xl" : "text-base"}`}>
                          {data.kind === "artist" ? (
                            <Link to="/artist/$slug" params={{ slug: slugifyArtist(e.name) }} className="hover:text-[var(--accent)] hover:underline">{e.name}</Link>
                          ) : data.kind === "album" ? (
                            <Link to="/album/$slug" params={{ slug: slugifyArtist(e.name) }} className="hover:text-[var(--accent)] hover:underline">{stripAlbumEdition(e.name)}</Link>
                          ) : (
                            <Link to="/song/$slug" params={{ slug: songSlug(e.name, e.artist) }} className="hover:text-[var(--accent)] hover:underline">{stripFeatFromTitle(e.name)}</Link>
                          )}
                        </div>
                        {data.kind !== "artist" && (
                          <div className={`break-words line-clamp-2 ${e.position === 1 ? "text-base text-[var(--muted-foreground)]" : "text-sm text-[var(--muted-foreground)]"}`}>
                            <Link to="/artist/$slug" params={{ slug: slugifyArtist(e.artist) }} className="hover:text-[var(--accent)] hover:underline">{e.artist}</Link>
                            {data.kind === "song" && <TrackArtists song={e.name} artist={e.artist} className="text-sm text-[var(--muted-foreground)]" />}
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
                        <div className={`placeholder-art flex items-center justify-center overflow-hidden bg-[var(--muted)] flex-shrink-0 ${e.position === 1 ? "w-[68px] h-[68px] border-l-[3px] border-[var(--accent)]" : "w-[64px] h-[64px]"}`}>
                          <SpotifyItemImage name={e.name} artist={e.artist} kind={data.kind} size={e.position === 1 ? 68 : 64} />
                        </div>
                        <div className="min-w-0 flex-1 flex flex-col justify-center">
                          <div className="font-bold text-[13px] leading-tight break-words line-clamp-2 flex flex-wrap items-center gap-1.5">
                            {data.kind === "artist" ? (
                              <Link to="/artist/$slug" params={{ slug: slugifyArtist(e.name) }} className="hover:text-[var(--accent)] hover:underline">{e.name}</Link>
                            ) : data.kind === "album" ? (
                              <Link to="/album/$slug" params={{ slug: slugifyArtist(e.name) }} className="hover:text-[var(--accent)] hover:underline">{stripAlbumEdition(e.name)}</Link>
                            ) : (
                              <Link to="/song/$slug" params={{ slug: songSlug(e.name, e.artist) }} className="hover:text-[var(--accent)] hover:underline">{stripFeatFromTitle(e.name)}</Link>
                            )}
                          </div>
                          {data.kind !== "artist" && (
                            <div className="text-[11px] text-[var(--muted-foreground)] leading-tight break-words line-clamp-1">
                              <Link to="/artist/$slug" params={{ slug: slugifyArtist(e.artist) }} className="hover:text-[var(--accent)] hover:underline">{e.artist}</Link>
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
                            <div className="text-[9px] uppercase font-bold tracking-wider text-[var(--accent)]">Peak</div>
                            <div className="font-black text-[var(--foreground)] text-sm mt-1">#{e.peak}</div>
                          </div>
                          <div className="text-center">
                            <div className="text-[9px] uppercase font-bold tracking-wider text-[var(--accent)]">Weeks</div>
                            <div className="font-black text-[var(--foreground)] text-sm mt-1">{e.weeks}</div>
                          </div>
                          <div className="text-center">
                            <div className="text-[9px] uppercase font-bold tracking-wider text-[var(--accent)]">{metricLabel}</div>
                            <div className="font-black text-[var(--foreground)] text-sm mt-1">
                              {sortBy === "units" ? formatMetric(e.totalUnits, false) : sortBy === "streams" ? formatMetric(e.totalStreams, true) : sortBy === "sales" ? formatMetric(e.totalSales, false) : sortBy === "audience" ? formatMetric(e.totalAudience, false) : sortBy === "points" ? formatMetric(e.totalPoints, false) : e.weeks}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </motion.div>
                );
              })
            ) : (
              <div className="text-center py-16 text-muted-foreground text-sm">No results found.</div>
            )}
          </section>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-lg text-sm font-semibold border border-[var(--border)] hover:border-[var(--accent)] disabled:opacity-30 transition-colors"
              >
                <i className="fas fa-chevron-left" />
              </button>
              <span className="text-sm text-muted-foreground px-2">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-lg text-sm font-semibold border border-[var(--border)] hover:border-[var(--accent)] disabled:opacity-30 transition-colors"
              >
                <i className="fas fa-chevron-right" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function GOATMobExpand({ activeId }: { activeId: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-center text-sm font-bold px-4 py-2 min-h-[44px] border border-[var(--border)] cursor-pointer transition-colors uppercase tracking-wide flex items-center justify-center gap-2 bg-[var(--muted)] text-[var(--foreground)] hover:bg-[var(--accent)] hover:text-black hover:border-[var(--accent)]"
      >
        {expanded ? "− Less" : "+ More Charts"}
      </button>
      {expanded && goatChartIds.filter((id) => id !== activeId).map((id) => {
        const c = chartsConfig[id];
        return (
          <Link
            key={id}
            to="/goat/$chartId"
            params={{ chartId: id }}
            className="sidebar-link"
          >
            <i className={`fas ${c.icon} text-xs text-muted-foreground w-4`} />
            {c.title}
          </Link>
        );
      })}
    </>
  );
}
