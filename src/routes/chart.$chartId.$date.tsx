import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { getHistoricalWeeklyChart, getWeeklyChart } from "@/lib/charts.functions";
import { chartsConfig, weeklyChartIds, slugifyArtist } from "@/lib/charts-config";
import { ChartTypeNav, WeekNavigator } from "@/components/chart-nav";
import { ChartRow } from "@/components/chart-row";
import { ChartImage } from "@/components/chart-image";
import { getSpotifyImage } from "@/lib/spotify.functions";
import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

function ChartPageSkeleton() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <Skeleton className="h-6 w-48 bg-[var(--muted)]" />
      <Skeleton className="h-10 w-64 bg-[var(--muted)]" />
      <Skeleton className="h-8 w-48 bg-[var(--muted)]" />
      <div className="flex gap-2">
        <Skeleton className="h-10 w-20 bg-[var(--muted)]" />
        <Skeleton className="h-10 w-20 bg-[var(--muted)]" />
        <Skeleton className="h-10 w-20 bg-[var(--muted)]" />
      </div>
      <div className="space-y-4">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="chart-card w-full">
            <div className="hidden md:grid gap-3 items-center" style={{ gridTemplateColumns: "auto auto auto minmax(0,1fr) auto" }}>
              <Skeleton className="w-16 h-12 bg-[var(--muted)]" />
              <Skeleton className="w-24 h-24 bg-[var(--muted)]" />
              <Skeleton className="w-8 h-8 bg-[var(--muted)]" />
              <div className="flex flex-col gap-2 flex-1">
                <Skeleton className="h-5 w-3/4 bg-[var(--muted)]" />
                <Skeleton className="h-4 w-1/2 bg-[var(--muted)]" />
              </div>
              <div className="flex gap-4">
                <div className="flex flex-col items-end gap-1">
                  <Skeleton className="h-3 w-16 bg-[var(--muted)]" />
                  <Skeleton className="h-3 w-16 bg-[var(--muted)]" />
                  <Skeleton className="h-3 w-16 bg-[var(--muted)]" />
                </div>
              </div>
            </div>
            <div className="md:hidden flex flex-col gap-2">
              <div className="flex items-start gap-2">
                <Skeleton className="w-10 h-10 bg-[var(--muted)]" />
                <Skeleton className="w-14 h-14 bg-[var(--muted)]" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4 bg-[var(--muted)]" />
                  <Skeleton className="h-3 w-1/2 bg-[var(--muted)]" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export const Route = createFileRoute("/chart/$chartId/$date")({
  loader: async ({ params }) => {
    if (!weeklyChartIds.includes(params.chartId)) throw notFound();
    const useHistoricalOnly =
      ["songs", "artists", "albums"].includes(params.chartId) &&
      params.date < "2017-06-24";

    const data = useHistoricalOnly
      ? await getHistoricalWeeklyChart({ data: { chartId: params.chartId } })
      : await getWeeklyChart({ data: { chartId: params.chartId } });

    // Let the last historical week navigate into the first primary-sheet week
    // without forcing historical pages to download the large 2017+ CSV.
    if (useHistoricalOnly && !data.dates.includes("2017-06-24")) {
      data.dates = [...data.dates, "2017-06-24"].sort();
    }
    // normalize incoming date to the Saturday of that week (charts publish on Saturdays)
    function toSaturdayIso(dStr: string) {
      try {
        const d = new Date(dStr + "T00:00:00");
        const diff = 6 - d.getDay();
        const sat = new Date(d);
        sat.setDate(d.getDate() + diff);
        return sat.toISOString().slice(0, 10);
      } catch { return dStr; }
    }
    const normalized = toSaturdayIso(params.date);
    const targetDate = data.entriesByDate[params.date] ? params.date : data.entriesByDate[normalized] ? normalized : null;
    if (!targetDate) throw notFound();

    // Trim SSR payload: keep dates array for navigation but only ±1 year of entries
    const targetYear = new Date(targetDate + "T00:00:00").getFullYear();
    const trimmedEntries: Record<string, any[]> = {};
    for (const d of data.dates) {
      const dYear = new Date(d + "T00:00:00").getFullYear();
      if (Math.abs(dYear - targetYear) <= 1 && data.entriesByDate[d]) {
        trimmedEntries[d] = data.entriesByDate[d];
      }
    }
    const trimmedData = { ...data, entriesByDate: trimmedEntries };

    if (targetDate === params.date) {
      return { data: trimmedData, date: params.date, chartId: params.chartId };
    }
    return { data: trimmedData, date: normalized, chartId: params.chartId, originalRequestedDate: params.date };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Chart not found | daegon charts" }] };
    const cfg = chartsConfig[loaderData.chartId];
    const label = new Date(loaderData.date + "T00:00:00").toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    const title = `${cfg.title} — ${label} | daegon charts`;
    const desc = `${cfg.title} chart for the week of ${label}.`;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
      ],
    };
  },
  notFoundComponent: () => (
    <div className="text-center py-16">
      <h2 className="text-2xl font-bold gold">Chart week not found</h2>
      <p className="text-muted-foreground mt-2">That chart or date has no data.</p>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="text-center py-16">
      <h2 className="text-xl font-bold gold">Something broke</h2>
      <p className="text-muted-foreground mt-2 text-sm">{error.message}</p>
    </div>
  ),
  pendingComponent: ChartPageSkeleton,
  component: WeeklyChartPage,
});

