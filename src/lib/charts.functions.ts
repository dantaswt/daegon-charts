import { createServerFn } from "./client-server-fn";
import Papa from "papaparse";
import { chartsConfig, chartBeatConfig, slugify, slugifyArtist, songSlug, parseSongSlug, weeklyChartIds } from "./charts-config";
import { getSupabase } from "./supabase";

// ─── Points Formula: Rank-based scoring ───
// Points = 1000 × ((N - Rank + 1) / N) ^ 1.5
// N=100 for Hot 100 Songs, N=50 for Top Albums / Artist 50
function computeChartPoints(position: number, chartId: string): number {
  const n = (chartId === "songs" || chartId === "streamingSongs" || chartId === "radioSongs" || chartId === "digitalSongsSales") ? 100 : 50;
  return Math.round(1000 * Math.pow(Math.max(0, (n - position + 1)) / n, 1.5));
}

// ─── DB Layer: reads secondary sheet data (2000-2017) from Supabase ───
// Cache is versioned by chart_data.synced_at. Version checks are short-lived so
// DB replacements propagate quickly, while stale data remains available if a
// serverless cold start hits a transient Supabase timeout.
const secondaryDbCache = new Map<string, { version: string; data: Record<string, ChartEntry[]> | null }>();
const secondaryVersionCache = new Map<string, { version: string; at: number }>();
const SECONDARY_VERSION_TTL = 60 * 1000;

async function getSecondaryVersion(chartId: string): Promise<string> {
  const cachedVersion = secondaryVersionCache.get(chartId);
  if (cachedVersion && Date.now() - cachedVersion.at < SECONDARY_VERSION_TTL) {
    return cachedVersion.version;
  }

  try {
    const sb = getSupabase();
    const { data, error } = await sb
      .from("chart_data")
      .select("synced_at")
      .like("chart_id", `${chartId}_%`)
      .order("synced_at", { ascending: false })
      .limit(1);
    if (error) throw error;
    const version = data?.[0]?.synced_at ?? "none";
    secondaryVersionCache.set(chartId, { version, at: Date.now() });
    return version;
  } catch {
    // Never invalidate a known-good historical cache just because the version
    // probe failed. This is especially important on Vercel cold starts.
    return cachedVersion?.version ?? secondaryDbCache.get(chartId)?.version ?? "unknown";
  }
}

async function loadSecondaryFromDB(chartId: string, knownVersion?: string): Promise<Record<string, ChartEntry[]> | null> {
  const version = knownVersion ?? await getSecondaryVersion(chartId);
  const hit = secondaryDbCache.get(chartId);
  if (hit && hit.version === version && hit.data) return hit.data;

  // Only a handful of rows exist per historical chart (songs_0, songs_200, ...).
  // Fetch them in one request instead of paging. On serverless cold starts this
  // removes several unnecessary network round trips and greatly reduces the
  // chance of showing "Historical chart data unavailable".
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const sb = getSupabase();
      const { data, error } = await sb
        .from("chart_data")
        .select("data")
        .like("chart_id", `${chartId}_%`)
        .order("chart_id");

      if (error) throw error;
      if (!data || data.length === 0) throw new Error("No historical chart rows returned");

      const merged: Record<string, ChartEntry[]> = {};
      for (const row of data as { data: WeeklyChartData }[]) {
        const chunk = row.data as WeeklyChartData;
        if (!chunk.entriesByDate) continue;

        for (const [d, entries] of Object.entries(chunk.entriesByDate)) {
          for (const entry of entries) {
            if (chunk.chartId === "songs") {
              entry.points = String(computeChartPoints(entry.position, "songs"));
            } else {
              if (entry.units == null || entry.units === "") {
                entry.units = String(computeChartPoints(entry.position, chunk.chartId));
              } else {
                entry.units = String(entry.units);
              }
              if (entry.totalUnits != null && entry.totalUnits !== "") {
                entry.totalUnits = String(entry.totalUnits);
              }
            }
          }
          (merged[d] ||= []).push(...entries);
        }
      }

      if (Object.keys(merged).length === 0) {
        throw new Error("Historical chart rows contained no dated entries");
      }

      secondaryDbCache.set(chartId, { version, data: merged });
      return merged;
    } catch {
      // Exponential-ish backoff: 300ms, 700ms, 1500ms before the next try.
      if (attempt < 3) {
        const waits = [300, 700, 1500];
        await new Promise((resolve) => setTimeout(resolve, waits[attempt]));
      }
    }
  }

  // If this warm instance has any previously successful snapshot, serve it
  // rather than breaking the page. Version checks still refresh every minute.
  return hit?.data ?? secondaryDbCache.get(chartId)?.data ?? null;
}

export interface ChartEntry {
  position: number;
  diff: string; // '▲n' '▼n' '=' 'NEW' 'RE' ''
  name: string; // song / album / artist name (item label)
  artist: string;
  album?: string;
  peak: number;
  weeks: number;
  weeksAt1?: number;
  lastWeek?: string;
  points?: string;
  sales?: string;
  streams?: string;
  airplay?: string;
  audience?: string;
  certification?: string;
  units?: string;
  totalUnits?: string;
  totalStreams?: string;
  totalSales?: string;
}

export interface WeeklyChartData {
  chartId: string;
  title: string;
  kind: "song" | "album" | "artist";
  dates: string[]; // sorted asc YYYY-MM-DD
  entriesByDate: Record<string, ChartEntry[]>;
}

export interface YearEndChartData {
  chartId: string;
  title: string;
  kind: "song" | "album" | "artist";
  years: string[]; // desc
  entriesByYear: Record<string, ChartEntry[]>;
}

export interface AlbumDetails {
  name: string;
  artist: string;
  chartRuns: {
    chartId: string;
    chartTitle: string;
    date: string;
    position: number;
    peak: number;
    weeks: number;
    points?: string;
    sales?: string;
    streams?: string;
    certification?: string;
    totalUnits?: string;
  }[];
  chartStats: Record<string, {
    weeksAt1: number;
    top5: number;
    top10: number;
    totalEntries: number;
    totalUnits: number;
    totalSales: number;
    totalStreams: number;
  }>;
  peak: number;
  weeks: number;
  totalUnits?: string;
  totalSales?: string;
  totalStreams?: string;
  certification?: string;
  certificationLevel?: string;
  goatPosition?: number;
  goatWeeks?: number;
  yecEntries: Array<{
    year: string;
    chartId: string;
    chartTitle: string;
    position: number;
    peak: number;
    weeks: number;
    totalUnits?: string;
  }>;
  statsRecords: Array<{
    category: string;
    value: string;
    details?: string;
  }>;
}

export interface SongDetails {
  name: string;
  artist: string;
  chartRuns: {
    chartId: string;
    chartTitle: string;
    date: string;
    position: number;
    peak: number;
    weeks: number;
    points?: string;
    sales?: string;
    streams?: string;
    audience?: string;
    certification?: string;
    totalUnits?: string;
  }[];
  chartStats: Record<string, {
    weeksAt1: number;
    top5: number;
    top10: number;
    totalEntries: number;
    totalPoints: number;
    totalSales: number;
    totalStreams: number;
    totalAudience: number;
  }>;
  peak: number;
  weeks: number;
  totalUnits?: string;
  totalPoints?: string;
  totalSales?: string;
  totalStreams?: string;
  totalAudience?: string;
  certification?: string;
  certificationLevel?: string;
  goatPosition?: number;
  goatWeeks?: number;
  yecEntries: Array<{
    year: string;
    chartId: string;
    chartTitle: string;
    position: number;
    peak: number;
    weeks: number;
    totalUnits?: string;
  }>;
  statsRecords: Array<{
    category: string;
    value: string;
    details?: string;
  }>;
}

export interface GoatChartData {
  chartId: string;
  title: string;
  kind: "song" | "album" | "artist";
  entries: ChartEntry[];
}

export interface ChartBeatPost {
  slug: string;
  title: string;
  publicationDate: string;
  artist: string | null;
  fullText: string;
  chartLink: string | null;
  image?: string | null;
}

// simple in-memory cache with TTL and size limit
const cache = new Map<string, { at: number; data: unknown }>();
const inflight = new Map<string, Promise<unknown>>();
const TTL = 5 * 60 * 1000;
const MAX_CACHE = 80;

export function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && now - hit.at < TTL) return Promise.resolve(hit.data as T);
  const inflightHit = inflight.get(key);
  if (inflightHit) return inflightHit as Promise<T>;
  const p = fn().then((data) => {
    cache.set(key, { at: Date.now(), data });
    inflight.delete(key);
    if (cache.size > MAX_CACHE) {
      const oldest = cache.keys().next().value!;
      cache.delete(oldest);
    }
    return data;
  }).catch((err) => { inflight.delete(key); throw err; });
  inflight.set(key, p);
  return p;
}

// In-memory CSV cache: avoids re-fetching from Google Sheets on every request
const csvCache = new Map<string, { data: string[][]; fetchedAt: number }>();
const CSV_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

async function fetchCsv(url: string, retries = 3): Promise<string[][]> {
  const cached = csvCache.get(url);
  if (cached && Date.now() - cached.fetchedAt < CSV_CACHE_TTL) return cached.data;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { headers: { "cache-control": "public, max-age=300" }, signal: AbortSignal.timeout(30_000) });
      if (res.status === 429) {
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }
      }
      if (!res.ok) throw new Error(`CSV fetch failed ${res.status}`);
      let text = await res.text();
      if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
      const parsed = Papa.parse<string[]>(text, { skipEmptyLines: true });
      const data = parsed.data as string[][];
      csvCache.set(url, { data, fetchedAt: Date.now() });
      return data;
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") throw err;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
  throw new Error("CSV fetch failed after retries");
}

function normalizeDate(d: string): string {
  if (!d) return "";
  d = d.trim();
  if (d.includes("/")) {
    const p = d.split("/");
    if (p.length === 3) return `${p[2]}-${p[1].padStart(2, "0")}-${p[0].padStart(2, "0")}`;
  }
  return d;
}

function findIdx(header: string[], keys: string[]): number {
  const lower = header.map((h) => h.toLowerCase().trim());
  for (const k of keys) {
    const i = lower.indexOf(k.toLowerCase());
    if (i !== -1) return i;
  }
  return -1;
}

function toInt(v: string | undefined): number {
  let s = (v ?? "").trim();
  if (!s || s === "-") return 0;
  // Remove non-numeric chars except dots, commas, minus
  s = s.replace(/[^0-9.,\-]/g, "");
  if (!s) return 0;
  // European format: dots as thousand separators (e.g. "3.648.500" or "56.000")
  if (s.includes(".") && (s.match(/\./g) || []).length >= 1) {
    // Multiple dots → definitely thousand separators
    // Single dot followed by exactly 3 digits at end → thousand separator
    if ((s.match(/\./g) || []).length > 1 || /^\d+\.\d{3}$/.test(s)) {
      s = s.replace(/\./g, "");
    }
  }
  // Remove commas (thousand separator in US format)
  s = s.replace(/,/g, "");
  const n = parseInt(s, 10);
  return isNaN(n) ? 0 : n;
}

