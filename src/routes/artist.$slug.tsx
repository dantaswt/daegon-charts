import { createFileRoute, Link } from "@tanstack/react-router";
import { getArtistChartHistory, getGoatGenerated, getArtist50TotalUnits, getArtist50Totals, getArtistYearEndPositions, type ArtistYECPosition } from "@/lib/charts.functions";
import { getSpotifyArtistProfile, getSpotifyFeaturedOn } from "@/lib/spotify.functions";
import { slugifyArtist, chartsConfig, weeklyChartIds, stripAlbumEdition, songSlug } from "@/lib/charts-config";
import { getArtistAwards, type AwardArtistData } from "@/lib/awards.functions";
import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { TrackArtists, stripFeatFromTitle } from "@/components/track-artists";
import { SpotifyItemImage } from "@/components/spotify-item-image";
import { Skeleton } from "@/components/ui/skeleton";
import { FavoriteButton } from "@/components/favorite-button";
import { ShareButton } from "@/components/share-button";

function ArtistPageSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-16 space-y-8">
      <Skeleton className="h-6 w-48 bg-[var(--muted)]" />
      <div className="flex flex-col sm:flex-row gap-6 bg-[var(--card)] rounded-3xl p-6 border border-[var(--border)]">
        <Skeleton className="w-48 h-48 sm:w-56 sm:h-56 rounded-2xl bg-[var(--muted)] shrink-0 mx-auto sm:mx-0" />
        <div className="flex-1 space-y-4">
          <Skeleton className="h-4 w-32 bg-[var(--muted)]" />
          <Skeleton className="h-10 w-64 bg-[var(--muted)]" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-3xl border border-[var(--border)] bg-[var(--muted)] p-4">
                <Skeleton className="h-3 w-16 bg-[var(--border)]" />
                <Skeleton className="h-6 w-20 mt-2 bg-[var(--border)]" />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="space-y-4">
        <Skeleton className="h-8 w-48 bg-[var(--muted)]" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-[var(--card)] rounded-3xl p-5 border border-[var(--border)] space-y-3">
              <Skeleton className="h-4 w-24 bg-[var(--muted)]" />
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: 8 }).map((_, j) => (
                  <Skeleton key={j} className="w-9 h-9 rounded-lg bg-[var(--muted)]" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ────── Chart name → route mapping ────── */
const chartNameToRoute: Record<string, { chartId: string }> = {};
for (const id of weeklyChartIds) {
  const cfg = chartsConfig[id];
  if (cfg) chartNameToRoute[cfg.title] = { chartId: id };
}
chartNameToRoute["Hot 100 Songs"] = { chartId: "songs" };
chartNameToRoute["Top 50 Artists"] = { chartId: "artists" };
  chartNameToRoute["Top 100 Albums"] = { chartId: "albums" };
chartNameToRoute["Radio Songs"] = { chartId: "radioSongs" };
chartNameToRoute["Top 40 Radio"] = { chartId: "radioSongs" };
chartNameToRoute["Top Streaming Albums"] = { chartId: "topStreamingAlbums" };
chartNameToRoute["Top Album Sales"] = { chartId: "topAlbumSales" };
chartNameToRoute["Streaming Songs"] = { chartId: "streamingSongs" };
chartNameToRoute["Digital Songs Sales"] = { chartId: "digitalSongsSales" };

/* ────── Format helpers ────── */
function parseEuro(v: string): number {
  let s = v.trim();
  if (!s || s === "-") return NaN;
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (hasDot) {
    const parts = s.split(".");
    if (parts.length === 2 && parts[1].length === 3) {
      s = s.replace(/\./g, "");
    } else {
      s = s.replace(/\./g, "");
    }
  } else if (hasComma) {
    s = s.replace(",", ".");
  }
  return parseFloat(s);
}

function formatStreams(v: string | null | undefined): string {
  if (!v) return "—";
  const n = parseEuro(v);
  if (isNaN(n)) return v;
  if (n >= 1_000_000) {
    const val = n / 1_000_000;
    return val % 1 === 0 ? `${val}B` : `${parseFloat(val.toFixed(1))}B`;
  }
  if (n >= 1_000) {
    const val = n / 1_000;
    return val % 1 === 0 ? `${val}M` : `${parseFloat(val.toFixed(1))}M`;
  }
  return n.toLocaleString("en-US");
}

function formatComma(v: string | null | undefined): string {
  if (!v) return "—";
  const n = parseEuro(v);
  if (isNaN(n)) return v;
  return n.toLocaleString("en-US");
}

function formatDate(d: string) {
  if (!d) return "—";
  try {
    return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "2-digit" });
  } catch {
    return d;
  }
}

