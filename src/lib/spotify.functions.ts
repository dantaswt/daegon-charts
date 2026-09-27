import { createServerFn } from "@tanstack/react-start";

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID ?? "";
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET ?? "";

let accessToken: string | null = null;
let tokenExpiresAt = 0;
const imageCache = new Map<string, string | null>();

function getNodeModules() {
  try {
    const fs = require("fs");
    const path = require("path");
    const CACHE_DIR = path.join(process.cwd(), "data");
    return { fs, path, CACHE_DIR };
  } catch { return null; }
}

let persistentCache: Record<string, string> = {};
let failCache: Record<string, number> = {};
try {
  const node = getNodeModules();
  if (node) {
    const imgFile = node.path.join(node.CACHE_DIR, "image-cache.json");
    if (node.fs.existsSync(imgFile)) persistentCache = JSON.parse(node.fs.readFileSync(imgFile, "utf-8"));
    const failFile = node.path.join(node.CACHE_DIR, "image-fail-cache.json");
    if (node.fs.existsSync(failFile)) failCache = JSON.parse(node.fs.readFileSync(failFile, "utf-8"));
  }
} catch {}

function savePersistentCache() {
  try {
    const node = getNodeModules();
    if (!node) return;
    const dir = node.path.join(node.CACHE_DIR, "image-cache.json");
    if (!node.fs.existsSync(node.CACHE_DIR)) node.fs.mkdirSync(node.CACHE_DIR, { recursive: true });
    node.fs.writeFileSync(dir, JSON.stringify(persistentCache));
  } catch {}
}

function saveFailCache() {
  try {
    const node = getNodeModules();
    if (!node) return;
    const dir = node.path.join(node.CACHE_DIR, "image-fail-cache.json");
    if (!node.fs.existsSync(node.CACHE_DIR)) node.fs.mkdirSync(node.CACHE_DIR, { recursive: true });
    node.fs.writeFileSync(dir, JSON.stringify(failCache));
  } catch {}
}

const FAIL_TTL = 30 * 60 * 1000;
function isFailed(key: string): boolean {
  const ts = failCache[key];
  if (!ts) return false;
  if (Date.now() - ts > FAIL_TTL) { delete failCache[key]; return false; }
  return true;
}

function markFailed(key: string) {
  failCache[key] = Date.now();
  saveFailCache();
}

const KNOWN_ARTIST_IDS: Record<string, string> = {
  "jao": "59FrDXDVJz0EKqYg39dnT2",
  "girls": "6IrnQvYWhXayVvhB4qKUSR",
  "avalanch": "1tqhcSjAUhQPXd2WsaU6C4",
  "the_weeknd": "1Xyo4u8uXC1ZmMpatF05PJ",
  "the_beatles": "3WrFJ7ztbogyGnzhbVl2EY",
  "bon_jovi": "58lV9VcRSjABXIdehiDU5k",
  "maroon_5": "04gDigrS5kc9YWfZHwBETP",
  "coldplay": "4gzpq5DPGxSnKw4USahUn0",
  "bts": "3Nrfpe0tUJi4K4DXYWgMUX",
  "sza": "7tYKF4w9nC0nq9CsPZTHyP",
  "rbd": "7cjh6y0V9SsyCrWSXTzwOs",
  "rouge": "7oCPozHYsiILeiQlma8EEj",
  "iza": "3zgnrYIltMkgeejmvMCnes",
  "fun.": "5nCi3BB41mBaMH9gfr6Su0",
  "f(x)": "3wRA5UYoo08BBKJnzyKkpF",
  "i.o.i": "6RKnXXyprPjhBdCvL802Ku",
  "ravena": "5jnvLdIq82U5JWfYRZKLYg",
  "cast_of_rent": "0ZAibQ1lZh5UbUaQybsn62",
  "teen_angels": "5bRULziD2hCP3acYRcfK3E",
};

async function getAccessToken() {
  if (accessToken && Date.now() < tokenExpiresAt) return accessToken;
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: "Basic " + btoa(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`),
    },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) return null;
  const data = await response.json();
  accessToken = data.access_token;
  tokenExpiresAt = Date.now() + data.expires_in * 1000 - 60_000;
  return accessToken;
}

function fieldValue(query: string, field: string) {
  return query.match(new RegExp(`${field}:"([^"]+)"`, "i"))?.[1]?.trim() ?? "";
}

function comparable(value: string) {
  return value
    .toLocaleLowerCase("en")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function exactMatch(actual: string, expected: string): boolean {
  return comparable(actual) === comparable(expected);
}

function isUsableImageUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  const lower = url.toLowerCase();
  // Last.fm's generic "no image" asset is a real 200 response, so <img onError>
  // never fires and the UI can show a black/blank square. Reject it server-side.
  if (lower.includes("2a96cbd8b46e442fc41c2b86b821562f")) return false;
  if (lower.includes("default_album") || lower.includes("noimage") || lower.includes("no-image")) return false;
  return true;
}

