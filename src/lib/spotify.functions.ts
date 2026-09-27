import { getSupabase } from "./supabase";

type ImageArgs = { query: string; type: "album" | "artist" | "track" };
type TrackArtist = { name: string; slug: string };
type FeaturedOnTrack = { name: string; artist: string; slug: string; imageUrl: string | null };

const imageCache = new Map<string, string | null>();
const profileCache = new Map<string, { imageUrl: string | null; followers: number; genres: string[]; bio?: string } | null>();
const featuredCache = new Map<string, FeaturedOnTrack[] | null>();

function slugify(v: string): string {
  return String(v || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseQuoted(query: string, key: string): string {
  const re = new RegExp(key + ':?"([^"]+)"', "i");
  return query.match(re)?.[1]?.trim() || "";
}

function parseImageQuery(query: string, type: ImageArgs["type"]) {
  if (type === "artist") {
    const artist = parseQuoted(query, "artist") || query.replace(/^artist:/i, "").replace(/^"|"$/g, "").trim();
    return { kind: "artist", name: artist, artist };
  }
  if (type === "album") {
    const name = parseQuoted(query, "album");
    const artist = parseQuoted(query, "artist");
    return { kind: "album", name: name || query, artist: artist || name || query };
  }
  const name = parseQuoted(query, "track");
  const artist = parseQuoted(query, "artist");
  return { kind: "song", name: name || query, artist: artist || query };
}

export async function getSpotifyImage({ data }: { data: ImageArgs }): Promise<string | null> {
  const key = data.type + "|" + data.query.toLowerCase();
  if (imageCache.has(key)) return imageCache.get(key) ?? null;
  const parsed = parseImageQuery(data.query, data.type);
  try {
    const sb = getSupabase();
    const { data: result, error } = await sb.functions.invoke("artwork-resolver", {
      body: parsed,
    });
    if (error) throw error;
    const url = typeof result?.imageUrl === "string" && /^https?:\/\//i.test(result.imageUrl) ? result.imageUrl : null;
    imageCache.set(key, url);
    return url;
  } catch {
    imageCache.set(key, null);
    return null;
  }
}

function featNames(song: string): string[] {
  const out: string[] = [];
  const patterns = [
    /\(?feat\.\s+([^)\]]+)/i,
    /\(?ft\.\s+([^)\]]+)/i,
    /\(?featuring\s+([^)\]]+)/i,
    /\(?with\s+([^)\]]+)/i,
  ];
  for (const re of patterns) {
    const m = song.match(re);
    if (m?.[1]) {
      out.push(...m[1].split(/,|&|\band\b|\+/i).map((x) => x.trim()).filter(Boolean));
      break;
    }
  }
  return out;
}

export async function getSpotifyTrackArtists({ data }: { data: { song: string; artist: string } }): Promise<TrackArtist[]> {
  const names = [data.artist, ...featNames(data.song)];
  const seen = new Set<string>();
  return names
    .filter(Boolean)
    .filter((name) => {
      const s = slugify(name);
      if (!s || seen.has(s)) return false;
      seen.add(s);
      return true;
    })
    .map((name) => ({ name, slug: slugify(name) }));
}

async function fetchJson(url: string): Promise<any> {
  const response = await fetch(url, { signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error(String(response.status));
  return response.json();
}

function cleanBio(html: string): string {
  return String(html || "")
    .replace(/<a[^>]*>.*?<\/a>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function getSpotifyArtistProfile({ data }: { data: { artistName: string } }) {
  const name = data.artistName.trim();
  if (profileCache.has(name)) return profileCache.get(name) ?? null;
  let imageUrl = await getSpotifyImage({ data: { query: `artist:"${name}"`, type: "artist" } });
  let followers = 0;
  let genres: string[] = [];
  let bio = "";
  try {
    const d = await fetchJson(
      "https://ws.audioscrobbler.com/2.0/?method=artist.getinfo&api_key=8fc896e5a34e6491b19710f4f1212a34&artist=" +
        encodeURIComponent(name) +
        "&format=json"
    );
    const a = d?.artist;
    followers = Number(a?.stats?.listeners || 0);
    genres = (a?.tags?.tag || []).map((x: any) => String(x?.name || "")).filter(Boolean).slice(0, 6);
    bio = cleanBio(a?.bio?.summary || "");
    if (!imageUrl) {
      const images = a?.image || [];
      imageUrl = [...images].reverse().map((x: any) => x?.["#text"]).find((x: any) => /^https?:\/\//i.test(String(x || ""))) || null;
    }
  } catch {}
  const result = { imageUrl, followers, genres, bio };
  profileCache.set(name, result);
  return result;
}

export async function getSpotifyFeaturedOn({ data }: { data: { artistName: string } }): Promise<FeaturedOnTrack[] | null> {
  const name = data.artistName.trim();
  if (featuredCache.has(name)) return featuredCache.get(name) ?? null;
  try {
    const d = await fetchJson(
      "https://itunes.apple.com/search?term=" + encodeURIComponent(name) + "&entity=song&limit=100"
    );
    const lower = name.toLowerCase();
    const rows: FeaturedOnTrack[] = [];
    const seen = new Set<string>();
    for (const r of d?.results || []) {
      const track = String(r.trackName || "");
      const primary = String(r.artistName || "");
      const hay = (track + " " + primary).toLowerCase();
      if (!hay.includes(lower)) continue;
      if (primary.toLowerCase() === lower) continue;
      const key = track.toLowerCase() + "|" + primary.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({
        name: track,
        artist: primary,
        slug: slugify(primary),
        imageUrl: r.artworkUrl100 ? String(r.artworkUrl100).replace("100x100bb", "600x600bb") : null,
      });
      if (rows.length >= 20) break;
    }
    const result = rows.length ? rows : null;
    featuredCache.set(name, result);
    return result;
  } catch {
    featuredCache.set(name, null);
    return null;
  }
}