export const Route = createFileRoute("/artist/$slug")({
  loader: async ({ params }) => {
    const [artistChartResult, artist50Units, artist50Totals] = await Promise.all([
      getArtistChartHistory({ data: { slug: params.slug } }),
      getArtist50TotalUnits(),
      getArtist50Totals(),
    ]);

    const artistName = artistChartResult.artistName;
    const chartsByKind = artistChartResult.chartsByKind;

    let profile = null;
    let goatData = null;
    let featuredOn = null;
    let yecPositions: ArtistYECPosition[] = [];

    if (artistName) {
      [profile, featuredOn] = await Promise.all([
        getSpotifyArtistProfile({ data: { artistName } }),
        getSpotifyFeaturedOn({ data: { artistName } }),
      ]);
      const goatArtists = await getGoatGenerated({ data: { chartId: "goatArtists" } }).catch(() => null);
      const foundInGoat = goatArtists?.entries?.find(e => e.name.toLowerCase() === artistName.toLowerCase());
      if (foundInGoat) {
        goatData = { position: foundInGoat.position, totalUnits: foundInGoat.totalUnits || foundInGoat.points };
      }
      yecPositions = await getArtistYearEndPositions({ data: { artistName } }).catch(() => []);
    }

    const artist = artistName ? { name: artistName, chartsByKind } : null;

    return { artist, slug: params.slug, profile, goatData, featuredOn, artist50Units, artist50Totals, yecPositions };
  },
  head: ({ loaderData }) => {
    const name = loaderData?.artist?.name ?? "Artist";
    return {
      meta: [
        { title: `${name} — chart history | daegon charts` },
        { name: "description", content: `Chart history and entries for ${name}.` },
        { property: "og:title", content: `${name} — daegon charts` },
      ],
    };
  },
  pendingComponent: ArtistPageSkeleton,
  component: ArtistPage,
});

/* ────── Date Link ────── */
function DateLink({ chartName, date, children }: { chartName: string; date: string; children: React.ReactNode }) {
  const route = chartNameToRoute[chartName];
  if (!route || !date) return <span>{children}</span>;
  return (
    <Link to="/chart/$chartId/$date" params={{ chartId: route.chartId, date }} className="hover:underline">
      {children}
    </Link>
  );
}