function extractYear(name: string): { year: string | null; stripped: string } {
  const match = name.match(/\b(19|20)\d{2}\b/);
  return { year: match ? match[0] : null, stripped: match ? name.replace(match[0], "").trim() : name };
}

function albumVariants(name: string): string[] {
  const { year, stripped } = extractYear(name);
  const variants = [name];
  if (year && stripped.trim()) variants.push(stripped.trim());
  return variants;
}

function artistMatch(album: any, expectedArtist: string): boolean {
  if (!expectedArtist) return true;
  const artists = (album.artists ?? []).map((a: any) => comparable(a.name ?? ""));
  const expected = comparable(expectedArtist);
  return artists.some((n: string) => n === expected);
}

async function fetchJson(url: string, init?: RequestInit): Promise<any> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const response = await fetch(url, { ...init, signal: controller.signal });
    clearTimeout(timeout);
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

async function spotifySearch(token: string, query: string, type: "album" | "artist" | "track" | "playlist", limit = 10) {
  const url = new URL("https://api.spotify.com/v1/search");
  url.searchParams.set("q", query);
  url.searchParams.set("type", type);
  url.searchParams.set("limit", String(limit));
  try {
    const response = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10_000) });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

async function searchDeviantArt(albumName: string, artistName: string): Promise<string | null> {
  try {
    const q = `${albumName} ${artistName} fan art album cover`;
    const url = `https://backend.deviantart.com/rss.xml?q=${encodeURIComponent(q)}&type=deviation`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!response.ok) return null;
    const text = await response.text();
    const matches = [...text.matchAll(/<media:thumbnail[^>]*url="([^"]+)"/g)];
    return matches[0]?.[1] ?? null;
  } catch {
    return null;
  }
}

async function searchTheAudioDB(name: string, kind: "artist" | "album", artistName?: string): Promise<string | null> {
  try {
    let url: string;
    if (kind === "artist") {
      url = `https://www.theaudiodb.com/api/v1/json/123/search.php?s=${encodeURIComponent(name)}`;
    } else {
      url = `https://www.theaudiodb.com/api/v1/json/123/searchalbum.php?s=${encodeURIComponent(artistName || "")}&a=${encodeURIComponent(name)}`;
    }
    const data = await fetchJson(url);
    if (kind === "artist") {
      const artist = data?.artists?.[0];
      if (artist?.strArtistThumb) return artist.strArtistThumb;
    } else {
      const album = data?.album?.[0];
      if (album?.strAlbumThumb) return album.strAlbumThumb;
    }
  } catch {}
  return null;
}