function parseEuropeanFloat(v: string | undefined): number {
  let s = (v ?? "").trim();
  if (!s || s === "-") return 0;
  s = s.replace(/[^0-9.,\-]/g, "");
  if (!s) return 0;
  if (s.includes(".") && (s.match(/\./g) || []).length > 1) {
    s = s.replace(/\./g, "");
  }
  s = s.replace(/,/g, ".");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function formatNumber(v: number): string {
  return Math.round(v).toLocaleString("en-US");
}

function formatTotalUnits(v: string | undefined): string | undefined {
  if (!v) return undefined;
  const n = toInt(v);
  return n > 0 ? n.toLocaleString("en-US") : undefined;
}

export function getCertificationLevel(units: number, type: "song" | "album"): string | undefined {
  if (type === "song") {
    if (units >= 12_000_000) return "2x Diamond";
    if (units >= 6_000_000) return "Diamond";
    if (units >= 600_000) {
      const x = Math.floor(units / 600_000);
      return x >= 2 ? `${x}x Platinum` : "Platinum";
    }
    if (units >= 400_000) return "Gold";
    if (units >= 200_000) return "Silver";
  } else {
    if (units >= 20_000_000) return "2x Diamond";
    if (units >= 10_000_000) return "Diamond";
    if (units >= 1_000_000) {
      const x = Math.floor(units / 1_000_000);
      return x >= 2 ? `${x}x Platinum` : "Platinum";
    }
    if (units >= 500_000) return "Gold";
  }
  return undefined;
}

export function getCertificationMeta(level: string | undefined): { color: string; bg: string; border: string } | undefined {
  if (!level) return undefined;
  if (level.includes("Diamond")) return { color: "text-cyan-600 dark:text-cyan-400", bg: "bg-cyan-50 dark:bg-cyan-900/20", border: "border-cyan-200 dark:border-cyan-800" };
  if (level === "Platinum") return { color: "text-gray-600 dark:text-gray-300", bg: "bg-gray-100 dark:bg-gray-800", border: "border-gray-300 dark:border-gray-700" };
  if (level === "Gold") return { color: "text-yellow-600 dark:text-yellow-400", bg: "bg-yellow-50 dark:bg-yellow-900/20", border: "border-yellow-200 dark:border-yellow-800" };
  if (level === "Silver") return { color: "text-gray-500 dark:text-gray-400", bg: "bg-gray-50 dark:bg-gray-900", border: "border-gray-200 dark:border-gray-700" };
  // Nx Platinum
  return { color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-50 dark:bg-violet-900/20", border: "border-violet-200 dark:border-violet-800" };
}

const mbCharts = new Set(["radioSongs", "topStreamingAlbums", "streamingSongs"]);
const usFormatCharts = new Set(["songs", "digitalSongsSales", "topAlbumSales", "albums", "artists"]);

function formatMetric(value: number, chartId: string): string {
  if (value <= 0) return "0";
  if (mbCharts.has(chartId)) {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}B`;
    if (value >= 1_000) return `${Math.round(value / 1_000)}M`;
    return String(value);
  }
  return value.toLocaleString("en-US");
}

function computeDiffs(dates: string[], entriesByDate: Record<string, ChartEntry[]>) {
  const seenBefore = new Map<string, string>(); // key -> first date
  for (const date of dates) {
    const prev = dates[dates.indexOf(date) - 1];
    const prevMap = new Map<string, number>();
    if (prev) for (const e of entriesByDate[prev]) prevMap.set(`${e.name.toLowerCase()}|${e.artist.toLowerCase()}`, e.position);
    for (const e of entriesByDate[date]) {
      const key = `${e.name.toLowerCase()}|${e.artist.toLowerCase()}`;
      const p = prevMap.get(key);
      if (p == null) {
        e.diff = seenBefore.has(key) ? "RE" : "NEW";
      } else {
        const d = p - e.position;
        e.diff = d > 0 ? `▲${d}` : d < 0 ? `▼${Math.abs(d)}` : "=";
      }
      if (!seenBefore.has(key)) seenBefore.set(key, date);
    }
  }
}

export async function loadWeekly(chartId: string): Promise<WeeklyChartData> {
  const cfg = chartsConfig[chartId];
  const ALBUM_NAME_OVERRIDES: Record<string, Record<string, string>> = {
    "anitta": { "versions of me": "Girl from Rio" },
    "waneesa": { "w (2005)": "W", "w": "W" },
  };

  function parseSheet(rows: string[][]): Record<string, ChartEntry[]> {
    const header = rows[0].map((h) => h.toLowerCase().trim());
    const idx = {
      date: findIdx(header, ["date", "chart date"]),
      position: findIdx(header, ["position", "rank", "pos"]),
      diff: findIdx(header, ["dif", "diff", "▲▼"]),
      song: findIdx(header, ["song", "title", "track"]),
      album: findIdx(header, ["album"]),
      artist: findIdx(header, ["artist", "artists"]),
      lastWeek: findIdx(header, ["last week", "lw", "last wk", "prev week", "previous week"]),
      peak: findIdx(header, ["peak"]),
      weeks: findIdx(header, ["weeks", "wks"]),
      weeksAt1: findIdx(header, ["weeks at 1", "wks at 1", "week at #1", "week at 1", "weeks at #1"]),
      points: findIdx(header, ["points"]),
      sales: findIdx(header, ["sales", "sales/streams", "sales/streaming", "pure sales"]),
      streams: findIdx(header, ["streams", "sea", "streaming"]),
      airplay: findIdx(header, ["airplay"]),
      audience: findIdx(header, ["audience"]),
      certification: findIdx(header, ["certification"]),
      units: findIdx(header, ["units", "spins", "sales", "streams", "audience"]),
      totalUnits: findIdx(header, ["total units", "total"]),
      totalStreams: findIdx(header, ["total streams", "total streaming"]),
      totalSales: findIdx(header, ["total sales"]),
    };
    if (cfg.id === "radioSongs") {
      const a = header.indexOf("audience");
      if (a !== -1) idx.units = a;
    }
    const nameIdx = cfg.kind === "artist" ? idx.artist : cfg.kind === "album" ? idx.album : idx.song;
    const result: Record<string, ChartEntry[]> = {};
    for (const r of rows.slice(1)) {
      const date = normalizeDate(r[idx.date]);
      if (!date) continue;
      const rawName = (r[nameIdx] ?? "").trim();
      const rawArtist = (r[idx.artist] ?? "").trim();
      const finalName = ALBUM_NAME_OVERRIDES[rawArtist.toLowerCase()]?.[rawName.toLowerCase()] || rawName;
      const entry: ChartEntry = {
        position: toInt(r[idx.position]),
        diff: idx.diff >= 0 ? (r[idx.diff] ?? "") : "",
        name: finalName,
        artist: rawArtist,
        album: idx.album >= 0 ? (r[idx.album] ?? "").trim() : undefined,
        peak: toInt(r[idx.peak]),
        weeks: toInt(r[idx.weeks]),
        weeksAt1: idx.weeksAt1 >= 0 ? toInt(r[idx.weeksAt1]) : undefined,
        lastWeek: idx.lastWeek >= 0 ? r[idx.lastWeek] : undefined,
        points: idx.points >= 0 ? r[idx.points] : undefined,
        sales: idx.sales >= 0 ? r[idx.sales] : undefined,
        streams: idx.streams >= 0 ? r[idx.streams] : undefined,
        airplay: idx.airplay >= 0 ? r[idx.airplay] : undefined,
        audience: idx.audience >= 0 ? r[idx.audience] : undefined,
        certification: idx.certification >= 0 ? r[idx.certification] : undefined,
        units: idx.units >= 0 ? r[idx.units] : undefined,
        totalUnits: idx.totalUnits >= 0 ? r[idx.totalUnits] : undefined,
        totalStreams: idx.totalStreams >= 0 ? r[idx.totalStreams] : undefined,
        totalSales: idx.totalSales >= 0 ? r[idx.totalSales] : undefined,
      };
      if (!entry.name || !entry.position) continue;
      (result[date] ||= []).push(entry);
    }
    return result;
  }

  // Fetch primary from CSV, secondary from DB (cached in memory, instant after first load)
  const [primaryRows, secondaryFromDB] = await Promise.all([
    fetchCsv(cfg.url),
    cfg.secondaryUrl ? loadSecondaryFromDB(chartId) : Promise.resolve(null),
  ]);
  const entriesByDate = parseSheet(primaryRows);
  if (secondaryFromDB) {
    for (const [d, entries] of Object.entries(secondaryFromDB)) {
      (entriesByDate[d] ||= []).push(...entries);
    }
  } else if (cfg.secondaryUrl) {
    // Fallback: fetch secondary CSV if DB not populated
    const secondaryRows = await fetchCsv(cfg.secondaryUrl);
    const entries2 = parseSheet(secondaryRows);
    for (const [d, entries] of Object.entries(entries2)) {
      (entriesByDate[d] ||= []).push(...entries);
    }
  }
  const dates = Object.keys(entriesByDate).sort();
  for (const d of dates) {
    entriesByDate[d].sort((a, b) => a.position - b.position);
    const seen = new Map<string, ChartEntry>();
    for (const e of entriesByDate[d]) {
      const key = `${e.name.toLowerCase()}|${e.artist.toLowerCase()}`;
      const existing = seen.get(key);
      if (existing) {
        if (e.position < existing.position) {
          entriesByDate[d] = entriesByDate[d].filter((x) => x !== existing);
          seen.set(key, e);
        } else {
          entriesByDate[d] = entriesByDate[d].filter((x) => x !== e);
        }
      } else {
        seen.set(key, e);
      }
    }
  }

  if (cfg.secondaryUrl) {
    const runningState = new Map<string, { weeks: number; peak: number; weeksAt1: number }>();
    const prevDatePositions = new Map<string, number>();

    for (const d of dates) {
      for (const e of entriesByDate[d]) {
        const key = `${e.name.toLowerCase()}|${e.artist.toLowerCase()}`;
        const state = runningState.get(key) ?? { weeks: 0, peak: Infinity, weeksAt1: 0 };

        state.weeks++;
        state.peak = Math.min(state.peak, e.position);
        if (e.position === 1) state.weeksAt1++;

        e.lastWeek = prevDatePositions.has(key) ? String(prevDatePositions.get(key)!) : undefined;
        e.weeks = state.weeks;
        e.peak = state.peak;
        e.weeksAt1 = state.weeksAt1 > 0 ? state.weeksAt1 : undefined;

        runningState.set(key, state);
      }

      prevDatePositions.clear();
      for (const e of entriesByDate[d]) {
        prevDatePositions.set(`${e.name.toLowerCase()}|${e.artist.toLowerCase()}`, e.position);
      }
    }
  }

  computeDiffs(dates, entriesByDate);
  return { chartId, title: cfg.title, kind: cfg.kind, dates, entriesByDate };
}

async function loadYearEnd(chartId: string): Promise<YearEndChartData> {
  const cfg = chartsConfig[chartId];
  const rows = await fetchCsv(cfg.url);
  const header = rows[0].map((h) => h.toLowerCase().trim());
  const idx = {
    year: findIdx(header, ["year", "ano"]),
    position: findIdx(header, ["position", "rank", "pos"]),
    song: findIdx(header, ["song", "title", "track"]),
    album: findIdx(header, ["album"]),
    artist: findIdx(header, ["artist", "artists"]),
    peak: findIdx(header, ["peak"]),
    weeks: findIdx(header, ["weeks", "wks"]),
    points: findIdx(header, ["points"]),
    units: findIdx(header, ["units", "spins", "sales", "streams", "audience", "total audience"]),
    totalUnits: findIdx(header, ["total units", "total", "total audience"]),
    totalStreams: findIdx(header, ["total streams", "total streaming"]),
    totalSales: findIdx(header, ["total sales"]),
    certification: findIdx(header, ["certification"]),
  };
  const nameIdx = cfg.kind === "artist" ? idx.artist : cfg.kind === "album" ? idx.album : idx.song;
  const entriesByYear: Record<string, ChartEntry[]> = {};
  for (const r of rows.slice(1)) {
    const year = (r[idx.year] ?? "").trim();
    if (!year) continue;
    const entry: ChartEntry = {
      position: toInt(r[idx.position]),
      diff: "",
      name: (r[nameIdx] ?? "").trim(),
      artist: (r[idx.artist] ?? "").trim(),
      album: idx.album >= 0 ? (r[idx.album] ?? "").trim() : undefined,
      peak: toInt(r[idx.peak]),
      weeks: toInt(r[idx.weeks]),
      points: idx.points >= 0 ? r[idx.points] : undefined,
      units: idx.units >= 0 ? r[idx.units] : undefined,
      totalUnits: idx.totalUnits >= 0 ? r[idx.totalUnits] : undefined,
      certification: idx.certification >= 0 ? r[idx.certification] : undefined,
      totalStreams: idx.totalStreams >= 0 ? r[idx.totalStreams] : undefined,
      totalSales: idx.totalSales >= 0 ? r[idx.totalSales] : undefined,
    };
    if (!entry.name || !entry.position) continue;
    (entriesByYear[year] ||= []).push(entry);
  }
  const years = Object.keys(entriesByYear).sort((a, b) => Number(b) - Number(a));
  for (const y of years) entriesByYear[y].sort((a, b) => a.position - b.position);
  return { chartId, title: cfg.title, kind: cfg.kind, years, entriesByYear };
}

async function loadGoat(chartId: string): Promise<GoatChartData> {
  const cfg = chartsConfig[chartId];
  const rows = await fetchCsv(cfg.url);
  const header = rows[0].map((h) => h.toLowerCase().trim());
  const idx = {
    position: findIdx(header, ["position", "rank", "pos", "all-time rank"]),
    song: findIdx(header, ["song", "title", "track"]),
    album: findIdx(header, ["album"]),
    artist: findIdx(header, ["artist", "artists"]),
    peak: findIdx(header, ["peak"]),
    weeks: findIdx(header, ["weeks", "wks", "total weeks"]),
    totalUnits: findIdx(header, ["total units", "total", "total audience"]),
  };
  const nameIdx = cfg.kind === "artist" ? idx.artist : cfg.kind === "album" ? idx.album : idx.song;
  const entries: ChartEntry[] = [];
  for (const r of rows.slice(1)) {
    const entry: ChartEntry = {
      position: toInt(r[idx.position]),
      diff: "",
      name: (r[nameIdx] ?? "").trim(),
      artist: (r[idx.artist] ?? "").trim(),
      album: idx.album >= 0 ? (r[idx.album] ?? "").trim() : undefined,
      peak: toInt(r[idx.peak]),
      weeks: toInt(r[idx.weeks]),
      totalUnits: idx.totalUnits >= 0 ? r[idx.totalUnits] : undefined,
    };
    if (!entry.name || !entry.position) continue;
    entries.push(entry);
  }
  entries.sort((a, b) => a.position - b.position);
  return { chartId, title: cfg.title, kind: cfg.kind, entries };
}

async function loadAlbumDetails(slug: string): Promise<AlbumDetails | null> {
  const albumChartIds = ["albums", "topStreamingAlbums", "topAlbumSales"];
  const albumRuns: AlbumDetails["chartRuns"] = [];
  let albumName = "";
  let albumArtist = "";
  let bestPeak = Number.MAX_SAFE_INTEGER;
  let bestWeeks = 0;
  let totalUnits: string | undefined;
  let certification: string | undefined;
  let totalUnitsRaw = 0;

  let albumUnitsRaw = 0;
  let albumStreamsRaw = 0;
  let albumSalesRaw = 0;

  // Per-chart stats accumulator
  const chartStatsAcc: Record<string, { weeksAt1: number; top5: number; top10: number; totalEntries: number; totalUnits: number; totalSales: number; totalStreams: number }> = {};

  for (const chartId of albumChartIds) {
    const chartData = await loadWeekly(chartId);
    let chartSales = 0;
    let chartStreams = 0;
    let weeksAt1 = 0;
    let top5 = 0;
    let top10 = 0;
    let totalEntries = 0;
    for (const date of chartData.dates) {
      for (const entry of chartData.entriesByDate[date]) {
        if (slugify(entry.name) !== slug) continue;
        albumName ||= entry.name;
        albumArtist ||= entry.artist;
        if (chartId === "albums") {
          if (entry.peak > 0 && entry.peak < bestPeak) bestPeak = entry.peak;
          bestWeeks = Math.max(bestWeeks, entry.weeks);
        }
        certification ||= entry.certification;
        if (chartId === "albums") { totalUnits = entry.totalUnits; totalUnitsRaw = toInt(entry.totalUnits); }
        const s = toInt(entry.sales);
        const st = toInt(entry.streams);
        chartSales += s;
        chartStreams += st;
        totalEntries++;
        if (entry.position === 1) weeksAt1++;
        if (entry.position <= 5) top5++;
        if (entry.position <= 10) top10++;
        albumRuns.push({
          chartId,
          chartTitle: chartsConfig[chartId].title,
          date,
          position: entry.position,
          peak: entry.peak,
          weeks: entry.weeks,
          points: entry.points,
          sales: entry.sales,
          streams: entry.streams,
          certification: entry.certification,
          totalUnits: entry.totalUnits,
        });
      }
    }
    if (chartId === "topStreamingAlbums") albumStreamsRaw = chartStreams;
    if (chartId === "topAlbumSales") albumSalesRaw = chartSales;
    chartStatsAcc[chartId] = { weeksAt1, top5, top10, totalEntries, totalUnits: chartSales + chartStreams, totalSales: chartSales, totalStreams: chartStreams };
  }

  if (!albumName) {
    return null;
  }

  // YEC entries
  const yecEntries: AlbumDetails["yecEntries"] = [];
  const yecChartIds = ["yearEndAlbums", "yearEndTopStreamingAlbums", "yearEndTopAlbumSales"];
  for (const yecId of yecChartIds) {
    const cfg = chartsConfig[yecId];
    if (!cfg || cfg.url.endsWith("&gid=0")) continue;
    try {
      const yearEndData = await loadYearEnd(yecId);
      for (const year of yearEndData.years) {
        for (const entry of yearEndData.entriesByYear[year]) {
          if (slugify(entry.name) === slug) {
            yecEntries.push({
              year,
              chartId: yecId,
              chartTitle: cfg.title,
              position: entry.position,
              peak: entry.peak,
              weeks: entry.weeks,
              totalUnits: entry.totalUnits,
            });
            if (entry.peak > 0 && entry.peak < bestPeak) bestPeak = entry.peak;
            bestWeeks = Math.max(bestWeeks, entry.weeks);
          }
        }
      }
    } catch {}
  }
  yecEntries.sort((a, b) => Number(b.year) - Number(a.year) || a.position - b.position);

  // GOAT position
  let goatPosition: number | undefined;
  let goatWeeks: number | undefined;
  try {
    const goatData = await loadGoat("goatAlbums");
    for (const entry of goatData.entries) {
      if (slugify(entry.name) === slug) {
        goatPosition = entry.position;
        goatWeeks = entry.weeks;
        break;
      }
    }
  } catch {}

  // Stats records
  const statsRecords: AlbumDetails["statsRecords"] = [];
  try {
    const statsCfg = chartsConfig.statsData;
    const rows = await fetchCsv(statsCfg.url);
    const header = rows[0].map((h) => h.toLowerCase().trim());
    const catIdx = findIdx(header, ["stats", "category"]);
    const itemIdx = findIdx(header, ["artist/song", "item", "title", "name"]);
    const numIdx = findIdx(header, ["number", "value", "total", "count"]);
    for (const r of rows.slice(1)) {
      const item = (r[itemIdx] ?? "").trim();
      if (slugify(item) === slug) {
        statsRecords.push({
          category: (r[catIdx] ?? "").trim(),
          value: (r[numIdx] ?? "").trim(),
        });
      }
    }
  } catch {}

  return {
    name: albumName,
    artist: albumArtist,
    peak: bestPeak === Number.MAX_SAFE_INTEGER ? 0 : bestPeak,
    weeks: bestWeeks,
    totalUnits: formatTotalUnits(totalUnits),
    totalSales: albumSalesRaw > 0 ? formatMetric(albumSalesRaw, "topAlbumSales") : undefined,
    totalStreams: albumStreamsRaw > 0 ? formatMetric(albumStreamsRaw, "topStreamingAlbums") : undefined,
    certification,
    certificationLevel: getCertificationLevel(totalUnitsRaw, "album"),
    goatPosition,
    goatWeeks,
    yecEntries,
    statsRecords,
    chartStats: chartStatsAcc,
    chartRuns: albumRuns.sort((a, b) => a.date.localeCompare(b.date)),
  };
}

export const getHistoricalWeeklyChart = createServerFn({ method: "GET" })
  .inputValidator((d: { chartId: string }) => d)
  .handler(async ({ data }) => {
    if (!["songs", "artists", "albums"].includes(data.chartId)) throw new Error("Historical chart unavailable");

    const version = await getSecondaryVersion(data.chartId);
    return cached(`historical-weekly:${data.chartId}:${version}`, async () => {
      const raw = await loadSecondaryFromDB(data.chartId, version);
      if (!raw) throw new Error("Historical chart data unavailable");

      const entriesByDate: Record<string, ChartEntry[]> = {};
      for (const [date, entries] of Object.entries(raw)) {
        entriesByDate[date] = entries.map((entry) => ({ ...entry })).sort((a, b) => a.position - b.position);
      }

      const dates = Object.keys(entriesByDate).sort();
      const runningState = new Map<string, { weeks: number; peak: number; weeksAt1: number }>();
      const prevDatePositions = new Map<string, number>();

      for (const date of dates) {
        for (const entry of entriesByDate[date]) {
          const key = `${entry.name.toLowerCase()}|${entry.artist.toLowerCase()}`;
          const state = runningState.get(key) ?? { weeks: 0, peak: Infinity, weeksAt1: 0 };

          state.weeks++;
          state.peak = Math.min(state.peak, entry.position);
          if (entry.position === 1) state.weeksAt1++;

          entry.lastWeek = prevDatePositions.has(key) ? String(prevDatePositions.get(key)!) : undefined;
          entry.weeks = state.weeks;
          entry.peak = state.peak;
          entry.weeksAt1 = state.weeksAt1 > 0 ? state.weeksAt1 : undefined;
          runningState.set(key, state);
        }

        prevDatePositions.clear();
        for (const entry of entriesByDate[date]) {
          prevDatePositions.set(`${entry.name.toLowerCase()}|${entry.artist.toLowerCase()}`, entry.position);
        }
      }

      computeDiffs(dates, entriesByDate);
      const cfg = chartsConfig[data.chartId];
      return { chartId: data.chartId, title: cfg.title, kind: cfg.kind, dates, entriesByDate };
    });
  });

export const getWeeklyChart = createServerFn({ method: "GET" })
  .inputValidator((d: { chartId: string }) => d)
  .handler(async ({ data }) => {
    if (!weeklyChartIds.includes(data.chartId)) throw new Error("Unknown chart");

    if (chartsConfig[data.chartId]?.secondaryUrl) {
      const version = await getSecondaryVersion(data.chartId);
      return cached(`weekly:${data.chartId}:${version}`, () => loadWeekly(data.chartId));
    }

    return cached(`weekly:${data.chartId}`, () => loadWeekly(data.chartId));
  });

export const getYearEndChart = createServerFn({ method: "GET" })
  .inputValidator((d: { chartId: string }) => d)
  .handler(async ({ data }) => cached(`ye:${data.chartId}`, () => loadYearEnd(data.chartId)));

export const getGoatChart = createServerFn({ method: "GET" })
  .inputValidator((d: { chartId: string }) => d)
  .handler(async ({ data }) => cached(`goat:${data.chartId}`, () => loadGoat(data.chartId)));

export const getAlbumDetails = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => d)
  .handler(async ({ data }) => cached(`album:${data.slug}`, () => loadAlbumDetails(data.slug)));

async function loadSongDetails(slug: string): Promise<SongDetails | null> {
  const songChartIds = ["songs", "digitalSongsSales", "streamingSongs", "radioSongs"];
  const songRuns: SongDetails["chartRuns"] = [];
  let songName = "";
  let songArtist = "";
  let bestPeak = Number.MAX_SAFE_INTEGER;
  let bestWeeks = 0;
  let certification: string | undefined;
  let totalUnits: string | undefined;
  let totalUnitsRaw = 0;

  const totalPoints = { raw: 0, formatted: "" };
  const totalSales = { raw: 0, formatted: "" };
  const totalStreams = { raw: 0, formatted: "" };
  const totalAudience = { raw: 0, formatted: "" };

  const chartStatsAcc: Record<string, { weeksAt1: number; top5: number; top10: number; totalEntries: number; totalPoints: number; totalSales: number; totalStreams: number; totalAudience: number }> = {};

  const parsed = parseSongSlug(slug);
  const matchName = parsed ? parsed.nameSlug : slug;
  const matchArtist = parsed ? parsed.artistSlug : null;

  const yecChartIds = ["yearEndSongs", "yearEndRadio", "yearEndStreamingSongs", "yearEndDigitalSongsSales"];

  const [allCharts, allYecData, allGoatData, statsRows] = await Promise.all([
    Promise.all(songChartIds.map((id) => loadWeekly(id))),
    Promise.all(yecChartIds.map((id) => {
      const cfg = chartsConfig[id];
      if (!cfg || cfg.url.endsWith("&gid=0")) return Promise.resolve(null);
      return loadYearEnd(id).catch(() => null);
    })),
    Promise.all(["goatSongs", "goatRadio"].map((id) => loadGoat(id).catch(() => null))),
    fetchCsv(chartsConfig.statsData.url).catch(() => null),
  ]);

  for (let ci = 0; ci < songChartIds.length; ci++) {
    const chartId = songChartIds[ci];
    const chartData = allCharts[ci];
    let chartPoints = 0;
    let chartSales = 0;
    let chartStreams = 0;
    let chartAudience = 0;
    let weeksAt1 = 0;
    let top5 = 0;
    let top10 = 0;
    let totalEntries = 0;
    for (const date of chartData.dates) {
      for (const entry of chartData.entriesByDate[date]) {
        const nameMatch = slugify(entry.name) === matchName;
        const artistMatch = matchArtist ? slugify(entry.artist) === matchArtist : true;
        if (!nameMatch || !artistMatch) continue;
        songName ||= entry.name;
        songArtist ||= entry.artist;
        if (chartId === "songs") {
          if (entry.peak > 0 && entry.peak < bestPeak) bestPeak = entry.peak;
          bestWeeks = Math.max(bestWeeks, entry.weeks);
        }
        certification ||= entry.certification;
        if (chartId === "songs") { totalUnits = entry.totalUnits; totalUnitsRaw = toInt(entry.totalUnits); }
        const p = toInt(entry.points);
        const s = toInt(entry.sales);
        const st = toInt(entry.streams);
        const a = toInt(entry.audience);
        chartPoints += p;
        chartSales += s;
        chartStreams += st;
        chartAudience += a;
        totalEntries++;
        if (entry.position === 1) weeksAt1++;
        if (entry.position <= 5) top5++;
        if (entry.position <= 10) top10++;
        songRuns.push({
          chartId,
          chartTitle: chartsConfig[chartId].title,
          date,
          position: entry.position,
          peak: entry.peak,
          weeks: entry.weeks,
          points: entry.points,
          sales: entry.sales,
          streams: entry.streams,
          audience: entry.audience,
          certification: entry.certification,
          totalUnits: entry.totalUnits,
        });
      }
    }
    if (chartId === "songs") totalPoints.raw = chartPoints;
    if (chartId === "digitalSongsSales") totalSales.raw = chartSales;
    if (chartId === "streamingSongs") totalStreams.raw = chartStreams;
    if (chartId === "radioSongs") totalAudience.raw = chartAudience;
    chartStatsAcc[chartId] = { weeksAt1, top5, top10, totalEntries, totalPoints: chartPoints, totalSales: chartSales, totalStreams: chartStreams, totalAudience: chartAudience };
  }

  if (!songName) return null;

  totalPoints.formatted = totalPoints.raw > 0 ? totalPoints.raw.toLocaleString("en-US") : "";
  totalSales.formatted = totalSales.raw > 0 ? formatMetric(totalSales.raw, "digitalSongsSales") : "";
  totalStreams.formatted = totalStreams.raw > 0 ? formatMetric(totalStreams.raw, "streamingSongs") : "";
  totalAudience.formatted = totalAudience.raw > 0 ? formatMetric(totalAudience.raw, "radioSongs") : "";

  const yecEntries: SongDetails["yecEntries"] = [];
  for (let yi = 0; yi < yecChartIds.length; yi++) {
    const yecId = yecChartIds[yi];
    const yearEndData = allYecData[yi];
    if (!yearEndData) continue;
    const cfg = chartsConfig[yecId];
    for (const year of yearEndData.years) {
      for (const entry of yearEndData.entriesByYear[year]) {
        const nameMatch = slugify(entry.name) === matchName;
        const artistMatch = matchArtist ? slugify(entry.artist) === matchArtist : true;
        if (nameMatch && artistMatch) {
          yecEntries.push({
            year,
            chartId: yecId,
            chartTitle: cfg.title,
            position: entry.position,
            peak: entry.peak,
            weeks: entry.weeks,
            totalUnits: entry.totalUnits,
          });
          if (entry.peak > 0 && entry.peak < bestPeak) bestPeak = entry.peak;
          bestWeeks = Math.max(bestWeeks, entry.weeks);
        }
      }
    }
  }
  yecEntries.sort((a, b) => Number(b.year) - Number(a.year) || a.position - b.position);

  let goatPosition: number | undefined;
  let goatWeeks: number | undefined;
  for (const goatData of allGoatData) {
    if (!goatData) continue;
    for (const entry of goatData.entries) {
      const nameMatch = slugify(entry.name) === matchName;
      const artistMatch = matchArtist ? slugify(entry.artist) === matchArtist : true;
      if (nameMatch && artistMatch) {
        goatPosition = entry.position;
        goatWeeks = entry.weeks;
        break;
      }
    }
    if (goatPosition) break;
  }

  const statsRecords: SongDetails["statsRecords"] = [];
  if (statsRows) {
    const header = statsRows[0].map((h: string) => h.toLowerCase().trim());
    const catIdx = findIdx(header, ["stats", "category"]);
    const itemIdx = findIdx(header, ["artist/song", "item", "title", "name"]);
    const numIdx = findIdx(header, ["number", "value", "total", "count"]);
    for (const r of statsRows.slice(1)) {
      const item = (r[itemIdx] ?? "").trim();
      if (slugify(item) === matchName) {
        statsRecords.push({
          category: (r[catIdx] ?? "").trim(),
          value: (r[numIdx] ?? "").trim(),
        });
      }
    }
  }

  return {
    name: songName,
    artist: songArtist,
    peak: bestPeak === Number.MAX_SAFE_INTEGER ? 0 : bestPeak,
    weeks: bestWeeks,
    totalUnits: formatTotalUnits(totalUnits),
    totalPoints: totalPoints.formatted || undefined,
    totalSales: totalSales.formatted || undefined,
    totalStreams: totalStreams.formatted || undefined,
    totalAudience: totalAudience.formatted || undefined,
    certification,
    certificationLevel: getCertificationLevel(totalUnitsRaw, "song"),
    goatPosition,
    goatWeeks,
    yecEntries,
    statsRecords,
    chartStats: chartStatsAcc,
    chartRuns: songRuns.sort((a, b) => a.date.localeCompare(b.date)),
  };
}

export const getSongDetails = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => d)
  .handler(async ({ data }) => cached(`song:${data.slug}`, () => loadSongDetails(data.slug)));

export const getChartBeat = createServerFn({ method: "GET" })
  .inputValidator((d: { blog: keyof typeof chartBeatConfig }) => d)
  .handler(async ({ data }) => {
    return cached(`beat:${data.blog}`, async () => {
      const cfg = chartBeatConfig[data.blog];
      const rows = await fetchCsv(cfg.url);
      const header = rows[0].map((h) => h.toLowerCase().trim());
      const idx = {
        date: findIdx(header, ["date", "data"]),
        title: findIdx(header, ["title", "título"]),
        text: findIdx(header, ["text", "conteúdo"]),
        artist: findIdx(header, ["artist", "artista"]),
        link: findIdx(header, ["chartlink"]),
        image: findIdx(header, ["image", "imagem", "photo", "foto"]),
      };
      const posts: ChartBeatPost[] = rows.slice(1).map((r, i) => ({
        slug: `${i + 1}-${slugify(r[idx.title] ?? "untitled")}`,
        title: r[idx.title] ?? "Untitled",
        publicationDate: r[idx.date] ?? "",
        artist: idx.artist >= 0 ? r[idx.artist] || null : null,
        fullText: r[idx.text] ?? "",
        chartLink: idx.link >= 0 ? r[idx.link] || null : null,
        image: idx.image >= 0 ? r[idx.image] || null : null,
      }));
      return { title: cfg.title, posts: posts.reverse() };
    });
  });

export interface ArtistDetails {
  name: string;
  chartsByKind: Record<string, { item: string; peak: number; weeks: number; weeksAt1?: number; unitsSold?: string | null; totalUnits?: string | null; firstEntry?: string | null; peakDate?: string | null }[]>;
}

export const getAllArtistNames = createServerFn({ method: "GET" }).handler(async () => {
  return cached("artistNames", async () => {
    const names = new Set<string>();

    const artistsChart = await getWeeklyChart({ data: { chartId: "artists" } }).catch(() => null);
    if (artistsChart) {
      for (const date of artistsChart.dates) {
        for (const e of artistsChart.entriesByDate[date]) {
          if (e.artist) names.add(e.artist);
        }
      }
    }

    const songsChart = await getWeeklyChart({ data: { chartId: "songs" } }).catch(() => null);
    if (songsChart) {
      for (const date of songsChart.dates) {
        for (const e of songsChart.entriesByDate[date]) {
          if (e.artist) names.add(e.artist);
        }
      }
    }

    return Array.from(names);
  });
});

export const getAllArtistList = createServerFn({ method: "GET" }).handler(async () => {
  return cached("artistList", async () => {
    const map: Record<string, { name: string; slug: string; entries: number }> = {};
    const slugify = (t: string) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

    const charts = ["artists", "songs", "digitalSongsSales", "streamingSongs", "radioSongs", "albums", "topAlbumSales", "topStreamingAlbums"];
    const allCharts = await Promise.all(
      charts.map(async (chartId) => {
        try { return await getWeeklyChart({ data: { chartId } }); } catch { return null; }
      })
    );

    for (const chart of allCharts) {
      if (!chart) continue;
      for (const date of chart.dates) {
        for (const e of chart.entriesByDate[date]) {
          if (!e.artist) continue;
          const slug = slugify(e.artist);
          if (!map[slug]) map[slug] = { name: e.artist, slug, entries: 0 };
          map[slug].entries++;
        }
      }
    }

    return Object.values(map).sort((a, b) => a.name.localeCompare(b.name));
  });
});

export const getAllAlbumList = createServerFn({ method: "GET" }).handler(async () => {
  return cached("albumList", async () => {
    const map: Record<string, { name: string; artist: string; slug: string; entries: number }> = {};

    const charts = ["albums", "topAlbumSales", "topStreamingAlbums"];
    const allCharts = await Promise.all(
      charts.map(async (chartId) => {
        try { return await getWeeklyChart({ data: { chartId } }); } catch { return null; }
      })
    );

    for (const chart of allCharts) {
      if (!chart) continue;
      for (const date of chart.dates) {
        for (const e of chart.entriesByDate[date]) {
          if (!e.name) continue;
          const slug = slugify(e.name);
          if (!map[slug]) map[slug] = { name: e.name, artist: e.artist, slug, entries: 0 };
          map[slug].entries++;
        }
      }
    }

    return Object.values(map).sort((a, b) => a.name.localeCompare(b.name));
  });
});

export const getAllSongList = createServerFn({ method: "GET" }).handler(async () => {
  return cached("songList", async () => {
    const map: Record<string, { name: string; artist: string; slug: string; entries: number }> = {};

    const charts = ["songs", "digitalSongsSales", "streamingSongs", "radioSongs"];
    const allCharts = await Promise.all(
      charts.map(async (chartId) => {
        try { return await getWeeklyChart({ data: { chartId } }); } catch { return null; }
      })
    );

    for (const chart of allCharts) {
      if (!chart) continue;
      for (const date of chart.dates) {
        for (const e of chart.entriesByDate[date]) {
          if (!e.name) continue;
          const slug = songSlug(e.name, e.artist);
          if (!map[slug]) map[slug] = { name: e.name, artist: e.artist, slug, entries: 0 };
          map[slug].entries++;
        }
      }
    }

    return Object.values(map).sort((a, b) => a.name.localeCompare(b.name));
  });
});

export const getAllArtistStats = createServerFn({ method: "GET" }).handler(async () => {
  return cached("artistStats", async () => {
    const cfg = chartsConfig.artistStats;
    const rows = await fetchCsv(cfg.url);
    const header = rows[0].map((h) => h.toLowerCase().trim());
    const idx = {
      artist: findIdx(header, ["artist", "artists"]),
      chart: findIdx(header, ["chart"]),
      item: findIdx(header, ["item"]),
      peak: findIdx(header, ["peak"]),
      weeks: findIdx(header, ["weeks", "wks"]),
      weeksAt1: findIdx(header, ["weeks at 1", "wks at 1", "week at #1", "weeks at #1"]),
      unitsSold: findIdx(header, ["units sold", "sales", "total sales", "units/sales"]),
      totalUnits: findIdx(header, ["total units", "total", "units"]),
      firstEntry: findIdx(header, ["first entry"]),
      peakDate: findIdx(header, ["peak date"]),
    };
    const map: Record<string, ArtistDetails> = {};
    const slugVariants = new Map<string, Set<string>>(); // slug → all name variants seen

    const allRows: { artist: string; chart: string; entry: any }[] = [];
    for (const r of rows.slice(1)) {
      const artist = (r[idx.artist] ?? "").trim();
      if (!artist) continue;
      const chart = (r[idx.chart] ?? "").trim() || "Other";
      const entry = {
        item: (r[idx.item] ?? "").trim(),
        peak: toInt(r[idx.peak]),
        weeks: toInt(r[idx.weeks]),
        weeksAt1: idx.weeksAt1 >= 0 ? toInt(r[idx.weeksAt1]) : undefined,
        unitsSold: idx.unitsSold >= 0 ? r[idx.unitsSold] || null : null,
      totalUnits: idx.totalUnits >= 0 ? r[idx.totalUnits] || null : null,
      firstEntry: idx.firstEntry >= 0 ? normalizeDate(r[idx.firstEntry] || "") || null : null,
      peakDate: idx.peakDate >= 0 ? normalizeDate(r[idx.peakDate] || "") || null : null,
    };
    const slug = slugify(artist);
    if (!slugVariants.has(slug)) slugVariants.set(slug, new Set());
    slugVariants.get(slug)!.add(artist);
    (map[artist] ||= { name: artist, chartsByKind: {} });
    (map[artist].chartsByKind[chart] ||= []).push(entry);
    allRows.push({ artist, chart, entry });
    }

    for (const [slug, variants] of slugVariants) {
      if (variants.size <= 1) continue;
      const sorted = [...variants].sort((a, b) => {
        const aAllUpper = a === a.toUpperCase() && a.length > 2;
        const bAllUpper = b === b.toUpperCase() && b.length > 2;
        if (aAllUpper !== bAllUpper) return aAllUpper ? -1 : 1;
        return b.length - a.length;
      });
      const best = sorted[0];
      for (const alt of sorted.slice(1)) {
        if (alt === best) continue;
        for (const chart of Object.keys(map[alt].chartsByKind)) {
          (map[best].chartsByKind[chart] ||= []).push(...map[alt].chartsByKind[chart]);
        }
        delete map[alt];
      }
      for (const row of allRows) {
        if (sorted.slice(1).includes(row.artist)) row.artist = best;
      }
      slugVariants.set(slug, new Set([best]));
    }

    const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

    const featVerifyCache = new Map<string, string[]>();
    async function verifyFeatViaApi(song: string, mainArtist: string): Promise<string[]> {
      const key = `${song}|${mainArtist}`;
      if (featVerifyCache.has(key)) return featVerifyCache.get(key)!;
      try {
        const q = encodeURIComponent(`${song} ${mainArtist}`);
        const resp = await fetch(`https://itunes.apple.com/search?term=${q}&entity=song&limit=5`, { signal: AbortSignal.timeout(10_000) });
        const data = await resp.json();
        for (const r of data.results ?? []) {
          const nameMatch = normalize(r.trackName ?? "") === normalize(song);
          const artistMatch = normalize(r.artistName ?? "").includes(normalize(mainArtist));
          if (nameMatch && artistMatch) {
            const raw = (r.artistName ?? "").trim();
            const parts = raw.split(/\s*(?:feat\.|ft\.|featuring|&)\s*/i).map((s: string) => s.trim()).filter(Boolean);
            if (parts.length > 1) {
              featVerifyCache.set(key, parts.slice(1));
              return parts.slice(1);
            }
          }
        }
        featVerifyCache.set(key, []);
        return [];
      } catch {
        featVerifyCache.set(key, []);
        return [];
      }
    }

    for (const { artist, chart, entry } of allRows) {
      const itemFeat = entry.item.match(/\(feat\.?\s+([^)]+)\)/i)
        || entry.item.match(/\(ft\.?\s+([^)]+)\)/i)
        || entry.item.match(/\(featuring\s+([^)]+)\)/i)
        || entry.item.match(/\(with\s+([^)]+)\)/i);
      const artistFeat = artist.match(/\bfeat\.?\s+/i)
        || artist.match(/\bft\.?\s+/i)
        || artist.match(/\bfeaturing\s+/i)
        || artist.match(/\bwith\s+/i);
      if (!itemFeat && !artistFeat) continue;
      const apiFeats = await verifyFeatViaApi(entry.item, artist);
      for (const apiFeat of apiFeats) {
        const existingKey = Object.keys(map).find(k => normalize(k) === normalize(apiFeat));
        if (!existingKey) continue;
        const alreadyExists = map[existingKey].chartsByKind[chart]?.some(
          (e: any) => e.item === entry.item && e.peak === entry.peak && e.weeks === entry.weeks
        );
        if (!alreadyExists) {
          (map[existingKey].chartsByKind[chart] ||= []).push(entry);
        }
      }
    }
    for (const a of Object.values(map)) {
      for (const list of Object.values(a.chartsByKind)) list.sort((x, y) => x.peak - y.peak || y.weeks - x.weeks);
    }
    return map;
  });
});

