const cache = new Map<string, any>();

function norm(s: string) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

export async function getAudioPreview({ data }: { data: { artist: string; track: string } }) {
  const key = (data.artist + "|||" + data.track).toLowerCase();
  if (cache.has(key)) return cache.get(key);
  let result = {
    previewUrl: null as string | null,
    duration: null as number | null,
    artworkUrl: null as string | null,
    source: null as string | null,
    trackName: data.track,
    artistName: data.artist,
  };
  try {
    const url = "https://itunes.apple.com/search?term=" + encodeURIComponent(data.track + " " + data.artist) + "&entity=song&limit=20";
    const response = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (response.ok) {
      const json = await response.json();
      const wantTrack = norm(data.track), wantArtist = norm(data.artist);
      const rows = json?.results || [];
      const hit = rows.find((x: any) => norm(x.trackName) === wantTrack && norm(x.artistName).includes(wantArtist))
        || rows.find((x: any) => norm(x.trackName) === wantTrack)
        || rows.find((x: any) => norm(x.artistName).includes(wantArtist))
        || rows[0];
      if (hit) {
        result = {
          previewUrl: hit.previewUrl || null,
          duration: hit.trackTimeMillis ? Math.round(Number(hit.trackTimeMillis) / 1000) : null,
          artworkUrl: hit.artworkUrl100 ? String(hit.artworkUrl100).replace("100x100bb", "600x600bb") : null,
          source: "iTunes",
          trackName: hit.trackName || data.track,
          artistName: hit.artistName || data.artist,
        };
      }
    }
  } catch {}
  cache.set(key, result);
  return result;
}
