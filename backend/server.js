import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3001;

let tokenCache = null;
let tokenExpiry = 0;

async function getSpotifyToken() {
  if (tokenCache && Date.now() < tokenExpiry) return tokenCache;

  const auth = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
  ).toString("base64");

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials"
  });

  const data = await res.json();
  tokenCache = data.access_token;
  tokenExpiry = Date.now() + data.expires_in * 1000;
  return tokenCache;
}

app.get("/api/spotify/search", async (req, res) => {
  const { q, type } = req.query;
  if (!q || !type) return res.status(400).json({ error: "Missing params" });

  const token = await getSpotifyToken();
  const response = await fetch(
    `https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=${type}&limit=1`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  res.json(await response.json());
});

app.listen(PORT, () =>
  console.log(`🚀 Backend Spotify em http://localhost:${PORT}`)
);
