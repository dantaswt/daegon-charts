import { useRef, useState } from "react";
import { toPng } from "html-to-image";
import type { ChartEntry } from "@/lib/charts.functions";
import { stripFeatFromTitle, getFeatArtistsFromTitle } from "@/components/track-artists";
import { stripAlbumEdition } from "@/lib/charts-config";
import { getSpotifyImage } from "@/lib/spotify.functions";

const COLOR_THEMES: Record<string, { accent: string; accentDark: string }> = {
  songs:          { accent: "#00E676", accentDark: "#00C853" },
  streamingSongs: { accent: "#00E676", accentDark: "#00C853" },
  radioSongs:     { accent: "#00E676", accentDark: "#00C853" },
  digitalSongsSales: { accent: "#00E676", accentDark: "#00C853" },
  albums:         { accent: "#2979FF", accentDark: "#1565C0" },
  topStreamingAlbums: { accent: "#2979FF", accentDark: "#1565C0" },
  topAlbumSales:  { accent: "#2979FF", accentDark: "#1565C0" },
  artists:        { accent: "#FF1744", accentDark: "#D50000" },
  goatSongs:      { accent: "#FFD700", accentDark: "#FFC107" },
  goatArtists:    { accent: "#FFD700", accentDark: "#FFC107" },
  goatAlbums:     { accent: "#FFD700", accentDark: "#FFC107" },
  goatRadio:      { accent: "#FFD700", accentDark: "#FFC107" },
  yearEndSongs:   { accent: "#FF6D00", accentDark: "#E65100" },
  yearEndArtists: { accent: "#FF6D00", accentDark: "#E65100" },
  yearEndAlbums:  { accent: "#FF6D00", accentDark: "#E65100" },
  yearEndRadio:   { accent: "#FF6D00", accentDark: "#E65100" },
  yearEndStreamingSongs: { accent: "#FF6D00", accentDark: "#E65100" },
  yearEndTopStreamingAlbums: { accent: "#FF6D00", accentDark: "#E65100" },
  yearEndTopAlbumSales: { accent: "#FF6D00", accentDark: "#E65100" },
  yearEndDigitalSongsSales: { accent: "#FF6D00", accentDark: "#E65100" },
  yearEndNewArtists: { accent: "#FF6D00", accentDark: "#E65100" },
};

function lastWeekDisplay(entry: ChartEntry): string {
  if (entry.diff === "NEW") return "NEW";
  if (entry.diff === "RE") return "RE";
  if (!entry.lastWeek) return "\u2014";
  return entry.lastWeek;
}

function displayName(entry: ChartEntry, kind: "song" | "album" | "artist"): string {
  if (kind === "artist") return entry.name;
  if (kind === "album") return stripAlbumEdition(stripFeatFromTitle(entry.name));
  return stripFeatFromTitle(entry.name);
}

function featText(entry: ChartEntry): string | null {
  const f = getFeatArtistsFromTitle(entry.name);
  if (!f) return null;
  return `${f.prefix === "&" ? "& " : "feat. "}${f.artists}`;
}

function accentToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

async function downloadBlob(dataUrl: string, filename: string) {
  const resp = await fetch(dataUrl);
  const blob = await resp.blob();
  const file = new File([blob], filename, { type: "image/png" });

  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return;
    } catch { /* user cancelled or not supported, fall through */ }
  }

  // iOS Safari ignores download attr — open in new tab so user can long-press to save
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  if (isIOS) {
    const blobUrl = URL.createObjectURL(blob);
    window.open(blobUrl, "_blank");
    setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
    return;
  }

  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = filename;
  link.target = "_blank";
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  setTimeout(() => { document.body.removeChild(link); URL.revokeObjectURL(blobUrl); }, 200);
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function truncText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 0 && ctx.measureText(t + "...").width > maxW) t = t.slice(0, -1);
  return t + "...";
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