export const getSpotifyImage = createServerFn({ method: "GET" })
  .inputValidator((d: { query: string; type: "album" | "artist" | "track" }) => d)
  .handler(async ({ data }) => {
    const cacheKey = `${data.type}:${data.query.trim()}`;
    if (imageCache.has(cacheKey)) return imageCache.get(cacheKey);
    if (persistentCache[cacheKey]) {
      if (isUsableImageUrl(persistentCache[cacheKey])) {
        imageCache.set(cacheKey, persistentCache[cacheKey]);
        return persistentCache[cacheKey];
      }
      delete persistentCache[cacheKey];
      savePersistentCache();
    }
    if (isFailed(cacheKey)) {
      return "data:image/svg+xml," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"><rect width="300" "300" fill="%23e5e7eb"/><text x="150" y="170" text-anchor="middle" font-size="120" fill="%239ca3af">♪</text></svg>`);
    }
    const token = await getAccessToken();

    // Hardcoded overrides for albums where Spotify search fails
    const HARDCODED_ALBUM_IMAGES: Record<string, string> = {
      "checkmate": "https://image-cdn-ak.spotifycdn.com/image/ab67706c0000da841ebe14cc216c7be9269638d7",
      "solo": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02c0f23c0d2af5ec63daef87f0",
      "ritalee1979": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02471646faaecf4b53e95b5c1c",
      "rebeldes": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e025637ea9091a58684212c8fea",
      "equals": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02dc806722f6802a8ea9953c89",
      "brasileirinha": "https://static.wikia.nocookie.net/anitta/images/0/0c/BRASILEIRINHA.png/revision/latest?cb=20210622000705&path-prefix=pt-br",
      "girlfromrio": "https://i.pinimg.com/736x/9d/1a/66/9d1a663dae6e7251e69c75e8605b9ce9.jpg",
      "acontece": "https://i.pinimg.com/736x/72/c5/fd/72c5fdbdcb418854b7aee2c12720007b.jpg",
      "wanessacamargo": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02b3053279804f33dd993d032c",
      "wanessacamargo2002": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02a492ad852a3ff45542494af6",
      "w": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e022cd46c56308c5aba148c03dc",
      "deadline": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e028db56c674b13b3a4c6a4dbb8",
    };

    // Hardcoded overrides for tracks
    const HARDCODED_TRACK_IMAGES: Record<string, string> = {
      "saveyourtearsremix": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02c6af5ffa661a365b77df6ef6",
    };

    if (data.type === "album") {
      const albumName = (fieldValue(data.query, "album") || data.query).trim().toLowerCase();
      const artistName = fieldValue(data.query, "artist");
      const hardcodedKey = comparable(albumName).replace(/[^a-z0-9]/g, "");
      if (HARDCODED_ALBUM_IMAGES[hardcodedKey]) {
        const img = HARDCODED_ALBUM_IMAGES[hardcodedKey];
        imageCache.set(cacheKey, img);
        return img;
      }
    }

    try {
      let imageUrl: string | null = null;

      if (data.type === "album") {
        const albumName = fieldValue(data.query, "album") || data.query;
        const artistName = fieldValue(data.query, "artist");

        const isAnitta = comparable(artistName ?? "") === "anitta";

        // 1. Last.fm
        if (!imageUrl && artistName) {
          for (const variant of albumVariants(albumName)) {
            const data = await fetchJson(`https://ws.audioscrobbler.com/2.0/?method=album.getinfo&api_key=8fc896e5a34e6491b19710f4f1212a34&artist=${encodeURIComponent(artistName)}&album=${encodeURIComponent(variant)}&format=json`);
            if (data?.album?.name && exactMatch(data.album.name, variant)) {
              const images = data.album.image ?? [];
              for (const img of [...images].reverse()) {
                if (isUsableImageUrl(img["#text"]) && (img.size === "extralarge" || img.size === "large" || img.size === "mega")) {
                  imageUrl = img["#text"];
                  break;
                }
              }
            }
            if (imageUrl) break;
          }
        }

        // 2. iTunes (exact)
        if (!imageUrl) {
          for (const variant of albumVariants(albumName)) {
            const q = artistName ? `${variant} ${artistName}` : variant;
            const data = await fetchJson(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=album&limit=10`);
            for (const r of data?.results ?? []) {
              if (!r.artworkUrl100) continue;
              if (!exactMatch(r.collectionName ?? "", variant)) continue;
              if (artistName && !exactMatch(r.artistName ?? "", artistName)) continue;
              imageUrl = r.artworkUrl100.replace("100x100bb", "600x600bb");
              break;
            }
            if (imageUrl) break;
          }
        }

        // 3. Deezer (exact)
        if (!imageUrl) {
          for (const variant of albumVariants(albumName)) {
            const q = artistName ? `${variant} ${artistName}` : variant;
            const data = await fetchJson(`https://api.deezer.com/search/album?q=${encodeURIComponent(q)}&limit=10`);
            for (const a of data?.data ?? []) {
              if (!exactMatch(a.title ?? "", variant)) continue;
              if (artistName && !exactMatch(a.artist?.name ?? "", artistName)) continue;
              if (a.cover_xl || a.cover_big || a.cover_medium) {
                imageUrl = a.cover_xl || a.cover_big || a.cover_medium;
                break;
              }
            }
            if (imageUrl) break;
          }
        }

        // 4. Wikipedia
        if (!imageUrl) {
          const yearMatch = albumName.match(/\b(19|20)\d{2}\b/);
          const year = yearMatch ? yearMatch[0] : null;
          const titles = artistName
            ? [
                `${albumName} (${artistName} album)`,
                `${albumName} (${artistName} ${year} album)`,
                year ? `${albumName.replace(year, "").trim()} (${artistName} ${year} album)` : null,
                `${albumName} (${artistName} álbüm)`,
                `${albumName} (álbum)`,
                `${albumName} (${year} album)`,
                year ? `${albumName.replace(year, "").trim()} (${year} album)` : null,
                `${albumName} album`,
                `${albumName}`,
              ].filter(Boolean) as string[]
            : [
                `${albumName} (album)`,
                year ? `${albumName} (${year} album)` : null,
                year ? `${albumName.replace(year, "").trim()} (${year} album)` : null,
                `${albumName} (álbum)`,
                `${albumName} álbüm`,
                `${albumName} album`,
                `${albumName}`,
              ].filter(Boolean) as string[];
          for (const title of titles) {
            const data = await fetchJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
            if (data?.thumbnail?.source) { imageUrl = data.thumbnail.source; break; }
          }
        }

        // 5. Cover Art Archive
        if (!imageUrl) {
          for (const variant of albumVariants(albumName)) {
            try {
              const q = artistName ? `release:${variant} AND artist:${artistName}` : `release:${variant}`;
              const mbData = await fetchJson(`https://musicbrainz.org/ws/2/release/?query=${encodeURIComponent(q)}&fmt=json&limit=5`, { headers: { "User-Agent": "DaegonCharts/1.0 (contact@daegoncharts.com)" } });
              for (const release of mbData?.releases ?? []) {
                if (!exactMatch(release.title ?? "", variant)) continue;
                try {
                  const controller = new AbortController();
                  const timeout = setTimeout(() => controller.abort(), 2000);
                  const caaResponse = await fetch(`https://coverartarchive.org/release/${release.id}/front-500`, { method: "HEAD", signal: controller.signal });
                  clearTimeout(timeout);
                  if (caaResponse.ok) { imageUrl = `https://coverartarchive.org/release/${release.id}/front-500`; break; }
                } catch {}
              }
            } catch {}
            if (imageUrl) break;
          }
        }

        // 6. Discogs (exact)
        if (!imageUrl) {
          for (const variant of albumVariants(albumName)) {
            try {
            const q = artistName ? `${variant} ${artistName}` : variant;
              const data = await fetchJson(`https://api.discogs.com/database/search?q=${encodeURIComponent(q)}&type=release&per_page=10`, { headers: { "User-Agent": "DaegonCharts/1.0 (contact@daegoncharts.com)" } });
              for (const r of data?.results ?? []) {
                if (!r.cover_image) continue;
                const title = comparable(r.title ?? "");
                if (!title.includes(comparable(variant))) continue;
                if (artistName && !title.includes(comparable(artistName))) continue;
                imageUrl = r.cover_image;
                break;
              }
            } catch {}
            if (imageUrl) break;
          }
        }

        // 7. TheAudioDB
        if (!imageUrl) {
          imageUrl = await searchTheAudioDB(albumName, "album", artistName);
        }

        // 8. DeviantArt
        if (!imageUrl) {
          imageUrl = await searchDeviantArt(albumName, artistName);
        }

        // 9. Spotify album/EP (exact)
        if (!imageUrl && token) {
          for (const variant of albumVariants(albumName)) {
            const q = artistName ? `album:"${variant}" artist:"${artistName}"` : `album:"${variant}"`;
            const r = await spotifySearch(token, q, "album", 10);
            for (const a of r?.albums?.items ?? []) {
              const isAlbumOrEp = a.album_type === "album" || a.album_type === "ep";
              if (!isAlbumOrEp) continue;
              if (!exactMatch(a.name ?? "", variant)) continue;
              if (!artistMatch(a, artistName)) continue;
              if (a.images?.[0]?.url) { imageUrl = a.images[0].url; break; }
            }
            if (imageUrl) break;
          }
        }

        // 10. Spotify broader (exact)
        if (!imageUrl && token) {
          for (const variant of albumVariants(albumName)) {
            const q = artistName ? `album:"${variant}" artist:"${artistName}"` : `album:"${variant}"`;
            const r = await spotifySearch(token, q, "album", 20);
            for (const a of r?.albums?.items ?? []) {
              if (!exactMatch(a.name ?? "", variant)) continue;
              if (!artistMatch(a, artistName)) continue;
              if (a.images?.[0]?.url) { imageUrl = a.images[0].url; break; }
            }
            if (imageUrl) break;
          }
        }

        // 11. Spotify album without artist
        if (!imageUrl && token) {
          for (const variant of albumVariants(albumName)) {
            const q = `album:"${variant}"`;
            const r = await spotifySearch(token, q, "album", 5);
            for (const a of r?.albums?.items ?? []) {
              if (!exactMatch(a.name ?? "", variant)) continue;
              if (a.images?.[0]?.url) { imageUrl = a.images[0].url; break; }
            }
            if (imageUrl) break;
          }
        }

        // 12. Spotify playlist cover
        if (!imageUrl && token) {
          for (const variant of albumVariants(albumName)) {
            const r = await spotifySearch(token, `"${variant}"`, "playlist", 5);
            for (const p of r?.playlists?.items ?? []) {
              if (!exactMatch(p.name ?? "", variant)) continue;
              if (p.images?.[0]?.url) { imageUrl = p.images[0].url; break; }
            }
            if (imageUrl) break;
          }
        }

        // 13. Artist image (last resort — Spotify)
        if (!imageUrl && token && artistName) {
          const ra = await spotifySearch(token, `artist:"${artistName}"`, "artist");
          const artists = (ra?.artists?.items ?? []).filter((a: any) => a.images?.[0]?.url);
          const exact = artists.find((a: any) => exactMatch(a.name ?? "", artistName));
          imageUrl = (exact ?? artists[0])?.images?.[0]?.url ?? null;
        }
        if (!imageUrl && token) {
          const rb = await spotifySearch(token, artistName || albumName, "artist");
          imageUrl = (rb?.artists?.items ?? []).find((a: any) => a.images?.[0]?.url)?.images?.[0]?.url ?? null;
        }
      } else if (data.type === "track") {
        const trackName = fieldValue(data.query, "track") || data.query;
        const artistName = fieldValue(data.query, "artist");

        // Hardcoded track overrides
        const trackKey = comparable(trackName).replace(/[^a-z0-9]/g, "");
        if (HARDCODED_TRACK_IMAGES[trackKey]) {
          const img = HARDCODED_TRACK_IMAGES[trackKey];
          imageCache.set(cacheKey, img);
          return img;
        }

        // 1. Last.fm track artwork — fast and especially useful for older catalog
        if (!imageUrl && artistName) {
          try {
            const lastFm = await fetchJson(`https://ws.audioscrobbler.com/2.0/?method=track.getInfo&api_key=8fc896e5a34e6491b19710f4f1212a34&artist=${encodeURIComponent(artistName)}&track=${encodeURIComponent(trackName)}&format=json`);
            const images = lastFm?.track?.album?.image ?? [];
            for (const img of [...images].reverse()) {
              if (isUsableImageUrl(img["#text"]) && (img.size === "extralarge" || img.size === "large" || img.size === "mega")) {
                imageUrl = img["#text"];
                break;
              }
            }
          } catch {}
        }

        // 2. Wikipedia single
        if (!imageUrl && artistName) {
          const titles = [`${trackName} (${artistName} single)`, `${trackName} (${artistName} song)`, `${trackName} (song)`, `${trackName} (single)`];
          for (const title of titles) {
            const wd = await fetchJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
            if (wd?.thumbnail?.source) { imageUrl = wd.thumbnail.source; break; }
          }
        }

        // 3. iTunes single (trackCount === 1)
        if (!imageUrl && artistName) {
          const data = await fetchJson(`https://itunes.apple.com/search?term=${encodeURIComponent(`${trackName} ${artistName}`)}&entity=song&limit=20`);
          for (const r of data?.results ?? []) {
            if (!r.artworkUrl100) continue;
            if (!exactMatch(r.trackName ?? "", trackName)) continue;
            if (!exactMatch(r.artistName ?? "", artistName)) continue;
            if (r.trackCount === 1) { imageUrl = r.artworkUrl100.replace("100x100bb", "600x600bb"); break; }
          }
        }

        // 4. Deezer single (album_type === "single")
        if (!imageUrl && artistName) {
          const data = await fetchJson(`https://api.deezer.com/search/track?q=${encodeURIComponent(`${trackName} ${artistName}`)}&limit=20`);
          for (const r of data?.data ?? []) {
            if (!r.album?.cover_xl && !r.album?.cover_big) continue;
            if (!exactMatch(r.title ?? "", trackName)) continue;
            if (!exactMatch(r.artist?.name ?? "", artistName)) continue;
            if (r.album?.album_type === "single") { imageUrl = r.album.cover_xl || r.album.cover_big; break; }
          }
        }

        // 5. iTunes any result (track + artist)
        if (!imageUrl && artistName) {
          const data = await fetchJson(`https://itunes.apple.com/search?term=${encodeURIComponent(`${trackName} ${artistName}`)}&entity=song&limit=20`);
          for (const r of data?.results ?? []) {
            if (!r.artworkUrl100) continue;
            if (!exactMatch(r.trackName ?? "", trackName)) continue;
            if (!exactMatch(r.artistName ?? "", artistName)) continue;
            imageUrl = r.artworkUrl100.replace("100x100bb", "600x600bb");
            break;
          }
        }

        // 6. Deezer any result (track + artist)
        if (!imageUrl && artistName) {
          const data = await fetchJson(`https://api.deezer.com/search/track?q=${encodeURIComponent(`${trackName} ${artistName}`)}&limit=20`);
          for (const r of data?.data ?? []) {
            if (!r.album?.cover_xl && !r.album?.cover_big) continue;
            if (!exactMatch(r.title ?? "", trackName)) continue;
            if (!exactMatch(r.artist?.name ?? "", artistName)) continue;
            imageUrl = r.album.cover_xl || r.album.cover_big;
            break;
          }
        }

        // 7. EPs by artist containing the track (Deezer)
        if (!imageUrl && artistName) {
          const data = await fetchJson(`https://api.deezer.com/search/album?q=${encodeURIComponent(artistName)}&limit=50`);
          const eps = (data?.data ?? []).filter((a: any) => a.record_type === "EP");
          for (const ep of eps) {
            if (!ep.cover_xl && !ep.cover_big) continue;
            try {
              const albumData = await fetchJson(`https://api.deezer.com/album/${ep.id}/tracks`);
              const found = (albumData?.data ?? []).find((t: any) => exactMatch(t.title ?? "", trackName));
              if (found) { imageUrl = ep.cover_xl || ep.cover_big; break; }
            } catch {}
          }
        }

        // 8. Albums by artist containing the track (Deezer)
        if (!imageUrl && artistName) {
          const data = await fetchJson(`https://api.deezer.com/search/album?q=${encodeURIComponent(artistName)}&limit=50`);
          const albums = (data?.data ?? []).filter((a: any) => a.record_type === "album");
          for (const album of albums) {
            if (!album.cover_xl && !album.cover_big) continue;
            try {
              const albumData = await fetchJson(`https://api.deezer.com/album/${album.id}/tracks`);
              const found = (albumData?.data ?? []).find((t: any) => exactMatch(t.title ?? "", trackName));
              if (found) { imageUrl = album.cover_xl || album.cover_big; break; }
            } catch {}
          }
        }

        // 9. Artist image (last resort — Spotify)
        if (!imageUrl && token && artistName) {
          const result = await spotifySearch(token, `artist:"${artistName}"`, "artist");
          const artists = (result?.artists?.items ?? [])
            .filter((a: any) => a.images?.[0]?.url)
            .sort((a: any, b: any) => {
              const nameMatch = Number(exactMatch(b.name ?? "", artistName)) - Number(exactMatch(a.name ?? "", artistName));
              if (nameMatch !== 0) return nameMatch;
              return (b.popularity ?? 0) - (a.popularity ?? 0);
            });
          imageUrl = artists[0]?.images?.[0]?.url ?? null;
        }

        // 10. Absolute fallback
        if (!imageUrl) {
          imageUrl = "data:image/svg+xml," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"><rect width="300" height="300" fill="%23e5e7eb"/><text x="150" y="170" text-anchor="middle" font-size="120" fill="%239ca3af">♪</text></svg>`);
        }
      } else {
        const artistName = fieldValue(data.query, "artist") || data.query;
        const title = fieldValue(data.query, "track") || fieldValue(data.query, "album");

        // 1. Spotify known artist IDs (avoids wrong matches for ambiguous names)
        const normalizedArtist = comparable(artistName).replace(/\s+/g, "_");
        const knownId = KNOWN_ARTIST_IDS[normalizedArtist];
        if (knownId && !title && token) {
          try {
            const response = await fetch(`https://api.spotify.com/v1/artists/${knownId}`, { headers: { Authorization: `Bearer ${token}` } });
            if (response.ok) {
              const data = await response.json();
              imageUrl = data.images?.[0]?.url ?? null;
            }
          } catch (e) { console.error(`Known artist ${artistName} fetch failed`, e); }
        }

        // 2. Deezer artist image (exact match)
        if (!imageUrl) {
          try {
            const data = await fetchJson(`https://api.deezer.com/search/artist?q=${encodeURIComponent(artistName)}&limit=5`);
            for (const a of data?.data ?? []) {
              if (exactMatch(a.name ?? "", artistName) && (a.picture_xl || a.picture_big)) {
                imageUrl = a.picture_xl || a.picture_big;
                break;
              }
            }
          } catch {}
        }

        // 3. iTunes artist image (exact match)
        if (!imageUrl) {
          try {
            const data = await fetchJson(`https://itunes.apple.com/search?term=${encodeURIComponent(artistName)}&entity=musicArtist&limit=5`);
            for (const r of data?.results ?? []) {
              if (r.artistViewUrl && r.artworkUrl100 && exactMatch(r.artistName ?? "", artistName)) {
                imageUrl = r.artworkUrl100.replace("100x100bb", "600x600bb");
                break;
              }
            }
          } catch {}
        }

        // 4. Last.fm artist image (exact match)
        if (!imageUrl) {
          try {
            const data = await fetchJson(`https://ws.audioscrobbler.com/2.0/?method=artist.getinfo&api_key=8fc896e5a34e6491b19710f4f1212a34&artist=${encodeURIComponent(artistName)}&format=json`);
            if (data?.artist?.name && exactMatch(data.artist.name, artistName)) {
              const images = data.artist.image ?? [];
              for (const img of [...images].reverse()) {
                if (isUsableImageUrl(img["#text"]) && (img.size === "extralarge" || img.size === "large" || img.size === "mega")) {
                  imageUrl = img["#text"];
                  break;
                }
              }
            }
          } catch {}
        }

        // 5. Last.fm broader (relaxed match)
        if (!imageUrl) {
          try {
            const data = await fetchJson(`https://ws.audioscrobbler.com/2.0/?method=artist.getinfo&api_key=8fc896e5a34e6491b19710f4f1212a34&artist=${encodeURIComponent(artistName)}&format=json`);
            const images = data?.artist?.image ?? [];
            for (const img of [...images].reverse()) {
              if (isUsableImageUrl(img["#text"]) && (img.size === "extralarge" || img.size === "large" || img.size === "mega")) {
                imageUrl = img["#text"];
                break;
              }
            }
          } catch {}
        }

        // 6. TheAudioDB
        if (!imageUrl) {
          imageUrl = await searchTheAudioDB(artistName, "artist");
        }

        // 7. Wikidata artist image (structured, precise)
        if (!imageUrl) {
          try {
            const searchUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(artistName)}&language=en&limit=5&format=json`;
            const searchData = await fetchJson(searchUrl);
            for (const item of searchData?.search ?? []) {
              if (!exactMatch(item.label ?? "", artistName)) continue;
              const entityUrl = `https://www.wikidata.org/w/api.php?action=wbgetclaims&entity=${item.id}&property=P18&format=json`;
              const entityData = await fetchJson(entityUrl);
              const claim = entityData?.claims?.P18?.[0];
              const fileName = claim?.mainsnak?.datavalue?.value;
              if (fileName) {
                const encoded = encodeURIComponent(fileName.replace(/ /g, "_"));
                imageUrl = `https://commons.wikimedia.org/wiki/Special:FilePath/${encoded}?width=600`;
                break;
              }
            }
          } catch {}
        }

        // 8. Spotify artist search (exact match)
        if (!imageUrl && token) {
          const result = await spotifySearch(token, `artist:"${artistName}"`, "artist");
          const artists = (result?.artists?.items ?? [])
            .filter((artist: any) => artist.images?.[0]?.url)
            .sort((a: any, b: any) => {
              const nameMatch = Number(exactMatch(b.name ?? "", artistName)) - Number(exactMatch(a.name ?? "", artistName));
              if (nameMatch !== 0) return nameMatch;
              return (b.popularity ?? 0) - (a.popularity ?? 0);
            });
          imageUrl = artists[0]?.images?.[0]?.url ?? null;
        }

        // 9. Spotify via track → artist
        if (!imageUrl && title && token) {
          const tracks = (await spotifySearch(token, `track:"${title}" artist:"${artistName}"`, "track"))?.tracks?.items ?? [];
          const track = tracks.find((item: any) => item.artists?.some((artist: any) => exactMatch(artist.name ?? "", artistName)));
          const artist = track?.artists?.find((item: any) => exactMatch(item.name ?? "", artistName));
          if (artist?.id) {
            const response = await fetch(`https://api.spotify.com/v1/artists/${artist.id}`, { headers: { Authorization: `Bearer ${token}` } });
            if (response.ok) imageUrl = (await response.json()).images?.[0]?.url ?? null;
          }
        }

        // 10. Spotify broader fallback
        if (!imageUrl && token) {
          const rb = await spotifySearch(token, artistName, "artist");
          const fallback = (rb?.artists?.items ?? []).find((a: any) => a.images?.[0]?.url);
          imageUrl = fallback?.images?.[0]?.url ?? null;
        }

        // 10. Absolute fallback — generic music note
        if (!imageUrl) {
          imageUrl = "data:image/svg+xml," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"><rect width="300" height="300" fill="%23e5e7eb"/><text x="150" y="170" text-anchor="middle" font-size="120" fill="%239ca3af">♪</text></svg>`);
        }
      }
      if (isUsableImageUrl(imageUrl)) {
        imageCache.set(cacheKey, imageUrl);
        persistentCache[cacheKey] = imageUrl;
        savePersistentCache();
        return imageUrl;
      }

      markFailed(cacheKey);
      return "data:image/svg+xml," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"><rect width="300" height="300" fill="%23e5e7eb"/><text x="150" y="170" text-anchor="middle" font-size="120" fill="%239ca3af">♪</text></svg>`);
    } catch (error) {
      console.error("Image search failed", error);
      return "data:image/svg+xml," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"><rect width="300" height="300" fill="%23e5e7eb"/><text x="150" y="170" text-anchor="middle" font-size="120" fill="%239ca3af">♪</text></svg>`);
    }
  });

