import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getYearEndGenerated } from "@/lib/charts.functions";
import { aggregateYecForDecade, DECADES } from "@/lib/yec-computed";
import { slugifyArtist, songSlug, stripAlbumEdition } from "@/lib/charts-config";
import { SpotifyItemImage } from "@/components/spotify-item-image";
import { stripFeatFromTitle } from "@/components/track-artists";
import { motion } from "framer-motion";

export const Route = createFileRoute("/decade-end/")({
  component: DecadeEndIndex,
});

const SONG_CHARTS = [
  { id: "decadeEndSongs", title: "Hot 100" },
  { id: "decadeEndRadio", title: "Radio Songs" },
  { id: "decadeEndDigitalSongsSales", title: "Digital Songs Sales" },
  { id: "decadeEndStreamingSongs", title: "Streaming Songs" },
];

const ALBUM_CHARTS = [
  { id: "decadeEndAlbums", title: "Top 100 Albums" },
  { id: "decadeEndTopAlbumSales", title: "Top Album Sales" },
  { id: "decadeEndTopStreamingAlbums", title: "Top Streaming Albums" },
];

const ARTIST_CHARTS = [
  { id: "decadeEndArtists", title: "Artist 50" },
];

function getDecadeRange(label: string) {
  const d = DECADES.find((d) => d.label === label) ?? DECADES[0];
  return { start: d.startYear, end: d.endYear };
}

function DecadeDropdown({ selectedDecade, onSelect }: { selectedDecade: string; onSelect: (d: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="flex flex-col items-center gap-2 mb-8">
      <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Decade</div>
      <div ref={ref} className="relative">
        <button
          onClick={() => setOpen(!open)}
          className="bg-[var(--muted)] text-[var(--foreground)] border border-[var(--border)] text-sm font-bold px-4 py-2 min-w-[160px] text-center focus:outline-none cursor-pointer flex items-center justify-center gap-2"
        >
          {selectedDecade}
          <i className={`fas fa-chevron-down text-xs transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        {open && (
          <div className="absolute top-full left-0 right-0 z-50 bg-[var(--card)] border border-[var(--border)]">
            {DECADES.map((d) => (
              <button
                key={d.label}
                onClick={() => { setOpen(false); if (d.label !== selectedDecade) onSelect(d.label); }}
                className={`w-full text-center text-sm font-bold px-4 py-2 border-b border-white/20 cursor-pointer transition-colors ${
                  d.label === selectedDecade ? "bg-[var(--accent)] text-black" : "text-[var(--foreground)] hover:bg-[var(--muted)]"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

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
              <SpotifyItemImage name={e.name} artist={e.artist} kind={kind} size={i === 0 ? 220 : 140} className="w-full" />
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
            {kind !== "artist" && <div className="text-xs text-muted-foreground truncate">{e.artist}</div>}
          </div>
        ))}
      </div>
      <div className="flex justify-center mt-4">
        <Link to="/decade-end/$chartId" params={{ chartId }} className="text-xs font-bold uppercase tracking-wider border border-[var(--border)] px-3 py-1.5 hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors">
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
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-w-3xl mx-auto justify-items-center">
        {charts.map((c) => (
          <Link key={c.id} to="/decade-end/$chartId" params={{ chartId: c.id }} className="bg-[var(--card)] hover:border-[var(--accent)] border border-[var(--border)] rounded-lg p-4 text-center transition-all shadow-sm">
            <div className="font-bold uppercase text-sm">{c.title}</div>
          </Link>
        ))}
      </div>
    </motion.div>
  );
}

function DecadeEndIndex() {
  const [selectedDecade, setSelectedDecade] = useState<string>("2000");
  const { start, end } = getDecadeRange(selectedDecade);

  const songsQuery = useQuery({
    queryKey: ["yec-songs"],
    queryFn: () => getYearEndGenerated({ data: { chartId: "songs" } }),
  });

  const albumsQuery = useQuery({
    queryKey: ["yec-albums"],
    queryFn: () => getYearEndGenerated({ data: { chartId: "albums" } }),
  });

  const artistsQuery = useQuery({
    queryKey: ["yec-artists"],
    queryFn: () => getYearEndGenerated({ data: { chartId: "artists" } }),
  });

  const topSongs = useMemo(() => {
    if (!songsQuery.data) return [];
    return aggregateYecForDecade(songsQuery.data, start, end).slice(0, 5);
  }, [songsQuery.data, start, end]);

  const topAlbums = useMemo(() => {
    if (!albumsQuery.data) return [];
    return aggregateYecForDecade(albumsQuery.data, start, end).slice(0, 5);
  }, [albumsQuery.data, start, end]);

  const topArtists = useMemo(() => {
    if (!artistsQuery.data) return [];
    return aggregateYecForDecade(artistsQuery.data, start, end).slice(0, 5);
  }, [artistsQuery.data, start, end]);

  const isLoading = songsQuery.isLoading || albumsQuery.isLoading || artistsQuery.isLoading;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-16">
      <div className="relative text-center py-10 md:py-14 mb-8 overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
          <span className="text-[2.5rem] md:text-[5rem] font-black text-[var(--foreground)] opacity-[0.06] font-sans uppercase tracking-tighter leading-none whitespace-nowrap">DECADE-END CHARTS</span>
        </div>
        <h1 className="text-4xl sm:text-5xl md:text-7xl font-black gold tracking-tight relative z-10 uppercase">Decade-End Charts</h1>
        <p className="text-muted-foreground text-sm md:text-base mt-3 relative z-10">The definitive decade-end rankings across every chart</p>
      </div>

      <DecadeDropdown selectedDecade={selectedDecade} onSelect={setSelectedDecade} />

      {isLoading && (
        <div className="text-center py-20 text-muted-foreground">Loading...</div>
      )}

      {!isLoading && (
        <>
          <Top5Preview title="Hot 100" chartId="decadeEndSongs" entries={topSongs} kind="song" />
          <Top5Preview title="Top 100 Albums" chartId="decadeEndAlbums" entries={topAlbums} kind="album" />
          <Top5Preview title="Artist 50" chartId="decadeEndArtists" entries={topArtists} kind="artist" />

          <ChartGrid title="Songs" charts={SONG_CHARTS.filter((c) => selectedDecade >= "2000" || c.id === "decadeEndSongs")} />
          <ChartGrid title="Albums" charts={ALBUM_CHARTS.filter((c) => selectedDecade >= "2000" || c.id === "decadeEndAlbums")} />
          <ChartGrid title="Artists" charts={ARTIST_CHARTS.filter((c) => selectedDecade >= "2000" || c.id === "decadeEndArtists")} />

          <div className="mt-10">
            <DecadeDropdown selectedDecade={selectedDecade} onSelect={setSelectedDecade} />
          </div>
        </>
      )}
    </div>
  );
}
