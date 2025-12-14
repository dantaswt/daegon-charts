const app = document.getElementById("app");

const imageCache = {};

async function getSpotifyImage(query, type) {
  const key = `${type}:${query}`;
  if (imageCache[key]) return imageCache[key];

  try {
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

    if (image) imageCache[key] = image;
    return image;
  } catch {
    return null;
  }
}

function renderHome() {
  app.innerHTML = `
    <div class="text-center">
      <h2 class="text-4xl font-bold mb-4">daegon charts</h2>
      <p class="text-gray-500">Personal music charts powered by Last.fm</p>

      <div class="mt-8">
        <div class="loader mx-auto"></div>
      </div>
    </div>
  `;
}

renderHome();
