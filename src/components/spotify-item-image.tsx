import { useEffect, useState } from "react";
import { getSpotifyImage } from "@/lib/spotify.functions";

interface SpotifyItemImageProps {
  name: string;
  artist: string;
  kind: "song" | "album" | "artist";
  size?: number;
  className?: string;
  rounded?: "lg" | "full";
}

export function SpotifyItemImage({ name, artist, kind, size = 40, className = "", rounded = "lg" }: SpotifyItemImageProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const isFull = rounded === "full";

  useEffect(() => {
    let active = true;
    let query: string;
    let type: "album" | "artist" | "track";
    if (kind === "artist") {
      query = `artist:"${name}"`;
      type = "artist";
    } else if (kind === "album") {
      query = `album:"${name}" artist:"${artist}"`;
      type = "album";
    } else {
      query = `artist:"${artist}" track:"${name}"`;
      type = "track";
    }
    getSpotifyImage({ data: { query, type } }).then((u) => {
      if (!active) return;
      if (u) {
        setUrl(u);
      } else if (kind !== "artist" && artist) {
        getSpotifyImage({ data: { query: `artist:"${artist}"`, type: "artist" } }).then((u2) => {
          if (active && u2) setUrl(u2);
        });
      }
    });
    return () => { active = false; };
  }, [name, artist, kind]);

  const imgStyle: React.CSSProperties = isFull ? { borderRadius: "50%", width: size, height: size } : { width: size, height: size };

  if (url) {
    return (
      <img
        src={url}
        alt={name}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => {
          setLoaded(false);
          setUrl(null);
        }}
        style={imgStyle}
        className={`object-cover shrink-0 transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"} ${className}`}
      />
    );
  }

  return (
    <div
      style={{ width: size, height: size, borderRadius: isFull ? "50%" : undefined }}
      className={`shrink-0 bg-[var(--muted)] flex items-center justify-center animate-pulse ${className}`}
    >
      <i className={`fas ${kind === "artist" ? "fa-user" : kind === "album" ? "fa-compact-disc" : "fa-music"} text-xs opacity-30`} />
    </div>
  );
}
