import { useRef, useState, useEffect } from "react";
import { toPng } from "html-to-image";
import { getSpotifyImage } from "@/lib/spotify.functions";
import type { Stats2Record } from "@/lib/charts.functions";

interface StatsGridImageProps {
  records: Stats2Record[];
  title: string;
  chartId: string;
  kind: "song" | "album" | "artist";
}

function getGridDimensions(count: number): { cols: number; rows: number } {
  if (count <= 4) return { cols: 2, rows: 2 };
  if (count <= 9) return { cols: 3, rows: 3 };
  return { cols: 4, rows: 4 };
}

const COLOR_THEMES: Record<string, { accent: string; accentDark: string }> = {
  songs:          { accent: "#FF6D00", accentDark: "#E65100" },
  streamingSongs: { accent: "#FF6D00", accentDark: "#E65100" },
  radioSongs:     { accent: "#FF6D00", accentDark: "#E65100" },
  digitalSongsSales: { accent: "#FF6D00", accentDark: "#E65100" },
  albums:         { accent: "#38BDF8", accentDark: "#0EA5E9" },
  topStreamingAlbums: { accent: "#38BDF8", accentDark: "#0EA5E9" },
  topAlbumSales:  { accent: "#38BDF8", accentDark: "#0EA5E9" },
  artists:        { accent: "#F87171", accentDark: "#EF4444" },
};

