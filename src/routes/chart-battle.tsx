import { createFileRoute } from "@tanstack/react-router";
import { getAllArtistStats } from "@/lib/charts.functions";
import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getSpotifyImage } from "@/lib/spotify.functions";
import React from "react";

export const Route = createFileRoute("/chart-battle")({
  loader: async () => {
    const all = await getAllArtistStats();
    return { artists: Object.values(all).map(a => a.name).sort(), stats: all };
  },
  head: () => ({
    meta: [
      { title: "Chart Battle | daegon charts" },
      { name: "description", content: "Compare two artists in a head-to-head chart battle!" }
    ]
  }),
  component: ChartBattlePage,
});

function parseNumber(str?: string | null): number {
  if (!str) return 0;
  return parseFloat(str.replace(/[^\d.-]/g, "")) || 0;
}

function ArtistSelect({ label, value, onChange, options }: { label: string, value: string | null, onChange: (v: string | null) => void, options: string[] }) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    if (!search) return options.slice(0, 50);
    return options.filter(o => o.toLowerCase().includes(search.toLowerCase())).slice(0, 50);
  }, [search, options]);

  return (
    <div className="relative w-full text-left">
      <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">{label}</label>
      {value ? (
        <div className="flex items-center justify-between bg-[var(--muted)] text-[var(--foreground)] border border-[var(--border)] p-3 rounded-lg">
          <span className="font-bold truncate">{value}</span>
          <button onClick={() => onChange(null)} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] shrink-0 ml-2"><i className="fas fa-times" /></button>
        </div>
      ) : (
        <div>
          <div className="relative">
            <i className="fas fa-search absolute left-3 top-3.5 text-[var(--muted-foreground)]" />
            <input
              type="text"
              placeholder="Search artist..."
              className="w-full bg-[var(--muted)] border border-[var(--border)] rounded-lg py-3 pl-9 pr-3 text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)]"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={() => setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 200)}
            />
          </div>
          {open && (
            <div className="absolute z-10 w-full mt-1 bg-[var(--card)] text-[var(--foreground)] border border-[var(--border)] rounded-lg shadow-xl max-h-60 overflow-y-auto">
              {filtered.map(opt => (
                <div
                  key={opt}
                  className="px-4 py-2 hover:bg-[var(--muted)] hover:text-[var(--foreground)] cursor-pointer text-sm"
                  onMouseDown={() => {
                    onChange(opt);
                    setSearch("");
                    setOpen(false);
                  }}
                >
                  {opt}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ArtistAvatar({ name }: { name: string }) {
  const [url, setUrl] = useState<string | null>(null);
  
  React.useEffect(() => {
    let active = true;
    let query = `artist:"${name}"`;
    if (/^ja[oã]$/i.test(name)) query = 'artist:"Jão"';
    if (/^anitta$/i.test(name)) query = 'artist:"Anitta"';

    getSpotifyImage({ data: { query, type: "artist" } }).then((u) => {
      if (active && u) setUrl(u);
    });
    return () => { active = false; };
  }, [name]);

  if (url) return <img src={url} alt={name} className="w-full h-full object-cover animate-fade-in" />;
  return <div className="w-full h-full flex items-center justify-center bg-[var(--muted)]"><i className="fas fa-user text-4xl text-[var(--muted-foreground)] animate-pulse" /></div>;
}

function ChartBattlePage() {
  const { artists, stats } = Route.useLoaderData();
  const [artist1, setArtist1] = useState<string | null>(null);
  const [artist2, setArtist2] = useState<string | null>(null);
  const [selectedChart, setSelectedChart] = useState<string>("All");
  const [battleStarted, setBattleStarted] = useState(false);

  const getStatsFor = (artistName: string | null) => {
    if (!artistName) return null;
    const a = stats[artistName];
    if (!a) return null;

    let totalNo1s = 0;
    let totalTop10s = 0;
    let totalWeeks = 0;
    let totalEntries = 0;
    let totalUnits = 0;

    const chartsToProcess = selectedChart === "All" ? Object.keys(a.chartsByKind) : [selectedChart];

    for (const c of chartsToProcess) {
      const entries = a.chartsByKind[c] || [];
      totalNo1s += entries.filter(e => e.peak === 1).length;
      totalTop10s += entries.filter(e => e.peak >= 1 && e.peak <= 10).length;
      totalWeeks += entries.reduce((acc, e) => acc + e.weeks, 0);
      totalEntries += entries.length;
      totalUnits += entries.reduce((acc, e) => acc + parseNumber(e.unitsSold || e.totalUnits), 0);
    }

    return { totalNo1s, totalTop10s, totalWeeks, totalEntries, totalUnits };
  };

  const s1 = getStatsFor(artist1);
  const s2 = getStatsFor(artist2);

  let p1 = 0;
  let p2 = 0;

  if (s1 && s2) {
    if (s1.totalNo1s > s2.totalNo1s) p1++; else if (s2.totalNo1s > s1.totalNo1s) p2++;
    if (s1.totalTop10s > s2.totalTop10s) p1++; else if (s2.totalTop10s > s1.totalTop10s) p2++;
    if (s1.totalWeeks > s2.totalWeeks) p1++; else if (s2.totalWeeks > s1.totalWeeks) p2++;
    if (s1.totalEntries > s2.totalEntries) p1++; else if (s2.totalEntries > s1.totalEntries) p2++;
    if (s1.totalUnits > s2.totalUnits) p1++; else if (s2.totalUnits > s1.totalUnits) p2++;
  }

  const handleFight = () => {
    if (artist1 && artist2) setBattleStarted(true);
  };

  const handleReset = () => {
    setArtist1(null);
    setArtist2(null);
    setBattleStarted(false);
  };

  const allAvailableCharts = useMemo(() => {
    const set = new Set<string>();
    if (artist1 && stats[artist1]) Object.keys(stats[artist1].chartsByKind).forEach(c => set.add(c));
    if (artist2 && stats[artist2]) Object.keys(stats[artist2].chartsByKind).forEach(c => set.add(c));
    return ["All", ...Array.from(set).sort()];
  }, [artist1, artist2, stats]);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-16">
      <div className="relative text-center py-10 md:py-14 mb-8 overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
          <span className="text-[6rem] md:text-[10rem] font-black text-[var(--foreground)] opacity-[0.06] font-sans uppercase tracking-tighter leading-none">BATTLE</span>
        </div>
        <h1 className="text-4xl sm:text-5xl md:text-7xl font-black gold tracking-tight relative z-10 uppercase"><i className="fas fa-bolt mr-3"></i>Chart Battle</h1>
        <p className="text-muted-foreground text-sm md:text-base mt-3 relative z-10">Select two artists and a chart to see who dominates</p>
      </div>

      {!battleStarted ? (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 shadow-2xl max-w-2xl mx-auto">
          <div className="flex flex-col md:flex-row gap-6 items-center">
            <ArtistSelect label="Artist 1" value={artist1} onChange={setArtist1} options={artists} />
            <div className="text-3xl font-black gold italic shrink-0">VS</div>
            <ArtistSelect label="Artist 2" value={artist2} onChange={setArtist2} options={artists} />
          </div>

          <div className="mt-6">
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2 text-center">Select Chart</label>
            <select 
              value={selectedChart} 
              onChange={e => setSelectedChart(e.target.value)}
              className="w-full bg-[var(--muted)] border border-[var(--border)] rounded-lg p-3 text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)] text-center cursor-pointer"
            >
              {allAvailableCharts.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="mt-8 flex justify-center">
            <button 
              onClick={handleFight} 
              disabled={!artist1 || !artist2}
              className={`px-12 py-4 rounded-full text-xl font-black tracking-widest uppercase transition-all shadow-xl ${
                artist1 && artist2 
                  ? "bg-[var(--accent)] text-black hover:scale-105 hover:shadow-[0_0_20px_var(--accent)]" 
                  : "bg-[var(--muted)] text-[var(--muted-foreground)] cursor-not-allowed"
              }`}
            >
              Fight!
            </button>
          </div>
        </motion.div>
      ) : (
        <AnimatePresence>
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center">
            
            <button onClick={handleReset} className="mb-6 text-sm text-muted-foreground hover:text-[var(--foreground)] flex items-center gap-2 bg-[var(--muted)] px-4 py-2 rounded-full border border-[var(--border)]">
              <i className="fas fa-redo"></i> New Battle
            </button>

            <div className="flex flex-col md:flex-row items-stretch w-full gap-4 md:gap-0 bg-[var(--card)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-2xl relative">
              
              {/* P1 Column */}
              <div className={`flex-1 flex flex-col p-6 items-center border-b md:border-b-0 md:border-r border-[var(--border)] transition-colors duration-500 ${p1 > p2 ? 'bg-orange-900/20' : ''}`}>
                <div className="w-32 h-32 md:w-48 md:h-48 rounded-full overflow-hidden border-4 border-[var(--border)] shadow-xl mb-4">
                  <ArtistAvatar name={artist1!} />
                </div>
                <h2 className="text-2xl md:text-3xl font-black mb-2 text-center text-[var(--foreground)]">{artist1}</h2>
                <div className="text-6xl font-black gold my-4">{p1}</div>
              </div>

              {/* Center Stats Column */}
              <div className="w-full md:w-64 flex flex-col justify-center bg-[var(--muted)] py-6 z-10 border-y md:border-y-0 border-[var(--border)] shadow-inner">
                <div className="text-center text-xs text-[var(--accent)] uppercase tracking-widest font-bold mb-6 px-4 truncate">
                  {selectedChart}
                </div>
                {[
                  { label: "#1's", v1: s1!.totalNo1s, v2: s2!.totalNo1s },
                  { label: "Top 10's", v1: s1!.totalTop10s, v2: s2!.totalTop10s },
                  { label: "Weeks", v1: s1!.totalWeeks, v2: s2!.totalWeeks },
                  { label: "Entries", v1: s1!.totalEntries, v2: s2!.totalEntries },
                  { label: "Units", v1: s1!.totalUnits.toLocaleString(), v2: s2!.totalUnits.toLocaleString(), num1: s1!.totalUnits, num2: s2!.totalUnits },
                  { label: "Avg. Position", v1: s1!.totalEntries > 0 ? (s1!.totalWeeks / s1!.totalEntries).toFixed(1) : "—", v2: s2!.totalEntries > 0 ? (s2!.totalWeeks / s2!.totalEntries).toFixed(1) : "—", num1: s1!.totalEntries > 0 ? s1!.totalWeeks / s1!.totalEntries : 999, num2: s2!.totalEntries > 0 ? s2!.totalWeeks / s2!.totalEntries : 999, lower: true },
                ].map(stat => (
                  <div key={stat.label} className="mb-5 last:mb-0">
                    <div className="text-[10px] text-center uppercase tracking-widest text-muted-foreground font-bold mb-1">{stat.label}</div>
                    <div className="flex items-center justify-between px-4">
                      <div className={`font-black text-lg ${(stat.lower ? (stat.num1 ?? 999) < (stat.num2 ?? 999) : (stat.num1 ?? stat.v1) > (stat.num2 ?? stat.v2)) ? 'text-green-400' : 'text-[var(--foreground)]'}`}>{stat.v1}</div>
                      <div className="text-muted-foreground mx-2"><i className="fas fa-arrows-alt-h text-[10px]"></i></div>
                      <div className={`font-black text-lg ${(stat.lower ? (stat.num2 ?? 999) < (stat.num1 ?? 999) : (stat.num2 ?? stat.v2) > (stat.num1 ?? stat.v1)) ? 'text-green-400' : 'text-[var(--foreground)]'}`}>{stat.v2}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* P2 Column */}
              <div className={`flex-1 flex flex-col p-6 items-center border-t md:border-t-0 md:border-l border-[var(--border)] transition-colors duration-500 ${p2 > p1 ? 'bg-orange-900/20' : ''}`}>
                <div className="w-32 h-32 md:w-48 md:h-48 rounded-full overflow-hidden border-4 border-[var(--border)] shadow-xl mb-4">
                  <ArtistAvatar name={artist2!} />
                </div>
                <h2 className="text-2xl md:text-3xl font-black mb-2 text-center text-[var(--foreground)]">{artist2}</h2>
                <div className="text-6xl font-black gold my-4">{p2}</div>
              </div>
            </div>

            <motion.div 
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.5, type: "spring", bounce: 0.5 }}
              className="mt-8 flex flex-col items-center bg-gradient-to-r from-yellow-500/20 via-yellow-400/30 to-yellow-500/20 border border-yellow-500/50 rounded-2xl px-12 py-6 shadow-[0_0_30px_rgba(234,179,8,0.2)] text-center"
            >
              <i className="fas fa-trophy text-6xl text-yellow-400 mb-4 drop-shadow-[0_0_10px_rgba(234,179,8,0.5)]"></i>
              <div className="text-3xl md:text-5xl font-black uppercase text-[var(--foreground)] tracking-tighter">
                {p1 > p2 ? `${artist1} WINS!` : p2 > p1 ? `${artist2} WINS!` : "IT's A TIE!"}
              </div>
            </motion.div>

          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}
