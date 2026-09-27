import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useAwardsData } from "./awards";
import { SpotifyItemImage } from "@/components/spotify-item-image";

export const Route = createFileRoute("/awards/stats")({
  component: AwardsStats,
  head: () => ({
    meta: [{ title: "Stats — Daegon Awards" }],
  }),
});

function AwardsStats() {
  const { allArtists, loaded } = useAwardsData();

  const stats = useMemo(() => {
    if (allArtists.length === 0) return null;
    const mostWins = [...allArtists].sort((a, b) => b.wins - a.wins).slice(0, 10);
    const mostNoms = [...allArtists].sort((a, b) => b.nominations - a.nominations).slice(0, 10);
    return {
      mostWins,
      mostNoms,
      totalArtists: allArtists.length,
      totalNoms: allArtists.reduce((s, a) => s + a.nominations, 0),
      totalWins: allArtists.reduce((s, a) => s + a.wins, 0),
    };
  }, [allArtists]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6 pb-4 border-b-2 border-[var(--accent)] flex-wrap gap-3">
        <h2 className="text-2xl font-bold text-[var(--foreground)]" style={{ fontFamily: "Times New Roman, serif" }}>Award Statistics</h2>
        <Link to="/awards" className="flex items-center gap-2 bg-[var(--accent)] text-black px-4 py-2 rounded-md font-semibold text-sm hover:opacity-90 transition-colors">
          <i className="fas fa-arrow-left" /> Back to Home
        </Link>
      </div>
      {!loaded || !stats ? (
        <div className="flex flex-col items-center py-16">
          <div className="w-12 h-12 border-4 border-[var(--accent)]/20 border-t-[var(--accent)] rounded-full animate-spin mb-4" />
          <span className="text-muted-foreground text-sm">Loading...</span>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div className="bg-[var(--card)] p-6 rounded-lg border-t-4 border-[var(--accent)] border border-[var(--border)] shadow text-center">
              <div className="text-4xl font-bold text-[var(--accent)] mb-2">{stats.totalArtists}</div>
              <div className="text-sm text-muted-foreground font-semibold">Total Artists</div>
            </div>
            <div className="bg-[var(--card)] p-6 rounded-lg border-t-4 border-[var(--accent)] border border-[var(--border)] shadow text-center">
              <div className="text-4xl font-bold text-[var(--accent)] mb-2">{stats.totalWins}</div>
              <div className="text-sm text-muted-foreground font-semibold">Total Wins</div>
            </div>
            <div className="bg-[var(--card)] p-6 rounded-lg border-t-4 border-[var(--accent)] border border-[var(--border)] shadow text-center">
              <div className="text-4xl font-bold text-[var(--accent)] mb-2">{stats.totalNoms}</div>
              <div className="text-sm text-muted-foreground font-semibold">Total Nominations</div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-[var(--card)] rounded-lg p-5 border border-[var(--border)]">
              <h3 className="text-lg font-semibold text-[var(--foreground)] mb-4 flex items-center gap-2"><i className="fas fa-trophy text-[var(--accent)]" /> Most Wins</h3>
              {stats.mostWins.map((a, i) => (
                <Link
                  key={a.name}
                  to="/artist/$slug"
                  params={{ slug: a.name.toLowerCase().replace(/\s+/g, "-") }}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-[var(--muted)] transition-colors mb-2"
                >
                  <span className="font-bold text-[var(--accent)] text-lg w-6 text-center">{i + 1}</span>
                  <div className="w-10 h-10 flex-shrink-0 border-2 border-[var(--accent)]" style={{ borderRadius: "50%", overflow: "hidden" }}>
                    <SpotifyItemImage name={a.name} artist={a.name} kind="artist" size={40} rounded="full" className="w-full h-full" />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-[var(--foreground)] text-sm">{a.name}</div>
                    <div className="text-xs text-[var(--accent)] font-bold">{a.wins} wins · {a.nominations} noms</div>
                  </div>
                </Link>
              ))}
            </div>
            <div className="bg-[var(--card)] rounded-lg p-5 border border-[var(--border)]">
              <h3 className="text-lg font-semibold text-[var(--foreground)] mb-4 flex items-center gap-2"><i className="fas fa-list text-[var(--accent)]" /> Most Nominations</h3>
              {stats.mostNoms.map((a, i) => (
                <Link
                  key={a.name}
                  to="/artist/$slug"
                  params={{ slug: a.name.toLowerCase().replace(/\s+/g, "-") }}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-[var(--muted)] transition-colors mb-2"
                >
                  <span className="font-bold text-[var(--accent)] text-lg w-6 text-center">{i + 1}</span>
                  <div className="w-10 h-10 flex-shrink-0 border-2 border-[var(--accent)]" style={{ borderRadius: "50%", overflow: "hidden" }}>
                    <SpotifyItemImage name={a.name} artist={a.name} kind="artist" size={40} rounded="full" className="w-full h-full" />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-[var(--foreground)] text-sm">{a.name}</div>
                    <div className="text-xs text-[var(--accent)] font-bold">{a.nominations} noms · {a.wins} wins</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
