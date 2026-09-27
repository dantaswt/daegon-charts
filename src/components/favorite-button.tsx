import { useFavorites } from "@/hooks/use-favorites";

interface FavoriteButtonProps {
  name: string;
  slug: string;
  kind: "artist" | "song" | "album";
  size?: "sm" | "md";
}

export function FavoriteButton({ name, slug, kind, size = "md" }: FavoriteButtonProps) {
  const { toggle, isFavorite } = useFavorites();
  const active = isFavorite(slug, kind);

  const sizeClasses = size === "sm"
    ? "w-7 h-7 text-xs"
    : "w-9 h-9 text-sm";

  return (
    <button
      onClick={() => toggle(name, slug, kind)}
      className={`${sizeClasses} rounded-full flex items-center justify-center transition-all duration-200 ${
        active
          ? "bg-[var(--accent)] text-black scale-110"
          : "bg-[var(--muted)] text-[var(--foreground)] hover:bg-[var(--border)]"
      }`}
      aria-label={active ? "Remove from favorites" : "Add to favorites"}
    >
      <i className={`${active ? "fas" : "far"} fa-heart`} />
    </button>
  );
}
