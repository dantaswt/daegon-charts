import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { getWeeklyChart } from "@/lib/charts.functions";
import { generateChartBeat2 } from "@/lib/chart-beat-generator";
import { ChartBeatArticle } from "@/components/chart-beat-article";
import { chartsConfig } from "@/lib/charts-config";
import { useState, useEffect } from "react";

const beatCharts = ["songs", "albums", "artists"] as const;

export const Route = createFileRoute("/chart-beat-2/$chartId/$date")({
  loader: async ({ params }) => {
    if (!beatCharts.includes(params.chartId as any)) throw notFound();
    const chartId = params.chartId;
    const data = await getWeeklyChart({ data: { chartId } });
    if (!data.dates.includes(params.date)) {
      const closest = data.dates.reduce((c, d) =>
        Math.abs(new Date(d + "T00:00:00").getTime() - new Date(params.date + "T00:00:00").getTime()) <
        Math.abs(new Date(c + "T00:00:00").getTime() - new Date(params.date + "T00:00:00").getTime()) ? d : c
      );
      if (!closest) throw notFound();
      return { chartId, date: closest, dates: data.dates };
    }
    return { chartId, date: params.date, dates: data.dates };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Chart Beat | daegon charts" }] };
    const cfg = chartsConfig[loaderData.chartId];
    return {
      meta: [
        { title: `Chart Beat — ${cfg.title} | daegon charts` },
        { name: "description", content: `Auto-generated chart analysis for ${cfg.title}.` },
      ],
    };
  },
  notFoundComponent: () => (
    <div className="text-center py-16">
      <h2 className="text-2xl font-bold gold">Chart not found</h2>
      <p className="text-muted-foreground mt-2">That chart or date has no data.</p>
    </div>
  ),
  component: ChartBeat2Page,
});

function formatDateShort(d: string) {
  try {
    return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return d;
  }
}

function ChartBeat2Page() {
  const loaderData = Route.useLoaderData() as any;
  const { chartId, date, dates } = loaderData;
  const cfg = chartsConfig[chartId];

  return (
    <div className="max-w-7xl mx-auto w-full grid gap-6 lg:grid-cols-[280px_1fr]">
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="mb-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-3">Chart Beat</h2>
          <div className="flex flex-col gap-1">
            {beatCharts.map((id) => (
              <Link
                key={id}
                to="/chart-beat-2/$chartId/$date"
                params={{ chartId: id, date: dates[dates.length - 1] }}
                className={`btn-nav text-left ${id === chartId ? "active" : ""}`}
              >
                <i className={`fas ${chartsConfig[id].icon} mr-2`} />
                {chartsConfig[id].title}
              </Link>
            ))}
          </div>
        </div>
        <div>
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Weeks</h3>
          <div className="max-h-[50vh] overflow-y-auto space-y-0.5 pr-1">
            {[...dates].reverse().map((d: string) => (
              <Link
                key={d}
                to="/chart-beat-2/$chartId/$date"
                params={{ chartId, date: d }}
                className={`block px-2 py-1.5 rounded text-xs transition ${d === date ? "bg-[var(--accent)] text-black font-bold" : "text-muted-foreground hover:text-[var(--accent)] hover:bg-[rgba(255,255,255,0.03)]"}`}
              >
                {formatDateShort(d)}
              </Link>
            ))}
          </div>
        </div>
      </aside>
      <main>
        <div className="mb-4 text-center md:text-left">
          <h1 className="text-2xl md:text-4xl font-extrabold text-[var(--foreground)] inline-flex items-center gap-2 justify-center md:justify-start uppercase">
            Chart Beat
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-1">
            Auto-generated analysis for {cfg.title} — week of {formatDateShort(date)}
          </p>
        </div>
        <div className="flex gap-2 mb-4 flex-wrap justify-center md:justify-start">
          <Link to="/chart/$chartId/$date" params={{ chartId, date }} className="btn-nav text-xs">
            <i className="fas fa-chart-bar mr-1" /> View Raw Chart
          </Link>
        </div>
        <ChartBeat2Article chartId={chartId} date={date} />
      </main>
    </div>
  );
}

function ChartBeat2Article({ chartId, date }: { chartId: string; date: string }) {
  const [article, setArticle] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    generateChartBeat2({ data: { chartId, date } }).then((data) => {
      if (active) {
        setArticle(data);
        setLoading(false);
      }
    }).catch(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [chartId, date]);

  if (loading) {
    return (
      <div className="text-center py-16">
        <i className="fas fa-spinner fa-spin text-2xl text-[var(--accent)]" />
        <p className="text-muted-foreground mt-3 text-sm">Generating article...</p>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">No data available for this week.</p>
      </div>
    );
  }

  return <ChartBeatArticle article={article} />;
}