const artistChartMapping: { chartId: string; label: string }[] = [
  { chartId: "artists", label: "Top 50 Artists" },
  { chartId: "songs", label: "Hot 100 Songs" },
  { chartId: "digitalSongsSales", label: "Digital Songs Sales" },
  { chartId: "streamingSongs", label: "Streaming Songs" },
  { chartId: "radioSongs", label: "Top 40 Radio" },
  { chartId: "albums", label: "Top 100 Albums" },
  { chartId: "topAlbumSales", label: "Top Album Sales" },
  { chartId: "topStreamingAlbums", label: "Top Streaming Albums" },
];

function matchesArtist(entryArtist: string, artistName: string): boolean {
  const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  const target = normalize(artistName);
  const parts = entryArtist.replace(/\b(?:feat\.?|ft\.?|featuring|with)\b/gi, ",").split(/[,&+]/).map((p) => normalize(p.trim())).filter(Boolean);
  return parts.some((p) => p === target);
}

export const getArtistChartHistory = createServerFn({ method: "GET" })
  .validator((d: { artistName?: string; slug?: string }) => d)
  .handler(async ({ data }) => {
    const { artistName: inputName, slug } = data;

    const allCharts = await Promise.all(
      artistChartMapping.map(async ({ chartId }) => {
        try { return await getWeeklyChart({ data: { chartId } }); } catch { return null; }
      })
    );

    let artistName = inputName;
    if (!artistName && slug) {
      for (const chart of allCharts) {
        if (!chart) continue;
        for (const date of chart.dates) {
          for (const e of chart.entriesByDate[date]) {
            if (slugifyArtist(e.artist) === slug) { artistName = e.artist; break; }
          }
          if (artistName) break;
        }
        if (artistName) break;
      }
    }

    if (!artistName) return { artistName: null as string | null, chartsByKind: {} as Record<string, any[]> };

    const results = artistChartMapping.map(({ label }, idx) => {
      const chart = allCharts[idx];
      if (!chart) return { label, entries: [] as any[] };
      const { dates, entriesByDate } = chart;
      const seen: Record<string, {
        item: string;
        bestPos: number;
        weeks: number;
        weeksAt1: number;
        totalUnits: number;
        firstDate: string | null;
        peakDate: string | null;
      }> = {};

      for (const date of dates) {
        for (const e of entriesByDate[date]) {
          const nameArtistMatch = matchesArtist(e.artist, artistName);
          const songFeatMatch = e.name.match(/\((?:feat\.?|ft\.?|featuring|with)\s+([^)]+)\)/i);
          const songFeat = songFeatMatch ? matchesArtist(songFeatMatch[1], artistName) : false;
          if (!nameArtistMatch && !songFeat) continue;
          const key = e.name.toLowerCase();
          if (!seen[key]) {
            seen[key] = {
              item: e.name,
              bestPos: e.position,
              weeks: 0,
              weeksAt1: 0,
              totalUnits: 0,
              firstDate: null,
              peakDate: null,
            };
          }
          const s = seen[key];
          s.weeks++;
          if (e.position <= s.bestPos) {
            s.bestPos = e.position;
            s.peakDate = date;
          }
          if (e.position === 1) s.weeksAt1++;
          if (e.units) s.totalUnits += parseEuropeanFloat(e.units);
          if (!s.firstDate) s.firstDate = date;
        }
      }

      const isSalesChart = label.includes("Sales");
      const isStreamsChart = label.includes("Streaming");
      const entries = Object.values(seen).map((s) => ({
        item: s.item,
        peak: s.bestPos,
        weeks: s.weeks,
        weeksAt1: s.weeksAt1,
        unitsSold: isSalesChart ? formatNumber(s.totalUnits) : null as string | null,
        totalUnits: isStreamsChart ? formatNumber(s.totalUnits) : s.totalUnits.toLocaleString("en-US"),
        firstEntry: s.firstDate,
        peakDate: s.peakDate,
      }));

      entries.sort((a, b) => a.peak - b.peak || b.weeks - a.weeks);
      return { label, entries };
    });

    const chartsByKind: Record<string, any[]> = {};
    for (const r of results) {
      if (r.entries.length > 0) chartsByKind[r.label] = r.entries;
    }
    return { artistName, chartsByKind };
  });

