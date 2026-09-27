import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getYearEndGenerated } from "@/lib/charts.functions";
import { getYearEndTopLatinAlbums } from "@/lib/yec-computed";
import { chartsConfig, slugifyArtist, songSlug, stripAlbumEdition } from "@/lib/charts-config";
import { SpotifyItemImage } from "@/components/spotify-item-image";
import { stripFeatFromTitle } from "@/components/track-artists";
import { motion } from "framer-motion";

export const Route = createFileRoute("/year-end/")({
  head: () => ({ meta: [{ title: "Year-End Charts | daegon charts" }] }),
  component: YearEndIndex,
});

const SONG_CHARTS = [
  { id: "yearEndSongs", title: "Hot 100" },
  { id: "yearEndRadio", title: "Radio Songs" },
  { id: "yearEndDigitalSongsSales", title: "Digital Songs Sales" },
  { id: "yearEndStreamingSongs", title: "Streaming Songs" },
];

const ALBUM_CHARTS = [
  { id: "yearEndAlbums", title: "Top 100 Albums" },
  { id: "yearEndTopAlbumSales", title: "Top Album Sales" },
  { id: "yearEndTopStreamingAlbums", title: "Top Streaming Albums" },
  { id: "yecTopLatinAlbums", title: "Top Latin Albums" },
];

const ARTIST_CHARTS = [
  { id: "yecHot100Artists", title: "Hot 100 — Artists" },
  { id: "yecArtist50Female", title: "Top Artists — Female" },
  { id: "yecArtist50Male", title: "Top Artists — Male" },
  { id: "yecArtist50DuoGroup", title: "Top Artists — Duo/Group" },
  { id: "yearEndNewArtists", title: "Top New Artists" },
  { id: "yecTop100AlbumsArtists", title: "Top 200 Albums — Artists" },
  { id: "yecRadioSongsArtists", title: "Radio Songs — Artists" },
];

function YearDropdown({ years, selectedYear, onSelect }: { years: string[]; selectedYear: string; onSelect: (y: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const yearIdx = years.indexOf(selectedYear);
  const prevYear = yearIdx < years.length - 1 ? years[yearIdx + 1] : null;
  const nextYear = yearIdx > 0 ? years[yearIdx - 1] : null;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (open && listRef.current) {
      const selected = listRef.current.querySelector("[data-selected]");
      if (selected) selected.scrollIntoView({ block: "center" });
    }
  }, [open]);

  return (
    <div className="flex flex-col items-center gap-2 mb-8">
      <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Year</div>
      <div className="flex flex-wrap items-center gap-2 justify-center">
        {prevYear ? (
          <button onClick={() => onSelect(prevYear)} className="btn-gold">
            <i className="fas fa-chevron-left" /> Prev
          </button>
        ) : (
          <button className="btn-gold" disabled><i className="fas fa-chevron-left" /> Prev</button>
        )}
        <div ref={ref} className="relative">
          <button
            onClick={() => setOpen(!open)}
            className="bg-[var(--muted)] text-[var(--foreground)] border border-[var(--border)] text-sm font-bold px-4 py-2 min-w-[160px] text-center focus:outline-none cursor-pointer flex items-center justify-center gap-2"
          >
            {selectedYear}
            <i className={`fas fa-chevron-down text-xs transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
          {open && (
            <div ref={listRef} className="absolute top-full left-0 right-0 z-50 bg-[var(--card)] border border-[var(--border)] max-h-[300px] overflow-y-auto">
              {years.map((y) => (
                <button
                  key={y}
                  data-selected={y === selectedYear || undefined}
                  onClick={() => {
                    setOpen(false);
                    if (y !== selectedYear) onSelect(y);
                  }}
                  className={`w-full text-center text-sm font-bold px-4 py-2 border-b border-white/20 cursor-pointer transition-colors ${
                    y === selectedYear
                      ? "bg-[var(--accent)] text-black"
                      : "text-[var(--foreground)] hover:bg-[var(--muted)]"
                  }`}
                >
                  {y}
                </button>
              ))}
            </div>
          )}
        </div>
        {nextYear ? (
          <button onClick={() => onSelect(nextYear)} className="btn-gold">
            Next <i className="fas fa-chevron-right" />
          </button>
        ) : (
          <button className="btn-gold" disabled>Next <i className="fas fa-chevron-right" /></button>
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
          to="/year-end/$chartId"
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
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-w-3xl mx-auto justify-items-center">
        {charts.map((c) => (
          <Link
            key={c.id}
            to="/year-end/$chartId"
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

function YearEndIndex() {
  const [selectedYear, setSelectedYear] = useState<string>("2025");

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

  const latinAlbumsQuery = useQuery({
    queryKey: ["yec-latin-albums"],
    queryFn: () => getYearEndTopLatinAlbums(),
  });

  const allYears = songsQuery.data?.years ?? [];
  const lockedUntil = new Date("2026-12-31T23:59:59");
  const years = allYears.filter((y) => y !== "2026" || new Date() >= lockedUntil);

  const songEntries = songsQuery.data?.entriesByYear[selectedYear] ?? [];
  const albumEntries = albumsQuery.data?.entriesByYear[selectedYear] ?? [];
  const artistEntries = artistsQuery.data?.entriesByYear[selectedYear] ?? [];
  const latinAlbumEntries = latinAlbumsQuery.data?.entriesByYear[selectedYear] ?? [];

  const topSongs = songEntries.slice(0, 5);
  const topAlbums = albumEntries.slice(0, 5);
  const topArtists = artistEntries.slice(0, 5);
  const topLatinAlbums = latinAlbumEntries.slice(0, 5);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-16">
      {/* Header */}
      <div className="relative text-center py-10 md:py-14 mb-8 overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
          <span className="text-[2.5rem] md:text-[5rem] font-black text-[var(--foreground)] opacity-[0.06] font-sans uppercase tracking-tighter leading-none whitespace-nowrap">YEAR-END CHARTS</span>
        </div>
        <h1 className="text-4xl sm:text-5xl md:text-7xl font-black gold tracking-tight relative z-10 uppercase">Year-End Charts</h1>
        <p className="text-muted-foreground text-sm md:text-base mt-3 relative z-10">The definitive year-end rankings across every chart</p>
      </div>

      {/* Year selector */}
      <YearDropdown years={years} selectedYear={selectedYear} onSelect={setSelectedYear} />

      {/* Loading */}
      {(songsQuery.isLoading || albumsQuery.isLoading) && (
        <div className="text-center py-20 text-muted-foreground">Loading...</div>
      )}

      {/* Content */}
      {!songsQuery.isLoading && !albumsQuery.isLoading && (
        <>
          {/* Top 5 previews */}
          <Top5Preview title="Hot 100" chartId="yearEndSongs" entries={topSongs} kind="song" />
          <Top5Preview title="Top 100 Albums" chartId="yearEndAlbums" entries={topAlbums} kind="album" />
          <Top5Preview title="Artist 50" chartId="yearEndArtists" entries={topArtists} kind="artist" />
          <Top5Preview title="Top Latin Albums" chartId="yecTopLatinAlbums" entries={topLatinAlbums} kind="album" />

          {/* Chart grids */}
          <ChartGrid title="Songs" charts={SONG_CHARTS} />
          <ChartGrid title="Albums" charts={ALBUM_CHARTS} />
          <ChartGrid title="Artists" charts={ARTIST_CHARTS} />

          {/* Bottom nav */}
          <div className="mt-10">
            <YearDropdown years={years} selectedYear={selectedYear} onSelect={setSelectedYear} />
          </div>
        </>
      )}
    </div>
  );
}