function WeeklyChartPage() {
  const loader = Route.useLoaderData() as any;
  const { data, date, chartId, originalRequestedDate } = loader;
  const cfg = chartsConfig[chartId];
  const [filters, setFilters] = useState<Set<string>>(new Set(["all"]));
  const [diffColors, setDiffColors] = useState(false);

  const toggleFilter = (key: string) => {
    setFilters((prev) => {
      const next = new Set(prev);
      if (key === "all") {
        return new Set(["all"]);
      }
      next.delete("all");
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      if (next.size === 0) next.add("all");
      return next;
    });
  };
  // if loader normalized the date, replace the URL so it always shows the Saturday
  useEffect(() => {
    if (originalRequestedDate && originalRequestedDate !== date) {
      // client-side replace
      try {
        const nav = (window as any).history;
        const newPath = window.location.pathname.replace(originalRequestedDate, date);
        nav.replaceState(nav.state, nav.title, newPath + window.location.search);
      } catch { /* ignore */ }
    }
  }, [originalRequestedDate, date]);
  const entries = data.entriesByDate[date];
  const currentIndex = data.dates.indexOf(date);
  const previousDate = currentIndex > 0 ? data.dates[currentIndex - 1] : null;
  const dropouts = previousDate
    ? (data.entriesByDate[previousDate] || []).filter((prevEntry: any) =>
        !entries.some((curr: any) => curr.name === prevEntry.name && curr.artist === prevEntry.artist)
      )
    : [];
  const dateLabel = new Date(date + "T00:00:00").toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

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

  const filteredEntries = entries.filter((e: typeof entries[number]) => {
    if (filters.has("all")) return true;
    const matches: string[] = [];
    if (e.diff === "NEW") matches.push("debut");
    if (e.diff === "RE") matches.push("re");
    if (e.diff.startsWith("▲")) matches.push("rising");
    if (e.diff.startsWith("▼")) matches.push("falling");
    if (e.diff === "=" || e.diff === "" || e.diff === "-") matches.push("static");
    return matches.some((m) => filters.has(m));
  });

  return (
    <div className="dc-weekly-current max-w-7xl mx-auto w-full grid gap-6 lg:grid-cols-[280px_1fr]">
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <ChartTypeNav activeId={chartId} date={date} />
      </aside>
      <main>
        <div className="mb-2 text-center md:text-left">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-2xl md:text-4xl font-extrabold text-[var(--foreground)] inline-flex items-center gap-2 justify-center md:justify-start uppercase">
                {cfg.title}
              </h1>
              <p className="text-xs md:text-sm text-muted-foreground mt-1">Chart week of {dateLabel}</p>
            </div>
            <div className="flex justify-center md:justify-end">
              <ChartImage
                entries={entries}
                chartTitle={cfg.title}
                chartId={chartId}
                date={date}
                kind={cfg.kind}
              />
            </div>
          </div>
        </div>
        <WeekNavigator chartId={chartId} dates={data.dates} currentDate={date} />
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
            filteredEntries.map((e: typeof entries[number]) => (
              <ChartRow
                key={`${e.position}-${e.name}-${e.artist}`}
                entry={e}
                kind={cfg.kind}
                chartId={chartId}
                date={date}
                chartDates={data.dates}
                chartEntriesByDate={data.entriesByDate}
                diffColors={diffColors}
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
              {dropouts.map((out: any) => (
                <DropoutChip key={`${out.name}-${out.artist}`} dropout={out} chartKind={cfg.kind} />
              ))}
            </div>
          </div>
        )}
        <div className="mt-8">
          <WeekNavigator chartId={chartId} dates={data.dates} currentDate={date} />
        </div>
      </main>
    </div>
  );
}

function DropoutChip({ dropout, chartKind }: { dropout: any; chartKind: string }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const query = chartKind === "album"
    ? `album:"${dropout.name}" artist:"${dropout.artist}"`
    : chartKind === "song"
    ? `artist:"${dropout.artist}" track:"${dropout.name}"`
    : `artist:"${dropout.artist}"`;
  const type = chartKind === "album" ? "album" : chartKind === "song" ? "track" : "artist";

  useEffect(() => {
    let active = true;
    getSpotifyImage({ data: { query, type } }).then((url) => {
      if (active && url) setImageUrl(url);
    });
    return () => {
      active = false;
    };
  }, [query, type]);

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
          <i className={`fas ${chartKind === "album" ? "fa-compact-disc" : chartKind === "song" ? "fa-music" : "fa-user"} text-xl text-[var(--muted-foreground)] animate-pulse`} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-[var(--foreground)] break-words">{dropout.name}</div>
        {chartKind !== "artist" && <div className="text-[11px] text-[var(--muted-foreground)] break-words">{dropout.artist}</div>}
        <div className="mt-1 text-[10px] text-[var(--muted-foreground)] flex flex-wrap gap-x-2">
          <span>LW: <span className="font-semibold">#{dropout.position}</span></span>
          {dropout.peak && <span>Peak: <span className="font-semibold">#{dropout.peak}</span></span>}
          {dropout.weeks && <span>Weeks: <span className="font-semibold">{dropout.weeks}</span></span>}
        </div>
      </div>
    </Link>
  );
}