export const getArtist50TotalUnits = createServerFn({ method: "GET" }).handler(async () => {
  return cached("artist50TotalUnits", async () => {
    const cfg = chartsConfig.artists;
    const rows = await fetchCsv(cfg.url);
    const header = rows[0].map((h) => h.toLowerCase().trim());
    const idx = {
      artist: findIdx(header, ["artist", "artists"]),
      date: findIdx(header, ["chart date", "date"]),
      totalUnits: findIdx(header, ["total units", "total", "total audience"]),
    };
    const map: Record<string, string> = {};
    for (const r of rows.slice(1)) {
      const artist = (r[idx.artist] ?? "").trim();
      if (!artist || idx.totalUnits < 0) continue;
      const date = normalizeDate(r[idx.date]);
      const totalUnits = r[idx.totalUnits] ?? "";
      if (!date || !totalUnits) continue;
      const existing = map[artist];
      if (!existing || date > existing.split("||")[0]) {
        map[artist] = `${date}||${totalUnits}`;
      }
    }
    const result: Record<string, string> = {};
    for (const [artist, val] of Object.entries(map)) {
      result[artist] = val.split("||")[1];
    }
    return result;
  });
});

export const getArtist50Totals = createServerFn({ method: "GET" }).handler(async () => {
  return cached("artist50Totals", async () => {
    const cfg = chartsConfig.artists;
    const rows = await fetchCsv(cfg.url);
    const header = rows[0].map((h) => h.toLowerCase().trim());
    const idx = {
      artist: findIdx(header, ["artist", "artists"]),
      date: findIdx(header, ["chart date", "date"]),
      totalUnits: findIdx(header, ["total units", "total", "total audience"]),
      totalSales: findIdx(header, ["total sales", "sales"]),
      totalStreams: findIdx(header, ["total streams", "total streaming"]),
    };
    const map: Record<string, { date: string; totalUnits: string; totalSales: string; totalStreams: string }> = {};
    for (const r of rows.slice(1)) {
      const artist = (r[idx.artist] ?? "").trim();
      if (!artist) continue;
      const date = normalizeDate(r[idx.date]);
      if (!date) continue;
      const totalUnits = idx.totalUnits >= 0 ? (r[idx.totalUnits] ?? "") : "";
      const totalSales = idx.totalSales >= 0 ? (r[idx.totalSales] ?? "") : "";
      const totalStreams = idx.totalStreams >= 0 ? (r[idx.totalStreams] ?? "") : "";
      const existing = map[artist];
      if (!existing || date > existing.date) {
        map[artist] = { date, totalUnits, totalSales, totalStreams };
      }
    }
    return map;
  });
});

