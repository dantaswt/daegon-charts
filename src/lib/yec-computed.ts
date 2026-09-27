import { createServerFn } from "./client-server-fn";
import { getWeeklyChart, computeYearEndGenerated, getYearEndGenerated, type YECEntry } from "./charts.functions";
import { chartsConfig } from "./charts-config";
import { getTopLatinAlbums } from "./latin-albums-chart";
import artistMetadata from "./artist-metadata.json";

/* ────── Artist metadata classification (three-tier) ────── */
type ArtistMeta = {
  categoryConfirmed?: boolean;
  category?: "FEMALE" | "MALE" | "GROUP";
  typeConfirmed?: boolean;
  type?: string;
};
const metaMap = artistMetadata as Record<string, ArtistMeta>;

function classifyArtist(name: string): "female" | "male" | "group" | "pending" {
  const slug = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const meta = metaMap[slug];

  if (meta?.categoryConfirmed && meta.category) {
    if (meta.category === "GROUP") return "group";
    if (meta.category === "FEMALE") return "female";
    if (meta.category === "MALE") return "male";
  }

  return "pending";
}

/* ────── Hot 100 — Artists (total points per artist across all Hot 100 entries) ────── */
export const getYearEndHot100Artists = createServerFn({ method: "GET" })
  .handler(async () => {
    const chartData = await getWeeklyChart({ data: { chartId: "songs" } });
    const years: Record<string, Record<string, { name: string; artist: string; peak: number; weeks: number; weeksAt1: number; totalUnits: number; items: Set<string> }>> = {};

    for (const date of chartData.dates) {
      const year = date.slice(0, 4);
      const entries = chartData.entriesByDate[date] || [];
      if (!years[year]) years[year] = {};

      for (const e of entries) {
        const key = e.artist.toLowerCase();
        if (!years[year][key]) {
          years[year][key] = { name: e.artist, artist: e.artist, peak: 100, weeks: 0, weeksAt1: 0, totalUnits: 0, items: new Set() };
        }
        const a = years[year][key];
        a.weeks += 1;
        a.items.add(e.name.toLowerCase());
        if (e.peak < a.peak) a.peak = e.peak;
        a.weeksAt1 += (e.weeksAt1 ?? 0);
        const v = String(e.points ?? e.units ?? "0");
        a.totalUnits += parseInt(v.replace(/[^0-9]/g, "")) || 0;
      }
    }

    const result: Record<string, YECEntry[]> = {};
    for (const [year, items] of Object.entries(years)) {
      result[year] = Object.values(items)
        .sort((a, b) => b.totalUnits - a.totalUnits || a.peak - b.peak)
        .slice(0, 20)
        .map((e, i) => ({ position: i + 1, name: e.name, artist: e.artist, peak: e.peak, weeks: e.weeks, weeksAt1: e.weeksAt1, totalUnits: e.totalUnits, entries: e.items.size, kind: "artist" as const }));
    }

    const sortedYears = Object.keys(result).sort().reverse();
    return { years: sortedYears, entriesByYear: result, kind: "artist" as const, title: "Hot 100 — Artists" };
  });

/* ────── Top 100 Albums — Artists (total units per artist across all album entries) ────── */
export const getYearEndTop100AlbumsArtists = createServerFn({ method: "GET" })
  .handler(async () => {
    const chartData = await getWeeklyChart({ data: { chartId: "albums" } });
    const years: Record<string, Record<string, { name: string; artist: string; peak: number; weeks: number; weeksAt1: number; totalUnits: number; items: Set<string> }>> = {};

    for (const date of chartData.dates) {
      const year = date.slice(0, 4);
      const entries = chartData.entriesByDate[date] || [];
      if (!years[year]) years[year] = {};

      for (const e of entries) {
        const key = e.artist.toLowerCase();
        if (!years[year][key]) {
          years[year][key] = { name: e.artist, artist: e.artist, peak: 100, weeks: 0, weeksAt1: 0, totalUnits: 0, items: new Set() };
        }
        const a = years[year][key];
        a.weeks += 1;
        a.items.add(e.name.toLowerCase());
        if (e.peak < a.peak) a.peak = e.peak;
        a.weeksAt1 += (e.weeksAt1 ?? 0);
        const v = String(e.units ?? "0");
        a.totalUnits += parseInt(v.replace(/[^0-9]/g, "")) || 0;
      }
    }

    const result: Record<string, YECEntry[]> = {};
    for (const [year, items] of Object.entries(years)) {
      result[year] = Object.values(items)
        .sort((a, b) => b.totalUnits - a.totalUnits || a.peak - b.peak)
        .slice(0, 20)
        .map((e, i) => ({ position: i + 1, name: e.name, artist: e.artist, peak: e.peak, weeks: e.weeks, weeksAt1: e.weeksAt1, totalUnits: e.totalUnits, entries: e.items.size, kind: "artist" as const }));
    }

    const sortedYears = Object.keys(result).sort().reverse();
    return { years: sortedYears, entriesByYear: result, kind: "artist" as const, title: "Top 100 Albums — Artists" };
  });

