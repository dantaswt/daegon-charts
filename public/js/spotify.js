import { appState } from "./state.js";

export async function getSpotifyImage(query, type) {
  const key = `${type}:${query}`;
  if (appState.imageCache[key]) return appState.imageCache[key];

  const res = await fetch(
    `/api/spotify/search?q=${encodeURIComponent(query)}&type=${type}`
  );
  const data = await res.json();

  let image = null;
  if (type === "artist") {
    image = data.artists?.items?.[0]?.images?.[0]?.url;
  } else {
    image = data.albums?.items?.[0]?.images?.[0]?.url;
  }

  if (image) appState.imageCache[key] = image;
  return image;
}