/* ────── Year-End Charts (generated from weekly data) ────── */
export interface YECEntry {
  position: number;
  name: string;
  artist: string;
  peak: number;
  weeks: number;
  weeksAt1: number;
  totalUnits: number;
  kind: "song" | "album" | "artist";
  entries?: number;
}

export async function computeYearEndGenerated(chartId: string) {
  return cached(`yec_gen_${chartId}`, async () => {
    const chartData = await loadWeekly(chartId);
    const years: Record<string, Record<string, YECEntry>> = {};

    const metricKey = chartId === "songs" ? "points" : chartId === "streamingSongs" || chartId === "topStreamingAlbums" ? "streams" : chartId === "radioSongs" ? "audience" : chartId === "topAlbumSales" || chartId === "digitalSongsSales" ? "sales" : "units";

    const seenGlobal = new Set<string>();
    for (const date of chartData.dates) {
      const year = date.slice(0, 4);
      const entries = chartData.entriesByDate[date] || [];
      if (!years[year]) years[year] = {};

      for (const e of entries) {
        const key = `${e.name.toLowerCase()}||${e.artist.toLowerCase()}`;
        if (!years[year][key]) {
          years[year][key] = {
            position: 0,
            name: e.name,
            artist: e.artist,
            peak: e.peak,
            weeks: 0,
            weeksAt1: 0,
            totalUnits: 0,
            kind: chartData.kind,
          };
        }
        const entry = years[year][key];
        entry.weeks += 1;
        if (e.peak < entry.peak) entry.peak = e.peak;
        entry.weeksAt1 += (e.weeksAt1 ?? 0);
        const isFirstAppearance = !seenGlobal.has(key);
        seenGlobal.add(key);
        if (isFirstAppearance && chartId === "topStreamingAlbums" && e.totalStreams) {
          entry.totalUnits += toInt(e.totalStreams);
        } else {
          const unitsRaw = String(e[metricKey as keyof ChartEntry] ?? e.units ?? "0");
          entry.totalUnits += toInt(unitsRaw);
        }
      }
    }

    const result: Record<string, YECEntry[]> = {};
    for (const [year, items] of Object.entries(years)) {
      result[year] = Object.values(items)
        .sort((a, b) => b.totalUnits - a.totalUnits || a.peak - b.peak)
        .slice(0, 100)
        .map((e, i) => ({ ...e, position: i + 1 }));
    }

    const sortedYears = Object.keys(result).sort().reverse();
    return { years: sortedYears, entriesByYear: result, kind: chartData.kind, title: chartsConfig[chartId]?.title ?? chartId };
  });
}

export const getYearEndGenerated = createServerFn({ method: "GET" })
  .validator((d: { chartId: string }) => d)
  .handler(async ({ data }) => {
    return computeYearEndGenerated(data.chartId);
  });

/* ────── Artist Year-End Positions ────── */
export interface ArtistYECPosition {
  chartTitle: string;
  year: string;
  itemName: string;
  position: number;
  peak: number;
  weeks: number;
}

export const getArtistYearEndPositions = createServerFn({ method: "GET" })
  .validator((d: { artistName: string }) => d)
  .handler(async ({ data }) => {
    return cached(`artist_yec_${data.artistName}`, async () => {
      const chartIds = [
        { id: "artists", title: "Year-End Artists" },
        { id: "albums", title: "Year-End Albums" },
        { id: "songs", title: "Year-End Songs" },
      ];
      const results: ArtistYECPosition[] = [];
      for (const { id, title } of chartIds) {
        const yec = await computeYearEndGenerated(id).catch(() => null);
        if (!yec) continue;
        for (const [year, entries] of Object.entries(yec.entriesByYear)) {
          for (const entry of entries) {
            const nameMatch = entry.name.toLowerCase() === data.artistName.toLowerCase();
            const artistMatch = entry.artist?.toLowerCase() === data.artistName.toLowerCase();
            if (nameMatch || artistMatch) {
              results.push({ chartTitle: title, year, itemName: entry.name, position: entry.position, peak: entry.peak, weeks: entry.weeks });
            }
          }
        }
      }
      return results.sort((a, b) => b.year.localeCompare(a.year) || a.position - b.position);
    });
  });