async function renderFullChartCanvas(
  entries: ChartEntry[],
  titleText: string,
  dateLabel: string,
  kind: "song" | "album" | "artist",
  accent: string,
  hideLastWeek: boolean,
  weeksAt1: number | null,
  artworkUrl?: string | null,
): Promise<string> {
  const W = 1800;
  const PAD = 56;
  const isArtist = kind === "artist";
  const [ar, ag, ab] = accentToRgb(accent);
  const F = "Inter, Helvetica Neue, Arial, sans-serif";

  const col1 = entries.slice(1, 51);
  const col2 = entries.slice(51, 100);
  const ROW_H = 30;

  const totalW = W - PAD * 2;
  const gap = 48;
  const chartColW = (totalW - gap) / 2;
  const LX = PAD;
  const RX = PAD + chartColW + gap;

  const maxRows = Math.max(col1.length, col2.length);
  const headerH = 320;
  const chartH = maxRows * ROW_H + 40;
  const footerH = 52;
  const H = headerH + chartH + footerH + 20;

  // Use 1x on mobile to avoid iOS memory limits (16M px cap)
  const isMobile = typeof navigator !== "undefined" && navigator.maxTouchPoints > 0;
  const pixelRatio = isMobile ? 1 : 2;

  const canvas = document.createElement("canvas");
  canvas.width = W * pixelRatio;
  canvas.height = H * pixelRatio;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(pixelRatio, pixelRatio);
  ctx.textBaseline = "top";

  // ── BG ──
  ctx.fillStyle = "#f5f5f0";
  ctx.fillRect(0, 0, W, H);

  // ── HEADER: CENTERED TITLE + DATE ──
  ctx.textAlign = "center";
  ctx.fillStyle = "#1a365d";
  ctx.font = `900 64px ${F}`;
  ctx.fillText(titleText, W / 2, 28);

  ctx.fillStyle = "#000";
  ctx.font = `400 22px ${F}`;
  ctx.fillText(dateLabel, W / 2, 102);

  ctx.fillStyle = accent;
  ctx.fillRect(W / 2 - 120, 134, 240, 3);
  ctx.textAlign = "left";

  // ── #1 SPOTLIGHT ──
  const spotY = 160;
  const top = entries[0];
  if (top) {
    const artSize = 140;
    const artX = PAD;
    const artY = spotY;

    // Artwork
    const artImg = artworkUrl ? await loadImage(artworkUrl) : null;
    if (artImg) {
      ctx.save();
      roundRect(ctx, artX, artY, artSize, artSize, 8);
      ctx.clip();
      ctx.drawImage(artImg, artX, artY, artSize, artSize);
      ctx.restore();
    } else {
      const grad = ctx.createLinearGradient(artX, artY, artX + artSize, artY + artSize);
      grad.addColorStop(0, accent);
      grad.addColorStop(1, `rgb(${Math.max(0, ar - 50)},${Math.max(0, ag - 50)},${Math.max(0, ab - 50)})`);
      ctx.fillStyle = grad;
      roundRect(ctx, artX, artY, artSize, artSize, 8);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = `900 56px ${F}`;
      ctx.textAlign = "center";
      ctx.fillText("1", artX + artSize / 2, artY + artSize / 2 - 28);
      ctx.textAlign = "left";
    }

    // Details
    const detX = artX + artSize + 28;
    const detW = totalW - artSize - 28;

    ctx.fillStyle = "#000";
    ctx.font = `900 40px ${F}`;
    ctx.fillText(truncText(ctx, displayName(top, kind), detW), detX, artY);

    if (!isArtist) {
      ctx.fillStyle = "#555";
      ctx.font = `400 24px ${F}`;
      const artistStr = top.artist + (featText(top) ? ` ${featText(top)}` : "");
      ctx.fillText(truncText(ctx, artistStr, detW), detX, artY + 48);
    }

    const statsY = artY + (isArtist ? 50 : 84);
    const stats = [
      { label: "LAST WEEK", value: lastWeekDisplay(top) },
      { label: "PEAK", value: `${top.peak}` },
      { label: "WEEKS ON CHART", value: `${top.weeks}` },
    ];
    if (weeksAt1) stats.splice(1, 0, { label: "WEEKS AT #1", value: `${weeksAt1}` });

    let sx = detX;
    for (const s of stats) {
      ctx.fillStyle = "#888";
      ctx.font = `700 10px ${F}`;
      ctx.fillText(s.label, sx, statsY);
      ctx.fillStyle = "#000";
      ctx.font = `900 22px ${F}`;
      ctx.fillText(s.value, sx, statsY + 14);
      sx += 120;
    }
  }

  // ── CHART COLUMNS ──
  let chartTopY = headerH + 16;

  function drawColHeaders(x0: number, cw: number, startY: number) {
    let hy = startY;
    const colNumW = 38;
    const colLW = 42;
    const colTitleW = cw * 0.40;
    const colArtW = cw * 0.28;
    const colPkW = 34;

    ctx.fillStyle = "#888";
    ctx.font = `800 11px ${F}`;
    let hx = x0;
    ctx.fillText("#", hx, hy); hx += colNumW;
    if (!hideLastWeek) { ctx.fillText("LW", hx, hy); hx += colLW; }
    ctx.fillText("TITLE", hx, hy); hx += colTitleW;
    ctx.fillText("ARTIST" + (isArtist ? "" : "(S)"), hx, hy); hx += colArtW;
    ctx.fillText("PK", hx, hy); hx += colPkW;
    ctx.fillText("WK", hx, hy);

    hy += 12;
    ctx.strokeStyle = "#ccc";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x0, hy);
    ctx.lineTo(x0 + cw, hy);
    ctx.stroke();
    return hy + 8;
  }

  const colStartY1 = drawColHeaders(LX, chartColW, chartTopY);
  const colStartY2 = drawColHeaders(RX, chartColW, chartTopY);

  function drawEntries(entriesSlice: ChartEntry[], x0: number, cw: number, startY: number) {
    const colNumW = 38;
    const colLW = 42;
    const colTitleW = cw * 0.40;
    const colArtW = cw * 0.28;
    const colPkW = 34;

    let cy = startY;
    for (const entry of entriesSlice) {
      const isTop3 = entry.position <= 3;
      const isNo1 = entry.position === 1;
      const isNew = entry.diff === "NEW" || entry.diff === "RE";

      if (isNo1) {
        ctx.fillStyle = `rgba(${ar},${ag},${ab},0.06)`;
        ctx.fillRect(x0 - 4, cy - 2, cw + 8, ROW_H);
      }

      let cx = x0;

      if (isTop3) {
        ctx.fillStyle = accent;
        roundRect(ctx, cx, cy + 3, 28, 22, 3);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.font = `900 13px ${F}`;
      } else {
        ctx.fillStyle = "#000";
        ctx.font = `900 15px ${F}`;
      }
      ctx.textAlign = "center";
      ctx.fillText(`${entry.position}`, cx + 14, cy + 6);
      ctx.textAlign = "left";
      cx += colNumW;

      if (!hideLastWeek) {
        ctx.fillStyle = isNew ? "#16a34a" : "#999";
        ctx.font = isNew ? `800 13px ${F}` : `700 14px ${F}`;
        ctx.fillText(lastWeekDisplay(entry), cx + 4, cy + 7);
        cx += colLW;
      }

      ctx.fillStyle = isTop3 ? "#000" : "#222";
      ctx.font = isTop3 ? `900 16px ${F}` : `700 14px ${F}`;
      ctx.fillText(truncText(ctx, displayName(entry, kind), colTitleW - 8), cx + 4, cy + 5);
      cx += colTitleW;

      if (!isArtist) {
        ctx.fillStyle = "#999";
        ctx.font = `400 13px ${F}`;
        ctx.fillText(truncText(ctx, entry.artist, colArtW - 8), cx + 4, cy + 7);
      }
      cx += colArtW;

      ctx.fillStyle = entry.peak === 1 ? accent : "#999";
      ctx.font = `700 14px ${F}`;
      ctx.textAlign = "center";
      ctx.fillText(`${entry.peak}`, cx + colPkW / 2, cy + 7);
      ctx.textAlign = "left";
      cx += colPkW;

      ctx.fillStyle = "#999";
      ctx.font = `700 14px ${F}`;
      ctx.textAlign = "center";
      ctx.fillText(`${entry.weeks}`, cx + 17, cy + 7);
      ctx.textAlign = "left";

      cy += ROW_H;
      ctx.strokeStyle = "#e5e5e5";
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(x0, cy - 2);
      ctx.lineTo(x0 + cw, cy - 2);
      ctx.stroke();
    }
  }

  drawEntries(col1, LX, chartColW, colStartY1);
  drawEntries(col2, RX, chartColW, colStartY2);

  // ── FOOTER ──
  const footerY = H - footerH;
  ctx.fillStyle = "#e5e5e5";
  ctx.fillRect(PAD, footerY, W - PAD * 2, 1);

  ctx.fillStyle = "#999";
  ctx.font = `600 12px ${F}`;
  ctx.fillText("daegoncharts.com", PAD, footerY + 16);
  ctx.textAlign = "right";
  ctx.fillText(`${entries.length} ENTRIES`, W - PAD, footerY + 16);
  ctx.textAlign = "left";

  return canvas.toDataURL("image/png");
}

