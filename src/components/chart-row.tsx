import { Link } from "@tanstack/react-router";
import type { ChartEntry } from "@/lib/charts.functions";
import { getCertificationLevel, getCertificationMeta } from "@/lib/charts.functions";
import { slugifyArtist, slugify as slugifyAlbum, songSlug, stripAlbumEdition, chartsConfig } from "@/lib/charts-config";
import { useEffect, useMemo, useState } from "react";
import { getSpotifyImage } from "@/lib/spotify.functions";
import { motion } from "framer-motion";
import { TrackArtists, stripFeatFromTitle, getFeatArtistsFromTitle } from "@/components/track-artists";
import { playTrack } from "@/components/audio-player";

const mbCharts = new Set(["radioSongs", "topStreamingAlbums", "streamingSongs"]);
const streamsMBCharts = new Set(["songs", "albums", "artists"]);

function parseEuropeanNumber(v: string | number | undefined): number {
  let s = String(v ?? "").trim();
  if (!s || s === "-") return 0;
  s = s.replace(/[^0-9.,\-]/g, "");
  if (!s) return 0;
  if (s.includes(".") && ((s.match(/\./g) || []).length > 1 || /^\d+\.\d{3}$/.test(s))) {
    s = s.replace(/\./g, "");
  }
  s = s.replace(/,/g, "");
  const n = parseInt(s, 10);
  return isNaN(n) ? 0 : n;
}