/* ────── Year-End New Artists (generated from artist chart data) ────── */
const CURATED_NEW_ARTISTS: Record<string, string[]> = {
  "2017": [
    "camila cabello", "dua lipa", "julia michaels", "prettymuch", "mgk",
    "niall horan", "pabllo vittar", "marian hill", "zara larsson", "harry styles",
    "neiked", "louis tomlinson", "blackpink", "poppy", "iza", "zayn",
  ],
  "2018": [
    "jão", "declan mckenna", "duda beat", "post malone", "cardi b",
    "lil peep", "ava max", "(g)i-dle", "iza", "bebe rexha",
    "hayley kiyoko", "the aces", "gustavo mioto", "bazzi", "louisa johnson",
    "luísa sonza", "khalid", "greeicy", "lauv",
  ],
  "2019": [
    "billie eilish", "lizzo", "lil nas x", "mc tha", "rosalía",
    "kim petras", "bad bunny", "normani", "dinah jane", "luísa sonza",
    "blaya", "mahmundi", "paloma mami", "lewis capaldi", "davi sabbag",
  ],
  "2020": [
    "doja cat", "chloe x halle", "conan gray", "megan thee stallion",
    "rina sawayama", "aminé", "summer walker", "alma", "karol g",
    "dadá boladão", "alina baraz", "yung beef",
  ],
  "2021": [
    "olivia rodrigo", "marina sena", "potyguara bardo", "phoebe bridgers",
    "don l", "clarissa", "juliette", "nathy peluso", "chlöe", "lisa",
    "giveon", "c. tangana", "faye webster", "slayyyter", "måneskin",
    "day", "paloma mami", "annikko", "chameleo",
  ],
  "2022": [
    "jovem dionisio", "tate mcrae", "steve lacy", "dove cameron",
    "omar apollo", "lele pons", "elley duhé", "gayle", "urias",
    "sabrina carpenter", "veridiana benassi", "latto", "newjeans",
    "maria becerra", "måneskin", "orville peck", "flo", "liniker",
    "rebelde la serie", "pedro sampaio",
  ],
  "2023": [
    "newjeans", "bizarrap", "gracie abrams", "raye", "melanie fiona",
    "maria becerra", "eslabon armando", "la cruz", "käärijä", "doechii",
    "emilia", "clarissa", "coi leray", "coco jones",
    "jung kook", "ice spice",
  ],
  "2024": [
    "chappell roan", "beabadoobee", "sevdaliza", "tyla", "addison rae",
    "dasha", "benson boone", "rosé", "caroline polachek",
    "wicked movie cast", "flo", "magdalena bay", "ayra starr", "ice spice",
  ],
  "2025": [
    "lola young", "pinkpantheress", "guitarricadelafuente", "katseye",
    "jade", "reneé rapp", "lucas pretti", "sombr", "ravyn lenae",
    "cynthia erivo", "huntr/x", "mariah the scientist", "olivia dean",
    "amaarae", "laufey", "os garotin", "rose gray", "destin conrad",
  ],
};

export const getYearEndNewArtists = createServerFn({ method: "GET" })
  .handler(async () => {
    return cached("yec_new_artists", async () => {
      const chartData = await getWeeklyChart({ data: { chartId: "artists" } });

      // Step 1: for each year, accumulate units for curated artists
      const years: Record<string, Record<string, YECEntry>> = {};
      for (const date of chartData.dates) {
        const year = date.slice(0, 4);
        const entries = chartData.entriesByDate[date] || [];
        if (!years[year]) years[year] = {};
        const curated = CURATED_NEW_ARTISTS[year];
        if (!curated) continue;

        for (const e of entries) {
          const key = `${e.name.toLowerCase()}||${e.artist.toLowerCase()}`;
          if (!curated.some((c) => c.toLowerCase() === e.name.toLowerCase())) continue;

          if (!years[year][key]) {
            years[year][key] = {
              position: 0,
              name: e.name,
              artist: e.artist,
              peak: e.peak,
              weeks: 0,
              weeksAt1: 0,
              totalUnits: 0,
              kind: "artist" as const,
            };
          }
          const entry = years[year][key];
          entry.weeks += 1;
          if (e.peak < entry.peak) entry.peak = e.peak;
          entry.weeksAt1 += (e.weeksAt1 ?? 0);
          entry.totalUnits += toInt(String(e.units ?? "0"));
        }
      }

      const result: Record<string, YECEntry[]> = {};
      for (const [year, items] of Object.entries(years)) {
        result[year] = Object.values(items)
          .sort((a, b) => b.totalUnits - a.totalUnits || a.peak - b.peak)
          .slice(0, 10)
          .map((e, i) => ({ ...e, position: i + 1 }));
      }

      const sortedYears = Object.keys(result).sort().reverse();
      return { years: sortedYears, entriesByYear: result, kind: "artist" as const, title: "Year-End New Artists" };
    });
  });

/* ────── Greatest of All Time Charts (generated from weekly data, top 500) ────── */
export interface GOATEntry {
  position: number;
  name: string;
  artist: string;
  peak: number;
  weeks: number;
  weeksAt1: number;
  weeksAt1Hot100: number;
  weeksAt1Artists: number;
  weeksAt1Albums: number;
  totalUnits: number;
  totalStreams: number;
  totalSales: number;
  totalAudience: number;
  totalPoints: number;
  kind: "song" | "album" | "artist";
}

export const getGoatGenerated = createServerFn({ method: "GET" })
  .validator((d: { chartId: string }) => d)
  .handler(async ({ data }) => {
    return cached(`goat_gen_${data.chartId}`, async () => {
      const cfg = chartsConfig[data.chartId];
      const kind = cfg?.kind ?? "song";
      const weeklyIds = data.chartId === "goatArtists" ? ["artists"] : data.chartId === "goatAlbums" ? ["albums"] : data.chartId === "goatRadio" ? ["radioSongs"] : ["songs"];

      // Fetch all three main charts for weeksAt1 breakdown
      const [songsData, artistsData, albumsData] = await Promise.all([
        getWeeklyChart({ data: { chartId: "songs" } }).catch(() => null),
        getWeeklyChart({ data: { chartId: "artists" } }).catch(() => null),
        getWeeklyChart({ data: { chartId: "albums" } }).catch(() => null),
      ]);

      // Build per-chart weeksAt1 maps: key → total weeksAt1 for that chart
      function buildWeeksAt1Map(chartData: { dates: string[]; entriesByDate: Record<string, ChartEntry[]> } | null): Record<string, number> {
        if (!chartData) return {};
        const map: Record<string, number> = {};
        for (const date of chartData.dates) {
          for (const e of chartData.entriesByDate[date] || []) {
            if (e.weeksAt1 && e.weeksAt1 > 0) {
              const key = `${e.name.toLowerCase()}||${e.artist.toLowerCase()}`;
              map[key] = (map[key] || 0) + e.weeksAt1;
            }
          }
        }
        return map;
      }

      const hot100Map = buildWeeksAt1Map(songsData);
      const artistsMap = buildWeeksAt1Map(artistsData);
      const albumsMap = buildWeeksAt1Map(albumsData);

      const aggregated: Record<string, GOATEntry> = {};

      // Aggregate from the relevant chart(s)
      const relevantData = data.chartId === "goatArtists" ? [artistsData] : data.chartId === "goatAlbums" ? [albumsData] : data.chartId === "goatRadio" ? [songsData] : [songsData];

      for (const chartData of relevantData) {
        if (!chartData) continue;
        for (const date of chartData.dates) {
          const entries = chartData.entriesByDate[date] || [];
          for (const e of entries) {
            const key = `${e.name.toLowerCase()}||${e.artist.toLowerCase()}`;
            if (!aggregated[key]) {
              aggregated[key] = {
                position: 0,
                name: e.name,
                artist: e.artist,
                peak: e.peak,
                weeks: 0,
                weeksAt1: 0,
                weeksAt1Hot100: 0,
                weeksAt1Artists: 0,
                weeksAt1Albums: 0,
                totalUnits: 0,
                totalStreams: 0,
                totalSales: 0,
                totalAudience: 0,
                totalPoints: 0,
                kind,
              };
            }
            const entry = aggregated[key];
            entry.weeks += 1;
            if (e.peak < entry.peak) entry.peak = e.peak;
            entry.weeksAt1 += (e.weeksAt1 ?? 0);
            entry.totalUnits += toInt(e.units || "0");
            entry.totalStreams += toInt(e.streams || "0");
            entry.totalSales += toInt(e.sales || "0");
            entry.totalAudience += toInt(e.audience || "0");
            entry.totalPoints += toInt(e.points || "0");
          }
        }
      }

      // Assign per-chart weeksAt1 from the pre-built maps
      for (const key of Object.keys(aggregated)) {
        aggregated[key].weeksAt1Hot100 = hot100Map[key] || 0;
        aggregated[key].weeksAt1Artists = artistsMap[key] || 0;
        aggregated[key].weeksAt1Albums = albumsMap[key] || 0;
      }

      const sorted = Object.values(aggregated)
        .sort((a, b) => b.weeks - a.weeks || a.peak - b.peak)
        .slice(0, 500)
        .map((e, i) => ({ ...e, position: i + 1 }));

      return { entries: sorted, kind, title: cfg?.title ?? data.chartId };
    });
  });

export interface Stats2Record {
  name: string;
  artist: string;
  value: number;
  valueLabel: string;
  peak?: number;
  firstDate?: string;
  chartId?: string;
  details?: string;
  metricLabel?: string;
}

export interface Stats2Category {
  id: string;
  title: string;
  icon: string;
  description: string;
  records: Stats2Record[];
}

export interface Stats2Data {
  chartStats: Record<string, Stats2Category[]>;
  availableYears: string[];
  chartIds: string[];
}