/* ────── Top Artists — Male / Female / Duo+Group ────── */
function filterSolo(source: YECEntry[], male: boolean): YECEntry[] {
  return source.filter((e) => {
    const c = classifyArtist(e.name);
    if (c === "group" || c === "pending") return false;
    return male ? c === "male" : c === "female";
  }).slice(0, 10).map((e, i) => ({ ...e, position: i + 1 }));
}

function filterGroups(source: YECEntry[]): YECEntry[] {
  return source.filter((e) => classifyArtist(e.name) === "group")
    .slice(0, 10).map((e, i) => ({ ...e, position: i + 1 }));
}

export const getYearEndArtist50Male = createServerFn({ method: "GET" })
  .handler(async () => {
    const yec = await computeYearEndGenerated("artists");
    const result: Record<string, YECEntry[]> = {};
    for (const year of yec.years) {
      result[year] = filterSolo(yec.entriesByYear[year] || [], true);
    }
    return { years: yec.years, entriesByYear: result, kind: "artist" as const, title: "Top Artists — Male" };
  });

export const getYearEndArtist50Female = createServerFn({ method: "GET" })
  .handler(async () => {
    const yec = await computeYearEndGenerated("artists");
    const result: Record<string, YECEntry[]> = {};
    for (const year of yec.years) {
      result[year] = filterSolo(yec.entriesByYear[year] || [], false);
    }
    return { years: yec.years, entriesByYear: result, kind: "artist" as const, title: "Top Artists — Female" };
  });

export const getYearEndArtist50DuoGroup = createServerFn({ method: "GET" })
  .handler(async () => {
    const yec = await computeYearEndGenerated("artists");
    const result: Record<string, YECEntry[]> = {};
    for (const year of yec.years) {
      result[year] = filterGroups(yec.entriesByYear[year] || []);
    }
    return { years: yec.years, entriesByYear: result, kind: "artist" as const, title: "Top Artists — Duo/Group" };
  });

/* ────── Radio Songs — Artists (total audience per artist across all radio entries) ────── */
export const getYearEndRadioSongsArtists = createServerFn({ method: "GET" })
  .handler(async () => {
    const chartData = await getWeeklyChart({ data: { chartId: "radioSongs" } });
    const years: Record<string, Record<string, { name: string; artist: string; peak: number; weeks: number; weeksAt1: number; totalUnits: number; items: Set<string> }>> = {};

    for (const date of chartData.dates) {
      const year = date.slice(0, 4);
      const entries = chartData.entriesByDate[date] || [];
      if (!years[year]) years[year] = {};

      for (const e of entries) {
        const key = e.artist.toLowerCase();
        if (!years[year][key]) {
          years[year][key] = { name: e.artist, artist: e.artist, peak: 100, weeks: 0, weeksAt1: 0, totalUnits: 0, items: new Set() };
        }
        const a = years[year][key];
        a.weeks += 1;
        a.items.add(e.name.toLowerCase());
        if (e.peak < a.peak) a.peak = e.peak;
        a.weeksAt1 += (e.weeksAt1 ?? 0);
        const v = String(e.audience ?? e.units ?? "0");
        a.totalUnits += parseInt(v.replace(/[^0-9]/g, "")) || 0;
      }
    }

    const result: Record<string, YECEntry[]> = {};
    for (const [year, items] of Object.entries(years)) {
      result[year] = Object.values(items)
        .sort((a, b) => b.totalUnits - a.totalUnits || a.peak - b.peak)
        .slice(0, 20)
        .map((e, i) => ({ position: i + 1, name: e.name, artist: e.artist, peak: e.peak, weeks: e.weeks, weeksAt1: e.weeksAt1, totalUnits: e.totalUnits, entries: e.items.size, kind: "artist" as const }));
    }

    const sortedYears = Object.keys(result).sort().reverse();
    return { years: sortedYears, entriesByYear: result, kind: "artist" as const, title: "Radio Songs — Artists" };
  });

