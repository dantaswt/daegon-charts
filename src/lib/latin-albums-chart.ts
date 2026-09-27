import { createServerFn } from "@tanstack/react-start";
import { getWeeklyChart, type ChartEntry, type WeeklyChartData } from "./charts.functions";

const RELEASES_URL = "https://docs.google.com/spreadsheets/d/1t6_7SOlspmNYrXq8PSfJ74frIdrWwQBFITQ3bQmRzeg/gviz/tq?tq=select%20*&tqx=out:csv&gid=1618822736";

async function fetchReleasesCsv(): Promise<Map<string, string>> {
  const res = await fetch(RELEASES_URL, { headers: { "cache-control": "public, max-age=300" }, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`Releases CSV fetch failed ${res.status}`);
  let text = await res.text();
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const Papa = (await import("papaparse")).default;
  const parsed = Papa.parse<string[]>(text, { skipEmptyLines: true });
  const rows = parsed.data as string[][];
  if (rows.length < 2) return new Map();
  const header = rows[0].map((h) => h.toLowerCase().trim());
  const artistIdx = header.findIndex((h) => h === "artist");
  const albumIdx = header.findIndex((h) => h === "album");
  const genreIdx = header.findIndex((h) => h === "genre");
  const genre2Idx = header.findIndex((h) => h === "genre 2");
  if (artistIdx < 0 || albumIdx < 0 || genreIdx < 0) return new Map();

  const map = new Map<string, string>();
  for (const r of rows.slice(1)) {
    const artist = (r[artistIdx] ?? "").trim();
    const album = (r[albumIdx] ?? "").trim();
    const genre = (r[genreIdx] ?? "").trim();
    const genre2 = genre2Idx >= 0 ? (r[genre2Idx] ?? "").trim() : "";
    if (!artist || !album) continue;
    const key = `${album.toLowerCase()}||${artist.toLowerCase()}`;
    const combined = [genre, genre2].filter(Boolean).join(", ");
    if (combined) map.set(key, combined);
  }
  return map;
}

const LATIN_GENRE_PATTERNS = [
  "latin", "reggaeton", "urbano", "latin urban", "latin trap",
  "salsa", "bachata", "merengue", "cumbia", "reggae en espanol",
  "latin hip hop", "latin rock", "latin alternative", "latin metal",
  "bossa nova", "mpb", "forró", "forro", "sertanejo", "pagode", "funk",
  "brega", "axé", "piseiro", "pisadinha",
  "spanish pop", "spanish rock", "spanish hip hop",
  "brazilian pop", "brazilian rock", "brazilian hip hop", "brazilian funk",
  "portuguese pop", "portuguese rock",
  "tropical", "tropipop", "vallenato", "grupero", "norteño", "banda",
  "corrido", "ranchera", "mariachi",
  "kizomba", "kuduro",
];

function isLatinGenre(genreStr: string): boolean {
  const lower = genreStr.toLowerCase();
  return LATIN_GENRE_PATTERNS.some((kw) => lower.includes(kw));
}

interface AlbumTracking {
  name: string;
  artist: string;
  peak: number;
  weeks: number;
  weeksAt1: number;
}

function buildLatinChart(albumData: WeeklyChartData, releasesGenreMap: Map<string, string>) {
  const latinAlbumsByDate: Record<string, ChartEntry[]> = {};

  const tracking: Map<string, AlbumTracking> = new Map();
  const everOnLatinChart = new Set<string>();

  for (const date of albumData.dates) {
    const entries = albumData.entriesByDate[date] || [];

    // Find Latin albums present on the main chart this week
    const latinAlbumsThisWeek: { key: string; name: string; artist: string; mainPos: number }[] = [];
    for (const e of entries) {
      const key = `${e.name.toLowerCase()}||${e.artist.toLowerCase()}`;
      const genreStr = releasesGenreMap.get(key) ?? "";
      if (genreStr && isLatinGenre(genreStr)) {
        latinAlbumsThisWeek.push({ key, name: e.name, artist: e.artist, mainPos: e.position });
      }
    }

    latinAlbumsThisWeek.sort((a, b) => a.mainPos - b.mainPos);

    // Previous week's Latin chart positions
    const prevDateIdx = albumData.dates.indexOf(date) - 1;
    const prevDate = prevDateIdx >= 0 ? albumData.dates[prevDateIdx] : null;
    const prevWeekEntries = prevDate ? (latinAlbumsByDate[prevDate] ?? []) : [];
    const prevWeekMap = new Map<string, number>();
    for (const pe of prevWeekEntries) {
      prevWeekMap.set(`${pe.name.toLowerCase()}||${pe.artist.toLowerCase()}`, pe.position);
    }

    // Build this week's chart: first from main chart, then carry-forward
    const maxSlots = 25;
    const chartThisWeek: { key: string; name: string; artist: string }[] = [];
    const seenInWeek = new Set<string>();

    for (const item of latinAlbumsThisWeek) {
      if (chartThisWeek.length >= maxSlots) break;
      chartThisWeek.push({ key: item.key, name: item.name, artist: item.artist });
      seenInWeek.add(item.key);
    }

    if (chartThisWeek.length < maxSlots && prevWeekEntries.length > 0) {
      for (const pe of prevWeekEntries) {
        if (chartThisWeek.length >= maxSlots) break;
        const pKey = `${pe.name.toLowerCase()}||${pe.artist.toLowerCase()}`;
        if (seenInWeek.has(pKey)) continue;
        const genreStr = releasesGenreMap.get(pKey) ?? "";
        if (!genreStr || !isLatinGenre(genreStr)) continue;
        chartThisWeek.push({ key: pKey, name: pe.name, artist: pe.artist });
        seenInWeek.add(pKey);
      }
    }

    // Compute diff, peak, weeks, weeksAt1 — all isolated to this chart
    const weekEntries: ChartEntry[] = chartThisWeek.map((item, i) => {
      const newPos = i + 1;
      const pKey = item.key;
      const prevPos = prevWeekMap.get(pKey);

      let diff = "";
      if (prevPos != null) {
        if (newPos < prevPos) diff = `▲${prevPos - newPos}`;
        else if (newPos > prevPos) diff = `▼${newPos - prevPos}`;
        else diff = "=";
      } else {
        diff = everOnLatinChart.has(pKey) ? "RE" : "NEW";
      }

      const existing = tracking.get(pKey);
      const peak = existing ? Math.min(existing.peak, newPos) : newPos;
      const weeks = existing ? existing.weeks + 1 : 1;
      const weeksAt1 = (existing?.weeksAt1 ?? 0) + (newPos === 1 ? 1 : 0);

      tracking.set(pKey, { name: item.name, artist: item.artist, peak, weeks, weeksAt1 });
      everOnLatinChart.add(pKey);

      // LW: show previous position only if was on chart last week; NEW/RE get no LW
      const lastWeek = prevPos != null ? String(prevPos) : undefined;

      return {
        position: newPos,
        diff,
        name: item.name,
        artist: item.artist,
        peak,
        weeks,
        weeksAt1,
        lastWeek,
        kind: "album" as const,
      };
    });

    latinAlbumsByDate[date] = weekEntries;
  }

  return {
    chartId: "topLatinAlbums",
    title: "Top Latin Albums",
    kind: "album" as const,
    dates: albumData.dates,
    entriesByDate: latinAlbumsByDate,
  };
}

export const getTopLatinAlbums = createServerFn({ method: "GET" })
  .handler(async () => {
    const [albumData, releasesGenreMap] = await Promise.all([
      getWeeklyChart({ data: { chartId: "albums" } }),
      fetchReleasesCsv(),
    ]);
    const filteredDates = albumData.dates.filter((d) => d >= "2017-01-01");
    const recentAlbumData: WeeklyChartData = {
      ...albumData,
      dates: filteredDates,
      entriesByDate: Object.fromEntries(
        filteredDates.map((d) => [d, albumData.entriesByDate[d] ?? []])
      ),
    };
    return buildLatinChart(recentAlbumData, releasesGenreMap);
  });