function GridCell({ record, rank, kind, imageUrl, accent }: {
  record: Stats2Record;
  rank: number;
  kind: string;
  imageUrl: string | null;
  accent: string;
}) {
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        paddingBottom: "100%",
        overflow: "hidden",
        borderRadius: 0,
      }}
    >
      {/* Background image */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: imageUrl ? `url(${imageUrl})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundColor: imageUrl ? undefined : "#2a2a2a",
        }}
      />

      {/* Gradient overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `
            linear-gradient(180deg,
              rgba(0,0,0,0.1) 0%,
              rgba(0,0,0,0.2) 40%,
              rgba(0,0,0,0.75) 70%,
              rgba(0,0,0,0.92) 100%
            )
          `,
        }}
      />

      {/* Rank number - top left */}
      <div
        style={{
          position: "absolute",
          top: 12,
          left: 14,
          fontSize: 38,
          fontWeight: 900,
          color: "#fff",
          lineHeight: 1,
          textShadow: "0 2px 8px rgba(0,0,0,0.6)",
          zIndex: 2,
        }}
      >
        #{rank}
      </div>

      {/* Value - top right */}
      <div
        style={{
          position: "absolute",
          top: 14,
          right: 14,
          fontSize: 26,
          fontWeight: 900,
          color: accent,
          lineHeight: 1,
          textAlign: "right",
          textShadow: "0 2px 8px rgba(0,0,0,0.6)",
          zIndex: 2,
          maxWidth: "55%",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {record.valueLabel}
      </div>

      {/* Name - bottom */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          padding: "14px 14px 14px",
          zIndex: 2,
        }}
      >
        <div
          style={{
            fontSize: 22,
            fontWeight: 900,
            color: "#fff",
            lineHeight: 1.2,
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            textShadow: "0 1px 4px rgba(0,0,0,0.5)",
          }}
        >
          {record.name}
        </div>
        {record.artist !== record.name && (
          <div
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: "rgba(255,255,255,0.7)",
              marginTop: 2,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {record.artist}
          </div>
        )}
      </div>
    </div>
  );
}

export function StatsGridImage({ records, title, chartId, kind }: StatsGridImageProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [generating, setGenerating] = useState(false);
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const [imageUrls, setImageUrls] = useState<Record<number, string | null>>({});

  const theme = COLOR_THEMES[chartId] ?? COLOR_THEMES.songs;
  const topRecords = records.slice(0, 16);
  const { cols } = getGridDimensions(topRecords.length);

  // Pre-fetch all images and convert to base64 for html-to-image
  useEffect(() => {
    let active = true;
    setImagesLoaded(false);

    async function urlToBase64(url: string): Promise<string | null> {
      try {
        const resp = await fetch(url);
        if (!resp.ok) return null;
        const blob = await resp.blob();
        return await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(blob);
        });
      } catch {
        return null;
      }
    }

    async function loadAll() {
      const urls: Record<number, string | null> = {};
      await Promise.all(
        topRecords.map(async (record, i) => {
          let query: string;
          let type: "album" | "artist" | "track";
          if (kind === "artist") {
            query = `artist:"${record.name}"`;
            type = "artist";
          } else if (kind === "album") {
            query = `album:"${record.name}" artist:"${record.artist}"`;
            type = "album";
          } else {
            query = `artist:"${record.artist}" track:"${record.name}"`;
            type = "track";
          }
          try {
            const url = await getSpotifyImage({ data: { query, type } });
            if (active && url) {
              const base64 = await urlToBase64(url);
              if (active) urls[i] = base64 ?? url;
            } else if (active) {
              urls[i] = null;
            }
          } catch {
            if (active) urls[i] = null;
          }
        })
      );
      if (active) {
        setImageUrls(urls);
        setImagesLoaded(true);
      }
    }
    loadAll();
    return () => { active = false; };
  }, [topRecords, kind]);

  const handleDownload = async () => {
    if (!ref.current) return;
    setGenerating(true);
    try {
      const dataUrl = await toPng(ref.current, {
        width: 1080,
        height: 0,
        pixelRatio: 2,
        backgroundColor: "#1a1a1a",
      });
      const resp = await fetch(dataUrl);
      const blob = await resp.blob();
      const file = new File([blob], `daegon-stats-grid-${chartId}.png`, { type: "image/png" });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `daegon stats grid` });
      } else {
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = blobUrl;
        link.download = `daegon-stats-grid-${chartId}.png`;
        link.target = "_blank";
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
          document.body.removeChild(link);
          URL.revokeObjectURL(blobUrl);
        }, 100);
      }
    } catch (err) {
      console.error("Failed to generate grid image:", err);
    } finally {
      setGenerating(false);
    }
  };

  const gridWidth = 1080;
  const cellSize = Math.floor(gridWidth / cols);
  const gridHeight = cellSize * Math.ceil(topRecords.length / cols);

  return (
    <>
      <button
        onClick={handleDownload}
        disabled={generating || !imagesLoaded}
        className="btn-gold text-xs whitespace-nowrap"
      >
        <i className={`fas ${generating ? "fa-spinner fa-spin" : !imagesLoaded ? "fa-spinner fa-spin" : "fa-download"}`} />
        {generating ? "Generating..." : !imagesLoaded ? "Loading images..." : "Download Grid"}
      </button>

      <div style={{ position: "fixed", left: "-9999px", top: 0 }}>
        <div
          ref={ref}
          style={{
            width: gridWidth,
            background: `
              linear-gradient(135deg, #0d0d0d 0%, #1a1a1a 25%, #2a2a2a 50%, #1a1a1a 75%, #0d0d0d 100%),
              radial-gradient(ellipse at 20% 50%, rgba(255,255,255,0.03) 0%, transparent 50%),
              radial-gradient(ellipse at 80% 20%, rgba(255,255,255,0.04) 0%, transparent 40%)
            `,
            fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            position: "relative",
          }}
        >
          {/* Metallic shimmer */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(45deg, transparent 0%, rgba(255,255,255,0.02) 25%, transparent 50%, rgba(255,255,255,0.03) 75%, transparent 100%)",
              pointerEvents: "none",
              zIndex: 0,
            }}
          />

          {/* Header */}
          <div
            style={{
              background: theme.accent,
              padding: "40px 48px 34px",
              display: "flex",
              flexDirection: "column",
              gap: 4,
              position: "relative",
              zIndex: 1,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div
                style={{
                  fontSize: 24,
                  fontWeight: 900,
                  color: "#000",
                  letterSpacing: "-0.02em",
                  textTransform: "uppercase",
                  opacity: 0.5,
                }}
              >
                daegon charts
              </div>
            </div>
            <div
              style={{
                fontSize: 52,
                fontWeight: 900,
                color: "#000",
                letterSpacing: "-0.03em",
                lineHeight: 1,
                textTransform: "uppercase",
              }}
            >
              {title}
            </div>
            <div
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: "#000",
                opacity: 0.5,
                marginTop: 4,
              }}
            >
              TOP {topRecords.length}
            </div>
          </div>

          {/* Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${cols}, 1fr)`,
              position: "relative",
              zIndex: 1,
            }}
          >
            {topRecords.map((record, i) => (
              <GridCell
                key={`${record.name}-${record.artist}-${i}`}
                record={record}
                rank={i + 1}
                kind={kind}
                imageUrl={imageUrls[i] ?? null}
                accent={theme.accent}
              />
            ))}
          </div>

          {/* Footer */}
          <div
            style={{
              padding: "16px 48px 24px",
              borderTop: "1px solid rgba(255,255,255,0.06)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              position: "relative",
              zIndex: 1,
            }}
          >
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.2)", fontWeight: 600 }}>
              daegoncharts.com
            </div>
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.2)", fontWeight: 600 }}>
              {topRecords.length} / {records.length} ENTRIES
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
