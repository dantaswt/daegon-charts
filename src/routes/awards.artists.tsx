import { createFileRoute, Link } from "@tanstack/react-router";
import { useAwardsData } from "./awards";
import { SpotifyItemImage } from "@/components/spotify-item-image";

export const Route = createFileRoute("/awards/artists")({
  component: AwardsArtists,
  head: () => ({
    meta: [{ title: "Artists — Daegon Awards" }],
  }),
});

function AwardsArtists() {
  const { allArtists, loaded } = useAwardsData();

  return (
    <div>
      <div className="flex items-center justify-between mb-6 pb-4 border-b-2 border-[var(--accent)] flex-wrap gap-3">
        <h2 className="text-2xl font-bold text-[var(--foreground)]" style={{ fontFamily: "Times New Roman, serif" }}>All Artists</h2>
        <Link to="/awards" className="flex items-center gap-2 bg-[var(--accent)] text-black px-4 py-2 rounded-md font-semibold text-sm hover:opacity-90 transition-colors">
          <i className="fas fa-arrow-left" /> Back to Home
        </Link>
      </div>
      {!loaded ? (
        <div className="flex flex-col items-center py-16">
          <div className="w-12 h-12 border-4 border-[var(--accent)]/20 border-t-[var(--accent)] rounded-full animate-spin mb-4" />
          <span className="text-muted-foreground text-sm">Loading...</span>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {allArtists.map((a) => (
            <Link
              key={a.name}
              to="/artist/$slug"
              params={{ slug: a.name.toLowerCase().replace(/\s+/g, "-") }}
              className="group rounded-lg overflow-hidden border border-[var(--border)] bg-[var(--card)] hover:shadow-lg transition-all text-left"
            >
              <div className="w-full h-40 flex items-center justify-center bg-[var(--muted)]" style={{ overflow: "hidden" }}>
                <SpotifyItemImage name={a.name} artist={a.name} kind="artist" size={128} rounded="full" className="w-32 h-32" />
              </div>
              <div className="p-3">
                <div className="font-semibold text-[var(--foreground)] text-sm truncate group-hover:text-[var(--accent)] transition-colors">{a.name}</div>
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span><span className="font-bold text-[var(--accent)]">{a.wins}</span> wins</span>
                  <span><span className="font-bold text-[var(--accent)]">{a.nominations}</span> noms</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
