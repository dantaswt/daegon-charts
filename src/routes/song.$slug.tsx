import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { getSongDetails, getCertificationMeta } from "@/lib/charts.functions";
import { getSpotifyImage } from "@/lib/spotify.functions";
import { slugifyArtist } from "@/lib/charts-config";
import React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { PositionChart } from "@/components/position-chart";
import { ChartGridTooltip } from "@/components/chart-grid-tooltip";
import { FavoriteButton } from "@/components/favorite-button";
import { ShareButton } from "@/components/share-button";

function SongPageSkeleton() {
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
        <div className="bg-[var(--card)] rounded-3xl p-5 border border-[var(--border)] space-y-4">
          <Skeleton className="h-4 w-24 bg-[var(--muted)]" />
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 20 }).map((_, i) => (
              <Skeleton key={i} className="w-9 h-9 rounded-lg bg-[var(--muted)]" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/song/$slug")({
  loader: async ({ params }) => {
    const song = await getSongDetails({ data: { slug: params.slug } });
    if (!song) throw notFound();
    return { song };
  },
  head: ({ loaderData }) => {
    const title = loaderData ? `${loaderData.song.name} — ${loaderData.song.artist} | daegon charts` : "Song | daegon charts";
    return {
      meta: [
        { title },
        { name: "description", content: `Song details for ${loaderData?.song.name} by ${loaderData?.song.artist}.` },
      ],
    };
  },
  pendingComponent: SongPageSkeleton,
  component: SongPage,
});

