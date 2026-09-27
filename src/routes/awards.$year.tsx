import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { fetchAwardEdition, type AwardEditionData } from "@/lib/awards.functions";
import { SpotifyItemImage } from "@/components/spotify-item-image";
import { useAwardsData } from "./awards";

export const Route = createFileRoute("/awards/$year")({
  component: AwardsEdition,
  head: ({ params }) => ({
    meta: [{ title: `Daegon Awards ${params.year} — daegon charts` }],
  }),
});

const NO_FEAT_CATEGORIES = ["Artist of the Year", "Best New Artist"];

function AwardsEdition() {
  const { year } = Route.useParams();
  const { allArtists } = useAwardsData();
  const [data, setData] = useState<AwardEditionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  useEffect(() => {
    setLoading(true);
    fetchAwardEdition(Number(year))
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [year]);

  const toggle = (key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6 pb-4 border-b-2 border-[var(--accent)] flex-wrap gap-3">
        <h2 className="text-2xl font-bold text-[var(--foreground)]" style={{ fontFamily: "Times New Roman, serif" }}>Daegon Awards {year}</h2>
        <Link to="/awards" className="flex items-center gap-2 bg-[var(--accent)] text-black px-4 py-2 rounded-md font-semibold text-sm hover:opacity-90 transition-colors">
          <i className="fas fa-arrow-left" /> Back to Home
        </Link>
      </div>
      {loading ? (
        <div className="flex flex-col items-center py-16">
          <div className="w-12 h-12 border-4 border-[var(--accent)]/20 border-t-[var(--accent)] rounded-full animate-spin mb-4" />
          <span className="text-muted-foreground text-sm">Loading...</span>
        </div>
      ) : data ? (
        <div className="space-y-4">
          {(data.order.length > 0 ? data.order : Object.keys(data.categories).sort()).map((catName) => {
            const nominees = data.categories[catName] || [];
            if (nominees.length === 0) return null;
            const sorted = [...nominees].sort((a, b) => {
              if (a.status === "Winner" && b.status !== "Winner") return -1;
              if (a.status !== "Winner" && b.status === "Winner") return 1;
              return a.artist.localeCompare(b.artist);
            });
            const isCollapsed = collapsed.has(catName);
            return (
              <div key={catName} className="rounded-lg overflow-hidden border border-[var(--border)] bg-[var(--card)]">
                <button
                  onClick={() => toggle(catName)}
                  className="w-full bg-[var(--accent)] text-black px-5 py-3 flex items-center justify-between cursor-pointer hover:opacity-90 transition-colors"
                >
                  <span className="text-lg font-semibold" style={{ fontFamily: "Times New Roman, serif" }}>{catName}</span>
                  <span className="text-xl">{isCollapsed ? "+" : "\u2212"}</span>
                </button>
                {!isCollapsed && (
                  <div className="p-3">
                    {sorted.map((n, i) => {
                      const isWinner = n.status === "Winner";
                      const showFeat = n.feature && !NO_FEAT_CATEGORIES.includes(catName);
                      return (
                        <div key={i} className={`flex items-center gap-4 py-3 px-3 border-b border-[var(--border)] last:border-0 transition-colors hover:bg-[var(--muted)]/50 ${isWinner ? "bg-[var(--accent)]/5 border-l-4 border-l-[var(--accent)]" : ""}`}>
                          <div className="w-12 h-12 flex-shrink-0 border-2 border-[var(--accent)] overflow-hidden" style={{ borderRadius: "50%" }}>
                            <SpotifyItemImage name={n.artist} artist={n.artist} kind="artist" size={48} rounded="full" className="w-full h-full" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <Link to="/artist/$slug" params={{ slug: n.artist.toLowerCase().replace(/\s+/g, "-") }} className="font-semibold text-[var(--foreground)] hover:text-[var(--accent)] transition-colors">
                              {n.artist || "Unknown"}
                            </Link>
                            {n.item && <div className="text-sm text-muted-foreground mt-0.5">{n.item}</div>}
                            {showFeat && (
                              <div className="text-xs text-muted-foreground italic mt-0.5">
                                feat.{" "}
                                {n.feature.split(",").map((f, fi) => (
                                  <span key={fi}>
                                    <Link to="/artist/$slug" params={{ slug: f.trim().toLowerCase().replace(/\s+/g, "-") }} className="text-[var(--accent)] hover:underline">{f.trim()}</Link>
                                    {fi < n.feature.split(",").length - 1 ? ", " : ""}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${isWinner ? "bg-[var(--accent)] text-black" : "bg-[var(--muted)] text-muted-foreground"}`}>
                            {isWinner ? "Winner" : "Nominated"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16 text-muted-foreground">No data available for {year}.</div>
      )}
    </div>
  );
}
