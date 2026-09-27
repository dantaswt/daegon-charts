import { createFileRoute, Outlet, Link, useLocation } from "@tanstack/react-router";
import { useState, useEffect, useRef, createContext, useContext } from "react";
import {
  fetchAllAwardEditions,
  getAwardArtists,
  type AwardEditionData,
  type AwardArtistData,
} from "@/lib/awards.functions";
import { SpotifyItemImage } from "@/components/spotify-item-image";

interface AwardsContextType {
  allData: AwardEditionData[];
  allArtists: AwardArtistData[];
  loaded: boolean;
}

export const AwardsContext = createContext<AwardsContextType>({ allData: [], allArtists: [], loaded: false });

export function useAwardsData() {
  return useContext(AwardsContext);
}

export const Route = createFileRoute("/awards")({
  component: AwardsLayout,
  head: () => ({
    meta: [{ title: "Daegon Awards — daegon charts" }],
  }),
});

const NAV_ITEMS = [
  { label: "Home", to: "/awards" },
  { label: "Categories", to: "/awards/categories" },
  { label: "Artists", to: "/awards/artists" },
  { label: "Stats", to: "/awards/stats" },
  { label: "About", to: "/awards/about" },
];

function AwardsLayout() {
  const location = useLocation();
  const [allData, setAllData] = useState<AwardEditionData[]>([]);
  const [allArtists, setAllArtists] = useState<AwardArtistData[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchAllAwardEditions().then((data) => {
      setAllData(data);
      getAwardArtists().then((artists) => {
        setAllArtists(artists);
        setLoaded(true);
      });
    });
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const searchResults = (() => {
    if (!searchQuery || searchQuery.length < 2) return [];
    const q = searchQuery.toLowerCase();
    const results: { type: string; name: string; sub: string; slug: string }[] = [];
    allArtists.forEach((a) => {
      if (a.name.toLowerCase().includes(q))
        results.push({ type: "artist", name: a.name, sub: `${a.wins} wins · ${a.nominations} nominations`, slug: a.name.toLowerCase().replace(/\s+/g, "-") });
    });
    allData.forEach((ed) => {
      Object.values(ed.categories).forEach((nominees) => {
        nominees.forEach((n) => {
          if (n.item?.toLowerCase().includes(q))
            results.push({ type: "work", name: n.item, sub: `${n.artist} · ${n.year}`, slug: n.artist.toLowerCase().replace(/\s+/g, "-") });
        });
      });
    });
    return results.slice(0, 20);
  })();

  const isActive = (to: string) => {
    if (to === "/awards") return location.pathname === "/awards" || location.pathname === "/awards/";
    return location.pathname.startsWith(to);
  };

  return (
    <AwardsContext.Provider value={{ allData, allArtists, loaded }}>
      <div className="min-h-screen">
        {/* Header */}
        <div className="border-b-2 border-[var(--accent)] bg-[var(--card)]">
          <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-4 flex-wrap">
            <Link to="/awards" className="flex items-center gap-3">
              <i className="fas fa-trophy text-[var(--accent)] text-lg" />
              <h1 className="text-xl font-bold tracking-wider text-[var(--foreground)]" style={{ fontFamily: "Times New Roman, serif" }}>DAEGON AWARDS</h1>
            </Link>
            <nav className="flex items-center gap-5 flex-wrap">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.label}
                  to={item.to}
                  className={`text-xs font-bold uppercase tracking-widest transition-colors ${
                    isActive(item.to) ? "text-[var(--accent)]" : "text-muted-foreground hover:text-[var(--foreground)]"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="relative" ref={searchRef}>
              <input
                type="text"
                placeholder="Search artists, songs..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setSearchOpen(true); }}
                onFocus={() => setSearchOpen(true)}
                className="px-4 py-2 pl-10 rounded-full border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] text-sm w-48 focus:w-64 transition-all outline-none focus:border-[var(--accent)]"
              />
              <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs" />
              {searchOpen && searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-[var(--card)] border border-[var(--border)] rounded-lg shadow-lg max-h-80 overflow-y-auto z-50">
                  {searchResults.map((r, i) => (
                    <Link
                      key={i}
                      to="/artist/$slug"
                      params={{ slug: r.slug }}
                      onClick={() => { setSearchOpen(false); setSearchQuery(""); }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--muted)] transition-colors text-left border-b border-[var(--border)] last:border-0"
                    >
                      <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
                        <SpotifyItemImage name={r.type === "artist" ? r.name : r.name} artist={r.type === "artist" ? r.name : r.name} kind="artist" size={40} rounded="full" className="w-full h-full" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-[var(--foreground)]">{r.name}</div>
                        <div className="text-xs text-muted-foreground">{r.sub}</div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 py-8">
          <Outlet />
        </div>
      </div>
    </AwardsContext.Provider>
  );
}
