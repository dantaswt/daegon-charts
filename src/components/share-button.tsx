import { useState } from "react";

interface ShareButtonProps {
  title: string;
  url?: string;
  kind: "artist" | "song" | "album" | "chart";
}

export function ShareButton({ title, url, kind }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);
  const shareUrl = url || (typeof window !== "undefined" ? window.location.href : "");

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: `${title} — Daegon Charts`, url: shareUrl });
      } catch {}
    } else {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const twitterShare = () => {
    const text = `Check out ${title} on Daegon Charts!`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`, "_blank");
  };

  const whatsappShare = () => {
    const text = `Check out ${title} on Daegon Charts! ${shareUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleShare}
        className="w-9 h-9 rounded-full bg-[var(--muted)] text-[var(--foreground)] text-sm hover:bg-[var(--border)] active:bg-[var(--accent)] active:text-white active:scale-95 transition-all duration-200 flex items-center justify-center"
        aria-label="Copy link"
      >
        <i className={`${copied ? "fas fa-check text-green-500" : "fas fa-link"}`} />
      </button>
      <button
        onClick={twitterShare}
        className="w-9 h-9 rounded-full bg-[var(--muted)] text-[var(--foreground)] text-sm hover:bg-[var(--border)] hover:text-[#1DA1F2] active:scale-95 transition-all duration-200 flex items-center justify-center"
        aria-label="Share on Twitter"
      >
        <i className="fab fa-x-twitter" />
      </button>
      <button
        onClick={whatsappShare}
        className="w-9 h-9 rounded-full bg-[var(--muted)] text-[var(--foreground)] text-sm hover:bg-[var(--border)] hover:text-[#25D366] active:scale-95 transition-all duration-200 flex items-center justify-center"
        aria-label="Share on WhatsApp"
      >
        <i className="fab fa-whatsapp" />
      </button>
    </div>
  );
}
