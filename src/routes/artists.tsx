import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { getAllArtistList } from "@/lib/charts.functions";
import { getSpotifyImage } from "@/lib/spotify.functions";
import { slugifyArtist } from "@/lib/charts-config";
import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";

export const Route = createFileRoute("/artists")({
  loader: async () => {
    const list = await getAllArtistList();
    return { list };
  },
  head: () => ({
    meta: [
      { title: "Artists — daegon charts" },
      { name: "description", content: "Every artist that has ever appeared on daegon charts." },
    ],
  }),
  component: AllArtistsPage,
});

function ArtistThumbnail({ name }: { name: string }) {
  const [imageUrl, setImageUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    getSpotifyImage({ data: { query: name, type: "artist" } }).then((url) => {
      if (active && url) setImageUrl(url);
    });
    return () => { active = false; };
  }, [name]);

  return (
    <div className="w-14 h-14 rounded-full overflow-hidden bg-[var(--card)] flex items-center justify-center text-sm font-semibold text-[var(--foreground)] uppercase border border-[var(--border)]">
      {imageUrl ? (
        <img src={imageUrl} alt={name} className="w-full h-full object-cover animate-fade-in" />
      ) : (
        <span className="animate-pulse">{name.charAt(0)}</span>
      )}
    </div>
  );
}

function AllArtistsPage() {
  const { list } = Route.useLoaderData();
  const navigate = useNavigate();
  const [search, setSearch] = useState(() => {
    if (typeof window !== "undefined") {
      return new URLSearchParams(window.location.search).get("q") ?? "";
    }
    return "";
  });
  const debounceRef = React.useRef<ReturnType<typeof setTimeout>>();
  const letters = useMemo(() => {
    return Array.from(new Set(list.map((a) => a.name[0].toUpperCase()))).sort();
  }, [list]);
  const [selectedLetter, setSelectedLetter] = useState<string>(() => letters[0] ?? "");

  React.useEffect(() => {
    if (!selectedLetter && letters.length) setSelectedLetter(letters[0]);
  }, [letters]);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      if (value) {
        params.set("q", value);
      } else {
        params.delete("q");
      }
      navigate({ search: Object.fromEntries(params), replace: true });
    }, 400);
  };

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return list.filter((a) => {
      const matchesLetter = !query || a.name[0].toUpperCase() === selectedLetter;
      const matchesSearch = !query || a.name.toLowerCase().includes(query);
      return matchesSearch;
    });
  }, [list, search, selectedLetter]);

  const grouped = useMemo(() => {
    return filtered.reduce<Record<string, typeof list>>((groups, artist) => {
      const letter = artist.name[0].toUpperCase();
      (groups[letter] ||= []).push(artist);
      return groups;
    }, {});
  }, [filtered]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-16">
      <div className="relative text-center py-10 md:py-14 mb-8 overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
          <span className="text-[6rem] md:text-[10rem] font-black text-[var(--foreground)] opacity-[0.06] font-sans uppercase tracking-tighter leading-none">ARTISTS</span>
        </div>
        <h1 className="text-4xl sm:text-5xl md:text-7xl font-black gold tracking-tight relative z-10 uppercase">Artists</h1>
        <p className="text-muted-foreground text-sm md:text-base mt-3 relative z-10">{list.length} artists tracked across all charts</p>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div className="flex flex-wrap gap-2">
          {letters.map((letter) => (
            <button
              key={letter}
              type="button"
              onClick={() => setSelectedLetter(letter)}
              className={`btn-nav ${selectedLetter === letter ? "active" : ""}`}
            >
              {letter}
            </button>
          ))}
        </div>
        <div className="w-full sm:w-auto">
          <input
            type="search"
            placeholder="Search artists"
            value={search}
            onChange={(event) => handleSearchChange(event.target.value)}
            className="w-full sm:w-72 bg-[var(--card)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:border-[var(--accent)]"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-sm text-muted-foreground">No artists found for that filter.</div>
      ) : (
        Object.keys(grouped).sort().map((letter) => (
          <section key={letter} className="mb-8">
            <h2 className="text-xl font-bold mb-3">{letter}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {grouped[letter].map((artist, i) => (
                <motion.div
                  key={artist.slug}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: Math.min(i * 0.03, 0.4) }}
                >
                <Link
                  to="/artist/$slug"
                  params={{ slug: artist.slug }}
                  className="group bg-[var(--card)] border border-[var(--border)] rounded-3xl p-4 flex items-center gap-3 hover:border-[var(--accent)] transition-colors shadow-sm"
                >
                  <ArtistThumbnail name={artist.name} />
                  <div className="min-w-0">
                    <div className="font-semibold truncate group-hover:text-[var(--accent)]">{artist.name}</div>
                    <div className="text-xs text-muted-foreground mt-1">{artist.entries} entries</div>
                  </div>
                </Link>
                </motion.div>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
