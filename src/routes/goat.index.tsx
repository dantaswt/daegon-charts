import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getGoatGenerated } from "@/lib/charts.functions";
import { chartsConfig, goatChartIds, slugifyArtist, songSlug, stripAlbumEdition } from "@/lib/charts-config";
import { SpotifyItemImage } from "@/components/spotify-item-image";
import { stripFeatFromTitle } from "@/components/track-artists";
import { motion } from "framer-motion";

export const Route = createFileRoute("/goat/")({
  head: () => ({ meta: [{ title: "Greatest of All Time | daegon charts" }] }),
  component: GoatIndex,
});

function Top5Preview({ title, chartId, entries, kind }: { title: string; chartId: string; entries: { position: number; name: string; artist: string }[]; kind: "song" | "album" | "artist" }) {
  if (entries.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5 }}
      className="mb-10"
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight text-center w-full">{title}</h2>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 justify-center">
        {entries.map((e, i) => (
          <div key={`${e.position}-${e.name}`} className="flex flex-col min-w-0 shrink-0" style={{ width: i === 0 ? 220 : 140 }}>
            <div className="relative mb-2">
              <SpotifyItemImage
                name={e.name}
                artist={e.artist}
                kind={kind}
                size={i === 0 ? 220 : 140}
                className="w-full"
              />
              <div className="absolute bottom-0 left-0 w-8 h-8 flex items-center justify-center font-black text-sm bg-[var(--accent)] text-black">
                {e.position}
              </div>
            </div>
            <div className="font-bold text-sm leading-tight truncate">
              {kind === "song" ? (
                <Link to="/song/$slug" params={{ slug: songSlug(e.name, e.artist) }} className="hover:text-[var(--accent)] hover:underline">{stripFeatFromTitle(e.name)}</Link>
              ) : kind === "album" ? (
                <Link to="/album/$slug" params={{ slug: slugifyArtist(e.name) }} className="hover:text-[var(--accent)] hover:underline">{stripAlbumEdition(e.name)}</Link>
              ) : (
                <Link to="/artist/$slug" params={{ slug: slugifyArtist(e.name) }} className="hover:text-[var(--accent)] hover:underline">{e.name}</Link>
              )}
            </div>
            {kind !== "artist" && (
              <div className="text-xs text-muted-foreground truncate">
                {e.artist}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="flex justify-center mt-4">
        <Link
          to="/goat/$chartId"
          params={{ chartId }}
          className="text-xs font-bold uppercase tracking-wider border border-[var(--border)] px-3 py-1.5 hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
        >
          View Chart
        </Link>
      </div>
    </motion.div>
  );
}

function ChartGrid({ title, charts }: { title: string; charts: { id: string; title: string }[] }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5 }}
      className="mb-10"
    >
      <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight mb-4 text-center">{title}</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-w-3xl mx-auto">
        {charts.map((c) => (
          <Link
            key={c.id}
            to="/goat/$chartId"
            params={{ chartId: c.id }}
            className="bg-[var(--card)] hover:border-[var(--accent)] border border-[var(--border)] rounded-lg p-4 text-center transition-all shadow-sm"
          >
            <div className="font-bold uppercase text-sm">{c.title}</div>
          </Link>
        ))}
      </div>
    </motion.div>
  );
}

function GoatIndex() {
  const songsQuery = useQuery({
    queryKey: ["goat-songs"],
    queryFn: () => getGoatGenerated({ data: { chartId: "goatSongs" } }),
  });

  const albumsQuery = useQuery({
    queryKey: ["goat-albums"],
    queryFn: () => getGoatGenerated({ data: { chartId: "goatAlbums" } }),
  });

  const artistsQuery = useQuery({
    queryKey: ["goat-artists"],
    queryFn: () => getGoatGenerated({ data: { chartId: "goatArtists" } }),
  });

  const topSongs = [...(songsQuery.data?.entries ?? [])].sort((a, b) => b.totalPoints - a.totalPoints).slice(0, 5).map((e, i) => ({ ...e, position: i + 1 }));
  const topAlbums = [...(albumsQuery.data?.entries ?? [])].sort((a, b) => b.totalUnits - a.totalUnits).slice(0, 5).map((e, i) => ({ ...e, position: i + 1 }));
  const topArtists = [...(artistsQuery.data?.entries ?? [])].sort((a, b) => b.totalUnits - a.totalUnits).slice(0, 5).map((e, i) => ({ ...e, position: i + 1 }));

  const allCharts = goatChartIds.map((id) => ({ id, title: chartsConfig[id]?.title ?? id }));

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-16">
      {/* Header */}
      <div className="relative text-center py-10 md:py-14 mb-8 overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
          <span className="text-[2.5rem] md:text-[5rem] font-black text-[var(--foreground)] opacity-[0.06] font-sans uppercase tracking-tighter leading-none whitespace-nowrap">GREATEST OF ALL TIME</span>
        </div>
        <h1 className="text-4xl sm:text-5xl md:text-7xl font-black gold tracking-tight relative z-10 uppercase">Greatest of All Time</h1>
        <p className="text-muted-foreground text-sm md:text-base mt-3 relative z-10">The definitive all-time rankings</p>
      </div>

      {/* Loading */}
      {(songsQuery.isLoading || albumsQuery.isLoading || artistsQuery.isLoading) && (
        <div className="text-center py-20 text-muted-foreground">Loading...</div>
      )}

      {/* Content */}
      {!songsQuery.isLoading && !albumsQuery.isLoading && !artistsQuery.isLoading && (
        <>
          {/* Top 5 previews */}
          <Top5Preview title="Greatest Songs" chartId="goatSongs" entries={topSongs} kind="song" />
          <Top5Preview title="Greatest Albums" chartId="goatAlbums" entries={topAlbums} kind="album" />
          <Top5Preview title="Greatest Artists" chartId="goatArtists" entries={topArtists} kind="artist" />

          {/* Chart grid */}
          <ChartGrid title="All Charts" charts={allCharts} />
        </>
      )}
    </div>
  );
}
