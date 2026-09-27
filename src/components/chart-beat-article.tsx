import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { getSpotifyImage } from "@/lib/spotify.functions";
import type { GeneratedBeatArticle } from "@/lib/chart-beat-generator";

function ArticleImage({ artist }: { artist: string | null }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!artist) return;
    let active = true;
    getSpotifyImage({ data: { query: `artist:"${artist}"`, type: "artist" } }).then((url) => {
      if (active) setImageUrl(url ?? null);
    });
    return () => { active = false; };
  }, [artist]);
  if (!imageUrl) return null;
  return <img src={imageUrl} alt="" loading="lazy" decoding="async" className="w-full h-52 md:h-72 object-cover rounded-xl border border-[var(--border)] mb-5" />;
}

function highlightText(text: string, artistName?: string | null) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

export function ChartBeatArticle({ article }: { article: GeneratedBeatArticle }) {
  const dateLabel = new Date(article.date + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const isArtistChart = article.chartId === "artists";

  return (
    <article className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 md:p-7 shadow-sm">
      {!isArtistChart && <ArticleImage artist={article.artist} />}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs font-bold uppercase tracking-wider text-[var(--accent)]">Chart Beat</span>
        <span className="text-xs text-muted-foreground">{dateLabel}</span>
      </div>
      <h1 className="text-2xl md:text-3xl font-extrabold text-[var(--foreground)] leading-tight mb-3">
        {article.headline}
      </h1>
      {article.subtitle && (
        <p className="text-base md:text-lg text-muted-foreground italic mb-6">
          {article.subtitle}
        </p>
      )}
      {article.artist && !isArtistChart && (
        <div className="inline-flex items-center gap-1 mb-5 text-sm font-bold text-[var(--accent)]">
          <i className="fas fa-user" />
          <Link to="/artist/$slug" params={{ slug: article.artist.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") }} className="hover:underline">
            {article.artist}
          </Link>
        </div>
      )}
      <div className="space-y-4">
        {article.sections.map((section, i) => (
          <div key={i}>
            {section.heading && (
              <h2 className="text-lg font-bold text-[var(--foreground)] mb-2 mt-4">{section.heading}</h2>
            )}
            {section.paragraphs.map((p, j) => (
              <p key={j} className="whitespace-pre-wrap leading-relaxed text-sm md:text-base text-justify mb-3">
                {highlightText(p)}
              </p>
            ))}
          </div>
        ))}
      </div>
      <div className="mt-5">
        <Link
          to="/chart/$chartId/$date"
          params={{ chartId: article.chartId, date: article.date }}
          className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent)] hover:underline"
        >
          <i className="fas fa-chart-bar" /> View the related weekly chart
        </Link>
      </div>
    </article>
  );
}
