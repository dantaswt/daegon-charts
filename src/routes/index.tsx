import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { getWeeklyChart, getAllArtistStats, type ChartEntry, type WeeklyChartData } from "@/lib/charts.functions";
import { getSpotifyImage } from "@/lib/spotify.functions";
import { chartsConfig, weeklyChartIds, slugifyArtist, songSlug, stripAlbumEdition } from "@/lib/charts-config";
import { getLatestBeatArticles, type GeneratedBeatArticle } from "@/lib/chart-beat-generator";
import { TrackArtists, stripFeatFromTitle } from "@/components/track-artists";
import React, { useState, useEffect, useRef, useMemo } from "react";
import { motion } from "framer-motion";

const MAIN_CHART_IDS = ["songs", "albums", "artists"] as const;
const SECONDARY_CHART_IDS = weeklyChartIds.filter(id => id !== "songs" && id !== "albums" && id !== "artists");

export const Route = createFileRoute("/")({
  loader: async () => {
    const safeChart = async (chartId: string) => {
      try { return await getWeeklyChart({ data: { chartId } }); }
      catch { return { chartId, title: chartId, kind: "song" as const, dates: [] as string[], entriesByDate: {} as Record<string, any[]> }; }
    };

    const [songsData, albumsData, artistsData] = await Promise.all([
      safeChart("songs"),
      safeChart("albums"),
      safeChart("artists"),
    ]);

    const knownData: Record<string, any> = { songs: songsData, albums: albumsData, artists: artistsData };

    const numberOnes = MAIN_CHART_IDS.map((id) => {
      const chart = knownData[id];
      if (!chart) return { chartId: id, title: id, kind: "song" as const, date: "", entry: null };
      const latestDate = chart.dates?.[chart.dates.length - 1] ?? "";
      const entries = latestDate ? (chart.entriesByDate?.[latestDate] ?? []) : [];
      const no1 = entries[0] ?? null;
      return { chartId: chart.chartId ?? id, title: chart.title ?? id, kind: chart.kind ?? "song" as const, date: latestDate, entry: no1 };
    });

    const firstTimers: Array<{ name: string; artist: string; position: number; date: string; kind: "song" | "album" | "artist"; chartId: string; chartTitle: string }> = [];
    const artistsChartDates = (artistsData?.dates ?? []).slice().reverse();
    for (const date of artistsChartDates) {
      const entries = artistsData?.entriesByDate?.[date] || [];
      for (const e of entries) {
        if (e.diff === "NEW" && !firstTimers.find(ft => ft.name === e.name && ft.artist === e.artist)) {
          firstTimers.push({ name: e.name, artist: e.artist, position: e.position, date, kind: "artist", chartId: "artists", chartTitle: chartsConfig["artists"].title });
          if (firstTimers.length >= 4) break;
        }
      }
      if (firstTimers.length >= 4) break;
    }

    const mainCharts = [
      { id: "songs", kind: "song" as const, cfg: chartsConfig.songs },
      { id: "albums", kind: "album" as const, cfg: chartsConfig.albums },
      { id: "artists", kind: "artist" as const, cfg: chartsConfig.artists },
    ];
    const latestDate = songsData?.dates?.[songsData.dates.length - 1] ?? "";
    const currentYear = latestDate ? new Date(latestDate + "T00:00:00").getFullYear() : new Date().getFullYear();
    let oldestYear = currentYear;
    for (const chart of mainCharts) {
      const chartData = knownData[chart.id];
      if (chartData?.dates?.length > 0) {
        const oldestDate = chartData.dates[0];
        const y = new Date(oldestDate + "T00:00:00").getFullYear();
        if (y < oldestYear) oldestYear = y;
      }
    }
    const onThisWeekYears: number[] = [];
    for (let y = currentYear; y >= oldestYear; y--) onThisWeekYears.push(y);
    const onThisWeekData: Record<number, Array<{ chartId: string; chartTitle: string; kind: string; entry: any; date: string }>> = {};
    for (const year of onThisWeekYears) {
      onThisWeekData[year] = [];
      for (const chart of mainCharts) {
        const chartData = knownData[chart.id];
        const targetDate = new Date(latestDate + "T00:00:00");
        targetDate.setFullYear(year);
        let bestDate: string | null = null;
        let bestDiff = Infinity;
        for (const d of (chartData?.dates ?? [])) {
          const diff = Math.abs(new Date(d + "T00:00:00").getTime() - targetDate.getTime());
          if (diff < bestDiff) { bestDiff = diff; bestDate = d; }
        }
        const entries = bestDate ? (chartData.entriesByDate[bestDate] || []) : [];
        const no1 = entries[0] ?? null;
        onThisWeekData[year].push({ chartId: chart.id, chartTitle: chart.cfg.title, kind: chart.kind, entry: no1, date: bestDate || "" });
      }
    }

    return {
      charts: {
        songs: { data: songsData, latestDate: songsData?.dates?.[songsData.dates.length - 1] ?? "" },
        albums: { data: albumsData, latestDate: albumsData?.dates?.[albumsData.dates.length - 1] ?? "" },
        artists: { data: artistsData, latestDate: artistsData?.dates?.[artistsData.dates.length - 1] ?? "" },
      },
      numberOnes,
      firstTimers,
      onThisWeekData,
      onThisWeekYears,
      onThisWeekLatestDate: latestDate,
    };
  },
  head: () => ({
    meta: [
      { title: "daegon charts — weekly music charts" },
      { name: "description", content: "Weekly music charts, year-end rankings and greatest of all time lists." },
    ],
  }),
  component: LandingPage,
});