type ImageMode = "top10" | "full";

interface ChartImageProps {
  entries: ChartEntry[];
  chartTitle: string;
  chartId: string;
  date: string;
  kind: "song" | "album" | "artist";
  hideWeeksAt1?: boolean;
  hideLastWeek?: boolean;
  displayTitle?: string;
}

export function ChartImage({ entries, chartTitle, chartId, date, kind, hideWeeksAt1 = false, hideLastWeek = false, displayTitle }: ChartImageProps) {
  const top10Ref = useRef<HTMLDivElement>(null);
  const [generating, setGenerating] = useState(false);
  const [mode, setMode] = useState<ImageMode>("top10");
  const theme = COLOR_THEMES[chartId] ?? COLOR_THEMES.songs;
  const topEntries = entries.slice(0, 10);
  const topEntry = topEntries[0];
  const weeksAt1 = hideWeeksAt1 ? null : (topEntry?.weeksAt1 && topEntry.position === 1 ? topEntry.weeksAt1 : null);
  const isArtist = kind === "artist";
  const titleText = displayTitle ?? chartTitle.toUpperCase();

  const dateLabel = new Date(date + "T00:00:00").toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).toUpperCase();

  const handleDownload = async () => {
    setGenerating(true);
    try {
      // Ensure fonts are loaded before canvas render
      await document.fonts.ready;

      if (mode === "top10") {
        if (!top10Ref.current) return;
        const dataUrl = await toPng(top10Ref.current, {
          width: 1080,
          pixelRatio: 2,
          backgroundColor: "#1a1a1a",
        });
        await downloadBlob(dataUrl, `daegon-${chartId}-${date}-top10.png`);
      } else {
        const topEntry = entries[0];
        let artworkUrl: string | null = null;
        if (topEntry) {
          try {
            const type = kind === "song" ? "track" : kind;
            const query = kind === "song"
              ? `track:"${topEntry.name}" artist:"${topEntry.artist}"`
              : kind === "album"
                ? `album:"${topEntry.name}" artist:"${topEntry.artist}"`
                : `artist:"${topEntry.name}"`;
            artworkUrl = (await getSpotifyImage({ data: { query, type } })) ?? null;
          } catch { /* ignore */ }
        }
        const dataUrl = await renderFullChartCanvas(
          entries, titleText, dateLabel, kind, "#FF6D00", hideLastWeek, weeksAt1, artworkUrl,
        );
        await downloadBlob(dataUrl, `daegon-${chartId}-${date}-full.png`);
      }
    } catch (err) {
      console.error("Failed to generate image:", err);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <>
      {/* Controls */}
      <div className="flex items-center gap-2">
        {chartId === "songs" && (
          <div className="flex border border-[var(--border)] overflow-hidden">
            <button
              onClick={() => setMode("top10")}
              className={`text-xs font-bold uppercase tracking-wider px-3 py-2.5 transition-all min-h-[44px] ${
                mode === "top10"
                  ? "bg-[var(--accent)] text-black"
                  : "bg-[var(--muted)] text-[var(--foreground)] hover:text-[var(--accent)]"
              }`}
            >
              Top 10
            </button>
            <button
              onClick={() => setMode("full")}
              className={`text-xs font-bold uppercase tracking-wider px-2.5 py-1 transition-all border-l border-[var(--border)] ${
                mode === "full"
                  ? "bg-[var(--accent)] text-black"
                  : "bg-[var(--muted)] text-[var(--foreground)] hover:text-[var(--accent)]"
              }`}
            >
              Full Chart
            </button>
          </div>
        )}
        <button
          onClick={handleDownload}
          disabled={generating}
          className="btn-gold text-xs whitespace-nowrap"
        >
          <i className={`fas ${generating ? "fa-spinner fa-spin" : "fa-download"}`} />
          {generating ? "Generating..." : "Download Image"}
        </button>
      </div>

      {/* ─── TOP 10 IMAGE (hidden, for html-to-image) ─── */}
      <div style={{ position: "fixed", top: 0, left: 0, width: 1080, opacity: 0, pointerEvents: "none", zIndex: -1, overflow: "hidden" }}>
        <div
          ref={top10Ref}
          style={{
            width: 1080,
            background: "linear-gradient(135deg, #0d0d0d 0%, #1a1a1a 25%, #2a2a2a 50%, #1a1a1a 75%, #0d0d0d 100%)",
            backgroundImage: `
              linear-gradient(135deg, #0d0d0d 0%, #1a1a1a 25%, #2a2a2a 50%, #1a1a1a 75%, #0d0d0d 100%),
              radial-gradient(ellipse at 20% 50%, rgba(255,255,255,0.03) 0%, transparent 50%),
              radial-gradient(ellipse at 80% 20%, rgba(255,255,255,0.04) 0%, transparent 40%),
              radial-gradient(ellipse at 60% 80%, rgba(255,255,255,0.02) 0%, transparent 50%)
            `,
            fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
            display: "flex",
            flexDirection: "column",
            position: "relative",
          }}
        >
          {/* Metallic shimmer overlay */}
          <div
            style={{
              position: "absolute",
              top: 0, left: 0, right: 0, bottom: 0,
              background: "linear-gradient(45deg, transparent 0%, rgba(255,255,255,0.02) 25%, transparent 50%, rgba(255,255,255,0.03) 75%, transparent 100%)",
              pointerEvents: "none",
              zIndex: 0,
            }}
          />
          {/* Header */}
          <div
            style={{
              background: theme.accent,
              padding: "50px 60px 42px",
              display: "flex",
              flexDirection: "column",
              gap: 6,
              position: "relative",
              zIndex: 1,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ fontSize: 30, fontWeight: 900, color: "#000", letterSpacing: "-0.02em", textTransform: "lowercase", opacity: 0.5 }}>
                daegon charts
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#000", opacity: 0.6, lineHeight: 1.3 }}>CHART DATED</div>
                <div style={{ fontSize: 30, fontWeight: 900, color: "#000" }}>{dateLabel}</div>
              </div>
            </div>
            <div style={{ fontSize: 100, fontWeight: 900, color: "#000", letterSpacing: "-0.04em", lineHeight: 0.95, marginTop: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {titleText}
            </div>
          </div>

          {/* Content */}
          <div style={{ padding: "32px 60px 36px", display: "flex", flexDirection: "column", gap: 0, position: "relative", zIndex: 1 }}>
            {/* Column headers */}
            <div style={{ display: "flex", alignItems: "center", padding: "0 0 12px", borderBottom: `2px solid ${theme.accent}`, marginBottom: 4 }}>
              <div style={{ width: 70, flexShrink: 0 }} />
              <div style={{ flex: 1 }} />
            </div>

            {/* Entries */}
            {topEntries.map((entry) => {
              const isNumberOne = entry.position === 1;
              return (
                <div key={`${entry.position}-${entry.name}-${entry.artist}`}>
                  {isNumberOne && (
                    <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
                      {weeksAt1 ? (
                        <div style={{ background: theme.accent, color: "#000", fontSize: 15, fontWeight: 800, padding: "6px 18px", borderRadius: 4, letterSpacing: "0.08em", textTransform: "uppercase", width: "fit-content", marginLeft: 70 }}>
                          {weeksAt1} {weeksAt1 === 1 ? "WEEK" : "WEEKS"} AT NO. 1
                        </div>
                      ) : <div style={{ marginLeft: 70 }} />}
                      <div style={{ flex: 1 }} />
                      {!hideLastWeek && (
                        <div style={{ width: 70, fontSize: 13, fontWeight: 800, color: theme.accent, textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "center", flexShrink: 0, lineHeight: 1.2 }}>
                          LAST<br />WEEK
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{ display: "flex", alignItems: "center", padding: isNumberOne ? "20px 0" : "14px 0", borderBottom: `1px solid ${theme.accent}`, position: "relative", overflow: "hidden" }}>
                    {isNumberOne && (
                      <div style={{ position: "absolute", left: -10, top: "50%", transform: "translateY(-50%)", fontSize: 160, fontWeight: 900, color: theme.accent, opacity: 0.12, lineHeight: 1, pointerEvents: "none", zIndex: 0 }}>1</div>
                    )}
                    <div style={{ width: isNumberOne ? 90 : 70, fontSize: isNumberOne ? 64 : 44, fontWeight: 900, color: isNumberOne ? theme.accent : "#fff", lineHeight: 1, textAlign: "center", flexShrink: 0, position: "relative", zIndex: 1 }}>
                      {entry.position}
                    </div>
                    <div style={{ flex: 1, minWidth: 0, textAlign: "left", position: "relative", zIndex: 1 }}>
                      <div style={{ fontSize: isNumberOne ? 34 : 26, fontWeight: 900, color: "#fff", textTransform: "uppercase", letterSpacing: "-0.01em", lineHeight: 1.2, textAlign: "left", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const }}>
                        {displayName(entry, kind)}
                      </div>
                    </div>
                    {!isArtist && (() => {
                      const featInfo = getFeatArtistsFromTitle(entry.name);
                      return (
                        <div style={{ flexShrink: 0, textAlign: "right", marginLeft: 16, marginRight: 24, maxWidth: 340, position: "relative", zIndex: 1 }}>
                          <div style={{ fontSize: isNumberOne ? 28 : 26, color: "rgba(255,255,255,0.45)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {entry.artist}
                          </div>
                          {featInfo && (
                            <div style={{ fontSize: isNumberOne ? 28 : 26, color: "rgba(255,255,255,0.45)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {featInfo.prefix === "&" ? "&" : "feat."}{" "}{featInfo.artists}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                    {isArtist && <div style={{ flex: 1 }} />}
                    {!hideLastWeek && (
                      <div style={{ width: 70, fontSize: isNumberOne ? 26 : 22, fontWeight: 800, color: theme.accent, textAlign: "center", flexShrink: 0, position: "relative", zIndex: 1 }}>
                        {lastWeekDisplay(entry)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div style={{ padding: "18px 60px 28px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center", position: "relative", zIndex: 1 }}>
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.2)", fontWeight: 600 }}>daegoncharts.com</div>
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.2)", fontWeight: 600 }}>{topEntries.length} / {entries.length} ENTRIES SHOWN</div>
          </div>
        </div>
      </div>
    </>
  );
}