/* ────── ARTIST PAGE ────── */
function ArtistPage() {
  const { artist, profile, goatData, featuredOn, artist50Units, artist50Totals, yecPositions } = Route.useLoaderData();

  if (!artist) {
    return (
      <div className="text-center py-20">
        <div className="w-20 h-20 rounded-full bg-[var(--muted)] flex items-center justify-center text-3xl text-muted-foreground mx-auto mb-6">
          <i className="fas fa-user" />
        </div>
        <h2 className="text-2xl font-bold gold mb-2">Artist not found</h2>
        <p className="text-muted-foreground text-sm mb-6">The artist you're looking for doesn't exist in our database.</p>
        <Link to="/artists" className="btn-gold inline-flex items-center gap-2">
          <i className="fas fa-arrow-left" /> Browse all artists
        </Link>
      </div>
    );
  }

  const order = [
    "Hot 100 Songs",
    "Digital Songs Sales",
    "Streaming Songs",
    "Top 40 Radio",
    "Top 100 Albums",
    "Top Album Sales",
    "Top Streaming Albums"
  ];

  const chartsToRender = order.filter(c => artist.chartsByKind[c] && artist.chartsByKind[c].length > 0);
  const otherCharts = Object.keys(artist.chartsByKind).filter(c => !order.includes(c) && c !== "Top 50 Artists" && c !== "Artists");
  const allCharts = [...chartsToRender, ...otherCharts];

  // Year-end charts for selector
  const yecCharts = ["Year-End Artists", "Year-End Albums", "Year-End Songs"];
  const allChartsWithYEC = [...allCharts, ...yecCharts];

  const [selectedChart, setSelectedChart] = useState(allChartsWithYEC[0] || "");
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<"charts" | "awards">("charts");
  const [awardsData, setAwardsData] = useState<AwardArtistData | null>(null);
  const [awardsLoading, setAwardsLoading] = useState(false);

  useEffect(() => {
    if (activeTab === "awards" && !awardsData && !awardsLoading) {
      setAwardsLoading(true);
      getArtistAwards(artist.name)
        .then(setAwardsData)
        .catch(() => setAwardsData(null))
        .finally(() => setAwardsLoading(false));
    }
  }, [activeTab, artist.name, awardsData, awardsLoading]);
  const isYEC = yecCharts.includes(selectedChart);
  const yecLocked = new Date() < new Date("2026-12-31T23:59:59");
  const currentEntries = isYEC
    ? (yecPositions.filter(y => y.chartTitle === selectedChart && !(yecLocked && y.year === "2026")).map(y => ({ item: y.itemName, year: y.year, peak: y.peak, weeks: y.weeks, yecPosition: y.position, peakDate: null, firstEntry: null, weeksAt1: 0 })))
    : (selectedChart ? (artist.chartsByKind[selectedChart] || []) : []);
  const visibleEntries = expanded ? currentEntries : currentEntries.slice(0, 5);

  const no1s = currentEntries.filter((e: any) => e.peak === 1).length;
  const titles = currentEntries.length;
  const top10 = currentEntries.filter((e: any) => e.peak >= 1 && e.peak <= 10).length;

  const isAlbumChart = selectedChart === "Top 100 Albums" || selectedChart === "Top Album Sales" || selectedChart === "Top Streaming Albums";

  const totals = artist50Totals?.[artist.name];

  // Artist 50 peak and weeks from chart history
  const artist50Chart = artist.chartsByKind["Top 50 Artists"] || artist.chartsByKind["Artists"] || [];
  const artist50Peak = artist50Chart.length > 0 ? Math.min(...artist50Chart.map((e: any) => e.peak)) : null;
  const artist50Weeks = artist50Chart.reduce((sum: number, e: any) => sum + (e.weeks || 0), 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-16">
      {/* Back Link */}
      <Link to="/artists" className="text-sm text-muted-foreground hover:text-[var(--accent)] mb-6 inline-flex items-center gap-2 transition-colors">
        <i className="fas fa-arrow-left" /> All artists
      </Link>

      {/* Hero Header */}
      <div className="relative text-center py-10 md:py-14 mb-8 overflow-hidden">
        <h1 className="text-5xl sm:text-6xl md:text-8xl font-black gold tracking-tight relative z-10 uppercase">{artist.name}</h1>
        <div className="relative z-10 mt-4 flex items-center justify-center gap-3">
          <FavoriteButton name={artist.name} slug={slugifyArtist(artist.name)} kind="artist" />
          <ShareButton title={artist.name} kind="artist" />
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
        {artist50Peak !== null && (
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 text-center">
            <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-1">Artist 50 Peak</div>
            <div className="text-2xl font-black gold">#{artist50Peak}</div>
          </div>
        )}
        {artist50Weeks > 0 && (
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 text-center">
            <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-1">Artist 50 Weeks</div>
            <div className="text-2xl font-black text-[var(--foreground)]">{artist50Weeks}</div>
          </div>
        )}
        {goatData && (
          <div className="bg-gradient-to-br from-yellow-500/20 to-yellow-600/10 border border-yellow-500/40 rounded-xl p-4 text-center">
            <div className="text-[10px] uppercase font-bold tracking-wider text-yellow-400 mb-1"><i className="fas fa-trophy mr-1" />GOAT Artists</div>
            <div className="text-2xl font-black text-yellow-400">#{goatData.position}</div>
          </div>
        )}
        {totals?.totalUnits && (
          <div className="bg-[var(--card)] border border-[var(--accent)]/30 rounded-xl p-4 text-center">
            <div className="text-[10px] uppercase font-bold tracking-wider text-[var(--accent)] mb-1">Total Units</div>
            <div className="text-2xl font-black text-[var(--foreground)]">{formatComma(totals.totalUnits)}</div>
          </div>
        )}
        {totals?.totalSales && totals.totalSales !== "0" && (
          <div className="bg-[var(--card)] border border-emerald-500/30 rounded-xl p-4 text-center">
            <div className="text-[10px] uppercase font-bold tracking-wider text-emerald-400 mb-1">Total Sales</div>
            <div className="text-2xl font-black text-[var(--foreground)]">{formatComma(totals.totalSales)}</div>
          </div>
        )}
        {totals?.totalStreams && totals.totalStreams !== "0" && (
          <div className="bg-[var(--card)] border border-violet-500/30 rounded-xl p-4 text-center">
            <div className="text-[10px] uppercase font-bold tracking-wider text-violet-400 mb-1">Total Streams</div>
            <div className="text-2xl font-black text-[var(--foreground)]">{formatStreams(totals.totalStreams)}</div>
          </div>
        )}
      </div>

      {/* Artist Image + Bio */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="flex flex-col items-center gap-6 mb-10">
        <div className="w-full max-w-xs">
          <div className="aspect-square relative overflow-hidden rounded-xl border border-[var(--border)]">
            <SpotifyItemImage name={artist.name} artist={artist.name} kind="artist" size={320} className="w-full h-full" />
          </div>
        </div>
        <div className="flex-1 flex flex-col justify-center text-center max-w-2xl">
          {profile && (
            <div className="flex flex-wrap items-center gap-3 text-sm mb-4">
              {profile.followers > 0 && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[var(--border)]">
                  <i className="fas fa-users text-[var(--accent)]" />
                  {profile.followers >= 1000000
                    ? `${(profile.followers / 1000000).toFixed(1)}M`
                    : profile.followers >= 1000
                    ? `${(profile.followers / 1000).toFixed(0)}K`
                    : profile.followers.toLocaleString()} Followers
                </span>
              )}
              {profile.genres.length > 0 && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[var(--border)] capitalize">
                  <i className="fas fa-music text-[var(--accent)]" />
                  {profile.genres.slice(0, 3).join(", ")}
                </span>
              )}
            </div>
          )}
          <div className="text-sm text-muted-foreground leading-relaxed">
            {profile?.bio ? profile.bio : `${artist.name} has ${Object.values(artist.chartsByKind).reduce((sum, entries) => sum + entries.length, 0)} chart entries across all charts.`}
          </div>
        </div>
      </motion.div>

      {/* Tab Navigation */}
      <div className="flex gap-1 mb-6 border-b border-[var(--border)]">
        <button
          onClick={() => setActiveTab("charts")}
          className={`px-5 py-3 text-sm font-bold uppercase tracking-wider transition-colors cursor-pointer border-b-2 ${
            activeTab === "charts"
              ? "border-[var(--accent)] text-[var(--accent)]"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <i className="fas fa-chart-line mr-2" />Charts
        </button>
        <button
          onClick={() => setActiveTab("awards")}
          className={`px-5 py-3 text-sm font-bold uppercase tracking-wider transition-colors cursor-pointer border-b-2 ${
            activeTab === "awards"
              ? "border-[var(--accent)] text-[var(--accent)]"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <i className="fas fa-trophy mr-2" />Awards
        </button>
      </div>

      {/* Awards Tab */}
      {activeTab === "awards" && (
        <div className="mb-8">
          {awardsLoading ? (
            <div className="flex flex-col items-center py-12">
              <div className="w-10 h-10 border-4 border-[var(--accent)]/20 border-t-[var(--accent)] rounded-full animate-spin mb-3" />
              <span className="text-sm text-muted-foreground">Loading awards...</span>
            </div>
          ) : awardsData ? (
            <div>
              <div className="grid grid-cols-2 gap-4 mb-6 max-w-md">
                <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 text-center">
                  <div className="text-4xl font-black gold mb-1">{awardsData.wins}</div>
                  <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Wins</div>
                </div>
                <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 text-center">
                  <div className="text-4xl font-black text-[var(--foreground)] mb-1">{awardsData.nominations}</div>
                  <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Nominations</div>
                </div>
              </div>
              {Object.keys(awardsData.entriesByYear)
                .sort((a, b) => Number(b) - Number(a))
                .map((year) => {
                  const entries = awardsData.entriesByYear[year];
                  const wins = entries.filter((e) => e.status === "Winner");
                  const noms = entries.filter((e) => e.status !== "Winner");
                  return (
                    <div key={year} className="mb-6 bg-[var(--card)] rounded-xl border border-[var(--border)] overflow-hidden">
                      <div className="bg-[var(--accent)] text-black px-5 py-3 font-bold text-lg">{year}</div>
                      <div className="p-4 space-y-4">
                        {wins.length > 0 && (
                          <div>
                            <div className="text-sm font-bold text-[var(--accent)] mb-3 pb-2 border-b border-[var(--border)] uppercase tracking-wider">
                              <i className="fas fa-trophy mr-1" /> Wins ({wins.length})
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {wins.map((e, i) => (
                                <div key={i} className="p-3 rounded-lg border-l-4 border-[var(--accent)] bg-[rgba(255,109,0,0.05)]">
                                  <div className="font-semibold text-sm text-[var(--foreground)]">{e.category}</div>
                                  {e.item && <div className="text-xs text-muted-foreground mt-1">{e.item}</div>}
                                  <span className="inline-block mt-2 px-2 py-0.5 bg-[var(--accent)] text-black text-[10px] font-bold rounded uppercase">Winner</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {noms.length > 0 && (
                          <div>
                            <div className="text-sm font-bold text-muted-foreground mb-3 pb-2 border-b border-[var(--border)] uppercase tracking-wider">
                              Nominations ({noms.length})
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {noms.map((e, i) => (
                                <div key={i} className="p-3 rounded-lg border-l-4 border-[var(--border)]">
                                  <div className="font-semibold text-sm text-[var(--foreground)]">{e.category}</div>
                                  {e.item && <div className="text-xs text-muted-foreground mt-1">{e.item}</div>}
                                  <span className="inline-block mt-2 px-2 py-0.5 bg-[var(--muted)] text-muted-foreground text-[10px] font-bold rounded uppercase">Nominated</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground text-sm">
              <i className="fas fa-trophy text-3xl mb-3 block opacity-40" />
              No award data found for this artist.
            </div>
          )}
        </div>
      )}

      {/* Charts Tab */}
      {activeTab === "charts" && allChartsWithYEC.length > 0 && (
        <div className="mb-8">
          {/* Summary Cards */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-[var(--accent)] text-black p-4 flex items-center justify-center rounded-xl">
              <div className="text-center">
                <div className="font-black text-sm leading-tight uppercase">{selectedChart || "—"}</div>
              </div>
            </div>
            <div className="border border-[var(--accent)] p-4 rounded-xl">
              <div className="text-center">
                <div className="text-3xl font-black text-[var(--foreground)]">{no1s}</div>
                <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mt-1">NO. 1 HITS</div>
              </div>
            </div>
            <div className="border border-[var(--accent)] p-4 rounded-xl">
              <div className="text-center">
                <div className="text-3xl font-black text-[var(--foreground)]">{titles}</div>
                <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mt-1">TITLES</div>
              </div>
            </div>
            <div className="border border-[var(--accent)] p-4 rounded-xl">
              <div className="text-center">
                <div className="text-3xl font-black text-[var(--foreground)]">{top10}</div>
                <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mt-1">TOP 10 HITS</div>
              </div>
            </div>
          </div>

          {/* Chart Selector */}
          <div className="mb-4">
            <select
              value={selectedChart}
              onChange={(e) => setSelectedChart(e.target.value)}
              className="bg-[var(--muted)] text-[var(--foreground)] border border-[var(--border)] text-sm font-bold px-4 py-3 min-w-[200px] focus:outline-none focus:border-[var(--accent)] cursor-pointer rounded-xl"
            >
              {allChartsWithYEC.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Table Header */}
          {currentEntries.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wider border-b border-[var(--border)]">
                    {isYEC ? (
                      <>
                        <th className="px-4 py-3 font-bold text-[var(--foreground)]">Year</th>
                        <th className="px-4 py-3 font-bold text-[var(--foreground)]">{selectedChart === "Year-End Artists" ? "Artist" : selectedChart === "Year-End Albums" ? "Album" : "Song"}</th>
                        <th className="px-3 py-3 text-center font-bold text-[var(--accent)]">Position</th>
                        <th className="px-3 py-3 text-center font-bold text-[var(--accent)]">Peak</th>
                        <th className="px-3 py-3 text-center font-bold text-[var(--accent)]">Weeks</th>
                      </>
                    ) : (
                      <>
                        <th className="px-4 py-3 font-bold text-[var(--foreground)]">{isAlbumChart ? "Album" : "Song"}</th>
                        <th className="px-3 py-3 text-center font-bold text-[var(--accent)]">Debut Date</th>
                        <th className="px-3 py-3 text-center font-bold text-[var(--accent)]">Peak Pos.</th>
                        <th className="px-3 py-3 text-center font-bold text-[var(--accent)]">Peak Date</th>
                        <th className="px-3 py-3 text-center font-bold text-[var(--accent)]">Wks. on Chart</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {visibleEntries.map((e: any, i: number) => (
                    <tr key={i} className="border-b border-[var(--border)] hover:bg-[rgba(255,109,0,0.05)] transition-colors">
                      {isYEC ? (
                        <>
                          <td className="px-4 py-4">
                            <div className="font-bold text-base">{e.year}</div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="font-bold text-sm whitespace-normal break-words">
                              {selectedChart === "Year-End Albums" ? (
                                <Link to="/album/$slug" params={{ slug: slugifyArtist(e.item) }} className="hover:text-[var(--accent)] hover:underline">{stripAlbumEdition(stripFeatFromTitle(e.item))}</Link>
                              ) : selectedChart === "Year-End Songs" ? (
                                <Link to="/song/$slug" params={{ slug: songSlug(e.item, artist.name) }} className="hover:text-[var(--accent)] hover:underline">{stripFeatFromTitle(e.item)}</Link>
                              ) : (
                                e.item
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-4 text-center">
                            <div className="font-black text-lg text-[var(--accent)]">#{e.yecPosition}</div>
                          </td>
                          <td className="px-3 py-4 text-center">
                            <div className="font-black text-lg">#{e.peak}</div>
                          </td>
                          <td className="px-3 py-4 text-center">
                            <span className="font-black text-xl">{e.weeks}</span>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-4">
                            <div className="font-bold text-base whitespace-normal break-words">
                              {selectedChart === "Top 50 Artists" ? e.item : isAlbumChart ? (
                                <Link to="/album/$slug" params={{ slug: slugifyArtist(e.item) }} className="hover:text-[var(--accent)] hover:underline">{stripAlbumEdition(stripFeatFromTitle(e.item))}</Link>
                              ) : (
                                <Link to="/song/$slug" params={{ slug: songSlug(e.item, artist.name) }} className="hover:text-[var(--accent)] hover:underline">{stripFeatFromTitle(e.item)}</Link>
                              )}
                            </div>
                            {selectedChart !== "Top 50 Artists" && (
                              <div className="text-xs text-muted-foreground break-words">
                                {artist.name}
                                {!isAlbumChart && <TrackArtists song={e.item} artist={artist.name} className="text-xs text-muted-foreground" />}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-4 text-center text-xs">
                            {e.firstEntry ? <DateLink chartName={selectedChart} date={e.firstEntry}>{formatDate(e.firstEntry)}</DateLink> : "—"}
                          </td>
                          <td className="px-3 py-4 text-center">
                            <div className="font-black text-lg">#{e.peak}</div>
                            {(e.weeksAt1 ?? 0) > 0 && (
                              <span className="inline-flex items-center px-2 py-0.5 bg-[var(--accent)] text-black text-[9px] font-bold rounded uppercase whitespace-nowrap mt-1">
                                {e.weeksAt1} WKS
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-4 text-center text-xs">
                            {e.peakDate ? <DateLink chartName={selectedChart} date={e.peakDate}>{formatDate(e.peakDate)}</DateLink> : "—"}
                          </td>
                          <td className="px-3 py-4 text-center">
                            <span className="font-black text-xl">{e.weeks}</span>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground text-sm">No entries found for this chart.</div>
          )}
          {currentEntries.length > 5 && (
            <div className="p-3 text-center border-t border-[var(--border)]">
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-[var(--accent)] hover:underline text-sm font-semibold cursor-pointer"
              >
                {expanded ? "Show less" : `Show all ${currentEntries.length} entries`}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Featured Collaborations */}
      {featuredOn && featuredOn.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4 }} className="mt-8">
          <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] overflow-hidden shadow-sm">
            <div className="flex items-center gap-3 p-4 sm:p-5 border-b border-[var(--border)]">
              <i className="fas fa-handshake text-[var(--accent)] text-lg" />
              <div>
                <h3 className="font-bold text-base sm:text-lg uppercase">Featured Collaborations</h3>
                <p className="text-xs text-muted-foreground">{featuredOn.length} {featuredOn.length === 1 ? "track" : "tracks"} where {artist.name} is featured</p>
              </div>
            </div>
            <div className="divide-y divide-[var(--border)]">
              {featuredOn.map((track, i) => (
                <div key={i} className="flex items-center gap-3 px-4 sm:px-5 py-3 hover:bg-[rgba(255,109,0,0.05)] transition-colors">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm break-words">{track.name}</div>
                    <div className="text-xs text-muted-foreground break-words">
                      <Link to="/artist/$slug" params={{ slug: track.slug }} className="hover:text-[var(--accent)] hover:underline">
                        {track.artist}
                      </Link>
                      {" & "}{artist.name}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* Back Link Bottom */}
      <div className="mt-12 text-center">
        <Link to="/artists" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-[var(--accent)] transition-colors">
          <i className="fas fa-arrow-left" /> Browse all artists
        </Link>
      </div>
    </div>
  );
}
