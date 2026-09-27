const EDITIONS: Record<number, { sheetId: string; gid: string }> = {
  2017: { sheetId: "1DNb6uYi6K231-fhrSt3XPlaag8eG9ZFVHhvSXyjWCuk", gid: "0" },
  2018: { sheetId: "1DNb6uYi6K231-fhrSt3XPlaag8eG9ZFVHhvSXyjWCuk", gid: "912023648" },
  2019: { sheetId: "1DNb6uYi6K231-fhrSt3XPlaag8eG9ZFVHhvSXyjWCuk", gid: "221365296" },
  2020: { sheetId: "1DNb6uYi6K231-fhrSt3XPlaag8eG9ZFVHhvSXyjWCuk", gid: "1123138246" },
  2021: { sheetId: "1DNb6uYi6K231-fhrSt3XPlaag8eG9ZFVHhvSXyjWCuk", gid: "919977085" },
  2022: { sheetId: "1DNb6uYi6K231-fhrSt3XPlaag8eG9ZFVHhvSXyjWCuk", gid: "2065423547" },
  2023: { sheetId: "1DNb6uYi6K231-fhrSt3XPlaag8eG9ZFVHhvSXyjWCuk", gid: "1803569858" },
  2024: { sheetId: "1DNb6uYi6K231-fhrSt3XPlaag8eG9ZFVHhvSXyjWCuk", gid: "1350904783" },
  2025: { sheetId: "1DNb6uYi6K231-fhrSt3XPlaag8eG9ZFVHhvSXyjWCuk", gid: "1189047483" },
};

export interface AwardNominee {
  category: string;
  item: string;
  artist: string;
  feature: string;
  status: "Winner" | "Nominated";
  year: number;
}

export interface AwardEditionData {
  categories: Record<string, AwardNominee[]>;
  order: string[];
}

export interface AwardArtistData {
  name: string;
  nominations: number;
  wins: number;
  entries: (AwardNominee & { role: string; mainArtist?: string })[];
  categories: string[];
  entriesByYear: Record<string, (AwardNominee & { role: string; mainArtist?: string })[]>;
}

const editionCache = new Map<number, AwardEditionData>();
const allArtistsCache: { data: AwardArtistData[] | null; promise: Promise<AwardArtistData[]> | null } = { data: null, promise: null };

const PROXY_URLS = [
  "https://api.allorigins.win/raw?url=",
  "https://corsproxy.io/?",
];

async function fetchWithTimeout(url: string, ms = 12000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchWithRetry(url: string, retries = 2): Promise<string> {
  let lastErr: Error | null = null;
  for (const proxy of PROXY_URLS) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await fetchWithTimeout(proxy + encodeURIComponent(url), 15000);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.text();
      } catch (err) {
        lastErr = err as Error;
        if (attempt < retries) await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
  }
  throw lastErr || new Error("Fetch failed");
}

export async function fetchAwardEdition(year: number): Promise<AwardEditionData> {
  if (editionCache.has(year)) return editionCache.get(year)!;
  const edition = EDITIONS[year];
  if (!edition) throw new Error(`Edition ${year} not found`);
  const targetUrl = `https://docs.google.com/spreadsheets/d/${edition.sheetId}/gviz/tq?tq=select%20*&tqx=out:json&gid=${edition.gid}`;
  const text = await fetchWithRetry(targetUrl);
  const jsonStart = text.indexOf("{");
  const jsonEnd = text.lastIndexOf("}") + 1;
  const data = JSON.parse(text.substring(jsonStart, jsonEnd));
  if (!data.table?.rows) return { categories: {}, order: [] };
  const rows = data.table.rows;
  const categories: Record<string, AwardNominee[]> = {};
  const categoryOrder: string[] = [];
  const seenCategories = new Set<string>();
  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i].c || [];
    const category = cells[0]?.v || "";
    const item = cells[1]?.v || "";
    const artist = cells[2]?.v || "";
    const feature = cells[3]?.v || "";
    const status = cells[4]?.v || "";
    if (!category?.trim()) continue;
    if (!seenCategories.has(category)) {
      seenCategories.add(category);
      categoryOrder.push(category);
    }
    if (!categories[category]) categories[category] = [];
    categories[category].push({
      category: category.trim(),
      item: item?.trim() || "",
      artist: artist?.trim() || "",
      feature: feature?.trim() || "",
      status: status?.toLowerCase().includes("win") ? "Winner" : "Nominated",
      year,
    });
  }
  const result = { categories, order: categoryOrder };
  editionCache.set(year, result);
  return result;
}

export async function fetchAllAwardEditions(): Promise<AwardEditionData[]> {
  const years = Object.keys(EDITIONS).map(Number).sort((a, b) => b - a);
  const results = await Promise.allSettled(years.map((y) => fetchAwardEdition(y)));
  return results
    .filter((r): r is PromiseFulfilledResult<AwardEditionData> => r.status === "fulfilled")
    .map((r) => r.value);
}

function buildArtistData(allData: AwardEditionData[]): AwardArtistData[] {
  const artistsMap = new Map<string, AwardArtistData>();
  allData.forEach((ed) => {
    Object.entries(ed.categories).forEach(([cat, nominees]) => {
      nominees.forEach((n) => {
        if (!n.artist?.trim()) return;
        const mainName = n.artist.trim();
        if (!artistsMap.has(mainName))
          artistsMap.set(mainName, { name: mainName, nominations: 0, wins: 0, entries: [], categories: [], entriesByYear: {} });
        const a = artistsMap.get(mainName)!;
        a.entries.push({ ...n, role: "Main Artist" });
        if (!a.categories.includes(cat)) a.categories.push(cat);
        if (n.feature?.trim()) {
          n.feature.split(",").map((f) => f.trim()).filter(Boolean).forEach((featName) => {
            if (!artistsMap.has(featName))
              artistsMap.set(featName, { name: featName, nominations: 0, wins: 0, entries: [], categories: [], entriesByYear: {} });
            const fa = artistsMap.get(featName)!;
            fa.entries.push({ ...n, role: "Featured Artist", mainArtist: mainName });
            if (!fa.categories.includes(cat)) fa.categories.push(cat);
          });
        }
      });
    });
  });
  return Array.from(artistsMap.values())
    .map((a) => {
      const seen = new Set<string>();
      a.entries = a.entries.filter((e) => {
        const k = `${e.year}-${e.category}-${e.item}-${e.role}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      a.nominations = a.entries.length;
      a.wins = a.entries.filter((e) => e.status === "Winner").length;
      a.entriesByYear = {};
      a.entries.forEach((e) => {
        if (!a.entriesByYear[e.year]) a.entriesByYear[e.year] = [];
        a.entriesByYear[e.year].push(e);
      });
      return a;
    })
    .sort((a, b) => b.nominations - a.nominations || b.wins - a.wins);
}

export function getAwardArtists(): Promise<AwardArtistData[]> {
  if (allArtistsCache.data) return Promise.resolve(allArtistsCache.data);
  if (allArtistsCache.promise) return allArtistsCache.promise;
  allArtistsCache.promise = fetchAllAwardEditions()
    .then((allData) => {
      const artists = buildArtistData(allData);
      allArtistsCache.data = artists;
      return artists;
    })
    .catch((err) => {
      allArtistsCache.promise = null;
      throw err;
    });
  return allArtistsCache.promise;
}

export async function getArtistAwards(artistName: string): Promise<AwardArtistData | null> {
  const artists = await getAwardArtists();
  return artists.find((a) => a.name.toLowerCase() === artistName.toLowerCase()) || null;
}