/* ────── Spotify Image (small reusable) ────── */
function SpotifyImg({ query, type, rounded }: { query: string; type: "artist" | "album" | "track"; rounded?: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    getSpotifyImage({ data: { query, type } }).then((u) => { if (active && u) setUrl(u); });
    return () => { active = false; };
  }, [query, type]);
  if (!url) return <div className={`w-full h-full bg-gradient-to-br from-[var(--muted)] to-[var(--border)] flex items-center justify-center text-muted-foreground animate-pulse ${rounded ? 'rounded-full' : 'rounded-lg'}`}><i className="fas fa-music text-lg opacity-30" /></div>;
  return <img src={url} alt={query} className={`w-full h-full object-cover animate-fade-in ${rounded ? 'rounded-full' : 'rounded-lg'}`} />;
}

/* ────── TOP CHARTS Section ────── */
function TopChartsSection({ charts }: { charts: any }) {
  const tabs: Array<"songs" | "albums" | "artists"> = ["songs", "albums", "artists"];
  const labels: { key: "songs" | "albums" | "artists"; label: string }[] = [
    { key: "songs", label: "HOT 100" },
    { key: "albums", label: "TOP 100 ALBUMS" },
    { key: "artists", label: "TOP 50 ARTISTS" },
  ];

  const [active, setActive] = useState<"songs" | "albums" | "artists">("songs");
  const [paused, setPaused] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Auto-rotate every 4 seconds, paused on hover/manual click
  useEffect(() => {
    if (paused) return;
    const timer = setInterval(() => {
      setActive((prev) => {
        const idx = tabs.indexOf(prev);
        return tabs[(idx + 1) % tabs.length];
      });
    }, 4000);
    return () => clearInterval(timer);
  }, [paused]);

  const handleManualClick = (key: "songs" | "albums" | "artists") => {
    setActive(key);
    setPaused(true);
    // Resume auto-rotation after 10s of inactivity
    setTimeout(() => setPaused(false), 10000);
  };

  const chartData = charts[active];
  const data = chartData?.data;
  const latestDate = chartData?.latestDate;
  const maxEntries = isMobile ? 4 : 5;
  const entries = (data?.entriesByDate?.[latestDate] ?? []).slice(0, maxEntries);
  const cfg = chartsConfig[active];

  return (
    <section className="mb-14" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="section-banner">
        <span>Top Charts</span>
        <Link to="/chart/$chartId/$date" params={{ chartId: active, date: latestDate }} className="text-xs font-bold uppercase tracking-wider hover:opacity-80 transition-opacity">
          View Chart <i className="fas fa-arrow-right ml-1" />
        </Link>
      </div>
      <div className="flex flex-wrap gap-2 mb-6">
        {labels.map(l => (
          <button
            key={l.key}
            onClick={() => handleManualClick(l.key)}
            className={`tab-pill ${active === l.key ? "active" : ""}`}
          >{l.label}</button>
        ))}
      </div>
      <motion.div
        key={active}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4"
      >
        {entries.map((e: ChartEntry, i: number) => (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: i * 0.06 }} key={`${active}-${e.position}`} className="bg-[var(--card)] rounded-xl border border-[var(--border)] overflow-hidden hover:border-[var(--accent)] hover:shadow-lg hover:shadow-[var(--accent)]/10 hover:-translate-y-1 transition-all duration-300 group shadow-sm">
            <div className="aspect-square relative">
              <SpotifyImg
                query={cfg.kind === "album" ? `album:"${e.name}" artist:"${e.artist}"` : cfg.kind === "artist" ? `artist:"${e.name}"` : `artist:"${e.artist}" track:"${e.name}"`}
                type={cfg.kind === "album" ? "album" : cfg.kind === "artist" ? "artist" : "track"}
                rounded={false}
              />
              <div className="rank-badge">{e.position}</div>
            </div>
            <div className="p-3">
              <div className="font-bold text-sm whitespace-normal break-words group-hover:text-[var(--accent)] transition-colors">
                {cfg.kind === "artist" ? (
                  <Link to="/artist/$slug" params={{ slug: slugifyArtist(e.name) }} className="hover:underline">
                    {e.name}
                  </Link>
                ) : cfg.kind === "album" ? (
                  <Link to="/album/$slug" params={{ slug: slugifyArtist(e.name) }} className="hover:underline">
                    {stripFeatFromTitle(e.name)}
                  </Link>
                ) : (
                  <Link to="/song/$slug" params={{ slug: songSlug(e.name, e.artist) }} className="hover:underline">
                    {stripFeatFromTitle(e.name)}
                  </Link>
                )}
              </div>
              {cfg.kind !== "artist" && (
                <div className="text-xs text-muted-foreground whitespace-normal break-words">
                  {e.artist}
                  <TrackArtists song={e.name} artist={e.artist} className="text-xs text-muted-foreground" />
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}

/* ────── NO.1 THIS WEEK Section ────── */
function NumberOnesSection({ numberOnes }: { numberOnes: any[] }) {
  return (
    <section className="mb-14">
      <div className="section-banner">
        <span>No. 1 This Week</span>
        <Link to="/number-ones" className="text-xs font-bold uppercase tracking-wider hover:opacity-80 transition-opacity">
          View All <i className="fas fa-arrow-right ml-1" />
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {numberOnes.map((n, i) => {
          if (!n.entry) return null;
          return (
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.3, delay: i * 0.05 }} key={n.chartId} className="bg-[var(--card)] rounded-xl border border-[var(--border)] overflow-hidden hover:border-[var(--accent)] hover:shadow-lg hover:shadow-[var(--accent)]/10 hover:-translate-y-1 transition-all duration-300 flex flex-col h-full shadow-sm">
              <div className="flex items-center gap-3 p-4 flex-grow">
                <div className="w-16 h-16 shrink-0">
                  <SpotifyImg
                    query={n.kind === "album" ? `album:"${n.entry.name}" artist:"${n.entry.artist}"` : n.kind === "artist" ? `artist:"${n.entry.name}"` : `artist:"${n.entry.artist}" track:"${n.entry.name}"`}
                    type={n.kind === "album" ? "album" : n.kind === "artist" ? "artist" : "track"}
                    rounded={false}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] uppercase text-muted-foreground font-bold tracking-widest mb-1">{n.title}</div>
                  <div className="font-bold text-sm whitespace-normal break-words">{n.kind === "artist" ? (
                    <Link to="/artist/$slug" params={{ slug: slugifyArtist(n.entry.name) }} className="hover:underline hover:text-[var(--accent)]">{n.entry.name}</Link>
                  ) : n.kind === "album" ? (
                    <Link to="/album/$slug" params={{ slug: slugifyArtist(n.entry.name) }} className="hover:underline">
                      {stripAlbumEdition(stripFeatFromTitle(n.entry.name))}
                    </Link>
                  ) : (
                    <Link to="/song/$slug" params={{ slug: songSlug(n.entry.name, n.entry.artist) }} className="hover:underline">
                      {stripFeatFromTitle(n.entry.name)}
                    </Link>
                  )}</div>
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
              <Link to="/chart/$chartId/$date" params={{ chartId: n.chartId, date: n.date }} className="block text-center text-xs text-[var(--accent)] font-semibold py-2 border-t border-[var(--border)] hover:bg-[rgba(255,109,0,0.05)] transition-colors mt-auto">
                View Chart →
              </Link>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}

/* ────── FIRST-TIMERS Section ────── */
function FirstTimersSection({ firstTimers }: { firstTimers: any[] }) {
  if (!firstTimers || firstTimers.length === 0) return null;
  return (
    <section className="mb-14">
      <div className="section-banner">
        <span>First-Timers</span>
        <Link to="/artists" className="text-xs font-bold uppercase tracking-wider hover:opacity-80 transition-opacity">
          View All <i className="fas fa-arrow-right ml-1" />
        </Link>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {firstTimers.map((ft, i) => (
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.3, delay: i * 0.05 }} key={i} className="bg-[var(--card)] rounded-xl border border-[var(--border)] overflow-hidden hover:border-[var(--accent)] hover:shadow-lg hover:shadow-[var(--accent)]/10 hover:-translate-y-1 transition-all duration-300 group shadow-sm flex flex-col h-full">
            <div className="text-center py-2 border-b border-[var(--border)]">
              <span className="text-[10px] uppercase text-muted-foreground font-bold tracking-widest">{ft.chartTitle}</span>
            </div>
            <div className="aspect-square relative">
              <SpotifyImg
                query={ft.kind === "album" ? `album:"${ft.name}" artist:"${ft.artist}"` : ft.kind === "artist" ? `artist:"${ft.name}"` : `artist:"${ft.artist}" track:"${ft.name}"`}
                type={ft.kind === "album" ? "album" : ft.kind === "artist" ? "artist" : "track"}
                rounded={false}
              />
              <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-[#00E676] text-white text-[9px] font-bold rounded uppercase">
                DEBUT
              </div>
            </div>
            <div className="p-3 flex flex-col flex-1">
              <div className="text-xl font-black text-center mb-1">
                NO. {ft.position}
              </div>
              <div className="font-bold text-sm text-center whitespace-normal break-words group-hover:text-[var(--accent)] transition-colors">
                {ft.kind === "artist" ? (
                  <Link to="/artist/$slug" params={{ slug: slugifyArtist(ft.name) }} className="hover:underline">
                    {ft.name}
                  </Link>
                ) : ft.kind === "album" ? (
                  <Link to="/album/$slug" params={{ slug: slugifyArtist(ft.name) }} className="hover:underline">
                    {stripFeatFromTitle(ft.name)}
                  </Link>
                ) : (
                  <Link to="/song/$slug" params={{ slug: songSlug(ft.name, ft.artist) }} className="hover:underline">
                    {stripFeatFromTitle(ft.name)}
                  </Link>
                )}
              </div>
              {ft.kind !== "artist" && ft.artist && (
                <div className="text-xs text-muted-foreground text-center whitespace-normal break-words mt-0.5">
                  <Link to="/artist/$slug" params={{ slug: slugifyArtist(ft.artist) }} className="hover:text-[var(--accent)] hover:underline">
                    {ft.artist}
                  </Link>
                </div>
              )}
              <div className="mt-auto pt-2 text-center">
                <Link to="/chart/$chartId/$date" params={{ chartId: ft.chartId, date: ft.date }} className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider hover:text-[var(--accent)] transition-colors">
                  See Chart
                </Link>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

/* ────── ON THIS WEEK Widget ────── */
function OnThisWeekWidget({ years, data, latestDate }: { years: number[]; data: Record<number, Array<{ chartId: string; chartTitle: string; kind: string; entry: any; date: string }>>; latestDate: string }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [selectedYear, setSelectedYear] = useState<number>(() => {
    const dayOfWeek = new Date().getDay();
    const currentYear = new Date(latestDate + "T00:00:00").getFullYear();
    const idx = Math.min(dayOfWeek, years.length - 1);
    return years[idx] ?? currentYear;
  });

  const entries = data[selectedYear] || [];
  const hasAny = entries.some((e) => e.entry);
  // Find the first chart's date for the "view chart" link
  const chartDate = entries[0]?.date || latestDate;

  if (!hasAny) return null;

  return (
    <div className="sidebar-section mt-4">
      <div className="text-xs uppercase text-muted-foreground font-bold tracking-widest mb-3">On This Week</div>
      {/* Year selector — horizontal scroll */}
      <div className="relative mb-3">
        <div
          ref={scrollRef}
          className="flex gap-1.5 overflow-x-auto scroll-thin pb-1"
        >
          {years.map((y) => (
            <button
              key={y}
              onClick={() => setSelectedYear(y)}
              className={`px-2.5 py-1.5 text-[11px] font-bold rounded-lg transition-all shrink-0 ${
                selectedYear === y
                  ? "bg-[var(--accent)] text-black shadow-[0_0_10px_rgba(255,109,0,0.3)]"
                  : "bg-[var(--muted)] text-muted-foreground hover:text-[var(--foreground)] hover:bg-[var(--border)]"
              }`}
            >
              {y}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-3">
        {entries.map((item) => {
          if (!item.entry) return null;
          const kindIcon = item.kind === "artist" ? "fa-user" : item.kind === "album" ? "fa-compact-disc" : "fa-music";
          return (
            <OnThisWeekItem key={`${selectedYear}-${item.chartId}`} item={item} kindIcon={kindIcon} />
          );
        })}
      </div>
      <Link
        to="/chart/$chartId/$date"
        params={{ chartId: "songs", date: chartDate }}
        className="mt-3 block text-center text-[10px] font-bold uppercase tracking-wider text-[var(--accent)] hover:opacity-80 transition-opacity"
      >
        View Full Chart <i className="fas fa-arrow-right ml-1" />
      </Link>
    </div>
  );
}

function OnThisWeekItem({ item, kindIcon }: { item: { chartId: string; chartTitle: string; kind: string; entry: any }; kindIcon: string }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const entry = item.entry;

  useEffect(() => {
    let active = true;
    setLoading(true);
    let query = "";
    if (item.kind === "artist") query = `artist:"${entry.name}"`;
    else if (item.kind === "album") query = `album:"${entry.name}" artist:"${entry.artist}"`;
    else query = `track:"${entry.name}" artist:"${entry.artist}"`;
    getSpotifyImage({ data: { query, type: item.kind as any } }).then((url) => {
      if (active) {
        setImageUrl(url ?? null);
        setLoading(false);
      }
    });
    return () => { active = false; };
  }, [entry.name, entry.artist, item.kind]);

  return (
    <div className="flex items-center gap-2.5 group">
      <div className="w-10 h-10 rounded-lg overflow-hidden bg-[var(--muted)] shrink-0 flex items-center justify-center">
        {loading ? (
          <div className="w-full h-full bg-gradient-to-br from-[var(--muted)] to-[var(--border)] animate-pulse" />
        ) : imageUrl ? (
          <img src={imageUrl} alt={entry.name} className="w-full h-full object-cover animate-fade-in" loading="lazy" />
        ) : (
          <i className={`fas ${kindIcon} text-muted-foreground text-xs`} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">{item.chartTitle}</div>
        <div className="font-bold text-xs truncate group-hover:text-[var(--accent)] transition-colors">
          {item.kind === "artist" ? (
            <Link to="/artist/$slug" params={{ slug: slugifyArtist(entry.name) }} className="hover:underline">{entry.name}</Link>
          ) : item.kind === "album" ? (
            <Link to="/album/$slug" params={{ slug: slugifyArtist(entry.name) }} className="hover:underline">{stripFeatFromTitle(entry.name)}</Link>
          ) : (
            <Link to="/song/$slug" params={{ slug: songSlug(entry.name, entry.artist) }} className="hover:underline">{stripFeatFromTitle(entry.name)}</Link>
          )}
        </div>
        {item.kind !== "artist" && (
          <div className="text-[10px] text-muted-foreground truncate">
            <Link to="/artist/$slug" params={{ slug: slugifyArtist(entry.artist) }} className="hover:text-[var(--accent)]">{entry.artist}</Link>
          </div>
        )}
      </div>
    </div>
  );
}

/* ────── CHART BEAT Section ────── */
function ChartBeatSection({ articles }: { articles: GeneratedBeatArticle[] }) {
  if (!articles || articles.length === 0) return null;

  return (
    <section className="mb-14">
      <div className="section-banner">
        <span>Chart Beat</span>
        <Link to="/chart-beat-2/$chartId/$date" params={{ chartId: "songs", date: articles[0]?.date ?? "" }} className="text-xs font-bold uppercase tracking-wider hover:opacity-80 transition-opacity">
          View All <i className="fas fa-arrow-right ml-1" />
        </Link>
      </div>
      <div className="flex flex-col gap-4">
        {articles.map((article, i) => {
          const dateLabel = new Date(article.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
          const cfg = chartsConfig[article.chartId];
          return (
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.3, delay: i * 0.05 }} key={article.chartId}>
              <Link to="/chart-beat-2/$chartId/$date" params={{ chartId: article.chartId, date: article.date }} className="bg-[var(--card)] rounded-xl border border-[var(--border)] overflow-hidden hover:border-[var(--accent)] transition-all flex items-stretch group shadow-sm">
                {article.artist && (
                  <div className="w-20 sm:w-32 h-auto shrink-0">
                    <SpotifyImg query={`artist:"${article.artist}"`} type="artist" rounded={false} />
                  </div>
                )}
                <div className="p-3 sm:p-4 flex flex-col justify-center flex-1 min-w-0">
                  <div className="text-[10px] uppercase text-muted-foreground font-bold tracking-widest mb-1 truncate">{cfg?.title ?? article.chartTitle}</div>
                  <div className="font-bold text-xs sm:text-base mb-1 group-hover:text-[var(--accent)] transition-colors line-clamp-2 break-words">{article.headline}</div>
                  <div className="text-[10px] sm:text-xs text-muted-foreground">{dateLabel}</div>
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}

/* ────── SIDEBAR ────── */
function Sidebar({ artistList }: { artistList: { name: string; slug: string }[] }) {
  const [search, setSearch] = useState("");
  const [yeOpen, setYeOpen] = useState(false);
  const [goatOpen, setGoatOpen] = useState(false);
  const navigate = useNavigate();

  const filteredArtists = search.trim()
    ? artistList.filter(a => a.name.toLowerCase().includes(search.toLowerCase())).slice(0, 8)
    : [];

  return (
    <aside className="space-y-4">
      {/* Search Artists */}
      <div className="sidebar-section">
        <div className="text-xs uppercase text-muted-foreground font-bold tracking-widest mb-3">Search Artists</div>
        <div className="relative">
          <input
            type="text"
            placeholder="Search Artists"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="sidebar-search"
          />
          <i className="fas fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs" />
        </div>
        {filteredArtists.length > 0 && (
          <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
            {filteredArtists.map(a => (
              <Link key={a.slug} to="/artist/$slug" params={{ slug: a.slug }} className="sidebar-link whitespace-normal break-words">
                {a.name}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Weekly Charts */}
      <div className="sidebar-section">
        <div className="text-xs uppercase text-muted-foreground font-bold tracking-widest mb-3">Weekly Charts</div>
        <div className="space-y-1">
          {weeklyChartIds.map(id => {
            const cfg = chartsConfig[id];
            return (
              <Link key={id} to="/chart/$chartId" params={{ chartId: id }} className="sidebar-link">
                {cfg.title}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Greatest of All Time */}
      <div className="sidebar-section">
        <button onClick={() => setGoatOpen(!goatOpen)} className="flex items-center justify-between w-full cursor-pointer">
          <div className="text-xs uppercase text-muted-foreground font-bold tracking-widest">Greatest of All Time</div>
          <i className={`fas fa-chevron-${goatOpen ? 'up' : 'down'} text-xs text-muted-foreground`} />
        </button>
        {goatOpen && (
          <div className="mt-3 space-y-1">
            <Link to="/goat/$chartId" params={{ chartId: "goatSongs" }} className="sidebar-link">Songs</Link>
            <Link to="/goat/$chartId" params={{ chartId: "goatArtists" }} className="sidebar-link">Artists</Link>
            <Link to="/goat/$chartId" params={{ chartId: "goatAlbums" }} className="sidebar-link">Albums</Link>
            <Link to="/goat/$chartId" params={{ chartId: "goatRadio" }} className="sidebar-link">Radio</Link>
          </div>
        )}
      </div>

      {/* Year-End */}
      <div className="sidebar-section">
        <button onClick={() => setYeOpen(!yeOpen)} className="flex items-center justify-between w-full cursor-pointer">
          <div className="text-xs uppercase text-muted-foreground font-bold tracking-widest">Year-End Charts</div>
          <i className={`fas fa-chevron-${yeOpen ? 'up' : 'down'} text-xs text-muted-foreground`} />
        </button>
        {yeOpen && (
          <div className="mt-3 space-y-1">
            <Link to="/year-end/$chartId" params={{ chartId: "yearEndSongs" }} className="sidebar-link">Hot 100</Link>
            <Link to="/year-end/$chartId" params={{ chartId: "yearEndArtists" }} className="sidebar-link">Artist 50</Link>
            <Link to="/year-end/$chartId" params={{ chartId: "yearEndAlbums" }} className="sidebar-link">Top 100 Albums</Link>
            <Link to="/year-end/$chartId" params={{ chartId: "yearEndRadio" }} className="sidebar-link">Radio Songs</Link>
            <Link to="/year-end/$chartId" params={{ chartId: "yearEndStreamingSongs" }} className="sidebar-link">Streaming Songs</Link>
            <Link to="/year-end/$chartId" params={{ chartId: "yearEndTopStreamingAlbums" }} className="sidebar-link">Top Streaming Albums</Link>
            <Link to="/year-end/$chartId" params={{ chartId: "yearEndTopAlbumSales" }} className="sidebar-link">Top Album Sales</Link>
            <Link to="/year-end/$chartId" params={{ chartId: "yearEndDigitalSongsSales" }} className="sidebar-link">Digital Songs Sales</Link>
            <Link to="/year-end/$chartId" params={{ chartId: "yearEndNewArtists" }} className="sidebar-link">New Artists</Link>
          </div>
        )}
      </div>

      {/* Stats */}
      <Link to="/stats" className="sidebar-section block hover:border-[var(--accent)] transition-all">
        <div className="text-xs uppercase text-muted-foreground font-bold tracking-widest">Stats</div>
      </Link>
    </aside>
  );
}

/* ────── LANDING PAGE ────── */
function LandingPage() {
  const { charts, numberOnes: serverNumberOnes, firstTimers, onThisWeekData, onThisWeekYears, onThisWeekLatestDate } = Route.useLoaderData();

  const [artistList, setArtistList] = useState<{ name: string; slug: string }[]>([]);
  const [latestArticles, setLatestArticles] = useState<GeneratedBeatArticle[]>([]);
  const [extraNumberOnes, setExtraNumberOnes] = useState<Array<{ chartId: string; title: string; kind: string; date: string; entry: any }>>([]);

  useEffect(() => {
    let active = true;
    getAllArtistStats().then((stats) => {
      if (!active) return;
      const list = Object.values(stats ?? {})
        .map((a: any) => ({ name: a.name, slug: slugifyArtist(a.name) }))
        .sort((a: any, b: any) => a.name.localeCompare(b.name));
      setArtistList(list);
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    getLatestBeatArticles().then((articles) => {
      if (active) setLatestArticles(articles ?? []);
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    const safeChart = async (chartId: string) => {
      try { return await getWeeklyChart({ data: { chartId } }); }
      catch { return { chartId, title: chartId, kind: "song" as const, dates: [] as string[], entriesByDate: {} as Record<string, any[]> }; }
    };
    Promise.all(SECONDARY_CHART_IDS.map(id => safeChart(id))).then((results) => {
      if (!active) return;
      const extras = SECONDARY_CHART_IDS.map((id, i) => {
        const chart = results[i];
        const latestDate = chart.dates?.[chart.dates.length - 1] ?? "";
        const entries = latestDate ? (chart.entriesByDate?.[latestDate] ?? []) : [];
        const no1 = entries[0] ?? null;
        return { chartId: chart.chartId ?? id, title: chart.title ?? id, kind: chart.kind ?? "song", date: latestDate, entry: no1 };
      });
      setExtraNumberOnes(extras);
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  const numberOnes = useMemo(() => [...serverNumberOnes, ...extraNumberOnes], [serverNumberOnes, extraNumberOnes]);

  return (
    <>
    <div className="max-w-7xl mx-auto px-4 sm:px-6">
      {/* Hero Title */}
      <div className="text-center py-10 md:py-16 relative overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
          <span className="text-[8rem] md:text-[14rem] font-black font-sans text-[var(--foreground)] opacity-[0.06] uppercase tracking-tighter leading-none">Charts</span>
        </div>
        <h1 className="text-5xl sm:text-6xl md:text-8xl font-black text-[var(--foreground)] tracking-tight relative z-10">daegon charts</h1>
        <p className="text-muted-foreground text-sm md:text-base mt-3 relative z-10">Weekly music charts, year-end rankings & greatest of all time lists</p>
      </div>

      {/* Main Layout */}
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar - Left Side */}
        <div className="w-full lg:w-72 shrink-0 lg:sticky lg:top-8 lg:h-fit">
          <Sidebar artistList={artistList} />
          <OnThisWeekWidget years={onThisWeekYears} data={onThisWeekData} latestDate={onThisWeekLatestDate} />
        </div>
        {/* Content */}
        <div className="flex-1 min-w-0">
          <TopChartsSection charts={charts} />
          <NumberOnesSection numberOnes={numberOnes} />
          <FirstTimersSection firstTimers={firstTimers} />
          <ChartBeatSection articles={latestArticles} />
          
          {/* Chart Battle Mobile Link */}
          <div className="md:hidden mt-10">
            <Link to="/chart-battle" className="block bg-[var(--card)] border border-[var(--accent)] shadow-[0_0_15px_rgba(255,109,0,0.3)] p-4 rounded-xl flex items-center justify-center gap-4 group">
              <div className="bg-[var(--accent)] text-white w-12 h-12 rounded-full flex items-center justify-center font-black text-xl shrink-0 group-hover:scale-110 transition-transform">
                VS
              </div>
              <div className="text-left">
                <div className="text-xs font-bold text-[var(--card-foreground)] uppercase tracking-widest">New Mini-Game!</div>
                <div className="text-lg font-black uppercase text-[var(--card-foreground)]">Play Chart Battle 🏆</div>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
      
      {/* Chart Battle Floating Tooltip */}
      <Link to="/chart-battle" className="fixed bottom-6 left-6 z-50 animate-bounce cursor-pointer group hidden md:block">
        <div className="bg-[var(--card)] border border-[var(--accent)] shadow-[0_0_15px_rgba(255,109,0,0.3)] px-4 py-3 rounded-2xl flex items-center gap-3">
          <div className="bg-[var(--accent)] text-white w-10 h-10 rounded-full flex items-center justify-center font-black">
            VS
          </div>
          <div>
            <div className="text-xs font-bold text-[var(--accent)] uppercase tracking-widest">New Mini-Game!</div>
            <div className="text-sm font-semibold text-[var(--card-foreground)]">Play Chart Battle 🏆</div>
          </div>
        </div>
      </Link>
    </>
  );
}