export const getStats2 = createServerFn({ method: "GET" }).handler(async () => {
  return cached("stats2", async () => {
    const chartIds = ["songs", "streamingSongs", "radioSongs", "digitalSongsSales", "albums", "topStreamingAlbums", "topAlbumSales", "artists"];
    const allData = await Promise.all(
      chartIds.map(async (id) => {
        const cfg = chartsConfig[id];
        const rows = await fetchCsv(cfg.url);
        const header = rows[0].map((h) => h.toLowerCase().trim());
        const idx = {
          date: findIdx(header, ["date", "chart date"]),
          position: findIdx(header, ["position", "rank", "pos"]),
          song: findIdx(header, ["song", "title", "track"]),
          album: findIdx(header, ["album"]),
          artist: findIdx(header, ["artist", "artists"]),
          diff: findIdx(header, ["dif", "diff", "▲▼"]),
          peak: findIdx(header, ["peak"]),
          weeks: findIdx(header, ["weeks", "wks"]),
          units: findIdx(header, ["units"]),
          sales: findIdx(header, ["sales", "pure sales", "sales/streams", "sales/streaming"]),
          streams: findIdx(header, ["streams", "sea", "streaming"]),
          audience: findIdx(header, ["audience"]),
        };
        if (cfg.id === "radioSongs") {
          const a = header.indexOf("audience");
          if (a !== -1) idx.units = a;
        }
        const nameIdx = cfg.kind === "artist" ? idx.artist : cfg.kind === "album" ? idx.album : idx.song;
        const entriesByDate: Record<string, { position: number; name: string; artist: string; diff: string; peak: number; weeks: number; metric: number; metricLabel: string }[]> = {};
        for (const r of rows.slice(1)) {
          const date = normalizeDate(r[idx.date]);
          if (!date) continue;
          const position = toInt(r[idx.position]);
          const name = (r[nameIdx] ?? "").trim();
          const artist = (r[idx.artist] ?? "").trim();
          if (!name || !position) continue;
          const metricValue = toInt(r[idx.units]) || toInt(r[idx.sales]) || toInt(r[idx.streams]) || toInt(r[idx.audience]);
          let metricLabel = "units";
          if (idx.units >= 0 && r[idx.units]) metricLabel = "units";
          else if (idx.sales >= 0 && r[idx.sales]) metricLabel = "sales";
          else if (idx.streams >= 0 && r[idx.streams]) metricLabel = "streams";
          else if (idx.audience >= 0 && r[idx.audience]) metricLabel = "audience";
          (entriesByDate[date] ||= []).push({
            position,
            name,
            artist,
            diff: idx.diff >= 0 ? (r[idx.diff] ?? "") : "",
            peak: toInt(r[idx.peak]),
            weeks: toInt(r[idx.weeks]),
            metric: metricValue,
            metricLabel,
          });
        }
        const dates = Object.keys(entriesByDate).sort();
        for (const d of dates) entriesByDate[d].sort((a, b) => a.position - b.position);
        return { id, title: cfg.title, kind: cfg.kind, dates, entriesByDate, metricLabel: entriesByDate[Object.keys(entriesByDate)[0]]?.[0]?.metricLabel ?? "units" };
      })
    );

    const allYears = new Set<string>();
    for (const chart of allData) {
      for (const date of chart.dates) allYears.add(date.slice(0, 4));
    }
    const availableYears = [...allYears].sort().reverse();

    const chartStats: Record<string, Stats2Category[]> = {};

    for (const chart of allData) {
      const categories: Stats2Category[] = [];

      // 1. Biggest Debuts (entries with diff=NEW, ranked by metric value — highest metric = biggest debut)
      const debutMap = new Map<string, Stats2Record>();
      for (const date of chart.dates) {
        for (const e of chart.entriesByDate[date]) {
          if (e.diff === "NEW") {
            const key = `${e.name}||${e.artist}`;
            const existing = debutMap.get(key);
            if (!existing || e.metric > existing.value) {
              debutMap.set(key, {
                name: e.name,
                artist: e.artist,
                value: e.metric,
                valueLabel: e.metric > 0 ? `${formatMetric(e.metric, chart.id)} ${e.metricLabel}` : `#${e.position} debut`,
                peak: e.peak,
                firstDate: date,
                chartId: chart.id,
                details: `#${e.position} debut · ${e.metric > 0 ? `${formatMetric(e.metric, chart.id)} ${e.metricLabel}` : "N/A"} on ${new Date(date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`,
              });
            }
          }
        }
      }
      categories.push({
        id: "debuts",
        title: "Biggest Debuts",
        icon: "fa-rocket",
        description: "Debuts ranked by metric volume",
        records: [...debutMap.values()].sort((a, b) => b.value - a.value).slice(0, 1000),
      });

      // 2. Most Weeks at #1
      const weeksAt1Map = new Map<string, Stats2Record>();
      for (const date of chart.dates) {
        for (const e of chart.entriesByDate[date]) {
          if (e.position === 1) {
            const key = `${e.name}||${e.artist}`;
            const existing = weeksAt1Map.get(key);
            if (existing) {
              existing.value++;
              existing.valueLabel = `${existing.value} weeks`;
            } else {
              weeksAt1Map.set(key, {
                name: e.name,
                artist: e.artist,
                value: 1,
                valueLabel: "1 week",
                peak: 1,
                firstDate: date,
                chartId: chart.id,
              });
            }
          }
        }
      }
      categories.push({
        id: "weeksAt1",
        title: "Most Weeks at #1",
        icon: "fa-crown",
        description: "Longest reigns at the top",
        records: [...weeksAt1Map.values()].sort((a, b) => b.value - a.value).slice(0, 1000),
      });

      // 3. Most Weeks in Top 5
      const top5Map = new Map<string, Stats2Record>();
      for (const date of chart.dates) {
        for (const e of chart.entriesByDate[date]) {
          if (e.position <= 5) {
            const key = `${e.name}||${e.artist}`;
            const existing = top5Map.get(key);
            if (existing) {
              existing.value++;
              existing.valueLabel = `${existing.value} weeks`;
            } else {
              top5Map.set(key, {
                name: e.name,
                artist: e.artist,
                value: 1,
                valueLabel: "1 week",
                peak: e.peak || e.position,
                firstDate: date,
                chartId: chart.id,
              });
            }
          }
        }
      }
      categories.push({
        id: "top5",
        title: "Most Weeks in Top 5",
        icon: "fa-star",
        description: "Longest runs in the top 5",
        records: [...top5Map.values()].sort((a, b) => b.value - a.value).slice(0, 1000),
      });

      // 4. Most Weeks in Top 10
      const top10Map = new Map<string, Stats2Record>();
      for (const date of chart.dates) {
        for (const e of chart.entriesByDate[date]) {
          if (e.position <= 10) {
            const key = `${e.name}||${e.artist}`;
            const existing = top10Map.get(key);
            if (existing) {
              existing.value++;
              existing.valueLabel = `${existing.value} weeks`;
            } else {
              top10Map.set(key, {
                name: e.name,
                artist: e.artist,
                value: 1,
                valueLabel: "1 week",
                peak: e.peak || e.position,
                firstDate: date,
                chartId: chart.id,
              });
            }
          }
        }
      }
      categories.push({
        id: "top10",
        title: "Most Weeks in Top 10",
        icon: "fa-arrow-up",
        description: "Longest runs in the top 10",
        records: [...top10Map.values()].sort((a, b) => b.value - a.value).slice(0, 1000),
      });

      // 5. Most Weeks in Top 50
      const top50Map = new Map<string, Stats2Record>();
      for (const date of chart.dates) {
        for (const e of chart.entriesByDate[date]) {
          if (e.position <= 50) {
            const key = `${e.name}||${e.artist}`;
            const existing = top50Map.get(key);
            if (existing) {
              existing.value++;
              existing.valueLabel = `${existing.value} weeks`;
            } else {
              top50Map.set(key, {
                name: e.name,
                artist: e.artist,
                value: 1,
                valueLabel: "1 week",
                peak: e.peak || e.position,
                firstDate: date,
                chartId: chart.id,
              });
            }
          }
        }
      }
      categories.push({
        id: "top50",
        title: "Most Weeks in Top 50",
        icon: "fa-chart-line",
        description: "Longest runs in the top 50",
        records: [...top50Map.values()].sort((a, b) => b.value - a.value).slice(0, 1000),
      });

      // 6. Most Weeks on Chart (Top 100)
      const totalWeeksMap = new Map<string, Stats2Record>();
      for (const date of chart.dates) {
        for (const e of chart.entriesByDate[date]) {
          const key = `${e.name}||${e.artist}`;
          const existing = totalWeeksMap.get(key);
          if (existing) {
            existing.value++;
            existing.valueLabel = `${existing.value} weeks`;
          } else {
            totalWeeksMap.set(key, {
              name: e.name,
              artist: e.artist,
              value: 1,
              valueLabel: "1 week",
              peak: e.peak || e.position,
              firstDate: date,
              chartId: chart.id,
            });
          }
        }
      }
      categories.push({
        id: "totalWeeks",
        title: "Most Weeks on Chart",
        icon: "fa-calendar-check",
        description: "Longest chart presence",
        records: [...totalWeeksMap.values()].sort((a, b) => b.value - a.value).slice(0, 1000),
      });

      // 7. Most Simultaneous Entries (artist with most entries on a single week)
      const maxSimulMap = new Map<string, { count: number; date: string; names: string[] }>();
      for (const date of chart.dates) {
        const artistCount = new Map<string, string[]>();
        for (const e of chart.entriesByDate[date]) {
          const list = artistCount.get(e.artist) || [];
          list.push(e.name);
          artistCount.set(e.artist, list);
        }
        for (const [artist, names] of artistCount) {
          if (names.length >= 2) {
            const existing = maxSimulMap.get(artist);
            if (!existing || names.length > existing.count) {
              maxSimulMap.set(artist, { count: names.length, date, names });
            }
          }
        }
      }
      const simulRecords: Stats2Record[] = [];
      for (const [artist, info] of maxSimulMap) {
        simulRecords.push({
          name: info.names.join(", "),
          artist,
          value: info.count,
          valueLabel: `${info.count} entries`,
          firstDate: info.date,
          chartId: chart.id,
          details: `Peak simultaneous: ${info.count} entries on ${new Date(info.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`,
        });
      }
      categories.push({
        id: "simultaneous",
        title: "Most Simultaneous Entries",
        icon: "fa-layer-group",
        description: "Artists with most concurrent chart entries",
        records: simulRecords.sort((a, b) => b.value - a.value).slice(0, 1000),
      });

      // 8. Artists with Most Total Entries (unique items)
      const artistEntriesMap = new Map<string, Set<string>>();
      for (const date of chart.dates) {
        for (const e of chart.entriesByDate[date]) {
          const set = artistEntriesMap.get(e.artist) || new Set();
          set.add(e.name);
          artistEntriesMap.set(e.artist, set);
        }
      }
      const artistEntryRecords: Stats2Record[] = [];
      for (const [artist, items] of artistEntriesMap) {
        artistEntryRecords.push({
          name: artist,
          artist,
          value: items.size,
          valueLabel: `${items.size} entries`,
          chartId: chart.id,
          details: [...items].slice(0, 5).join(", ") + (items.size > 5 ? ` +${items.size - 5} more` : ""),
        });
      }
      categories.push({
        id: "artistEntries",
        title: "Artists with Most Entries",
        icon: "fa-users",
        description: "Artists with the most different chart entries",
        records: artistEntryRecords.sort((a, b) => b.value - a.value).slice(0, 1000),
      });

      // 9. Biggest Drops (position fell the most in one week)
      const dropRecords: Stats2Record[] = [];
      for (let di = 1; di < chart.dates.length; di++) {
        const prevDate = chart.dates[di - 1];
        const currDate = chart.dates[di];
        const prevMap = new Map<string, number>();
        for (const e of chart.entriesByDate[prevDate]) prevMap.set(`${e.name}||${e.artist}`, e.position);
        for (const e of chart.entriesByDate[currDate]) {
          const key = `${e.name}||${e.artist}`;
          const prevPos = prevMap.get(key);
          if (prevPos != null && e.position > prevPos) {
            const drop = e.position - prevPos;
            if (drop >= 5) {
              dropRecords.push({
                name: e.name,
                artist: e.artist,
                value: drop,
                valueLabel: `▼${drop}`,
                peak: e.peak,
                firstDate: currDate,
                chartId: chart.id,
                details: `Dropped ${drop} spots: #${prevPos} → #${e.position} on ${new Date(currDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`,
              });
            }
          }
        }
      }
      categories.push({
        id: "biggestDrops",
        title: "Biggest Drops",
        icon: "fa-arrow-down",
        description: "Largest single-week drops",
        records: dropRecords.sort((a, b) => b.value - a.value).slice(0, 1000),
      });

      // 10. Biggest Gainers (position rose the most in one week)
      const gainerRecords: Stats2Record[] = [];
      for (let di = 1; di < chart.dates.length; di++) {
        const prevDate = chart.dates[di - 1];
        const currDate = chart.dates[di];
        const prevMap = new Map<string, number>();
        for (const e of chart.entriesByDate[prevDate]) prevMap.set(`${e.name}||${e.artist}`, e.position);
        for (const e of chart.entriesByDate[currDate]) {
          const key = `${e.name}||${e.artist}`;
          const prevPos = prevMap.get(key);
          if (prevPos != null && e.position < prevPos) {
            const gain = prevPos - e.position;
            if (gain >= 5) {
              gainerRecords.push({
                name: e.name,
                artist: e.artist,
                value: gain,
                valueLabel: `▲${gain}`,
                peak: e.peak,
                firstDate: currDate,
                chartId: chart.id,
                details: `Gained ${gain} spots: #${prevPos} → #${e.position} on ${new Date(currDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`,
              });
            }
          }
        }
      }
      categories.push({
        id: "biggestGainers",
        title: "Biggest Gainers",
        icon: "fa-arrow-up",
        description: "Largest single-week gains",
        records: gainerRecords.sort((a, b) => b.value - a.value).slice(0, 1000),
      });

      // 11. Artists with Most #1's (unique songs that reached #1)
      const artistNumberOnesMap = new Map<string, Map<string, number>>();
      for (const date of chart.dates) {
        for (const e of chart.entriesByDate[date]) {
          if (e.position === 1) {
            if (!artistNumberOnesMap.has(e.artist)) {
              artistNumberOnesMap.set(e.artist, new Map());
            }
            const artistSongs = artistNumberOnesMap.get(e.artist)!;
            const weeks = artistSongs.get(e.name) || 0;
            artistSongs.set(e.name, weeks + 1);
          }
        }
      }
      const artistNo1Records: Stats2Record[] = [];
      for (const [artist, songs] of artistNumberOnesMap) {
        const totalWeeks = [...songs.values()].reduce((sum, w) => sum + w, 0);
        const uniqueSongs = songs.size;
        const topSongs = [...songs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, weeks]) => `${name} (${weeks}w)`).join(", ");
        artistNo1Records.push({
          name: artist,
          artist,
          value: uniqueSongs,
          valueLabel: `${uniqueSongs} #1's`,
          chartId: chart.id,
          details: `${totalWeeks} total weeks at #1 · Top: ${topSongs}`,
        });
      }
      categories.push({
        id: "artistNumberOnes",
        title: "Artists with Most #1's",
        icon: "fa-crown",
        description: "Artists with the most songs to reach #1",
        records: artistNo1Records.sort((a, b) => b.value - a.value).slice(0, 1000),
      });

      // 12. Artists with Most Top 5 (unique songs that reached top 5)
      const artistTop5Map = new Map<string, Map<string, number>>();
      for (const date of chart.dates) {
        for (const e of chart.entriesByDate[date]) {
          if (e.position >= 1 && e.position <= 5) {
            if (!artistTop5Map.has(e.artist)) {
              artistTop5Map.set(e.artist, new Map());
            }
            const artistSongs = artistTop5Map.get(e.artist)!;
            const weeks = artistSongs.get(e.name) || 0;
            artistSongs.set(e.name, weeks + 1);
          }
        }
      }
      const artistTop5Records: Stats2Record[] = [];
      for (const [artist, songs] of artistTop5Map) {
        const uniqueSongs = songs.size;
        const topSongs = [...songs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, weeks]) => `${name} (${weeks}w)`).join(", ");
        artistTop5Records.push({
          name: artist,
          artist,
          value: uniqueSongs,
          valueLabel: `${uniqueSongs} top 5`,
          chartId: chart.id,
          details: `Top: ${topSongs}`,
        });
      }
      categories.push({
        id: "artistTop5",
        title: "Artists with Most Top 5",
        icon: "fa-arrow-up",
        description: "Artists with the most songs to reach the top 5",
        records: artistTop5Records.sort((a, b) => b.value - a.value).slice(0, 1000),
      });

      // 13. Artists with Most Top 10 (unique songs that reached top 10)
      const artistTop10Map = new Map<string, Map<string, number>>();
      for (const date of chart.dates) {
        for (const e of chart.entriesByDate[date]) {
          if (e.position >= 1 && e.position <= 10) {
            if (!artistTop10Map.has(e.artist)) {
              artistTop10Map.set(e.artist, new Map());
            }
            const artistSongs = artistTop10Map.get(e.artist)!;
            const weeks = artistSongs.get(e.name) || 0;
            artistSongs.set(e.name, weeks + 1);
          }
        }
      }
      const artistTop10Records: Stats2Record[] = [];
      for (const [artist, songs] of artistTop10Map) {
        const uniqueSongs = songs.size;
        const topSongs = [...songs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, weeks]) => `${name} (${weeks}w)`).join(", ");
        artistTop10Records.push({
          name: artist,
          artist,
          value: uniqueSongs,
          valueLabel: `${uniqueSongs} top 10`,
          chartId: chart.id,
          details: `Top: ${topSongs}`,
        });
      }
      categories.push({
        id: "artistTop10",
        title: "Artists with Most Top 10",
        icon: "fa-chart-line",
        description: "Artists with the most songs to reach the top 10",
        records: artistTop10Records.sort((a, b) => b.value - a.value).slice(0, 1000),
      });

      // 14. Artists with Most Debuts at #1 (songs that debuted at #1)
      const artistDebutNo1Map = new Map<string, { count: number; songs: string[]; dates: string[] }>();
      for (const date of chart.dates) {
        for (const e of chart.entriesByDate[date]) {
          if (e.position === 1 && e.diff === "NEW") {
            if (!artistDebutNo1Map.has(e.artist)) {
              artistDebutNo1Map.set(e.artist, { count: 0, songs: [], dates: [] });
            }
            const info = artistDebutNo1Map.get(e.artist)!;
            info.count++;
            info.songs.push(e.name);
            info.dates.push(date);
          }
        }
      }
      const artistDebutNo1Records: Stats2Record[] = [];
      for (const [artist, info] of artistDebutNo1Map) {
        const recentDebuts = info.songs.slice(0, 5).map((s, i) => `${s} (${new Date(info.dates[i] + "T00:00:00").toLocaleDateString("en-US", { month: "short", year: "numeric" })})`).join(", ");
        artistDebutNo1Records.push({
          name: artist,
          artist,
          value: info.count,
          valueLabel: `${info.count} debut #1's`,
          chartId: chart.id,
          details: `Top debuts: ${recentDebuts}`,
        });
      }
      categories.push({
        id: "artistDebutNumberOnes",
        title: "Artists with Most Debuts at #1",
        icon: "fa-rocket",
        description: "Artists with the most songs to debut at #1",
        records: artistDebutNo1Records.sort((a, b) => b.value - a.value).slice(0, 1000),
      });

      // 15. Artists with Most Debuts on Top 5 (songs that debuted in top 5)
      const artistDebutTop5Map = new Map<string, { count: number; songs: string[]; dates: string[] }>();
      for (const date of chart.dates) {
        for (const e of chart.entriesByDate[date]) {
          if (e.position >= 1 && e.position <= 5 && e.diff === "NEW") {
            if (!artistDebutTop5Map.has(e.artist)) {
              artistDebutTop5Map.set(e.artist, { count: 0, songs: [], dates: [] });
            }
            const info = artistDebutTop5Map.get(e.artist)!;
            info.count++;
            info.songs.push(e.name);
            info.dates.push(date);
          }
        }
      }
      const artistDebutTop5Records: Stats2Record[] = [];
      for (const [artist, info] of artistDebutTop5Map) {
        const recentDebuts = info.songs.slice(0, 5).map((s, i) => `${s} (${new Date(info.dates[i] + "T00:00:00").toLocaleDateString("en-US", { month: "short", year: "numeric" })})`).join(", ");
        artistDebutTop5Records.push({
          name: artist,
          artist,
          value: info.count,
          valueLabel: `${info.count} debuts top 5`,
          chartId: chart.id,
          details: `Top debuts: ${recentDebuts}`,
        });
      }
      categories.push({
        id: "artistDebutTop5",
        title: "Artists with Most Debuts on Top 5",
        icon: "fa-rocket",
        description: "Artists with the most songs to debut in the top 5",
        records: artistDebutTop5Records.sort((a, b) => b.value - a.value).slice(0, 1000),
      });

      // 16. Artists with Most Debuts on Top 10 (songs that debuted in top 10)
      const artistDebutTop10Map = new Map<string, { count: number; songs: string[]; dates: string[] }>();
      for (const date of chart.dates) {
        for (const e of chart.entriesByDate[date]) {
          if (e.position >= 1 && e.position <= 10 && e.diff === "NEW") {
            if (!artistDebutTop10Map.has(e.artist)) {
              artistDebutTop10Map.set(e.artist, { count: 0, songs: [], dates: [] });
            }
            const info = artistDebutTop10Map.get(e.artist)!;
            info.count++;
            info.songs.push(e.name);
            info.dates.push(date);
          }
        }
      }
      const artistDebutTop10Records: Stats2Record[] = [];
      for (const [artist, info] of artistDebutTop10Map) {
        const recentDebuts = info.songs.slice(0, 5).map((s, i) => `${s} (${new Date(info.dates[i] + "T00:00:00").toLocaleDateString("en-US", { month: "short", year: "numeric" })})`).join(", ");
        artistDebutTop10Records.push({
          name: artist,
          artist,
          value: info.count,
          valueLabel: `${info.count} debuts top 10`,
          chartId: chart.id,
          details: `Top debuts: ${recentDebuts}`,
        });
      }
      categories.push({
        id: "artistDebutTop10",
        title: "Artists with Most Debuts on Top 10",
        icon: "fa-rocket",
        description: "Artists with the most songs to debut in the top 10",
        records: artistDebutTop10Records.sort((a, b) => b.value - a.value).slice(0, 1000),
      });

      chartStats[chart.id] = categories;
    }

    // ── All-Kill ── entries that are #1 across multiple charts on the same date
    const songChartIds = ["songs", "streamingSongs", "radioSongs", "digitalSongsSales"];
    const albumChartIds = ["albums", "topStreamingAlbums", "topAlbumSales"];
    const allChartIds = [...songChartIds, ...albumChartIds, "artists"];

    const allChartData: Record<string, { entriesByDate: Record<string, { name: string; artist: string; position: number }[]>; dates: string[] }> = {};
    for (const chart of allData) {
      allChartData[chart.id] = chart;
    }

    function getAllCommonDates(chartIds: string[]): string[] {
      const dateSets = chartIds.map((id) => new Set(allChartData[id]?.dates ?? []));
      if (dateSets.length === 0) return [];
      return [...dateSets[0]].filter((d) => dateSets.every((s) => s.has(d))).sort();
    }

    function getNumberOne(date: string, chartId: string): { name: string; artist: string } | null {
      const entries = allChartData[chartId]?.entriesByDate[date];
      if (!entries) return null;
      const top = entries.find((e) => e.position === 1);
      return top ? { name: top.name, artist: top.artist } : null;
    }

    // Top All-Kill: #1 on Hot 100 + Top 100 Albums + Artist 50 by the same artist
    const topCharts = ["songs", "albums", "artists"];
    const topAllKillDates = getAllCommonDates(topCharts);
    const topAllKills: { name: string; artist: string; date: string; count: number; charts: string[]; entries: string[] }[] = [];
    for (const date of topAllKillDates) {
      const n1 = getNumberOne(date, topCharts[0]);
      if (!n1) continue;
      const chartsHit: string[] = [];
      const entriesHit: string[] = [];
      let allMatch = true;
      for (const cid of topCharts) {
        const n = getNumberOne(date, cid);
        if (n && n.artist === n1.artist) {
          chartsHit.push(chartsConfig[cid].title);
          entriesHit.push(n.name);
        } else {
          allMatch = false;
          break;
        }
      }
      if (allMatch && chartsHit.length === topCharts.length) {
        topAllKills.push({ name: n1.name, artist: n1.artist, date, count: chartsHit.length, charts: chartsHit, entries: entriesHit });
      }
    }

    // Full All-Kill: #1 on ALL charts by the same artist (different entries allowed)
    const fullAllKillDates = getAllCommonDates(allChartIds);
    const fullAllKills: { name: string; artist: string; date: string; count: number; charts: string[]; entries: string[] }[] = [];
    for (const date of fullAllKillDates) {
      const n1 = getNumberOne(date, allChartIds[0]);
      if (!n1) continue;
      const chartsHit: string[] = [];
      const entriesHit: string[] = [];
      let allMatch = true;
      for (const cid of allChartIds) {
        const n = getNumberOne(date, cid);
        if (n && n.artist === n1.artist) {
          chartsHit.push(chartsConfig[cid].title);
          entriesHit.push(n.name);
        } else {
          allMatch = false;
          break;
        }
      }
      if (allMatch && chartsHit.length === allChartIds.length) {
        fullAllKills.push({ name: n1.name, artist: n1.artist, date, count: chartsHit.length, charts: chartsHit, entries: entriesHit });
      }
    }

    // Song All-Kill: #1 on all song charts
    const songAllKillDates = getAllCommonDates(songChartIds);
    const songAllKills: { name: string; artist: string; date: string; count: number; charts: string[] }[] = [];
    for (const date of songAllKillDates) {
      const n1 = getNumberOne(date, songChartIds[0]);
      if (!n1) continue;
      const chartsHit: string[] = [];
      let allMatch = true;
      for (const cid of songChartIds) {
        const n = getNumberOne(date, cid);
        if (n && n.name === n1.name && n.artist === n1.artist) {
          chartsHit.push(chartsConfig[cid].title);
        } else {
          allMatch = false;
          break;
        }
      }
      if (allMatch && chartsHit.length === songChartIds.length) {
        songAllKills.push({ name: n1.name, artist: n1.artist, date, count: chartsHit.length, charts: chartsHit });
      }
    }

    // Album All-Kill: #1 on all album charts
    const albumAllKillDates = getAllCommonDates(albumChartIds);
    const albumAllKills: { name: string; artist: string; date: string; count: number; charts: string[] }[] = [];
    for (const date of albumAllKillDates) {
      const n1 = getNumberOne(date, albumChartIds[0]);
      if (!n1) continue;
      const chartsHit: string[] = [];
      let allMatch = true;
      for (const cid of albumChartIds) {
        const n = getNumberOne(date, cid);
        if (n && n.name === n1.name && n.artist === n1.artist) {
          chartsHit.push(chartsConfig[cid].title);
        } else {
          allMatch = false;
          break;
        }
      }
      if (allMatch && chartsHit.length === albumChartIds.length) {
        albumAllKills.push({ name: n1.name, artist: n1.artist, date, count: chartsHit.length, charts: chartsHit });
      }
    }

    return { chartStats, availableYears, chartIds, allKills: { top: topAllKills, full: fullAllKills, songs: songAllKills, albums: albumAllKills } };
  });
});

