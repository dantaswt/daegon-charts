import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { getChartBeat, getWeeklyChart, type ChartBeatPost } from "@/lib/charts.functions";
import { chartBeatConfig } from "@/lib/charts-config";
import { getSpotifyImage } from "@/lib/spotify.functions";
import { useEffect, useMemo, useState } from "react";

const blogs = Object.keys(chartBeatConfig) as (keyof typeof chartBeatConfig)[];
const chartForBlog: Record<keyof typeof chartBeatConfig, string> = { hot100: "songs", artists: "artists", top100Albums: "albums" };

function dateValue(value: string) {
  const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1])).getTime();
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

function nearestChartDate(value: string, dates: string[]) {
  const target = dateValue(value);
  if (target === null || !dates.length) return dates[dates.length - 1] ?? null;
  return dates.reduce((closest, date) => Math.abs(new Date(`${date}T00:00:00`).getTime() - target) < Math.abs(new Date(`${closest}T00:00:00`).getTime() - target) ? date : closest);
}

export const Route = createFileRoute("/chart-beat/$blog")({
  loader: async ({ params }) => {
    if (!(blogs as string[]).includes(params.blog)) throw notFound();
    const blog = params.blog as keyof typeof chartBeatConfig;
    const chartId = chartForBlog[blog];
    const [data, chart] = await Promise.all([getChartBeat({ data: { blog } }), getWeeklyChart({ data: { chartId } })]);
    return {
      blog,
      chartId,
      data: {
        ...data,
        posts: data.posts.map((post) => ({ ...post, relatedDate: nearestChartDate(post.publicationDate, chart.dates) })),
      },
    };
  },
  head: ({ loaderData }) => ({ meta: [{ title: `${loaderData?.data.title ?? "Chart Beat"} — Chart Beat | daegon charts` }, { name: "description", content: "News and commentary connected to the weekly charts." }] }),
  notFoundComponent: () => <div className="text-center py-16 gold font-bold">Not found</div>,
  component: ChartBeatPage,
});

