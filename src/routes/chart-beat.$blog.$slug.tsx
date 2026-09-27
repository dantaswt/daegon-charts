import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { getAllArtistStats, getChartBeat, getWeeklyChart } from "@/lib/charts.functions";
import { chartBeatConfig, slugifyArtist } from "@/lib/charts-config";

const chartForBlog: Record<keyof typeof chartBeatConfig, string> = { hot100: "songs", artists: "artists", top100Albums: "albums" };
function escapeRegex(value: string) { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function timestamp(value: string) { const m = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); const d = m ? new Date(+m[3], +m[2] - 1, +m[1]) : new Date(value); return d.getTime(); }

export const Route = createFileRoute("/chart-beat/$blog/$slug")({
  loader: async ({ params }) => {
    if (!(params.blog in chartForBlog)) throw notFound();
    const blog = params.blog as keyof typeof chartBeatConfig;
    const [beat, stats, chart] = await Promise.all([getChartBeat({ data: { blog } }), getAllArtistStats(), getWeeklyChart({ data: { chartId: chartForBlog[blog] } })]);
    const post = beat.posts.find((item) => item.slug === params.slug);
    if (!post) throw notFound();
    const target = timestamp(post.publicationDate);
    const date = chart.dates.reduce((best, item) => Math.abs(new Date(`${item}T00:00:00`).getTime() - target) < Math.abs(new Date(`${best}T00:00:00`).getTime() - target) ? item : best, chart.dates[chart.dates.length - 1]);
    return { post, blog, chartId: chartForBlog[blog], date, artists: Object.values(stats).map((artist) => artist.name) };
  },
  head: ({ loaderData }) => ({ meta: [{ title: `${loaderData?.post.title ?? "Chart Beat"} | daegon charts` }, { name: "description", content: loaderData?.post.fullText.slice(0, 160) ?? "Chart Beat article" }, ...(loaderData?.post.image ? [{ property: "og:image", content: loaderData.post.image }, { name: "twitter:card", content: "summary_large_image" }] : [])] }),
  component: ArticlePage,
});

function RichText({ text, artists }: { text: string; artists: string[] }) {
  const found = artists.filter((artist) => new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegex(artist)}(?![\\p{L}\\p{N}])`, "iu").test(text)).sort((a, b) => b.length - a.length);
  const pattern = [...found.map((artist) => `(?<![\\p{L}\\p{N}])${escapeRegex(artist)}(?![\\p{L}\\p{N}])`), "#?\\d+(?:[.,]\\d+)?(?:[KMBkmb])?"].join("|");
  const matcher = new RegExp(`(${pattern})`, "giu"); const map = new Map(found.map((artist) => [artist.toLocaleLowerCase(), artist]));
  return <div className="whitespace-pre-wrap leading-relaxed text-sm md:text-base">{text.split(matcher).map((part, index) => { const artist = map.get(part.toLocaleLowerCase()); if (artist) return <Link key={index} to="/artist/$slug" params={{ slug: slugifyArtist(artist) }} className="font-bold text-[var(--accent)] hover:underline">{part}</Link>; return /^#?\d+(?:[.,]\d+)?(?:[KMBkmb])?$/.test(part) ? <em key={index}>{part}</em> : part; })}</div>;
}
function ArticlePage() { const { post, blog, chartId, date, artists } = Route.useLoaderData(); return <article className="max-w-3xl mx-auto px-4 sm:px-6 pb-16 animate-fade-in"><Link to="/chart-beat/$blog" params={{ blog }} className="text-sm text-muted-foreground hover:text-[var(--accent)]">← Chart Beat</Link>{post.image && <img src={post.image} alt="" className="mt-6 w-full max-h-[430px] object-cover rounded-xl border border-[var(--border)]" />}<div className="mt-6 text-xs text-muted-foreground">{post.publicationDate}</div><h1 className="mt-2 text-3xl md:text-5xl font-black gold">{post.title}</h1>{post.artist && <Link to="/artist/$slug" params={{ slug: slugifyArtist(post.artist) }} className="mt-4 inline-block font-bold text-[var(--accent)] hover:underline">{post.artist}</Link>}<div className="mt-7"><RichText text={post.fullText} artists={artists} /></div><Link to="/chart/$chartId/$date" params={{ chartId, date }} className="btn-gold mt-8"><i className="fas fa-chart-bar" /> View related weekly chart</Link></article>; }