export const getStats = createServerFn({ method: "GET" }).handler(async () => {
  return cached("stats", async () => {
    const cfg = chartsConfig.statsData;
    const rows = await fetchCsv(cfg.url);
    const header = rows[0].map((h) => h.toLowerCase().trim());
    const rankIdx = findIdx(header, ["rank", "pos", "position"]);
    const catIdx = findIdx(header, ["stats", "category"]);
    const itemIdx = findIdx(header, ["artist/song", "item", "title", "name"]);
    const numIdx = findIdx(header, ["number", "value", "total", "count"]);
    const byCategory: Record<string, { rank: number; item: string; number: string }[]> = {};
    for (const r of rows.slice(1)) {
      const cat = (r[catIdx] ?? "").trim();
      if (!cat) continue;
      (byCategory[cat] ||= []).push({
        rank: toInt(r[rankIdx]),
        item: (r[itemIdx] ?? "").trim(),
        number: (r[numIdx] ?? "").trim(),
      });
    }
    for (const list of Object.values(byCategory)) {
      list.sort((a, b) => {
        if (a.rank !== b.rank) return a.rank - b.rank;
        const numA = parseFloat(a.number.replace(/[^\d.-]/g, '')) || 0;
        const numB = parseFloat(b.number.replace(/[^\d.-]/g, '')) || 0;
        return numB - numA;
      });
    }
    return { categories: Object.keys(byCategory), byCategory };
  });
});
