import { createFileRoute } from "@tanstack/react-router";
import { getStats2, type Stats2Record, type Stats2Category } from "@/lib/charts.functions";
import { chartsConfig } from "@/lib/charts-config";
import { getSpotifyImage } from "@/lib/spotify.functions";
import { StatsGridImage } from "@/components/stats-grid-image";
import React, { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";

export const Route = createFileRoute("/stats/")({
  loader: async () => await getStats2(),
  head: () => ({
    meta: [
      { title: "Stats | daegon charts" },
      { name: "description", content: "Comprehensive chart statistics, records and milestones." },
    ],
  }),
  component: Stats2Page,
});

/* ── Image component ── */
function ItemImage({ name, artist, kind }: { name: string; artist: string; kind: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const query = kind === "album" ? `album:"${name}" artist:"${artist}"` : kind === "artist" ? `artist:"${name}"` : `artist:"${artist}" track:"${name}"`;
  const type = kind === "album" ? "album" : "artist";
  useEffect(() => {
    let active = true;
    getSpotifyImage({ data: { query, type } }).then((u) => { if (active && u) setUrl(u); });
    return () => { active = false; };
  }, [query, type]);
  return (
    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg overflow-hidden bg-gradient-to-br from-[var(--muted)] to-[var(--border)] flex items-center justify-center shrink-0">
      {url ? <img src={url} alt={name} className="w-full h-full object-cover animate-fade-in" /> : <i className="fas fa-music text-muted-foreground animate-pulse" />}
    </div>
  );
}

/* ── Record Row ── */
function RecordRow({ record, rank, kind, chartId }: { record: Stats2Record; rank: number; kind: string; chartId: string }) {
  const cfg = chartsConfig[chartId];
  const actualKind = cfg?.kind ?? kind;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: Math.min(rank * 0.02, 0.4) }}
      className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl border border-[var(--border)] bg-[var(--card)] hover:border-[var(--accent)] hover:shadow-md transition-all group"
    >
      <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center font-black text-sm shrink-0 ${rank <= 3 ? "bg-[var(--accent)] text-black" : "bg-[var(--muted)] text-[var(--foreground)]"}`}>
        {rank}
      </div>
      <ItemImage name={record.name} artist={record.artist} kind={actualKind} />
      <div className="min-w-0 flex-1">
        <div className="font-bold text-sm group-hover:text-[var(--accent)] transition-colors">{record.name}</div>
        <div className="text-xs text-muted-foreground">{record.artist}</div>
        {record.details && <div className="text-[11px] text-muted-foreground mt-0.5 break-words">{record.details}</div>}
      </div>
      <div className="text-right shrink-0">
        <div className="font-black text-base sm:text-lg gold">{record.valueLabel}</div>
        {record.peak && record.peak > 0 && (
          <div className="text-[10px] text-muted-foreground">Peak #{record.peak}</div>
        )}
      </div>
    </motion.div>
  );
}

/* ── All-Kill Section ── */
function AllKillSection({ allKills }: { allKills: { top: { name: string; artist: string; date: string; count: number; charts: string[]; entries: string[] }[]; full: { name: string; artist: string; date: string; count: number; charts: string[]; entries: string[] }[]; songs: { name: string; artist: string; date: string; count: number; charts: string[] }[]; albums: { name: string; artist: string; date: string; count: number; charts: string[] }[] } }) {
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<"full" | "top" | "songs" | "albums">("full");

  const tabs = [
    { id: "full" as const, label: "Full All-Kill", icon: "fa-trophy", items: allKills.full },
    { id: "top" as const, label: "Top All-Kill", icon: "fa-crown", items: allKills.top },
    { id: "songs" as const, label: "Song All-Kill", icon: "fa-music", items: allKills.songs },
    { id: "albums" as const, label: "Album All-Kill", icon: "fa-compact-disc", items: allKills.albums },
  ];

  const activeItems = tabs.find((t) => t.id === activeTab)?.items ?? [];
  const displayItems = expanded ? activeItems : activeItems.slice(0, 5);

  return (
    <section className="mb-8">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-500 to-amber-600 flex items-center justify-center shadow-lg">
          <i className="fas fa-trophy text-white text-lg" />
        </div>
        <div>
          <h2 className="text-lg font-black gold uppercase tracking-wide">All-Kill</h2>
          <p className="text-xs text-muted-foreground">Entries that dominated #1 across every chart simultaneously</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setExpanded(false); }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === tab.id
                ? "bg-[var(--accent)] text-black"
                : "bg-[var(--card)] border border-[var(--border)] text-[var(--foreground)] hover:border-[var(--accent)]"
            }`}
          >
            <i className={`fas ${tab.icon}`} />
            {tab.label}
            <span className={`ml-1 px-1.5 py-0.5 rounded text-[10px] ${
              activeTab === tab.id ? "bg-black/20" : "bg-[var(--muted)]"
            }`}>
              {tab.items.length}
            </span>
          </button>
        ))}
      </div>

      {/* Items */}
      {activeItems.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground bg-[var(--card)] rounded-xl border border-[var(--border)]">
          <i className="fas fa-trophy text-3xl mb-3 block opacity-30" />
          <p className="text-sm font-semibold">No All-Kills found</p>
          <p className="text-xs mt-1">No entry has topped all charts in this category yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {displayItems.map((item, i) => {
            const itemKind = activeTab === "songs" ? "song" : activeTab === "albums" ? "album" : "artist";
            return (
            <motion.div
              key={`${item.name}||${item.artist}||${item.date}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: Math.min(i * 0.02, 0.3) }}
              className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl border border-[var(--border)] bg-[var(--card)] hover:border-[var(--accent)] hover:shadow-md transition-all group"
            >
              <ItemImage name={item.name} artist={item.artist} kind={itemKind} />
              <div className="min-w-0 flex-1">
                <div className="font-bold text-sm group-hover:text-[var(--accent)] transition-colors">{item.artist}</div>
                <div className="text-xs text-muted-foreground">
                  {"entries" in item && Array.isArray(item.entries)
                    ? [...new Set(item.entries)].join(", ")
                    : item.name}
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {item.charts.map((c) => (
                    <span key={c} className="px-1.5 py-0.5 bg-[var(--muted)] rounded text-[10px] text-muted-foreground">{c}</span>
                  ))}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-black text-base sm:text-lg gold">{item.count} Charts</div>
                <div className="text-[10px] text-muted-foreground">
                  {new Date(item.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </div>
              </div>
            </motion.div>
            );
          })}
          {activeItems.length > 5 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="w-full py-2 text-xs text-muted-foreground hover:text-[var(--accent)] transition-colors"
            >
              {expanded ? (
                <><i className="fas fa-chevron-up mr-1" /> Show less</>
              ) : (
                <><i className="fas fa-chevron-down mr-1" /> Show all {activeItems.length} All-Kills</>
              )}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

/* ── Summary Cards for the overview ── */
function SummaryCards({ categories, chartKind }: { categories: Stats2Category[]; chartKind: string }) {
  const summaryStats = categories.map((cat) => {
    const top = cat.records[0];
    return { ...cat, topRecord: top };
  });
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-3 sm:gap-4 mb-8">
      {summaryStats.map((cat) => (
        <div key={cat.id} className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-4 hover:border-[var(--accent)] transition-all cursor-default shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-[var(--muted)] flex items-center justify-center">
              <i className={`fas ${cat.icon} text-[var(--accent)] text-sm`} />
            </div>
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground leading-tight">{cat.title}</div>
          </div>
          {cat.topRecord ? (
            <>
              <div className="font-bold text-sm truncate">{cat.topRecord.name}</div>
              <div className="text-xs text-muted-foreground truncate">{cat.topRecord.artist}</div>
              <div className="mt-2 font-black text-lg gold">{cat.topRecord.valueLabel}</div>
            </>
          ) : (
            <div className="text-xs text-muted-foreground italic">No data</div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ── Chart selector ── */
function ChartSelector({ active, onChange }: { active: string; onChange: (id: string) => void }) {
  const chartGroups = [
    { label: "Songs", ids: ["songs", "streamingSongs", "radioSongs", "digitalSongsSales"] },
    { label: "Albums", ids: ["albums", "topStreamingAlbums", "topAlbumSales"] },
    { label: "Artists", ids: ["artists"] },
  ];
  return (
    <select
      value={active}
      onChange={(e) => onChange(e.target.value)}
      className="bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm font-semibold text-[var(--foreground)] outline-none focus:border-[var(--accent)] transition-colors cursor-pointer"
    >
      {chartGroups.map((group) => (
        <optgroup key={group.label} label={group.label}>
          {group.ids.map((id) => {
            const cfg = chartsConfig[id];
            return (
              <option key={id} value={id}>{cfg.title}</option>
            );
          })}
        </optgroup>
      ))}
    </select>
  );
}

/* ── Stat type tabs ── */
function StatTypeTabs({ categories, active, onChange }: { categories: Stats2Category[]; active: string; onChange: (id: string) => void }) {
  return (
    <select
      value={active}
      onChange={(e) => onChange(e.target.value)}
      className="bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm font-semibold text-[var(--foreground)] outline-none focus:border-[var(--accent)] transition-colors cursor-pointer"
    >
      {categories.map((cat) => (
        <option key={cat.id} value={cat.id}>{cat.title}</option>
      ))}
    </select>
  );
}

/* ── Year filter ── */
function YearFilter({ years, active, onChange }: { years: string[]; active: string; onChange: (y: string) => void }) {
  return (
    <select
      value={active}
      onChange={(e) => onChange(e.target.value)}
      className="bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm font-semibold text-[var(--foreground)] outline-none focus:border-[var(--accent)] transition-colors cursor-pointer"
    >
      <option value="all">All Years</option>
      {years.map((y) => (
        <option key={y} value={y}>{y}</option>
      ))}
    </select>
  );
}

/* ── Search filter ── */
function SearchFilter({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative">
      <input
        type="text"
        placeholder={placeholder || "Search records..."}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="sidebar-search pr-8"
      />
      {value && (
        <button
          onClick={() => onChange("")}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-[var(--accent)]"
        >
          <i className="fas fa-times text-xs" />
        </button>
      )}
    </div>
  );
}

/* ── Multi Artist Filter ── */
function MultiArtistFilter({ artists, selected, onChange }: { artists: string[]; selected: string[]; onChange: (v: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return artists.filter((a) => !q || a.toLowerCase().includes(q));
  }, [artists, query]);

  const toggle = (artist: string) => {
    if (selected.includes(artist)) {
      onChange(selected.filter((a) => a !== artist));
    } else {
      onChange([...selected, artist]);
    }
  };

  const remove = (artist: string) => {
    onChange(selected.filter((a) => a !== artist));
  };

  return (
    <div className="relative flex-1 min-w-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm font-semibold text-left flex items-center gap-2 focus:border-[var(--accent)] transition-colors cursor-pointer"
      >
        {selected.length > 0 ? (
          <span className="text-[var(--foreground)]">{selected.length} artist{selected.length !== 1 ? "s" : ""} selected</span>
        ) : (
          <span className="text-muted-foreground">Filter by artist...</span>
        )}
        <i className={`fas fa-chevron-${open ? "up" : "down"} text-[10px] text-muted-foreground ml-auto`} />
      </button>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {selected.map((a) => (
            <span key={a} className="inline-flex items-center gap-1 px-2 py-0.5 bg-[var(--accent)] text-black text-[10px] font-bold rounded-full">
              {a}
              <button type="button" onClick={() => remove(a)} className="hover:opacity-70">
                <i className="fas fa-times text-[8px]" />
              </button>
            </span>
          ))}
        </div>
      )}
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-[var(--card)] border border-[var(--border)] rounded-lg shadow-lg max-h-60 overflow-hidden flex flex-col">
          <div className="p-2 border-b border-[var(--border)]">
            <input
              type="text"
              placeholder="Search artists..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-[var(--muted)] border border-[var(--border)] rounded px-2 py-1.5 text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:border-[var(--accent)]"
              autoFocus
            />
          </div>
          <div className="overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-xs text-muted-foreground italic">No artists found</div>
            ) : (
              filtered.map((artist) => (
                <button
                  key={artist}
                  type="button"
                  onClick={() => toggle(artist)}
                  className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 transition-colors ${selected.includes(artist) ? "text-[var(--accent)] font-bold" : "text-[var(--foreground)] hover:text-[var(--accent)]"} hover:bg-[var(--muted)]`}
                >
                  <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${selected.includes(artist) ? "bg-[var(--accent)] border-[var(--accent)]" : "border-[var(--border)]"}`}>
                    {selected.includes(artist) && <i className="fas fa-check text-[8px] text-black" />}
                  </span>
                  {artist}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Sort selector ── */
function SortSelector({ value, onChange, isLowerBetter }: { value: string; onChange: (v: string) => void; isLowerBetter: boolean }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 text-xs font-semibold text-[var(--foreground)] outline-none focus:border-[var(--accent)] transition-colors cursor-pointer"
    >
      <option value="auto">{isLowerBetter ? "Best (Lowest First)" : "Best (Highest First)"}</option>
      <option value="value-desc">Highest Value</option>
      <option value="value-asc">Lowest Value</option>
      <option value="name-asc">Name A-Z</option>
      <option value="name-desc">Name Z-A</option>
    </select>
  );
}

/* ── Main Stats Page ── */
function Stats2Page() {
  const data = Route.useLoaderData();
  const { chartStats, availableYears, chartIds, allKills } = data;

  const [selectedChart, setSelectedChart] = useState(chartIds[0]);
  const [selectedStat, setSelectedStat] = useState("debuts");
  const [selectedYear, setSelectedYear] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedArtists, setSelectedArtists] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState("auto");
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 50;

  const categories = chartStats[selectedChart] ?? [];
  const activeCategory = categories.find((c) => c.id === selectedStat) ?? categories[0];

  const uniqueArtists = useMemo(() => {
    if (!activeCategory) return [];
    return Array.from(new Set(activeCategory.records.map((r) => r.artist))).sort();
  }, [activeCategory]);

  // Clean up selected artists that don't exist in the new category
  useEffect(() => {
    if (selectedArtists.length > 0) {
      setSelectedArtists((prev) => prev.filter((a) => uniqueArtists.includes(a)));
    }
  }, [uniqueArtists]);

  const isLowerBetter = false;

  const filteredRecords = useMemo(() => {
    if (!activeCategory) return [];
    let records = [...activeCategory.records];

    // Year filter
    if (selectedYear !== "all") {
      records = records.filter((r) => r.firstDate?.startsWith(selectedYear));
    }

    // Artist filter
    if (selectedArtists.length > 0) {
      records = records.filter((r) => selectedArtists.includes(r.artist));
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      records = records.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.artist.toLowerCase().includes(q) ||
          (r.details && r.details.toLowerCase().includes(q))
      );
    }

    // Sort
    if (sortBy === "name-asc") {
      records.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === "name-desc") {
      records.sort((a, b) => b.name.localeCompare(a.name));
    } else if (sortBy === "value-asc") {
      records.sort((a, b) => a.value - b.value);
    } else if (sortBy === "value-desc") {
      records.sort((a, b) => b.value - a.value);
    } else {
      // auto: debuts/drops ascending, others descending
      records.sort((a, b) => isLowerBetter ? a.value - b.value : b.value - a.value);
    }

    return records;
  }, [activeCategory, selectedYear, selectedArtists, searchQuery, sortBy, isLowerBetter]);

  const totalPages = Math.ceil(filteredRecords.length / PAGE_SIZE);
  const displayedRecords = filteredRecords.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // Reset state when chart changes (keep artist filter)
  useEffect(() => {
    setSelectedStat(categories[0]?.id ?? "debuts");
    setSearchQuery("");
    setCurrentPage(1);
  }, [selectedChart]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedStat, selectedYear, selectedArtists, searchQuery, sortBy]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-16">
      {/* Hero Header */}
      <div className="relative text-center py-10 md:py-14 mb-8 overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
          <span className="text-[6rem] md:text-[10rem] font-black text-[var(--foreground)] opacity-[0.06] font-sans uppercase tracking-tighter leading-none">STATS</span>
        </div>
        <h1 className="text-4xl sm:text-5xl md:text-7xl font-black gold tracking-tight relative z-10 uppercase">Stats</h1>
        <p className="text-muted-foreground text-sm md:text-base mt-3 relative z-10">Records, milestones & chart history across every chart</p>
      </div>

      {/* All-Kill Section */}
      {allKills && (
        <AllKillSection allKills={allKills} />
      )}

      {/* Filters */}
      <section className="mb-6 space-y-3 sticky top-0 z-40 bg-[var(--background)] py-3 -mx-4 sm:-mx-6 px-4 sm:px-6 border-b border-[var(--border)]">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <ChartSelector active={selectedChart} onChange={setSelectedChart} />
          <StatTypeTabs categories={categories} active={selectedStat} onChange={setSelectedStat} />
          <YearFilter years={availableYears} active={selectedYear} onChange={setSelectedYear} />
          <SortSelector value={sortBy} onChange={setSortBy} isLowerBetter={isLowerBetter} />
        </div>
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <div className="flex-1 min-w-0">
            <SearchFilter value={searchQuery} onChange={setSearchQuery} placeholder="Search by name..." />
          </div>
          <MultiArtistFilter artists={uniqueArtists} selected={selectedArtists} onChange={setSelectedArtists} />
        </div>
      </section>

      {/* Summary Cards */}
      {categories.length > 0 && (
        <section className="mb-8">
          <div className="text-xs uppercase text-muted-foreground font-bold tracking-widest mb-3">Overview</div>
          <SummaryCards categories={categories} chartKind={chartsConfig[selectedChart]?.kind ?? "song"} />
        </section>
      )}

      {/* Results count + Grid download */}
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs text-muted-foreground">
          {filteredRecords.length} record{filteredRecords.length !== 1 ? "s" : ""} found
          {selectedYear !== "all" && ` in ${selectedYear}`}
          {selectedArtists.length > 0 && ` by ${selectedArtists.length} artist${selectedArtists.length !== 1 ? "s" : ""}`}
          {searchQuery && ` matching "${searchQuery}"`}
        </div>
        {filteredRecords.length > 0 && (
          <StatsGridImage
            records={filteredRecords}
            title={activeCategory?.title ?? "Stats"}
            chartId={selectedChart}
            kind={chartsConfig[selectedChart]?.kind ?? "song"}
          />
        )}
      </div>

      {/* Records List */}
      <section className="space-y-2 sm:space-y-2.5">
        {displayedRecords.length > 0 ? (
            displayedRecords.map((record, i) => (
              <RecordRow
                key={`${record.name}||${record.artist}||${i}`}
                record={record}
                rank={(currentPage - 1) * PAGE_SIZE + i + 1}
                kind={chartsConfig[selectedChart]?.kind ?? "song"}
                chartId={selectedChart}
              />
            ))
          ) : (
            <div className="text-center py-16 text-muted-foreground">
              <i className="fas fa-search text-4xl mb-4 block opacity-30" />
              <p className="font-semibold">No records found</p>
              <p className="text-xs mt-1">Try adjusting your filters or search query</p>
            </div>
          )}
      </section>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8 flex-wrap">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="btn-gold disabled:opacity-30"
          >
            <i className="fas fa-chevron-left" />
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <button
              key={page}
              onClick={() => setCurrentPage(page)}
              className={`w-9 h-9 rounded-lg font-bold text-xs transition-all ${
                currentPage === page
                  ? "bg-[var(--accent)] text-black"
                  : "bg-[var(--card)] border border-[var(--border)] text-[var(--foreground)] hover:border-[var(--accent)]"
              }`}
            >
              {page}
            </button>
          ))}
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="btn-gold disabled:opacity-30"
          >
            <i className="fas fa-chevron-right" />
          </button>
        </div>
      )}

      {/* Back to top */}
      <div className="text-center mt-8">
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="text-xs text-muted-foreground hover:text-[var(--accent)] transition-colors"
        >
          <i className="fas fa-arrow-up mr-1" /> Back to top
        </button>
      </div>
    </div>
  );
}
