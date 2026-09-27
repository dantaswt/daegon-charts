import { useState, useEffect, useCallback } from "react";

export interface Favorite {
  name: string;
  slug: string;
  kind: "artist" | "song" | "album";
  addedAt: number;
}

const STORAGE_KEY = "daegon_favorites";

function loadFavorites(): Favorite[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveFavorites(favs: Favorite[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(favs));
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<Favorite[]>([]);

  useEffect(() => {
    setFavorites(loadFavorites());
  }, []);

  const toggle = useCallback((name: string, slug: string, kind: Favorite["kind"]) => {
    setFavorites((prev) => {
      const exists = prev.some((f) => f.slug === slug && f.kind === kind);
      const next = exists
        ? prev.filter((f) => !(f.slug === slug && f.kind === kind))
        : [...prev, { name, slug, kind, addedAt: Date.now() }];
      saveFavorites(next);
      return next;
    });
  }, []);

  const isFavorite = useCallback(
    (slug: string, kind: Favorite["kind"]) => favorites.some((f) => f.slug === slug && f.kind === kind),
    [favorites],
  );

  return { favorites, toggle, isFavorite };
}