/* ────── Year-End Top Latin Albums (mirrors YEC Top 100 Albums, filtered to Latin) ────── */
export const getYearEndTopLatinAlbums = createServerFn({ method: "GET" })
  .handler(async () => {
    const [latinData, yecAlbums] = await Promise.all([
      getTopLatinAlbums(),
      computeYearEndGenerated("albums"),
    ]);

    // Build Latin album keys from weekly Latin chart (all albums that ever appeared)
    const latinAlbumKeys = new Set<string>();
    for (const date of latinData.dates) {
      for (const e of latinData.entriesByDate[date] ?? []) {
        latinAlbumKeys.add(`${e.name.toLowerCase()}||${e.artist.toLowerCase()}`);
      }
    }

    // Also build peak/weeks from Latin chart for display
    const latinStats: Record<string, { peak: number; weeks: number; weeksAt1: number }> = {};
    for (const date of latinData.dates) {
      for (const e of latinData.entriesByDate[date] ?? []) {
        const key = `${e.name.toLowerCase()}||${e.artist.toLowerCase()}`;
        const existing = latinStats[key];
        if (existing) {
          existing.weeks += 1;
          if (e.peak < existing.peak) existing.peak = e.peak;
          existing.weeksAt1 += (e.weeksAt1 ?? 0);
        } else {
          latinStats[key] = { peak: e.peak, weeks: 1, weeksAt1: e.weeksAt1 ?? 0 };
        }
      }
    }

    const result: Record<string, YECEntry[]> = {};
    for (const year of yecAlbums.years) {
      const yecEntries = yecAlbums.entriesByYear[year] ?? [];

      // First: Latin albums in YEC Top 100 Albums order
      const latinInYec = yecEntries.filter((e) => {
        const key = `${e.name.toLowerCase()}||${e.artist.toLowerCase()}`;
        return latinAlbumKeys.has(key);
      });

      // If >= 25, just take top 25
      if (latinInYec.length >= 25) {
        result[year] = latinInYec.slice(0, 25).map((e, i) => {
          const key = `${e.name.toLowerCase()}||${e.artist.toLowerCase()}`;
          const stats = latinStats[key];
          return {
            position: i + 1,
            name: e.name,
            artist: e.artist,
            peak: stats?.peak ?? e.peak,
            weeks: stats?.weeks ?? e.weeks,
            weeksAt1: stats?.weeksAt1 ?? e.weeksAt1,
            totalUnits: e.totalUnits,
            kind: "album" as const,
          };
        });
      } else {
        // Fill remaining slots with Latin chart points logic
        const latinPtsByAlbum: Record<string, { name: string; artist: string; peak: number; weeks: number; weeksAt1: number; points: number }> = {};
        for (const date of latinData.dates) {
          if (date.slice(0, 4) !== year) continue;
          for (const e of latinData.entriesByDate[date] ?? []) {
            const key = `${e.name.toLowerCase()}||${e.artist.toLowerCase()}`;
            const pts = Math.max(0, 26 - e.position);
            const existing = latinPtsByAlbum[key];
            if (existing) {
              existing.weeks += 1;
              existing.points += pts;
              if (e.peak < existing.peak) existing.peak = e.peak;
              existing.weeksAt1 += (e.weeksAt1 ?? 0);
            } else {
              latinPtsByAlbum[key] = {
                name: e.name,
                artist: e.artist,
                peak: e.peak,
                weeks: 1,
                weeksAt1: e.weeksAt1 ?? 0,
                points: pts,
              };
            }
          }
        }

        // Already placed from YEC
        const placed = new Set(latinInYec.map((e) => `${e.name.toLowerCase()}||${e.artist.toLowerCase()}`));

        const extra = Object.values(latinPtsByAlbum)
          .filter((e) => !placed.has(`${e.name.toLowerCase()}||${e.artist.toLowerCase()}`))
          .sort((a, b) => b.points - a.points || a.peak - b.peak);

        const combined = [
          ...latinInYec.map((e) => ({
            position: 0,
            name: e.name,
            artist: e.artist,
            peak: latinStats[`${e.name.toLowerCase()}||${e.artist.toLowerCase()}`]?.peak ?? e.peak,
            weeks: latinStats[`${e.name.toLowerCase()}||${e.artist.toLowerCase()}`]?.weeks ?? e.weeks,
            weeksAt1: latinStats[`${e.name.toLowerCase()}||${e.artist.toLowerCase()}`]?.weeksAt1 ?? e.weeksAt1,
            totalUnits: e.totalUnits,
          })),
          ...extra.map((e) => ({
            position: 0,
            name: e.name,
            artist: e.artist,
            peak: e.peak,
            weeks: e.weeks,
            weeksAt1: e.weeksAt1,
            totalUnits: e.points,
          })),
        ];

        result[year] = combined.slice(0, 25).map((e, i) => ({
          ...e,
          position: i + 1,
          kind: "album" as const,
        }));
      }
    }

    const sortedYears = Object.keys(result).sort().reverse();
    return { years: sortedYears, entriesByYear: result, kind: "album" as const, title: "Top Latin Albums" };
  });

