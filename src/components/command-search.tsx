import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Command } from "cmdk";
import { getAllArtistList, getAllSongList, getAllAlbumList } from "@/lib/charts.functions";
import { slugifyArtist } from "@/lib/charts-config";

interface SearchItem {
  name: string;
  artist?: string;
  slug: string;
  kind: "artist" | "song" | "album";
  entries: number;
}

export function CommandSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<SearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (open && items.length === 0) {
      setLoading(true);
      Promise.all([getAllArtistList(), getAllSongList(), getAllAlbumList()])
        .then(([artists, songs, albums]) => {
          const artistItems: SearchItem[] = (artists || []).map((a) => ({
            name: a.name,
            slug: a.slug,
            kind: "artist" as const,
            entries: a.entries,
          }));
          const songItems: SearchItem[] = (songs || []).map((s) => ({
            name: s.name,
            artist: s.artist,
            slug: s.slug,
            kind: "song" as const,
            entries: s.entries,
          }));
          const albumItems: SearchItem[] = (albums || []).map((a) => ({
            name: a.name,
            artist: a.artist,
            slug: a.slug,
            kind: "album" as const,
            entries: a.entries,
          }));
          setItems([...artistItems, ...songItems, ...albumItems]);
        })
        .finally(() => setLoading(false));
    }
  }, [open, items.length]);

  useEffect(() => {
    if (!open) {
      setQuery("");
    }
  }, [open]);

  const filtered = query
    ? items.filter((item) => {
        const q = query.toLowerCase();
        const nameMatch = item.name.toLowerCase().includes(q);
        const artistMatch = item.artist?.toLowerCase().includes(q);
        return nameMatch || artistMatch;
      })
    : items.slice(0, 20);

  const grouped = {
    artists: filtered.filter((i) => i.kind === "artist"),
    songs: filtered.filter((i) => i.kind === "song"),
    albums: filtered.filter((i) => i.kind === "album"),
  };

  const handleSelect = useCallback(
    (item: SearchItem) => {
      setOpen(false);
      if (item.kind === "artist") {
        navigate({ to: "/artist/$slug", params: { slug: item.slug } });
      } else if (item.kind === "song") {
        navigate({ to: "/song/$slug", params: { slug: item.slug } });
      } else {
        navigate({ to: "/album/$slug", params: { slug: item.slug } });
      }
    },
    [navigate],
  );

  const kindIcon = (kind: string) => {
    if (kind === "artist") return "fa-user";
    if (kind === "album") return "fa-compact-disc";
    return "fa-music";
  };

  const kindColor = (kind: string) => {
    if (kind === "artist") return "text-[var(--accent)]";
    if (kind === "album") return "text-violet-400";
    return "text-emerald-400";
  };

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 bg-transparent border border-[var(--border)] text-[var(--muted-foreground)] text-[10px] font-bold uppercase tracking-wider px-2.5 py-1.5 w-36 hover:border-[var(--accent)] hover:text-[var(--foreground)] focus:border-[var(--accent)] focus:outline-none transition-colors cursor-pointer"
      >
        <i className="fas fa-search" />
        <span>SEARCH</span>
        <kbd className="ml-auto text-[9px] bg-[var(--muted)] border border-[var(--border)] px-1 py-0.5 rounded font-mono">⌘K</kbd>
      </button>

      {/* Dialog */}
      {open && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-lg mx-4">
            <Command
              className="bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-2xl overflow-hidden"
              shouldFilter={!query}
              filter={(value, search) => {
                if (value.toLowerCase().includes(search.toLowerCase())) return 1;
                return 0;
              }}
            >
              <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)]">
                <i className="fas fa-search text-muted-foreground" />
                <Command.Input
                  ref={inputRef}
                  value={query}
                  onValueChange={setQuery}
                  placeholder="Search artists, songs, albums..."
                  className="flex-1 bg-transparent text-sm text-[var(--foreground)] placeholder-muted-foreground outline-none"
                  autoFocus
                />
                <kbd className="text-[10px] bg-[var(--muted)] border border-[var(--border)] px-1.5 py-0.5 rounded font-mono text-muted-foreground">ESC</kbd>
              </div>
              <Command.List className="max-h-[400px] overflow-y-auto p-2">
                {loading && (
                  <Command.Empty className="py-8 text-center text-sm text-muted-foreground">
                    <i className="fas fa-spinner fa-spin mr-2" />Loading...
                  </Command.Empty>
                )}
                {!loading && filtered.length === 0 && (
                  <Command.Empty className="py-8 text-center text-sm text-muted-foreground">
                    No results found.
                  </Command.Empty>
                )}
                {grouped.artists.length > 0 && (
                  <Command.Group heading={<span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Artists</span>}>
                    {grouped.artists.slice(0, 5).map((item) => (
                      <Command.Item
                        key={`artist-${item.slug}`}
                        value={`artist ${item.name}`}
                        onSelect={() => handleSelect(item)}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer text-sm hover:bg-[var(--muted)] transition-colors data-[selected=true]:bg-[var(--muted)]"
                      >
                        <i className={`fas ${kindIcon(item.kind)} ${kindColor(item.kind)} w-5 text-center`} />
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-[var(--foreground)] truncate">{item.name}</div>
                          <div className="text-xs text-muted-foreground">{item.entries} entries</div>
                        </div>
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}
                {grouped.songs.length > 0 && (
                  <Command.Group heading={<span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Songs</span>}>
                    {grouped.songs.slice(0, 5).map((item) => (
                      <Command.Item
                        key={`song-${item.slug}`}
                        value={`song ${item.name} ${item.artist}`}
                        onSelect={() => handleSelect(item)}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer text-sm hover:bg-[var(--muted)] transition-colors data-[selected=true]:bg-[var(--muted)]"
                      >
                        <i className={`fas ${kindIcon(item.kind)} ${kindColor(item.kind)} w-5 text-center`} />
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-[var(--foreground)] truncate">{item.name}</div>
                          <div className="text-xs text-muted-foreground truncate">{item.artist}</div>
                        </div>
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}
                {grouped.albums.length > 0 && (
                  <Command.Group heading={<span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Albums</span>}>
                    {grouped.albums.slice(0, 5).map((item) => (
                      <Command.Item
                        key={`album-${item.slug}`}
                        value={`album ${item.name} ${item.artist}`}
                        onSelect={() => handleSelect(item)}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer text-sm hover:bg-[var(--muted)] transition-colors data-[selected=true]:bg-[var(--muted)]"
                      >
                        <i className={`fas ${kindIcon(item.kind)} ${kindColor(item.kind)} w-5 text-center`} />
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-[var(--foreground)] truncate">{item.name}</div>
                          <div className="text-xs text-muted-foreground truncate">{item.artist}</div>
                        </div>
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}
              </Command.List>
            </Command>
          </div>
        </div>
      )}
    </>
  );
}