function formatMB(v: string | number | undefined): string {
  const num = parseEuropeanNumber(v);
  if (num === 0) return String(v ?? "-");
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1).replace(/\.0$/, "")}B`;
  if (num >= 1_000) return `${Math.round(num / 1_000)}M`;
  return String(num);
}

function ordinal(n: number): string {
  if (n <= 0) return String(n);
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function wordOrdinal(n: number): string {
  const words = ["zeroth", "first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth", "eleventh", "twelfth", "thirteenth", "fourteenth", "fifteenth", "sixteenth", "seventeenth", "eighteenth", "nineteenth", "twentieth"];
  if (n >= 0 && n <= 20) return words[n];
  return ordinal(n);
}

function formatValue(v: string | number | undefined, chartId?: string, isStream?: boolean): string {
  if (v == null || String(v).trim() === "" || String(v).trim() === "-") return "-";
  if (isStream && chartId && streamsMBCharts.has(chartId)) {
    return formatMB(v);
  }
  if (chartId && mbCharts.has(chartId)) {
    return formatMB(v);
  }
  const num = parseEuropeanNumber(v);
  if (num === 0) return String(v);
  return num.toLocaleString("en-US");
}

function AwardIcon({ type }: { type: "gainer" | "performance" }) {
  if (type === "gainer") {
    return (
      <span className="award-icon inline-flex items-center justify-center w-6 h-6 rounded-full border-2 border-black" title="Greatest Gainer of the Week">
        <svg viewBox="0 0 24 24" fill="black" className="w-3.5 h-3.5"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.27 5.82 22 7 14.14l-5-4.87 6.91-1.01z"/></svg>
      </span>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="black" className="award-icon w-5 h-5" title="Gains In Performance"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.27 5.82 22 7 14.14l-5-4.87 6.91-1.01z"/></svg>
  );
}

function DiffIndicator({ diff }: { diff: string }) {
  if (!diff) return null;
  if (diff === "NEW") return <span className="diff-badge diff-new">NEW</span>;
  if (diff === "RE") return <span className="diff-badge diff-new">RE-ENTRY</span>;
  if (diff === "=") return <span className="diff-steady flex items-center justify-center"><svg className="diff-arrow" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8h10M9 4l4 4-4 4"/></svg></span>;
  if (diff.startsWith("▲")) {
    return <span className="diff-steady flex items-center justify-center"><svg className="diff-arrow" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3v10M4 7l4-4 4 4"/></svg></span>;
  }
  if (diff.startsWith("▼")) {
    return <span className="diff-steady flex items-center justify-center"><svg className="diff-arrow" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 13V3M4 9l4 4 4-4"/></svg></span>;
  }
  return <span className="text-xs">{diff}</span>;
}

interface Props {
  entry: ChartEntry;
  kind: "song" | "album" | "artist";
  chartId?: string;
  date?: string;
  chartDates?: string[];
  chartEntriesByDate?: Record<string, ChartEntry[]>;
  showDiff?: boolean;
  diffColors?: boolean;
  hideDetailFields?: boolean;
}

function SpotifyImage({ entry, kind, delay = 0 }: { entry: ChartEntry; kind: "song" | "album" | "artist"; delay?: number }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const query = useMemo(() => {
    if (kind === "album") {
      return `album:"${entry.name}" artist:"${entry.artist}"`;
    }
    if (kind === "artist") {
      const name = String(entry.name ?? "").trim();
      if (/^ja[oã]$/i.test(name)) return 'artist:"Jão"';
      if (/^anitta$/i.test(name)) return 'artist:"Anitta"';
      return `artist:"${name}"`;
    }
    const artistName = String(entry.artist ?? "").trim();
    if (/^ja[oã]$/i.test(artistName)) return 'artist:"Jão"';
    if (/^anitta$/i.test(artistName)) return 'artist:"Anitta"';
    return `track:"${entry.name}" artist:"${artistName}"`;
  }, [entry.name, entry.artist, kind]);
  const type = kind === "song" ? "track" : kind === "album" ? "album" : "artist";

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      getSpotifyImage({ data: { query, type } }).then((url) => {
        if (active && url) setImageUrl(url);
      });
    }, delay);
    return () => { active = false; clearTimeout(timer); };
  }, [query, type, delay]);

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={entry.name}
        loading="lazy"
        decoding="async"
        onError={() => setImageUrl(null)}
        className="w-full h-full object-cover shadow-sm rounded-none animate-fade-in"
      />
    );
  }

  return <i className={`fas ${kind === "artist" ? "fa-user" : kind === "album" ? "fa-compact-disc" : "fa-music"} text-2xl opacity-30 animate-pulse`} />;
}

function ChartMetrics({ entry, showDiff }: { entry: ChartEntry; showDiff?: boolean }) {
  const lastWeek = entry.lastWeek !== undefined && String(entry.lastWeek).trim() !== "" ? (entry.lastWeek === "0" || entry.lastWeek === 0 ? "-" : String(entry.lastWeek)) : "-";
  const peak = entry.peak > 0 ? String(entry.peak) : "-";
  const weeks = entry.weeks > 0 ? String(entry.weeks) : "-";

  return (
    <div className="flex items-center gap-2 text-[11px] lg:text-xs leading-tight whitespace-nowrap flex-shrink-0">
      {showDiff && (
        <>
          <span className="text-[var(--muted-foreground)]">LW <span className="font-medium text-[var(--muted-foreground)]">{lastWeek}</span></span>
          <span className="text-[var(--border)]">·</span>
        </>
      )}
      <span className="text-[var(--muted-foreground)]">PEAK <span className="font-medium text-[var(--muted-foreground)]">{peak}</span></span>
      <span className="text-[var(--border)]">·</span>
      <span className="text-[var(--muted-foreground)]">WEEKS <span className="font-medium text-[var(--muted-foreground)]">{weeks}</span></span>
    </div>
  );
}

export function ChartRow({ entry, kind, chartId, date, chartDates, chartEntriesByDate, showDiff = true, diffColors = false, hideDetailFields = false }: Props) {
  const [showDetails, setShowDetails] = useState(false);
  const [copied, setCopied] = useState(false);
  const slug = slugifyArtist(entry.artist);
  const isGoat = chartId?.startsWith("goat");

  const certLevel = useMemo(() => {
    if (chartId !== "songs" && chartId !== "albums") return undefined;
    const totalUnits = entry.totalUnits ? parseFloat(String(entry.totalUnits).replace(/[.,]/g, "")) : 0;
    if (!totalUnits) return undefined;
    return getCertificationLevel(totalUnits, chartId === "songs" ? "song" : "album");
  }, [entry.totalUnits, chartId]);
  const certMeta = getCertificationMeta(certLevel);

  const awards = useMemo(() => {
    if (!date || !chartEntriesByDate || isGoat) return { gainerStreams: false, gainerSales: false, performance: false, hasStar: false };
    if (chartId !== "songs" && chartId !== "albums") return { gainerStreams: false, gainerSales: false, performance: false, hasStar: false };

    const isUpOrReOrNew = entry.diff.startsWith("▲") || entry.diff === "RE" || entry.diff === "NEW";
    if (!isUpOrReOrNew) return { gainerStreams: false, gainerSales: false, performance: false, hasStar: false };

    const currentEntries = chartEntriesByDate[date] || [];
    const myKey = `${entry.name}|${entry.artist}`;

    let maxStreams = 0;
    let streamsKey = "";
    let maxSales = 0;
    let salesKey = "";
    for (const e of currentEntries) {
      const st = parseEuropeanNumber(e.streams);
      if (st > maxStreams) { maxStreams = st; streamsKey = `${e.name}|${e.artist}`; }
      const sa = parseEuropeanNumber(e.sales);
      if (sa > maxSales) { maxSales = sa; salesKey = `${e.name}|${e.artist}`; }
    }

    const isGainerStreams = maxStreams > 0 && streamsKey === myKey;
    const isGainerSales = maxSales > 0 && salesKey === myKey;
    const isGainer = isGainerStreams || isGainerSales;

    return { gainerStreams: isGainerStreams, gainerSales: isGainerSales, performance: !isGainer, hasStar: true };
  }, [date, chartEntriesByDate, entry, isGoat, chartId]);

  const detailFields = useMemo(() => {
    const items: Array<{ label: string; value: string | undefined }> = [];

    if (chartId === "artists") {
      const salesVal = parseEuropeanNumber(entry.sales);
      const totalSalesVal = parseEuropeanNumber(entry.totalSales);
      const streamsVal = parseEuropeanNumber(entry.streams);
      const totalStreamsVal = parseEuropeanNumber(entry.totalStreams);
      const unitsVal = parseEuropeanNumber(entry.units);
      const totalUnitsVal = parseEuropeanNumber(entry.totalUnits);
      items.push({ label: "Units", value: unitsVal > 0 ? formatValue(entry.units, chartId) : "-" });
      items.push({ label: "Total Units", value: totalUnitsVal > 0 ? formatValue(entry.totalUnits, chartId) : "-" });
      items.push({ label: "Sales", value: salesVal > 0 ? formatValue(entry.sales, chartId) : "-" });
      items.push({ label: "Total Sales", value: totalSalesVal > 0 ? formatValue(entry.totalSales, chartId) : "-" });
      items.push({ label: "Streams", value: streamsVal > 0 ? formatValue(entry.streams, chartId, true) : "-" });
      items.push({ label: "Total Streams", value: totalStreamsVal > 0 ? formatValue(entry.totalStreams, chartId, true) : "-" });
      return items;
    }

    if (chartId === "songs") {
      if (entry.points) items.push({ label: "Points", value: formatValue(entry.points, chartId) });
      const streamsVal = parseEuropeanNumber(entry.streams);
      items.push({ label: "Streams", value: streamsVal > 0 ? formatValue(entry.streams, chartId, true) : "-" });
      if (entry.airplay !== undefined) {
        const airVal = parseEuropeanNumber(entry.airplay);
        items.push({ label: "Airplay", value: airVal > 0 ? formatValue(entry.airplay, chartId, true) : "-" });
      }
      const salesVal = parseEuropeanNumber(entry.sales);
      items.push({ label: "Sales", value: salesVal > 0 ? formatValue(entry.sales, chartId) : "-" });
      const unitsVal = parseEuropeanNumber(entry.units);
      items.push({ label: "Units", value: unitsVal > 0 ? formatValue(entry.units, chartId) : "-" });
      if (entry.totalUnits !== undefined) {
        const totalUnitsVal = parseEuropeanNumber(entry.totalUnits);
        items.push({ label: "Total Units", value: totalUnitsVal > 0 ? formatValue(entry.totalUnits, chartId) : "-" });
      }
      if (certLevel) items.push({ label: "Certification", value: certLevel });
      return items;
    }

    if (chartId === "albums") {
      const unitsVal = parseEuropeanNumber(entry.units);
      items.push({ label: "Units", value: unitsVal > 0 ? formatValue(entry.units, chartId) : "-" });
      if (entry.totalUnits !== undefined) {
        const totalUnitsVal = parseEuropeanNumber(entry.totalUnits);
        items.push({ label: "Total Units", value: totalUnitsVal > 0 ? formatValue(entry.totalUnits, chartId) : "-" });
      }
      const salesVal = parseEuropeanNumber(entry.sales);
      items.push({ label: "Pure Sales", value: salesVal > 0 ? formatValue(entry.sales, chartId) : "-" });
      const streamsVal = parseEuropeanNumber(entry.streams);
      items.push({ label: "SEA", value: streamsVal > 0 ? formatValue(entry.streams, chartId, true) : "-" });
      if (certLevel) items.push({ label: "Certification", value: certLevel });
      return items;
    }

    if (chartId === "yearEndRadio" || chartId === "goatRadio") {
      if (entry.units) items.push({ label: "Total Audience", value: formatValue(entry.units, chartId) });
      return items;
    }

    if (chartId === "topStreamingAlbums" || chartId === "streamingSongs") {
      const streamsVal = parseEuropeanNumber(entry.streams);
      items.push({ label: "Streams", value: streamsVal > 0 ? formatValue(entry.streams, chartId, true) : "-" });
      if (entry.totalStreams !== undefined) {
        const totalStreamsVal = parseEuropeanNumber(entry.totalStreams);
        items.push({ label: "Total Streams", value: totalStreamsVal > 0 ? formatValue(entry.totalStreams, chartId, true) : "-" });
      }
      if (certLevel) items.push({ label: "Certification", value: certLevel });
      return items;
    }

    if (chartId === "topAlbumSales" || chartId === "digitalSongsSales") {
      const salesVal = parseEuropeanNumber(entry.sales);
      items.push({ label: "Sales", value: salesVal > 0 ? formatValue(entry.sales, chartId) : "-" });
      if (entry.totalSales !== undefined) {
        const totalSalesVal = parseEuropeanNumber(entry.totalSales);
        items.push({ label: "Total Sales", value: totalSalesVal > 0 ? formatValue(entry.totalSales, chartId) : "-" });
      }
      if (certLevel) items.push({ label: "Certification", value: certLevel });
      return items;
    }

    // Fallback for other charts
    if (chartId !== "radioSongs" && chartId !== "yearEndRadio" && chartId !== "goatRadio") {
      if (entry.units) {
        const unitsVal = parseEuropeanNumber(entry.units);
        items.push({ label: "Units", value: unitsVal > 0 ? formatValue(entry.units, chartId) : "-" });
      }
    }
    if (chartId !== "radioSongs" && chartId !== "yearEndRadio" && chartId !== "goatRadio") {
      if (entry.totalUnits) {
        const totalUnitsVal = parseEuropeanNumber(entry.totalUnits);
        items.push({ label: "Total Units", value: totalUnitsVal > 0 ? formatValue(entry.totalUnits, chartId) : "-" });
      }
    }
    if (entry.sales) {
      const salesVal = parseEuropeanNumber(entry.sales);
      items.push({ label: "Sales", value: salesVal > 0 ? formatValue(entry.sales, chartId) : "-" });
    }
    if (entry.streams) {
      const streamsVal = parseEuropeanNumber(entry.streams);
      items.push({ label: "Streams", value: streamsVal > 0 ? formatValue(entry.streams, chartId, true) : "-" });
    }
    if (entry.totalStreams) {
      const totalStreamsVal = parseEuropeanNumber(entry.totalStreams);
      items.push({ label: "Total Streams", value: totalStreamsVal > 0 ? formatValue(entry.totalStreams, chartId, true) : "-" });
    }
    if (entry.audience !== undefined) {
      const audVal = parseEuropeanNumber(entry.audience);
      items.push({ label: "Audience", value: audVal > 0 ? formatValue(entry.audience, chartId) : "-" });
    }
    if (entry.airplay !== undefined) {
      const airVal = parseEuropeanNumber(entry.airplay);
      items.push({ label: "Airplay", value: airVal > 0 ? formatValue(entry.airplay, chartId, true) : "-" });
    }
    if (entry.certification) items.push({ label: "Certification", value: entry.certification });
    else if (entry.totalUnits) {
      const totalUnitsVal = parseEuropeanNumber(entry.totalUnits);
      const certLevel = getCertificationLevel(totalUnitsVal, kind === "album" ? "album" : "song");
      if (certLevel) items.push({ label: "Certification", value: certLevel });
    }
    if (awards.gainerStreams) {
      items.push({ label: "Award", value: "Greatest Gainer of the Week — Streams" });
    }
    if (awards.gainerSales) {
      items.push({ label: "Award", value: "Greatest Gainer of the Week — Sales" });
    }
    if (awards.performance) {
      items.push({ label: "Award", value: "Gains In Performance" });
    }
    return items;
  }, [awards, chartId, entry.airplay, entry.audience, entry.certification, entry.points, entry.sales, entry.streams, entry.totalStreams, entry.totalUnits, entry.units, entry.lastWeek, isGoat, kind]);

  const metric = kind === "song" ? entry.points ?? entry.units : entry.units ?? entry.points;

  const handleCopy = async () => {
    const cfg = chartId ? chartsConfig[chartId] : undefined;
    const chartTitle = cfg ? cfg.title : "Chart";
    const isAlbum = kind === "album";
    const isNew = entry.diff === "NEW";
    const isReEntry = entry.diff === "RE";
    const isUp = entry.diff?.startsWith("▲");
    const atPeak = entry.position === entry.peak;
    const w1 = entry.weeksAt1 ?? 0;

    // Diff symbols: ▲→+, ▼→-
    let copyDiff = entry.diff;
    if (copyDiff === "NEW") copyDiff = "new";
    else if (copyDiff === "RE") copyDiff = "re";
    else if (copyDiff.startsWith("▲")) copyDiff = "+" + copyDiff.slice(1);
    else if (copyDiff.startsWith("▼")) copyDiff = "-" + copyDiff.slice(1);

    // Position part
    const posPart = isNew ? `#${entry.position}(new)` : `#${entry.position}(${copyDiff})`;

    // Metrics
    const metricsPart = isAlbum && entry.units ? formatValue(entry.units, chartId) : "";

    // Album new entry format: units first, then streams/sales in bracket
    let entryDetail = "";
    if (isAlbum && isNew) {
      const unitsRaw = parseEuropeanNumber(entry.units);
      const unitsStr = unitsRaw > 0 ? unitsRaw.toLocaleString("en-US") : "";
      const streamsRaw = parseEuropeanNumber(entry.streams);
      const salesRaw = parseEuropeanNumber(entry.sales);
      const streamsStr = streamsRaw > 0 ? `${(streamsRaw / 1000).toLocaleString("en-US")} million on-demand streams` : "";
      const salesStr = salesRaw > 0 ? `${salesRaw.toLocaleString("en-US")} pure sales` : "";
      const bracketParts = [];
      if (streamsStr) bracketParts.push(streamsStr);
      if (salesStr) bracketParts.push(salesStr);
      const bracket = bracketParts.length > 0 ? ` [${bracketParts.join(" | ")}].` : ".";
      entryDetail = unitsStr ? `${unitsStr}${bracket}` : bracket;
    } else {
      const unitsStr = metricsPart || "";
      const totalUnitsRaw = parseEuropeanNumber(entry.totalUnits);
      const totalStr = totalUnitsRaw > 0 ? ` (${totalUnitsRaw.toLocaleString("en-US")} units since release)` : "";
      entryDetail = unitsStr ? `${unitsStr}${totalStr}` : "";
    }

    // Annotations at end (replaces peak annotation)
    let annotation = "";
    const isRePeak = atPeak && isUp && !isNew && entry.position === 1 && w1 > 1;
    const isWeeksAt1 = entry.position === 1 && w1 > 1 && !isRePeak;

    const weeksAtPeak = runEntries.filter((r) => r.position === entry.peak).length;

    if (isRePeak) {
      annotation = `*re-peak; ${wordOrdinal(w1)} week at #1*`;
    } else if (isWeeksAt1) {
      annotation = `*${wordOrdinal(w1)} week at #1*`;
    } else if (atPeak && (isUp || isReEntry) && !isNew) {
      annotation = `*new peak*`;
    } else if (entry.peak === 1 && w1 >= 1) {
      annotation = w1 > 1 ? `*peak: #1 for ${w1} weeks*` : `*peak: #1*`;
    } else if (entry.peak > 0 && weeksAtPeak > 1) {
      annotation = `*peak: #${entry.peak} for ${weeksAtPeak} weeks*`;
    } else {
      annotation = `*peak: #${entry.peak}*`;
    }

    // Chart date
    let chartDateStr = "";
    if (date) {
      const formattedDate = new Date(date + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
      chartDateStr = `\n\nChart dated ${formattedDate}.`;
    }

    const weeksPart = isNew ? "" : `[${entry.weeks} weeks].`;
    const annotationPart = isNew ? "" : annotation;

    const featInfo = getFeatArtistsFromTitle(entry.name);
    const artistPart = featInfo ? `${entry.artist} ${featInfo.prefix} ${featInfo.artists}` : entry.artist;

    const parts = [
      `Daegon's ${chartTitle}:`,
      posPart,
      `${isAlbum ? stripAlbumEdition(stripFeatFromTitle(entry.name)) : stripFeatFromTitle(entry.name)},`,
      artistPart,
      entryDetail,
      weeksPart,
      annotationPart
    ].filter(Boolean).join(" ");

    const textToCopy = `${parts}${chartDateStr}`;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(textToCopy);
      } else {
        const ta = document.createElement("textarea");
        ta.value = textToCopy;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
    } catch {
      const ta = document.createElement("textarea");
      ta.value = textToCopy;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const runEntries = useMemo(() => {
    if (!chartDates || !chartEntriesByDate || !chartId || isGoat) return [];
    const key = `${entry.name.toLowerCase()}|${entry.artist.toLowerCase()}`;
    return chartDates
      .filter((d) => !date || d <= date)
      .flatMap((d) => (chartEntriesByDate[d] || [])
        .filter((e) => `${String(e.name ?? "").toLowerCase()}|${String(e.artist ?? "").toLowerCase()}` === key)
        .map((e) => ({ date: d, position: e.position, peak: e.peak, weeks: e.weeks, points: e.points, totalUnits: e.totalUnits }))
      );
  }, [chartDates, chartEntriesByDate, chartId, entry.artist, entry.name, isGoat, date]);

  const diffBg = useMemo(() => {
    const d = entry.diff;
    if (d === "NEW") return "bg-sky-200";
    if (d === "RE") return "bg-blue-200";
    if (d.startsWith("▲")) {
      const spots = parseInt(d.slice(1)) || 0;
      return spots >= 10 ? "bg-emerald-300" : "bg-emerald-100";
    }
    if (d.startsWith("▼")) {
      const spots = parseInt(d.slice(1)) || 0;
      return spots >= 10 ? "bg-red-300" : "bg-red-100";
    }
    return "";
  }, [entry.diff]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.3 }}
      id={`entry-${entry.position}`}
      className={`chart-card w-full ${diffColors && diffBg ? diffBg : ""} ${diffColors && diffBg ? "diff-colors-active" : ""}`}
    >
      {/* Desktop layout */}
      <div className="hidden md:grid gap-3 items-center" style={{ gridTemplateColumns: "auto auto auto minmax(0,1fr) auto" }}>
        <div className={`flex flex-col items-center justify-center ${entry.position === 1 ? "w-16" : "w-16"}`}>
          <div className={`rank-num font-black ${entry.position === 1 ? "text-4xl bg-[var(--accent)] text-black w-16 h-16 flex items-center justify-center" : "text-3xl"}`}>{entry.position}</div>
          {entry.position === 1 && (entry.weeksAt1 ?? 0) >= 2 && (
            <div className="mt-0.5 px-1.5 py-0.5 bg-[#FFD600] text-black text-[9px] font-bold rounded whitespace-nowrap uppercase">
              {entry.weeksAt1} {entry.weeksAt1 === 1 ? "WEEK" : "WEEKS"}
            </div>
          )}
        </div>
        <div className={`placeholder-art flex items-center justify-center overflow-hidden bg-[var(--muted)] rounded-none flex-shrink-0 ${entry.position === 1 ? "w-[180px] h-[180px] border-l-4 border-[var(--accent)] -ml-3" : "w-24 h-24"}`}>
          <SpotifyImage entry={entry} kind={kind} delay={entry.position * 150} />
        </div>
        <div className="flex items-center justify-center w-8 flex-shrink-0">
          {showDiff && <DiffIndicator diff={entry.diff} />}
        </div>
        <div className="min-w-0 flex flex-col flex-1">
          <div className={`font-bold break-words line-clamp-2 flex flex-wrap items-center gap-1.5 ${entry.position === 1 ? "text-xl" : "text-base"}`}>
            {kind === "album" ? (
              <Link to="/album/$slug" params={{ slug: slugifyAlbum(entry.name) }} className="hover:text-[var(--accent)] hover:underline">
                {stripAlbumEdition(stripFeatFromTitle(entry.name))}
              </Link>
            ) : kind === "song" ? (
              <Link to="/song/$slug" params={{ slug: songSlug(entry.name, entry.artist) }} className="hover:text-[var(--accent)] hover:underline">
                {stripFeatFromTitle(entry.name)}
              </Link>
            ) : (
              <Link to="/artist/$slug" params={{ slug }} className="hover:text-[var(--accent)] hover:underline">{entry.name}</Link>
            )}
            {entry.position !== 1 && (entry.weeksAt1 ?? 0) >= 2 && (
              <span className="inline-flex items-center px-1.5 py-0.5 bg-[#FFD600] text-black text-[9px] font-bold rounded whitespace-nowrap uppercase">
                {entry.weeksAt1} {entry.weeksAt1 === 1 ? "WEEK" : "WEEKS"} AT #1
              </span>
            )}
          </div>
          {kind !== "artist" && (
            <div className={`break-words line-clamp-2 ${entry.position === 1 ? "text-base text-[var(--muted-foreground)]" : "text-sm text-[var(--muted-foreground)]"}`}>
              <Link to="/artist/$slug" params={{ slug }} className="hover:text-[var(--accent)] hover:underline">{entry.artist}</Link>
              {kind === "song" && <TrackArtists song={entry.name} artist={entry.artist} className="text-sm text-[var(--muted-foreground)]" />}
            </div>
          )}
          {kind === "song" && chartId !== "songs" && chartId !== "streamingSongs" && entry.album && (
            <Link to="/album/$slug" params={{ slug: slugifyAlbum(entry.album) }} className="text-[11px] text-[var(--muted-foreground)] break-words hover:text-[var(--accent)] hover:underline">{stripAlbumEdition(entry.album)}</Link>
          )}
        </div>
        <div className="flex items-center gap-4 flex-shrink-0">
          {awards.hasStar && (
            <div className="flex items-center">
              <AwardIcon type={(awards.gainerStreams || awards.gainerSales) ? "gainer" : "performance"} />
            </div>
          )}
          <ChartMetrics entry={entry} showDiff={showDiff} />
          <div className="flex flex-col gap-2">
            {kind === "song" && (
              <button type="button" onClick={() => playTrack(entry.artist, entry.name)} className="play-btn w-8 h-8 rounded-full bg-[var(--muted)] text-[var(--foreground)] text-sm hover:bg-[var(--border)] active:bg-[var(--accent)] active:text-white active:scale-95 transition-all duration-200 flex items-center justify-center" aria-label="Play preview">
                <i className="fas fa-play ml-0.5" />
              </button>
            )}
            <div className="relative">
              <button type="button" onClick={handleCopy} className={`copy-btn w-8 h-8 rounded-full text-sm transition-all duration-200 flex items-center justify-center ${copied ? "bg-[var(--accent)] text-black" : "bg-[var(--muted)] text-[var(--foreground)] hover:bg-[var(--border)] active:bg-[var(--accent)] active:text-white active:scale-95"}`} aria-label="Copy info">
                <i className={`fas ${copied ? "fa-check" : "fa-copy"}`} />
              </button>
              {copied && (
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap bg-[var(--foreground)] text-[var(--background)] text-[10px] font-bold px-2 py-1 rounded pointer-events-none animate-fade-in">
                  Copied!
                </div>
              )}
            </div>
            <button type="button" onClick={() => setShowDetails((v) => !v)} className="details-btn w-8 h-8 rounded-full bg-[var(--muted)] text-[var(--foreground)] text-sm hover:bg-[var(--border)] active:bg-[var(--accent)] active:text-white active:scale-95 transition-all duration-200 flex items-center justify-center" aria-label="Toggle details">
              {showDetails ? "−" : "+"}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile layout — Billboard-inspired */}
      <div className="md:hidden">
        <div className="flex items-start gap-2">
          {/* Position + diff */}
          <div className="flex flex-col items-center justify-center w-8 flex-shrink-0 pt-0.5">
            <div className="rank-num text-xl font-black leading-none">{entry.position}</div>
            <div className="flex items-center justify-center h-5 mt-0.5">
              {showDiff && <DiffIndicator diff={entry.diff} />}
            </div>
            {entry.position === 1 && (entry.weeksAt1 ?? 0) >= 2 && (
              <div className="mt-0.5 px-1 py-0.5 bg-[#FFD600] text-black text-[7px] font-bold rounded whitespace-nowrap uppercase leading-none">
                {entry.weeksAt1}W AT #1
              </div>
            )}
          </div>

          {/* Cover art — enlarged */}
          <div className={`placeholder-art flex items-center justify-center overflow-hidden bg-[var(--muted)] flex-shrink-0 ${entry.position === 1 ? "w-[68px] h-[68px] border-l-[3px] border-[var(--accent)]" : "w-[64px] h-[64px]"}`}>
            <SpotifyImage entry={entry} kind={kind} delay={entry.position * 150} />
          </div>

          {/* Title / Artist / Stats — top-aligned with cover */}
          <div className="min-w-0 flex-1 flex flex-col gap-0.5 justify-start min-w-0">
            {/* Title + badges */}
            <div className="font-bold text-[13px] leading-tight break-words line-clamp-2 flex flex-wrap items-center gap-1">
              {kind === "album" ? (
                <Link to="/album/$slug" params={{ slug: slugifyAlbum(entry.name) }} className="hover:text-[var(--accent)] hover:underline">
                  {stripAlbumEdition(stripFeatFromTitle(entry.name))}
                </Link>
              ) : kind === "song" ? (
                <Link to="/song/$slug" params={{ slug: songSlug(entry.name, entry.artist) }} className="hover:text-[var(--accent)] hover:underline">
                  {stripFeatFromTitle(entry.name)}
                </Link>
              ) : (
                <Link to="/artist/$slug" params={{ slug }} className="hover:text-[var(--accent)] hover:underline">
                  {entry.name}
                </Link>
              )}
              {entry.position !== 1 && (entry.weeksAt1 ?? 0) >= 2 && (
                <span className="inline-flex items-center px-1 py-px bg-[#FFD600] text-black text-[7px] font-bold rounded whitespace-nowrap uppercase leading-none">
                  {entry.weeksAt1}W AT #1
                </span>
              )}
            </div>

            {/* Artist */}
            {kind !== "artist" && (
              <div className="text-[11px] text-[var(--muted-foreground)] leading-tight break-words line-clamp-1">
                <Link to="/artist/$slug" params={{ slug }} className="hover:text-[var(--accent)] hover:underline">
                  {entry.artist}
                </Link>
                {kind === "song" && <TrackArtists song={entry.name} artist={entry.artist} className="text-[11px] text-[var(--muted-foreground)]" />}
              </div>
            )}

            {/* LW / Peak / Weeks — inline below artist */}
            <div className="flex items-center gap-1.5 text-[9px] sm:text-[10px] text-[var(--muted-foreground)] leading-tight whitespace-nowrap mt-0.5">
              {showDiff && (
                <span>LW {entry.lastWeek !== undefined && String(entry.lastWeek).trim() !== "" ? (entry.lastWeek === "0" || entry.lastWeek === 0 ? "-" : String(entry.lastWeek)) : "-"}</span>
              )}
              <span className="text-[var(--border)]">·</span>
              <span>PEAK {entry.peak > 0 ? entry.peak : "-"}</span>
              <span className="text-[var(--border)]">·</span>
              <span>WEEKS {entry.weeks > 0 ? String(entry.weeks) : "-"}</span>
            </div>
          </div>

          {/* Right column — [Star] Copy + Details buttons */}
          <div className="flex flex-col items-center gap-1.5 flex-shrink-0 pt-0.5">
            <div className="flex items-center gap-1.5">
              {awards.hasStar && (
                <AwardIcon type={(awards.gainerStreams || awards.gainerSales) ? "gainer" : "performance"} />
              )}
              {kind === "song" && (
                <button type="button" onClick={() => playTrack(entry.artist, entry.name)} className="play-btn w-8 h-8 rounded-full bg-[var(--muted)] text-[var(--foreground)] text-xs hover:bg-[var(--border)] active:bg-[var(--accent)] active:text-white active:scale-95 transition-all duration-200 flex items-center justify-center" aria-label="Play preview">
                  <i className="fas fa-play ml-0.5" />
                </button>
              )}
              <div className="relative">
                <button type="button" onClick={handleCopy} className={`copy-btn w-8 h-8 rounded-full text-xs transition-all duration-200 flex items-center justify-center ${copied ? "bg-[var(--accent)] text-black" : "bg-[var(--muted)] text-[var(--foreground)] hover:bg-[var(--border)] active:bg-[var(--accent)] active:text-white active:scale-95"}`} aria-label="Copy info">
                  <i className={`fas ${copied ? "fa-check" : "fa-copy"}`} />
                </button>
                {copied && (
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap bg-[var(--foreground)] text-[var(--background)] text-[10px] font-bold px-2 py-1 rounded pointer-events-none animate-fade-in">
                    Copied!
                  </div>
                )}
              </div>
            </div>
            <button type="button" onClick={() => setShowDetails((v) => !v)} className="details-btn w-8 h-8 rounded-full bg-[var(--muted)] text-[var(--foreground)] text-xs hover:bg-[var(--border)] active:bg-[var(--accent)] active:text-white active:scale-95 transition-all duration-200 flex items-center justify-center" aria-label="Toggle details">
              {showDetails ? "−" : "+"}
            </button>
          </div>
        </div>
      </div>

      {/* Details panel (shared) */}
      {showDetails && (
        <div className="details-panel mt-3 w-full rounded-xl bg-[var(--muted)] p-3 border border-[var(--border)] text-sm animate-fade-in">
          {runEntries.length > 0 ? (
            <div>
              <div className="font-semibold mb-2 text-[var(--foreground)]">Chart run</div>
              <div className="space-y-2">
                {runEntries.map((run) => {
                  const runHref = `/chart/${chartId}/${run.date}`;
                  return (
                    <a
                      key={`${run.date}-${run.position}`}
                      href={runHref}
                      className="block rounded-3xl border border-[var(--border)] bg-[var(--card)] p-3 transition hover:border-[var(--accent)] hover:bg-[var(--muted)]"
                    >
                      <div className="flex items-center justify-between gap-3 text-sm text-[var(--foreground)]">
                        <span>{new Date(run.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                        <span className="font-semibold text-[var(--accent)]">{run.position}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-[var(--muted-foreground)]">
                        <span>Peak: {run.peak}</span>
                        <span>Weeks: {run.weeks}</span>
                        {run.points && <span>Points: {formatValue(run.points, chartId)}</span>}
                        {run.totalUnits && <span>Total Units: {formatValue(run.totalUnits, chartId)}</span>}
                      </div>
                    </a>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-sm text-[var(--muted-foreground)]">Details shown. Press + again to close.</div>
          )}
        </div>
      )}
    </motion.div>
  );
}