/* ────── Decade-End: aggregate YEC data across years in a decade ────── */
export interface DecadeEntry {
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

export const DECADES = [
  { label: "1960", startYear: 1960, endYear: 1969 },
  { label: "1970", startYear: 1970, endYear: 1979 },
  { label: "1980", startYear: 1980, endYear: 1989 },
  { label: "1990", startYear: 1990, endYear: 1999 },
  { label: "2000", startYear: 2000, endYear: 2009 },
  { label: "2010", startYear: 2010, endYear: 2019 },
] as const;

export function aggregateYecForDecade(yec: { years: string[]; entriesByYear: Record<string, YECEntry[]>; kind: "song" | "album" | "artist" }, startYear: number, endYear: number): DecadeEntry[] {
  const aggregated: Record<string, { name: string; artist: string; peak: number; weeks: number; weeksAt1: number; totalUnits: number; kind: "song" | "album" | "artist"; appearances: number }> = {};

  for (const [year, entries] of Object.entries(yec.entriesByYear)) {
    const y = parseInt(year);
    if (y < startYear || y > endYear) continue;
    for (const e of entries) {
      const key = `${e.name.toLowerCase()}||${e.artist.toLowerCase()}`;
      if (!aggregated[key]) {
        aggregated[key] = { name: e.name, artist: e.artist, peak: 100, weeks: 0, weeksAt1: 0, totalUnits: 0, kind: e.kind, appearances: 0 };
      }
      const a = aggregated[key];
      a.weeks += e.weeks;
      a.weeksAt1 += e.weeksAt1;
      a.totalUnits += e.totalUnits;
      a.appearances += 1;
      if (e.peak < a.peak) a.peak = e.peak;
    }
  }

  return Object.values(aggregated)
    .sort((a, b) => b.totalUnits - a.totalUnits || a.peak - b.peak)
    .slice(0, 100)
    .map((e, i) => ({ ...e, position: i + 1 }));
}

export const getDecadeEndGenerated = createServerFn({ method: "GET" })
  .validator((d: { chartId: string; decadeLabel: string }) => d)
  .handler(async ({ data }) => {
    const decade = DECADES.find((d) => d.label === data.decadeLabel) ?? DECADES[0];
    const weeklyChartId = data.chartId.replace("decadeEnd", "").replace(/^./, (c) => c.toLowerCase());
    const weeklyMap: Record<string, string> = {
      songs: "songs", artists: "artists", albums: "albums", radio: "radioSongs",
      streamingSongs: "streamingSongs", topStreamingAlbums: "topStreamingAlbums",
      topAlbumSales: "topAlbumSales", digitalSongsSales: "digitalSongsSales",
    };
    const mappedId = weeklyMap[weeklyChartId] ?? weeklyChartId;
    const yec = await computeYearEndGenerated(mappedId);
    const entries = aggregateYecForDecade(yec, decade.startYear, decade.endYear);
    const title = chartsConfig[data.chartId]?.title ?? data.chartId;
    return { decades: DECADES.map((d) => d.label), entriesByDecade: { [decade.label]: entries }, kind: yec.kind, title };
  });
