import { createServerFn } from "@tanstack/react-start";

function getNodeModules() {
  try {
    const fs = require("fs");
    const path = require("path");
    return { fs, path, CACHE_DIR: path.join(process.cwd(), "data") };
  } catch { return null; }
}

let audioCache: Record<string, { previewUrl: string | null; duration: number | null; artworkUrl: string | null; source: string | null; checkedAt: number }> = {};
try {
  const node = getNodeModules();
  if (node) {
    const cacheFile = node.path.join(node.CACHE_DIR, "audio-cache.json");
    if (node.fs.existsSync(cacheFile)) {
      audioCache = JSON.parse(node.fs.readFileSync(cacheFile, "utf-8"));
    }
  }
} catch {}

function saveAudioCache() {
  try {
    const node = getNodeModules();
    if (!node) return;
    const cacheFile = node.path.join(node.CACHE_DIR, "audio-cache.json");
    if (!node.fs.existsSync(node.CACHE_DIR)) node.fs.mkdirSync(node.CACHE_DIR, { recursive: true });
    node.fs.writeFileSync(cacheFile, JSON.stringify(audioCache));
  } catch {}
}

const CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/&/g, "and").replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
}

function looseMatch(query: string, target: string): boolean {
  const a = norm(query);
  const b = norm(target);
  if (a.includes(b) || b.includes(a)) return true;
  const wordsA = a.split(" ").filter(Boolean);
  const wordsB = b.split(" ").filter(Boolean);
  const matched = wordsA.filter((w) => wordsB.some((wb) => wb.includes(w) || w.includes(wb)));
  return matched.length >= Math.min(wordsA.length, wordsB.length) * 0.6;
}

interface AudioResult {
  previewUrl: string | null;
  duration: number | null;
  artworkUrl: string | null;
  trackName: string;
  artistName: string;
  source: string;
}

async function searchiTunes(artist: string, track: string): Promise<AudioResult | null> {
  try {
    const term = `${artist} ${track}`;
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=song&limit=10`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!response.ok) return null;
    const data = await response.json();

    // Exact match pass
    for (const r of data.results ?? []) {
      if (!r.previewUrl) continue;
      const tMatch = looseMatch(r.trackName ?? "", track);
      const aMatch = looseMatch(r.artistName ?? "", artist);
      if (tMatch && aMatch) {
        return {
          previewUrl: r.previewUrl,
          duration: r.trackTimeMillis ? Math.round(r.trackTimeMillis / 1000) : null,
          artworkUrl: r.artworkUrl100?.replace("100x100bb", "600x600bb") ?? null,
          trackName: r.trackName ?? track,
          artistName: r.artistName ?? artist,
          source: "itunes",
        };
      }
    }

    // Loose: any result with matching artist
    for (const r of data.results ?? []) {
      if (!r.previewUrl) continue;
      if (looseMatch(r.artistName ?? "", artist)) {
        return {
          previewUrl: r.previewUrl,
          duration: r.trackTimeMillis ? Math.round(r.trackTimeMillis / 1000) : null,
          artworkUrl: r.artworkUrl100?.replace("100x100bb", "600x600bb") ?? null,
          trackName: r.trackName ?? track,
          artistName: r.artistName ?? artist,
          source: "itunes",
        };
      }
    }
  } catch {}
  return null;
}

async function searchDeezer(artist: string, track: string): Promise<AudioResult | null> {
  try {
    const url = `https://api.deezer.com/search?q=${encodeURIComponent(`${track} ${artist}`)}&limit=10`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!response.ok) return null;
    const data = await response.json();

    // Exact match pass
    for (const r of data.data ?? []) {
      if (!r.preview) continue;
      const tMatch = looseMatch(r.title ?? "", track);
      const aMatch = looseMatch(r.artist?.name ?? "", artist);
      if (tMatch && aMatch) {
        return {
          previewUrl: r.preview,
          duration: r.duration ?? null,
          artworkUrl: r.album?.cover_xl || r.album?.cover_big || null,
          trackName: r.title ?? track,
          artistName: r.artist?.name ?? artist,
          source: "deezer",
        };
      }
    }

    // Loose: matching artist only
    for (const r of data.data ?? []) {
      if (!r.preview) continue;
      if (looseMatch(r.artist?.name ?? "", artist)) {
        return {
          previewUrl: r.preview,
          duration: r.duration ?? null,
          artworkUrl: r.album?.cover_xl || r.album?.cover_big || null,
          trackName: r.title ?? track,
          artistName: r.artist?.name ?? artist,
          source: "deezer",
        };
      }
    }
  } catch {}
  return null;
}

async function searchSpotifyPreview(artist: string, track: string): Promise<AudioResult | null> {
  // Spotify doesn't provide preview URLs via client_credentials anymore for most tracks,
  // but we can try as a last resort via their oEmbed API for metadata
  return null;
}

export const getAudioPreview = createServerFn({ method: "GET" })
  .validator((d: { artist: string; track: string }) => d)
  .handler(async ({ data }) => {
    const cacheKey = `${data.artist}|||${data.track}`.toLowerCase();

    const cached = audioCache[cacheKey];
    if (cached && Date.now() - cached.checkedAt < CACHE_TTL) {
      return {
        previewUrl: cached.previewUrl,
        duration: cached.duration,
        artworkUrl: cached.artworkUrl,
        source: cached.source,
        trackName: data.track,
        artistName: data.artist,
      };
    }

    // Search iTunes and Deezer in parallel
    const [itunesResult, deezerResult] = await Promise.all([
      searchiTunes(data.artist, data.track),
      searchDeezer(data.artist, data.track),
    ]);

    // Prefer Deezer (better Brazilian coverage), then iTunes
    const result = deezerResult || itunesResult || await searchSpotifyPreview(data.artist, data.track);

    const entry = {
      previewUrl: result?.previewUrl ?? null,
      duration: result?.duration ?? null,
      artworkUrl: result?.artworkUrl ?? null,
      source: result?.source ?? null,
      checkedAt: Date.now(),
    };

    audioCache[cacheKey] = entry;
    saveAudioCache();

    return {
      previewUrl: entry.previewUrl,
      duration: entry.duration,
      artworkUrl: entry.artworkUrl,
      source: entry.source,
      trackName: result?.trackName ?? data.track,
      artistName: result?.artistName ?? data.artist,
    };
  });