interface TrackArtist {
  name: string;
  slug: string;
}

const trackArtistsCache = new Map<string, TrackArtist[] | null>();
const slugify = (name: string) =>
  name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

function parseItunesArtist(artistName: string): TrackArtist[] {
  const parts = artistName.split(/\s*(?:feat\.|ft\.|featuring)\s*/i).map(s => s.trim()).filter(Boolean);
  return parts.map(name => ({ name, slug: slugify(name) }));
}

async function fetchTrackArtistsFromItunes(song: string, artist: string): Promise<TrackArtist[] | null> {
  try {
    const q = `${song} ${artist}`;
    const data = await fetchJson(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=song&limit=5`);
    for (const r of data?.results ?? []) {
      const nameMatch = exactMatch(r.trackName ?? "", song);
      const artistMatch = exactMatch(r.artistName ?? "", artist);
      if (nameMatch && artistMatch) {
        const allArtists = parseItunesArtist(r.artistName ?? "");
        if (allArtists.length > 1) return allArtists;
      }
    }
    for (const r of data?.results ?? []) {
      const nameMatch = exactMatch(r.trackName ?? "", song);
      if (nameMatch) {
        const allArtists = parseItunesArtist(r.artistName ?? "");
        if (allArtists.length > 1) return allArtists;
      }
    }
    return null;
  } catch {
    return null;
  }
}

export const getSpotifyTrackArtists = createServerFn({ method: "GET" })
  .validator((d: { song: string; artist: string }) => d)
  .handler(async ({ data }) => {
    const cacheKey = `${data.song.trim().toLowerCase()}|${data.artist.trim().toLowerCase()}`;
    if (trackArtistsCache.has(cacheKey)) return trackArtistsCache.get(cacheKey);

    let result: TrackArtist[] | null = null;

    try {
      const token = await getAccessToken();
      if (token) {
        const tracks = (await spotifySearch(token, `track:"${data.song}" artist:"${data.artist}"`, "track"))?.tracks?.items ?? [];
        const track = tracks.find((t: any) =>
          t.artists?.some((a: any) => exactMatch(a.name ?? "", data.artist))
        );
        if (track?.artists && track.artists.length > 1) {
          result = track.artists.map((a: any) => ({
            name: a.name,
            slug: slugify(a.name),
          }));
        }
      }
    } catch {}

    if (!result) {
      result = await fetchTrackArtistsFromItunes(data.song, data.artist);
    }

    if (result) {
      trackArtistsCache.set(cacheKey, result);
    }
    return result;
  });

interface FeaturedOnTrack {
  name: string;
  artist: string;
  slug: string;
  imageUrl: string | null;
}

const featuredOnCache = new Map<string, FeaturedOnTrack[] | null>();

export const getSpotifyFeaturedOn = createServerFn({ method: "GET" })
  .validator((d: { artistName: string }) => d)
  .handler(async ({ data }) => {
    if (featuredOnCache.has(data.artistName)) return featuredOnCache.get(data.artistName);

    const token = await getAccessToken();
    if (!token) { featuredOnCache.set(data.artistName, null); return null; }

    try {
      const results: FeaturedOnTrack[] = [];

      const searchResult = await spotifySearch(token, `artist:"${data.artistName}"`, "track", 50);
      const tracks = searchResult?.tracks?.items ?? [];

      for (const track of tracks) {
        const allArtists = track.artists ?? [];
        const isFeatured = allArtists.length > 1 && allArtists.some((a: any) => exactMatch(a.name ?? "", data.artistName));
        if (!isFeatured) continue;

        const mainArtist = allArtists.find((a: any) => !exactMatch(a.name ?? "", data.artistName));
        if (!mainArtist) continue;

        const albumImg = track.album?.images?.[0]?.url ?? null;
        results.push({
          name: track.name,
          artist: mainArtist.name,
          slug: slugify(mainArtist.name),
          imageUrl: albumImg,
        });
      }

      const unique = results.slice(0, 20);
      if (unique.length > 0) {
        featuredOnCache.set(data.artistName, unique);
      }
      return unique.length > 0 ? unique : null;
    } catch {
      featuredOnCache.set(data.artistName, null);
      return null;
    }
  });

const profileCache = new Map<string, { imageUrl: string | null; followers: number; genres: string[] } | null>();

export const getSpotifyArtistProfile = createServerFn({ method: "GET" })
  .validator((d: { artistName: string }) => d)
  .handler(async ({ data }) => {
    if (profileCache.has(data.artistName)) return profileCache.get(data.artistName);

    let imageUrl: string | null = null;
    let followers = 0;
    let genres: string[] = [];
    const token = await getAccessToken();

    // 1. Last.fm (no auth)
    try {
      const d = await fetchJson(`https://ws.audioscrobbler.com/2.0/?method=artist.getinfo&api_key=8fc896e5a34e6491b19710f4f1212a34&artist=${encodeURIComponent(data.artistName)}&format=json`);
      const images = d?.artist?.image ?? [];
      for (const img of [...images].reverse()) {
        if (isUsableImageUrl(img["#text"]) && (img.size === "extralarge" || img.size === "large" || img.size === "mega")) {
          imageUrl = img["#text"];
          break;
        }
      }
    } catch {}

    // 2. iTunes (no auth)
    if (!imageUrl) {
      try {
        const d = await fetchJson(`https://itunes.apple.com/search?term=${encodeURIComponent(data.artistName)}&entity=musicArtist&limit=5`);
        for (const r of d?.results ?? []) {
          if (r.artistViewUrl && r.artworkUrl100) {
            imageUrl = r.artworkUrl100.replace("100x100bb", "600x600bb");
            break;
          }
        }
      } catch {}
    }

    // 3. Deezer (no auth)
    if (!imageUrl) {
      try {
        const d = await fetchJson(`https://api.deezer.com/search/artist?q=${encodeURIComponent(data.artistName)}&limit=5`);
        for (const a of d?.data ?? []) {
          if (exactMatch(a.name ?? "", data.artistName) && (a.picture_xl || a.picture_big)) {
            imageUrl = a.picture_xl || a.picture_big;
            break;
          }
        }
      } catch {}
    }

    // 4. Wikipedia (no auth)
    if (!imageUrl) {
      try {
        const d = await fetchJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(data.artistName)}`);
        if (d?.thumbnail?.source) imageUrl = d.thumbnail.source;
      } catch {}
    }

    // 5. Spotify (needs token)
    if (token) {
      try {
        const normalized = comparable(data.artistName).replace(/\s+/g, "_");
        const knownId = KNOWN_ARTIST_IDS[normalized];
        const artist = knownId
          ? await fetch(`https://api.spotify.com/v1/artists/${knownId}`, { headers: { Authorization: `Bearer ${token}` } }).then((response) => response.ok ? response.json() : null)
          : (await spotifySearch(token, `artist:"${data.artistName}"`, "artist"))?.artists?.items?.sort((a: any, b: any) => Number(exactMatch(b.name ?? "", data.artistName)) - Number(exactMatch(a.name ?? "", data.artistName)))[0];
        if (artist) {
          if (!imageUrl && artist.images?.[0]?.url) imageUrl = artist.images[0].url;
          followers = artist.followers?.total ?? 0;
          genres = artist.genres ?? [];
        }
      } catch {}
    }

    if (!imageUrl) {
      imageUrl = "data:image/svg+xml," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"><rect width="300" height="300" fill="%23e5e7eb"/><text x="150" y="170" text-anchor="middle" font-size="120" fill="%239ca3af">♪</text></svg>`);
    }

    const profile = { imageUrl, followers, genres };
    profileCache.set(data.artistName, profile);
    return profile;
  });