type ArticlePost = ChartBeatPost & { relatedDate: string | null };

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function ArticleText({ text }: { text: string }) {
  const numberPattern = "#?\\d+(?:[.,]\\d+)?(?:[KMBkmb])?";
  const matcher = new RegExp(`(${numberPattern})`, "gi");
  return <div className="whitespace-pre-wrap leading-relaxed text-sm md:text-base text-justify">{text.split(matcher).map((part, index) => {
    if (/^#?\d+(?:[.,]\d+)?(?:[KMBkmb])?$/.test(part)) return <em key={index}>{part}</em>;
    return part;
  })}</div>;
}

function ArticleImage({ post }: { post: ArticlePost }) {
  const [imageUrl, setImageUrl] = useState<string | null>(post.image ?? null);
  useEffect(() => {
    if (post.image || !post.artist) return;
    let active = true;
    getSpotifyImage({ data: { query: `artist:"${post.artist}"`, type: "artist" } }).then((url) => { if (active) setImageUrl(url ?? null); });
    return () => { active = false; };
  }, [post.artist, post.image]);
  return imageUrl ? <img src={imageUrl} alt="" className="w-full h-52 md:h-72 object-cover rounded-xl border border-[var(--border)] mb-5 animate-fade-in" /> : null;
}

function ChartBeatPage() {
  const { data, blog, chartId } = Route.useLoaderData();
  const posts = data.posts as ArticlePost[];
  const [expandedYears, setExpandedYears] = useState<Set<string>>(new Set());

  const yearsData = useMemo(() => {
    const yearMap = new Map<string, Map<string, ArticlePost[]>>();
    posts.forEach((post) => {
      const timestamp = dateValue(post.publicationDate);
      const date = timestamp ? new Date(timestamp) : null;
      const year = date ? String(date.getFullYear()) : "Other";
      const month = date ? date.toLocaleDateString("en-US", { month: "long" }) : "Other";
      if (!yearMap.has(year)) yearMap.set(year, new Map());
      const months = yearMap.get(year)!;
      if (!months.has(month)) months.set(month, []);
      months.get(month)!.push(post);
    });
    return [...yearMap.entries()].sort((a, b) => Number(b[0]) - Number(a[0]));
  }, [posts]);

  const toggleYear = (year: string) => {
    setExpandedYears((prev) => {
      const next = new Set(prev);
      if (next.has(year)) next.delete(year);
      else next.add(year);
      return next;
    });
  };

  const selectMonth = (year: string, month: string) => {
    const key = `${year}|${month}`;
    setExpandedYears(new Set([year]));
    const el = document.getElementById(`month-${key}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-16">
      <div className="relative text-center py-10 md:py-14 mb-8 overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
          <span className="text-[6rem] md:text-[10rem] font-black text-[var(--foreground)] opacity-[0.06] font-sans uppercase tracking-tighter leading-none">BEAT</span>
        </div>
        <h1 className="text-4xl sm:text-5xl md:text-7xl font-black gold tracking-tight relative z-10 uppercase">Chart Beat</h1>
        <p className="text-muted-foreground text-sm md:text-base mt-3 relative z-10">Stories, analysis and insights from the charts</p>
      </div>
      <div className="flex gap-2 mb-8 flex-wrap">{blogs.map((item) => <Link key={item} to="/chart-beat/$blog" params={{ blog: item }} className={`btn-nav ${item === blog ? "active" : ""}`}>{chartBeatConfig[item].title}</Link>)}</div>
      <div className="grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-24 lg:self-start sidebar-section max-h-[calc(100vh-8rem)] overflow-y-auto">
          <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Archive</div>
          <button onClick={() => setExpandedYears(new Set())} className={`block w-full text-left px-2 py-1.5 rounded text-sm ${expandedYears.size === 0 ? "text-[var(--accent)] font-bold bg-[rgba(255,109,0,0.1)]" : "hover:text-[var(--accent)]"}`}>All articles</button>
          {yearsData.map(([year, months]) => (
            <div key={year}>
              <button onClick={() => toggleYear(year)} className="flex items-center justify-between w-full text-left px-2 py-1.5 rounded text-sm hover:text-[var(--accent)]">
                <span className="font-semibold">{year}</span>
                <i className={`fas fa-chevron-${expandedYears.has(year) ? "up" : "down"} text-[10px] text-[var(--muted-foreground)]`} />
              </button>
              {expandedYears.has(year) && (
                <div className="ml-2">
                  {[...months.entries()].map(([month, monthPosts]) => (
                    <button key={month} onClick={() => selectMonth(year, month)} className="block w-full text-left px-2 py-1 rounded text-xs hover:text-[var(--accent)]">
                      {month} <span className="text-muted-foreground">({monthPosts.length})</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </aside>

        <main className="space-y-6">
          {posts.length === 0 && <p className="text-muted-foreground">No posts yet.</p>}
          {posts.map((post) => {
            const timestamp = dateValue(post.publicationDate);
            const date = timestamp ? new Date(timestamp) : null;
            const monthKey = date ? `${date.getFullYear()}|${date.toLocaleDateString("en-US", { month: "long" })}` : "Other|Other";
            return (
              <article key={post.slug} id={`month-${monthKey}`} className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 md:p-7 shadow-sm">
                <ArticleImage post={post} />
                <div className="text-xs text-muted-foreground mb-2">{post.publicationDate}</div>
                <h2 className="text-xl md:text-2xl font-extrabold gold mb-3">{post.title}</h2>
                {post.artist && <div className="inline-flex items-center gap-1 mb-5 text-sm font-bold text-[var(--accent)]"><i className="fas fa-user" /> {post.artist}</div>}
                <ArticleText text={post.fullText} />
                {post.relatedDate && <Link to="/chart/$chartId/$date" params={{ chartId, date: post.relatedDate }} className="inline-flex items-center gap-2 mt-7 text-sm font-semibold text-[var(--accent)] hover:underline"><i className="fas fa-chart-bar" /> View the related weekly chart</Link>}
              </article>
            );
          })}
        </main>
      </div>
    </div>
  );
}