function SongPage() {
  const { song } = Route.useLoaderData();
  const [imageUrl, setImageUrl] = React.useState<string | null>(null);
  const [chartView, setChartView] = React.useState<"grid" | "line">("grid");

  React.useEffect(() => {
    let active = true;
    getSpotifyImage({ data: { query: `track:"${song.name}" artist:"${song.artist}"`, type: "track" } }).then((url) => {
      if (active) setImageUrl(url ?? null);
    });
    return () => { active = false; };
  }, [song.name, song.artist]);

  const chartLabels: Record<string, string> = {
    songs: "Hot 100",
    digitalSongsSales: "Digital Songs Sales",
    streamingSongs: "Streaming Songs",
    radioSongs: "Radio Songs",
  };

  const chartRunsByChart: Record<string, typeof song.chartRuns> = {};
  for (const run of song.chartRuns) {
    (chartRunsByChart[run.chartId] ||= []).push(run);
  }

  const chartGrids = songChartIds().map((chartId) => {
    const runs = chartRunsByChart[chartId] || [];
    const dateMap = new Map<string, { position: number; peak: number; weeks: number }>();
    for (const r of runs) {
      dateMap.set(r.date, { position: r.position, peak: r.peak, weeks: r.weeks });
    }
    const stats = song.chartStats[chartId];
    return { chartId, title: chartLabels[chartId] || chartId, dateMap, hasData: runs.length > 0, stats };
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-16 space-y-8">
      <Link to="/chart/$chartId" params={{ chartId: "songs" }} className="text-sm text-[var(--muted-foreground)] hover:text-[var(--accent)] inline-flex items-center gap-2">
        <i className="fas fa-arrow-left" /> Back to Hot 100
      </Link>

      <div className="flex flex-col sm:flex-row gap-6 bg-[var(--card)] rounded-3xl p-6 border border-[var(--border)] shadow-lg">
        <div className="w-48 h-48 sm:w-56 sm:h-56 rounded-2xl overflow-hidden bg-[var(--muted)] shrink-0 mx-auto sm:mx-0">
          {imageUrl ? (
            <img src={imageUrl} alt={song.name} className="w-full h-full object-cover animate-fade-in" loading="lazy" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-5xl text-[var(--muted-foreground)] animate-pulse">
              <i className="fas fa-music" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0 text-center sm:text-left">
          <div className="text-sm uppercase tracking-[0.3em] text-muted-foreground mb-1">
            <Link to="/artist/$slug" params={{ slug: slugifyArtist(song.artist) }} className="hover:text-[var(--accent)] transition-colors">{song.artist}</Link>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold mb-3 break-words text-[var(--foreground)]">{song.name}</h1>
          <div className="mb-3 flex items-center gap-3">
            <FavoriteButton name={song.name} slug={slugifyArtist(song.name)} kind="song" size="sm" />
            <ShareButton title={`${song.name} by ${song.artist}`} kind="song" />
          </div>
          {song.goatPosition && (
            <div className="inline-flex items-center gap-2 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-full px-4 py-1.5 text-sm font-semibold mb-4 border border-amber-500/20">
              <i className="fas fa-trophy" />
              GOAT Songs #{song.goatPosition} · {song.goatWeeks} total weeks
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <StatBox label="Peak" value={`#${song.peak}`} />
            <StatBox label="Weeks" value={String(song.weeks)} />
            {song.totalPoints && <StatBox label="Points" value={song.totalPoints} />}
            {song.totalUnits && <StatBox label="Total Units" value={song.totalUnits} />}
            {song.totalSales && <StatBox label="Sales" value={song.totalSales} />}
            {song.totalStreams && <StatBox label="Streams" value={song.totalStreams} />}
            {song.totalAudience && <StatBox label="Audience" value={song.totalAudience} />}
            {song.certificationLevel && <CertificationBox level={song.certificationLevel} />}
          </div>
        </div>
      </div>

      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-extrabold text-[var(--foreground)]">Chart Runs</h2>
          {chartGrids.filter((g) => g.hasData).length > 0 && (
            <div className="flex gap-1 bg-[var(--muted)] rounded-lg p-1 border border-[var(--border)]">
              <button
                onClick={() => setChartView("grid")}
                className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${
                  chartView === "grid"
                    ? "bg-[var(--accent)] text-black"
                    : "text-muted-foreground hover:text-[var(--foreground)]"
                }`}
              >
                <i className="fas fa-th mr-1.5" />Grid
              </button>
              <button
                onClick={() => setChartView("line")}
                className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${
                  chartView === "line"
                    ? "bg-[var(--accent)] text-black"
                    : "text-muted-foreground hover:text-[var(--foreground)]"
                }`}
              >
                <i className="fas fa-chart-line mr-1.5" />Line
              </button>
            </div>
          )}
        </div>
        {chartGrids.filter((g) => g.hasData).length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)]">No chart run data available.</p>
        ) : (
          <div className="space-y-6">
            {chartGrids.filter((g) => g.hasData).map((grid) => (
              <div key={grid.chartId} className="bg-[var(--card)] rounded-3xl p-5 border border-[var(--border)] shadow-lg space-y-4">
                {chartView === "line" ? (
                  <PositionChart
                    data={[...grid.dateMap.entries()]
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([date, { position, peak, weeks }]) => ({
                        date,
                        position,
                        peak,
                        weeks,
                        chartTitle: grid.title,
                      }))}
                    chartTitle={grid.title}
                  />
                ) : (
                  <>
                    <div className="text-sm font-bold text-[var(--muted-foreground)] uppercase tracking-wider">{grid.title}</div>
                {grid.stats && (
                  <div className="flex flex-wrap gap-3 text-xs">
                    <span className="rounded-full bg-[var(--muted)] px-3 py-1 font-semibold text-[var(--foreground)] border border-[var(--border)]">Peak #{grid.stats.weeksAt1 > 0 ? "1" : grid.dateMap.size > 0 ? Math.min(...[...grid.dateMap.values()].map((v) => v.position)) : "—"}</span>
                    <span className="rounded-full bg-[var(--muted)] px-3 py-1 font-semibold text-[var(--foreground)] border border-[var(--border)]">{grid.dateMap.size} weeks</span>
                    {grid.stats.weeksAt1 > 0 && <span className="rounded-full bg-amber-100 dark:bg-amber-900/30 px-3 py-1 font-semibold text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">{grid.stats.weeksAt1} #1's</span>}
                    {grid.stats.top5 > 0 && <span className="rounded-full bg-[var(--muted)] px-3 py-1 font-semibold text-[var(--foreground)] border border-[var(--border)]">Top 5: {grid.stats.top5}</span>}
                    {grid.stats.top10 > 0 && <span className="rounded-full bg-[var(--muted)] px-3 py-1 font-semibold text-[var(--foreground)] border border-[var(--border)]">Top 10: {grid.stats.top10}</span>}
                  </div>
                )}
                <div className="flex flex-wrap gap-1.5 items-center">
                  {(() => {
                    const sorted = [...grid.dateMap.entries()].sort(([a], [b]) => a.localeCompare(b));
                    const items: React.ReactNode[] = [];
                    sorted.forEach(([date, { position }], i) => {
                      if (i > 0) {
                        const prevDate = new Date(sorted[i - 1][0] + "T00:00:00");
                        const currDate = new Date(date + "T00:00:00");
                        const gapWeeks = Math.round((currDate.getTime() - prevDate.getTime()) / (7 * 86400000)) - 1;
                        if (gapWeeks > 0) {
                          items.push(
                            <div key={`out-${date}`} className="flex items-center justify-center h-8 sm:h-9 px-2 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 text-[10px] font-bold border border-red-200 dark:border-red-800" title={`Out for ${gapWeeks} week${gapWeeks > 1 ? "s" : ""}`}>
                              OUT {gapWeeks >= 2 ? `${gapWeeks}x` : ""}
                            </div>
                          );
                        }
                      }
                      items.push(
                        <ChartGridTooltip
                          key={date}
                          date={date}
                          position={position}
                          chartTitle={grid.title}
                        >
                          <Link
                            to="/chart/$chartId/$date"
                            params={{ chartId: grid.chartId, date }}
                            className="group relative"
                          >
                            <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center text-xs font-bold transition-transform group-hover:scale-110 ${
                              position <= 10 ? "bg-emerald-500 text-white" :
                              position <= 25 ? "bg-emerald-500/70 text-white" :
                              position <= 50 ? "bg-emerald-500/30 text-emerald-700 dark:text-emerald-300" :
                              "bg-[var(--muted)] text-[var(--muted-foreground)] border border-[var(--border)]"
                            }`}>
                              {position}
                            </div>
                          </Link>
                        </ChartGridTooltip>
                      );
                    });
                      return items;
                    })()}
                  </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {song.yecEntries.filter(e => !(new Date() < new Date("2026-12-31T23:59:59") && e.year === "2026")).length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-extrabold text-[var(--foreground)]">Year-End History</h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {song.yecEntries.filter(e => !(new Date() < new Date("2026-12-31T23:59:59") && e.year === "2026")).map((e) => (
              <Link
                key={`${e.year}-${e.chartId}`}
                to="/year-end/$chartId"
                params={{ chartId: e.chartId }}
                className="flex items-center gap-3 rounded-2xl bg-[var(--card)] p-3 border border-[var(--border)] hover:border-[var(--accent)]/50 transition-colors shadow-sm"
              >
                <div className="w-12 h-12 rounded-xl bg-[var(--accent)]/10 flex items-center justify-center text-lg font-extrabold text-[var(--accent)] shrink-0">
                  #{e.position}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-[var(--foreground)]">{e.year}</div>
                  <div className="text-xs text-[var(--muted-foreground)] truncate">{e.chartTitle}</div>
                  <div className="text-xs text-[var(--muted-foreground)]">Peak #{e.peak} · {e.weeks} weeks</div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {song.statsRecords.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-extrabold text-[var(--foreground)]">Records</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {song.statsRecords.map((rec, i) => (
              <div key={i} className="flex items-center gap-3 rounded-2xl bg-[var(--card)] p-3 border border-[var(--border)] shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-[var(--accent)]/10 flex items-center justify-center shrink-0">
                  <i className="fas fa-chart-bar text-[var(--accent)] text-sm" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs text-[var(--muted-foreground)] uppercase tracking-wider">{rec.category}</div>
                  <div className="text-sm font-bold text-[var(--foreground)]">{rec.value}</div>
                  {rec.details && <div className="text-xs text-[var(--muted-foreground)]">{rec.details}</div>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[var(--muted)] p-3 text-center border border-[var(--border)]">
      <div className="uppercase tracking-[0.2em] text-[10px] text-[var(--muted-foreground)]">{label}</div>
      <div className="text-xl font-bold text-[var(--foreground)] mt-1">{value}</div>
    </div>
  );
}

function CertificationBox({ level }: { level: string }) {
  const meta = getCertificationMeta(level);
  if (!meta) return null;
  return (
    <div className={`rounded-2xl p-3 text-center border ${meta.bg} ${meta.border}`}>
      <div className="uppercase tracking-[0.2em] text-[10px] text-[var(--muted-foreground)]">Certification</div>
      <div className={`text-xl font-bold mt-1 uppercase ${meta.color}`}>
        {level}
      </div>
    </div>
  );
}

function formatDateShort(date: string): string {
  const d = new Date(date + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function songChartIds(): string[] {
  return ["songs", "digitalSongsSales", "streamingSongs", "radioSongs"];
}
