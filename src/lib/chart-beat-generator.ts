import { createServerFn } from "@tanstack/react-start";
import { getWeeklyChart, getAllArtistStats, cached, type ChartEntry, type WeeklyChartData } from "./charts.functions";
import { chartsConfig } from "./charts-config";

export interface GeneratedBeatArticle {
  chartId: string;
  chartTitle: string;
  date: string;
  headline: string;
  subtitle: string;
  sections: BeatSection[];
  image: string | null;
  artist: string | null;
}

export interface BeatSection {
  heading?: string;
  paragraphs: string[];
}

function ordinal(n: number): string {
  if (n <= 0) return String(n);
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function wordOrdinal(n: number): string {
  const words = ["Zeroth", "First", "Second", "Third", "Fourth", "Fifth", "Sixth", "Seventh", "Eighth", "Ninth", "Tenth", "Eleventh", "Twelfth", "Thirteenth", "Fourteenth", "Fifteenth", "Sixteenth", "Seventeenth", "Eighteenth", "Nineteenth", "Twentieth"];
  if (n >= 0 && n <= 20) return words[n];
  return ordinal(n);
}

function parseEuropeanNumber(v: string | undefined): number {
  let s = (v ?? "").trim();
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

function formatUnits(v: string | undefined): string {
  const num = parseEuropeanNumber(v);
  if (num === 0) return "0";
  return num.toLocaleString("en-US");
}

function formatDateLong(dateStr: string): string {
  try {
    return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  } catch {
    return dateStr;
  }
}

function diffLabel(diff: string): string {
  if (diff === "NEW") return pick(["debuts", "arrives", "enters"]);
  if (diff === "RE") return pick(["re-enters", "returns", "reclaims a spot"]);
  if (diff.startsWith("▲")) return pick(["rises", "climbs", "ascends", "moves up"]);
  if (diff.startsWith("▼")) return pick(["falls", "drops", "slides", "dips"]);
  return pick(["holds", "maintains", "stays at"]);
}

function diffDirection(diff: string): "up" | "down" | "steady" | "new" {
  if (diff === "NEW" || diff === "RE") return "new";
  if (diff.startsWith("▲")) return "up";
  if (diff.startsWith("▼")) return "down";
  return "steady";
}

function boldArtist(artist: string): string {
  return `**${artist}**`;
}

function boldName(artist: string, name: string): string {
  return `**${artist}**'s '${name}'`;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function buildHeadline(artist: string, entry: ChartEntry, chartTitle: string, stats: { totalNo1s: number } | null, chartId: string): string {
  const chartName = chartTitle;
  const itemName = entry.name;
  const isArtist = chartId === "artists";

  const name = isArtist ? itemName : `${artist}'s '${itemName}'`;
  const nameAlt = isArtist ? itemName : `'${itemName}' by ${artist}`;

  if (entry.position === 1) {
    if (entry.diff === "NEW") {
      const no1Count = (stats?.totalNo1s ?? 0) + 1;
      const ordinalStr = wordOrdinal(no1Count);
      return pick([
        `${name} Achieves ${ordinalStr} No. 1 on ${chartName}`,
        `${name} Debuts at No. 1 on ${chartName}, Earning ${ordinalStr} Chart-Topper`,
        `${isArtist ? itemName : `${artist} Lands ${ordinalStr} No. 1 as '${itemName}'`} Storms to the Top of ${chartName}`,
      ]);
    }
    if (entry.diff === "RE") {
      return pick([
        `${name} Returns to No. 1 on ${chartName}`,
        `${name} Reclaims the Top Spot on ${chartName}`,
        `${name} Storms Back to No. 1 on ${chartName}`,
      ]);
    }
    if ((entry.weeksAt1 ?? 0) > 1) {
      return pick([
        `${name} Rules ${chartName} for ${wordOrdinal(entry.weeksAt1!)} Week`,
        `${name} Holds at No. 1 for ${wordOrdinal(entry.weeksAt1!)} Week on ${chartName}`,
        `${name} Extends No. 1 Reign on ${chartName} to ${wordOrdinal(entry.weeksAt1!)} Week`,
      ]);
    }
    return pick([
      `${name} Rises to No. 1 on ${chartName}`,
      `${name} Climbs to the Top of ${chartName}`,
      `${name} Ascends to No. 1 on ${chartName}`,
    ]);
  }

  if (entry.diff === "NEW") {
    return pick([
      `${name} Debuts at No. ${entry.position} on ${chartName}`,
      `${name} Arrives at No. ${entry.position} on ${chartName}`,
    ]);
  }
  if (entry.diff === "RE") {
    return pick([
      `${name} Re-Enters ${chartName} at No. ${entry.position}`,
      `${name} Returns to ${chartName} at No. ${entry.position}`,
    ]);
  }
  return pick([
    `${name} at No. ${entry.position} on ${chartName}`,
    `${name} Holds at No. ${entry.position} on ${chartName}`,
  ]);
}

function buildSubtitle(topEntries: ChartEntry[], chartTitle: string): string {
  const parts: string[] = [];
  const debuts = topEntries.filter((e) => e.diff === "NEW" && e.position !== 1);
  if (debuts.length > 0) {
    const names = debuts.slice(0, 3).map((e) => `'${e.name}'`);
    parts.push(`Plus, ${names.join(", ")} ${debuts.length === 1 ? "debuts" : "debut"} in the top 10`);
  }
  const reEntries = topEntries.filter((e) => e.diff === "RE" && e.position !== 1);
  if (reEntries.length > 0 && parts.length === 0) {
    const names = reEntries.slice(0, 2).map((e) => `'${e.name}'`);
    parts.push(`${names.join(" and ")} ${reEntries.length === 1 ? "re-enters" : "re-enter"} the top 10`);
  }
  if (parts.length === 0) {
    const movers = topEntries.filter((e) => e.position !== 1 && e.diff.startsWith("▲"));
    if (movers.length > 0) {
      parts.push(`${movers[0].name} moves up to No. ${movers[0].position}`);
    }
  }
  return parts.join(". ") || pick([
    "A look at the biggest moves on this week's chart.",
    "Here are the key stories shaping this week's rankings.",
    "The latest chart movements and what they mean.",
    "A breakdown of the most notable chart activity this week.",
  ]);
}

function buildNumberOneSection(entry: ChartEntry, artist: string, chartTitle: string, chartId: string, stats: { totalNo1s: number; items: string[] } | null): BeatSection {
  const paragraphs: string[] = [];
  const isArtist = chartId === "artists";
  const name = isArtist ? boldArtist(entry.name) : boldName(artist, entry.name);

  let diffWord = entry.diff === "NEW" ? "debuts" : entry.diff === "RE" ? "re-enters" : "holds";
  if (entry.position === 1 && entry.diff.startsWith("▲")) diffWord = "rises";

  let metricLine = "";
  if (chartId === "songs") {
    const parts: string[] = [];
    if (entry.streams && parseEuropeanNumber(entry.streams) > 0) parts.push(`${formatUnits(entry.streams)} streams`);
    if (entry.sales && parseEuropeanNumber(entry.sales) > 0) parts.push(`${formatUnits(entry.sales)} in sales`);
    if (entry.airplay && parseEuropeanNumber(entry.airplay) > 0) parts.push(`${formatUnits(entry.airplay)} in audience`);
    if (parts.length > 0) metricLine = ` earned ${parts.join(", ")}`;
  } else if (chartId === "albums") {
    const parts: string[] = [];
    if (entry.units && parseEuropeanNumber(entry.units) > 0) parts.push(`${formatUnits(entry.units)} equivalent album units`);
    if (entry.streams && parseEuropeanNumber(entry.streams) > 0) parts.push(`${formatUnits(entry.streams)} streaming equivalent album (SEA) units`);
    if (entry.sales && parseEuropeanNumber(entry.sales) > 0) parts.push(`${formatUnits(entry.sales)} pure album sales`);
    if (parts.length > 0) metricLine = ` earned ${parts.join(", ")}`;
  } else if (chartId === "artists") {
    if (entry.units && parseEuropeanNumber(entry.units) > 0) metricLine = ` with ${formatUnits(entry.units)} equivalent units`;
  }

  if (entry.diff === "NEW" && stats && stats.totalNo1s > 0) {
    const ordinalStr = wordOrdinal(stats.totalNo1s + 1);
    paragraphs.push(pick([
      `${name} ${diffWord} at No. 1 on the ${chartTitle} chart, earning ${ordinalStr} chart-topper.${metricLine}. With ${stats.totalNo1s + 1} No. 1s, ${boldArtist(isArtist ? entry.name : artist.split(" ")[0])} now stands among the acts with the most chart-toppers on the ${chartTitle}.`,
      `With '${entry.name}' ${diffWord} at No. 1, ${boldArtist(isArtist ? entry.name : artist)} secures its ${ordinalStr} chart-topper on the ${chartTitle}.${metricLine}. The act now has ${stats.totalNo1s + 1} No. 1s on the ${chartTitle} chart.`,
    ]));
  } else if (entry.diff === "NEW") {
    paragraphs.push(pick([
      `${name} ${diffWord} at No. 1 on the ${chartTitle} chart${metricLine}.`,
      `The ${chartTitle} welcomes a new leader: ${name} arrives atop the chart${metricLine}.`,
    ]));
  } else if ((entry.weeksAt1 ?? 0) > 1) {
    paragraphs.push(pick([
      `${name} rules the ${chartTitle} chart for the ${wordOrdinal(entry.weeksAt1!)} week, as it holds at No. 1.${metricLine}.`,
      `For the ${wordOrdinal(entry.weeksAt1!)} week running, ${name} maintains its grip on No. 1.${metricLine}.`,
    ]));
  } else {
    paragraphs.push(pick([
      `${name} ${diffWord} at No. 1 on the ${chartTitle} chart.${metricLine}.`,
      `${name} ${diffWord} atop the ${chartTitle} chart${metricLine}.`,
    ]));
  }

  if (stats && stats.items.length > 1) {
    const otherItems = stats.items.filter((i) => i !== entry.name).slice(0, 3);
    if (otherItems.length > 0) {
      paragraphs.push(pick([
        `Previously, ${boldArtist(isArtist ? entry.name : artist)} topped the ${chartTitle} with ${otherItems.map((i) => `'${i}'`).join(", ")}.`,
        `${boldArtist(isArtist ? entry.name : artist)}'s earlier ${chartTitle} No. 1s include ${otherItems.map((i) => `'${i}'`).join(", ")}.`,
      ]));
    }
  }

  return { heading: "No. 1 Spotlight", paragraphs };
}

function buildTop10Rundown(entries: ChartEntry[], chartTitle: string, chartId: string, artistStats: Record<string, any>): BeatSection {
  const paragraphs: string[] = [];
  const rest = entries.filter((e) => e.position >= 2 && e.position <= 10);
  const isArtist = chartId === "artists";

  if (rest.length === 0) return { paragraphs: [] };

  const lines: string[] = [];
  for (const e of rest) {
    const name = isArtist ? boldArtist(e.name) : boldName(e.artist, e.name);
    let detail = "";

    if (e.diff === "NEW") {
      detail = pick(["debuts at", "arrives at", "enters at"]);
    } else if (e.diff === "RE") {
      detail = pick(["re-enters at", "returns at", "reclaims a spot at"]);
    } else if (e.diff.startsWith("▲")) {
      const spots = parseInt(e.diff.slice(1)) || 0;
      detail = pick([
        `rises ${spots === 1 ? "one spot" : `${spots} spots`} to`,
        `climbs ${spots === 1 ? "one spot" : `${spots} spots`} to`,
        `ascends ${spots === 1 ? "one spot" : `${spots} spots`} to`,
      ]);
    } else if (e.diff.startsWith("▼")) {
      const spots = parseInt(e.diff.slice(1)) || 0;
      detail = pick([
        `falls ${spots === 1 ? "one spot" : `${spots} spots`} to`,
        `drops ${spots === 1 ? "one spot" : `${spots} spots`} to`,
        `slides ${spots === 1 ? "one spot" : `${spots} spots`} to`,
      ]);
    } else {
      detail = pick(["holds at", "maintains at", "stays at"]);
    }

    let metricStr = "";
    if (chartId === "albums" && e.units && parseEuropeanNumber(e.units) > 0) metricStr = ` (${formatUnits(e.units)} equivalent units)`;
    else if (chartId === "artists" && e.units && parseEuropeanNumber(e.units) > 0) metricStr = ` (${formatUnits(e.units)} units)`;

    lines.push(`${name} ${detail} No. ${e.position}${metricStr}`);
  }

  if (lines.length <= 3) {
    paragraphs.push(lines.join(". ") + ".");
  } else {
    paragraphs.push(lines.slice(0, Math.ceil(lines.length / 2)).join(". ") + ".");
    paragraphs.push(lines.slice(Math.ceil(lines.length / 2)).join(". ") + ".");
  }

  return { heading: "The Rest of the Top 10", paragraphs };
}

function buildNotableMovers(entries: ChartEntry[], allEntries: ChartEntry[], chartTitle: string, chartId: string): BeatSection {
  const paragraphs: string[] = [];
  const isArtist = chartId === "artists";

  const newEntries = entries.filter((e) => e.diff === "NEW" && e.position > 10);
  const reEntries = entries.filter((e) => e.diff === "RE" && e.position > 10);
  const bigGainers = entries
    .filter((e) => e.diff.startsWith("▲") && e.position > 10)
    .sort((a, b) => {
      const aSpots = parseInt(a.diff.slice(1)) || 0;
      const bSpots = parseInt(b.diff.slice(1)) || 0;
      return bSpots - aSpots;
    })
    .slice(0, 3);
  const bigDrops = entries
    .filter((e) => e.diff.startsWith("▼") && e.position > 10)
    .sort((a, b) => {
      const aSpots = parseInt(a.diff.slice(1)) || 0;
      const bSpots = parseInt(b.diff.slice(1)) || 0;
      return bSpots - aSpots;
    })
    .slice(0, 3);

  if (newEntries.length > 0) {
    const names = newEntries.slice(0, 5).map((e) => isArtist ? `${boldArtist(e.name)} (No. ${e.position})` : `${boldName(e.artist, e.name)} (No. ${e.position})`);
    paragraphs.push(pick([
      `Beyond the top 10, ${names.join(", ")} ${names.length === 1 ? "debuts" : "debut"} on the ${chartTitle}.`,
      `The top 20 sees fresh arrivals: ${names.join(", ")} ${names.length === 1 ? "arrives" : "arrive"} on the ${chartTitle}.`,
      `New to the chart: ${names.join(", ")} ${names.length === 1 ? "opens" : "open"} outside the top 10.`,
    ]));
  }

  if (reEntries.length > 0) {
    const names = reEntries.slice(0, 3).map((e) => isArtist ? `${boldArtist(e.name)} (No. ${e.position})` : `${boldName(e.artist, e.name)} (No. ${e.position})`);
    paragraphs.push(pick([
      `Re-entries include ${names.join(", ")}.`,
      `Returning to the chart: ${names.join(", ")}.`,
      `Back on the chart: ${names.join(", ")}.`,
    ]));
  }

  if (bigGainers.length > 0) {
    const lines = bigGainers.map((e) => {
      const spots = parseInt(e.diff.slice(1)) || 0;
      const name = isArtist ? boldArtist(e.name) : boldName(e.artist, e.name);
      return `${name} surges ${spots} spots to No. ${e.position}`;
    });
    paragraphs.push(pick([
      `Among the week's biggest gainers: ${lines.join("; ")}.`,
      `The week's biggest risers include ${lines.join("; ")}.`,
      `Notable climbers: ${lines.join("; ")}.`,
    ]));
  }

  if (bigDrops.length > 0) {
    const lines = bigDrops.map((e) => {
      const spots = parseInt(e.diff.slice(1)) || 0;
      const name = isArtist ? boldArtist(e.name) : boldName(e.artist, e.name);
      return `${name} drops ${spots} spots to No. ${e.position}`;
    });
    paragraphs.push(pick([
      `The steepest declines include ${lines.join("; ")}.`,
      `Falling fast: ${lines.join("; ")}.`,
      `The week's biggest drops: ${lines.join("; ")}.`,
    ]));
  }

  return { heading: "Notable Movers", paragraphs };
}

function buildRecordsSection(entries: ChartEntry[], chartData: WeeklyChartData, date: string, chartTitle: string, chartId: string): BeatSection {
  const paragraphs: string[] = [];
  const isArtist = chartId === "artists";
  const allDates = chartData.dates;
  const dateIdx = allDates.indexOf(date);
  const topEntry = entries[0];
  if (!topEntry) return { paragraphs: [] };

  // Count weeks at #1 for the current leader up to this date
  const top1Key = `${topEntry.artist}|||${topEntry.name}`;
  let currentTop1Weeks = 0;
  for (let i = 0; i <= dateIdx; i++) {
    const d = allDates[i];
    for (const e of chartData.entriesByDate[d] ?? []) {
      if (e.position === 1 && `${e.artist}|||${e.name}` === top1Key) {
        currentTop1Weeks += 1;
      }
    }
  }

  // Find previous record holder for most weeks at #1
  const top1Weeks: Record<string, number> = {};
  for (let i = 0; i <= dateIdx; i++) {
    const d = allDates[i];
    for (const e of chartData.entriesByDate[d] ?? []) {
      if (e.position === 1) {
        const key = `${e.artist}|||${e.name}`;
        top1Weeks[key] = (top1Weeks[key] ?? 0) + 1;
      }
    }
  }
  const sortedTop1 = Object.entries(top1Weeks).sort((a, b) => b[1] - a[1]);
  const prevRecord = sortedTop1.find(([k]) => k !== top1Key);
  const prevRecordWeeks = prevRecord ? prevRecord[1] : 0;

  // Only mention if current #1 is breaking/extending the record
  if (currentTop1Weeks > 1 && currentTop1Weeks > prevRecordWeeks) {
    const name = isArtist ? boldArtist(topEntry.name) : boldName(topEntry.artist, topEntry.name);
    if (currentTop1Weeks === prevRecordWeeks + 1 && prevRecordWeeks > 0) {
      const prevName = prevRecord![0].split("|||");
      paragraphs.push(pick([
        `${name} breaks ${boldArtist(prevName[0])}'s record of ${prevRecordWeeks} weeks at No. 1 on the ${chartTitle}, now claiming ${currentTop1Weeks} weeks atop the chart.`,
        `A historic milestone: ${name} surpasses ${boldArtist(prevName[0])}'s ${prevRecordWeeks}-week reign at No. 1, extending to ${currentTop1Weeks} weeks.`,
      ]));
    } else if (currentTop1Weeks > prevRecordWeeks && prevRecordWeeks > 0) {
      paragraphs.push(pick([
        `${name} extends its dominance at No. 1 to ${currentTop1Weeks} weeks on the ${chartTitle}, further extending the record.`,
        `The reign continues: ${name} now holds ${currentTop1Weeks} weeks at No. 1 on the ${chartTitle}.`,
      ]));
    }
  }

  // Biggest movers — only if a record was broken
  if (dateIdx > 0) {
    const prevDate = allDates[dateIdx - 1];
    const prevEntries = chartData.entriesByDate[prevDate] ?? [];
    const currEntries = chartData.entriesByDate[date] ?? [];
    const prevPos: Record<string, number> = {};
    for (const e of prevEntries) {
      prevPos[`${e.artist}|||${e.name}`] = e.position;
    }
    const gainers = currEntries
      .map((e) => {
        const key = `${e.artist}|||${e.name}`;
        const prev = prevPos[key] ?? 101;
        return { ...e, gained: prev - e.position };
      })
      .filter((e) => e.gained > 10 && !e.diff.startsWith("NEW") && !e.diff.startsWith("RE"))
      .sort((a, b) => b.gained - a.gained)
      .slice(0, 2);
    if (gainers.length > 0) {
      const lines = gainers.map((e) => {
        const name = isArtist ? boldArtist(e.name) : boldName(e.artist, e.name);
        return `${name} (up ${e.gained} spots)`;
      });
      paragraphs.push(pick([
        `The week's biggest comebacks: ${lines.join(", ")}.`,
        `Most improved: ${lines.join(", ")}.`,
      ]));
    }
  }

  return { heading: "Chart Highlights", paragraphs };
}

function countNo1sBeforeDate(artistName: string, chartId: string, data: WeeklyChartData, currentDate: string): { totalNo1s: number; items: string[] } {
  const items: Set<string> = new Set();
  for (const date of data.dates) {
    if (date >= currentDate) continue;
    for (const entry of data.entriesByDate[date]) {
      if (entry.artist.toLowerCase() === artistName.toLowerCase() && entry.position === 1) {
        items.add(entry.name);
      }
    }
  }
  return { totalNo1s: items.size, items: Array.from(items) };
}

function findBestImage(entries: ChartEntry[], artistStats: Record<string, any>): { image: string | null; artist: string | null } {
  for (const e of entries) {
    if (e.position === 1) return { image: null, artist: e.artist };
  }
  if (entries.length > 0) return { image: null, artist: entries[0].artist };
  return { image: null, artist: null };
}

export const generateChartBeat2 = createServerFn({ method: "GET" })
  .inputValidator((d: { chartId: string; date: string }) => d)
  .handler(async ({ data }) => {
    const { chartId, date } = data;
    const cfg = chartsConfig[chartId];
    if (!cfg) throw new Error("Unknown chart");

    const chartData = await getWeeklyChart({ data: { chartId } });
    const entries = chartData.entriesByDate[date];

    if (!entries || entries.length === 0) {
      return {
        chartId,
        chartTitle: cfg.title,
        date,
        headline: `No Chart Data Available for ${formatDateLong(date)}`,
        subtitle: "",
        sections: [],
        image: null,
        artist: null,
      } satisfies GeneratedBeatArticle;
    }

    const topEntry = entries[0];
    const top10 = entries.filter((e) => e.position <= 10);

    const artistStatsData = await getAllArtistStats();
    const artistEntry = artistStatsData[topEntry.artist];
    const artistChartEntries = artistEntry?.chartsByKind?.[chartId === "artists" ? cfg.title : chartId === "songs" ? "Hot 100" : "Billboard 200"] ?? [];
    const no1Count = countNo1sBeforeDate(topEntry.artist, chartId, chartData, date);

    const headline = buildHeadline(topEntry.artist, topEntry, cfg.title, { totalNo1s: no1Count.totalNo1s }, chartId);
    const subtitle = buildSubtitle(top10, cfg.title);

    const sections: BeatSection[] = [];

    sections.push(buildNumberOneSection(topEntry, topEntry.artist, cfg.title, chartId, { totalNo1s: no1Count.totalNo1s, items: no1Count.items }));

    sections.push(buildTop10Rundown(top10, cfg.title, chartId, artistStatsData));

    sections.push(buildNotableMovers(entries, entries, cfg.title, chartId));

    sections.push(buildRecordsSection(entries, chartData, date, cfg.title, chartId));

    const { artist } = findBestImage(entries, artistStatsData);

    return {
      chartId,
      chartTitle: cfg.title,
      date,
      headline,
      subtitle,
      sections,
      image: null,
      artist: artist ?? topEntry.artist,
    } satisfies GeneratedBeatArticle;
  });

export const getLatestBeatArticles = createServerFn({ method: "GET" })
  .handler(async () => {
    return cached("latestBeatArticles", async () => {
      const chartIds = ["songs", "albums", "artists"];
      const articles: GeneratedBeatArticle[] = [];
      for (const chartId of chartIds) {
        try {
          const chartData = await getWeeklyChart({ data: { chartId } });
          const latestDate = chartData.dates[chartData.dates.length - 1];
          if (!latestDate) continue;
          const article = await generateChartBeat2({ data: { chartId, date: latestDate } });
          articles.push(article);
        } catch {
          // skip failed charts
        }
      }
      return articles;
    });
  });
