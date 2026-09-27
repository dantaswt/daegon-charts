export type ChartKind = "song" | "album" | "artist";

export interface ChartConfig {
  id: string;
  url: string;
  title: string;
  icon: string;
  kind: ChartKind;
  group: "weekly" | "yearEnd" | "goat" | "decadeEnd";
  secondaryUrl?: string;
}

const SHEET = "https://docs.google.com/spreadsheets/d/1t6_7SOlspmNYrXq8PSfJ74frIdrWwQBFITQ3bQmRzeg/gviz/tq?tq=select%20*&tqx=out:csv&gid=";
const SHEET_HOT100 = "https://docs.google.com/spreadsheets/d/1BUo5KNCtoWAMpezDYwv80MY9njOUyuJJRPQbmPbCZH4/gviz/tq?tq=select%20*&tqx=out:csv&gid=";
const SHEET_HOT100_SONGS = "https://docs.google.com/spreadsheets/d/1BUo5KNCtoWAMpezDYwv80MY9njOUyuJJRPQbmPbCZH4/gviz/tq?tq=select%20A,B,C,D,E,F,G,H,I,J&tqx=out:csv&gid=";

export const chartsConfig: Record<string, ChartConfig> = {
  songs: { id: "songs", url: SHEET + "904867620", title: "Daegon 100", icon: "fa-music", kind: "song", group: "weekly", secondaryUrl: SHEET_HOT100_SONGS + "1011796371" },
  artists: { id: "artists", url: SHEET + "1568177610", title: "Daegon Artists 50", icon: "fa-user", kind: "artist", group: "weekly", secondaryUrl: SHEET_HOT100 + "1959135946" },
  albums: { id: "albums", url: SHEET + "1940039611", title: "Daegon Albums 100", icon: "fa-compact-disc", kind: "album", group: "weekly", secondaryUrl: SHEET_HOT100 + "765580865" },
  radioSongs: { id: "radioSongs", url: SHEET + "1681272096", title: "Radio Songs", icon: "fa-broadcast-tower", kind: "song", group: "weekly" },
  topStreamingAlbums: { id: "topStreamingAlbums", url: SHEET + "1028545573", title: "Top Streaming Albums", icon: "fa-headphones", kind: "album", group: "weekly" },
  topAlbumSales: { id: "topAlbumSales", url: SHEET + "1111633725", title: "Top Album Sales", icon: "fa-chart-simple", kind: "album", group: "weekly" },
  streamingSongs: { id: "streamingSongs", url: SHEET + "626144821", title: "Streaming Songs", icon: "fa-cloud", kind: "song", group: "weekly" },
  digitalSongsSales: { id: "digitalSongsSales", url: SHEET + "302176914", title: "Digital Songs Sales", icon: "fa-download", kind: "song", group: "weekly" },
  yearEndSongs: { id: "yearEndSongs", url: SHEET + "530686468", title: "Daegon 100", icon: "fa-music", kind: "song", group: "yearEnd" },
  yearEndArtists: { id: "yearEndArtists", url: SHEET + "1597569311", title: "Daegon Artists 50", icon: "fa-user", kind: "artist", group: "yearEnd" },
  yearEndAlbums: { id: "yearEndAlbums", url: SHEET + "897935603", title: "Daegon Albums 100", icon: "fa-compact-disc", kind: "album", group: "yearEnd" },
  yearEndRadio: { id: "yearEndRadio", url: SHEET + "982271206", title: "Radio Songs", icon: "fa-broadcast-tower", kind: "song", group: "yearEnd" },
  yearEndStreamingSongs: { id: "yearEndStreamingSongs", url: SHEET + "0", title: "Streaming Songs", icon: "fa-cloud", kind: "song", group: "yearEnd" },
  yearEndTopStreamingAlbums: { id: "yearEndTopStreamingAlbums", url: SHEET + "0", title: "Top Streaming Albums", icon: "fa-headphones", kind: "album", group: "yearEnd" },
  yearEndTopAlbumSales: { id: "yearEndTopAlbumSales", url: SHEET + "0", title: "Top Album Sales", icon: "fa-chart-simple", kind: "album", group: "yearEnd" },
  yearEndDigitalSongsSales: { id: "yearEndDigitalSongsSales", url: SHEET + "0", title: "Digital Songs Sales", icon: "fa-download", kind: "song", group: "yearEnd" },
  yearEndNewArtists: { id: "yearEndNewArtists", url: SHEET + "0", title: "Top New Artists", icon: "fa-user-plus", kind: "artist", group: "yearEnd" },
  yecHot100Artists: { id: "yecHot100Artists", url: "", title: "Daegon 100 — Artists", icon: "fa-trophy", kind: "artist", group: "yearEnd" },
  yecTop100AlbumsArtists: { id: "yecTop100AlbumsArtists", url: "", title: "Top 100 Albums — Artists", icon: "fa-trophy", kind: "artist", group: "yearEnd" },
  yecArtist50Male: { id: "yecArtist50Male", url: "", title: "Top Artists — Male", icon: "fa-mars", kind: "artist", group: "yearEnd" },
  yecArtist50Female: { id: "yecArtist50Female", url: "", title: "Top Artists — Female", icon: "fa-venus", kind: "artist", group: "yearEnd" },
  yecArtist50DuoGroup: { id: "yecArtist50DuoGroup", url: "", title: "Top Artists — Duo/Group", icon: "fa-users", kind: "artist", group: "yearEnd" },
  yecRadioSongsArtists: { id: "yecRadioSongsArtists", url: "", title: "Radio Songs — Artists", icon: "fa-broadcast-tower", kind: "artist", group: "yearEnd" },
  yecTopLatinAlbums: { id: "yecTopLatinAlbums", url: "", title: "Top Latin Albums", icon: "fa-fire", kind: "album", group: "yearEnd" },

  decadeEndSongs: { id: "decadeEndSongs", url: "", title: "Daegon 100", icon: "fa-music", kind: "song", group: "decadeEnd" },
  decadeEndAlbums: { id: "decadeEndAlbums", url: "", title: "Daegon Albums 100", icon: "fa-compact-disc", kind: "album", group: "decadeEnd" },
  decadeEndArtists: { id: "decadeEndArtists", url: "", title: "Daegon Artists 50", icon: "fa-user", kind: "artist", group: "decadeEnd" },
  decadeEndRadio: { id: "decadeEndRadio", url: "", title: "Radio Songs", icon: "fa-broadcast-tower", kind: "song", group: "decadeEnd" },
  decadeEndStreamingSongs: { id: "decadeEndStreamingSongs", url: "", title: "Streaming Songs", icon: "fa-cloud", kind: "song", group: "decadeEnd" },
  decadeEndTopAlbumSales: { id: "decadeEndTopAlbumSales", url: "", title: "Top Album Sales", icon: "fa-chart-simple", kind: "album", group: "decadeEnd" },
  decadeEndTopStreamingAlbums: { id: "decadeEndTopStreamingAlbums", url: "", title: "Top Streaming Albums", icon: "fa-headphones", kind: "album", group: "decadeEnd" },
  decadeEndDigitalSongsSales: { id: "decadeEndDigitalSongsSales", url: "", title: "Digital Songs Sales", icon: "fa-download", kind: "song", group: "decadeEnd" },

  goatSongs: { id: "goatSongs", url: SHEET + "1157278896", title: "Greatest of All Time Songs", icon: "fa-trophy", kind: "song", group: "goat" },
  goatArtists: { id: "goatArtists", url: SHEET + "222299678", title: "Greatest of All Time Artists", icon: "fa-trophy", kind: "artist", group: "goat" },
  goatAlbums: { id: "goatAlbums", url: SHEET + "1548244755", title: "Greatest of All Time Albums", icon: "fa-trophy", kind: "album", group: "goat" },
  goatRadio: { id: "goatRadio", url: SHEET + "1447340097", title: "Greatest of All Time Radio", icon: "fa-broadcast-tower", kind: "song", group: "goat" },
  artistStats: { id: "artistStats", url: SHEET + "1519606558", title: "Artist Statistics", icon: "fa-chart-bar", kind: "artist", group: "weekly" },
  statsData: { id: "statsData", url: SHEET + "193788146", title: "Stats", icon: "fa-chart-line", kind: "artist", group: "weekly" },
};

export const chartBeatConfig = {
  hot100: { url: SHEET + "1019123057", title: "Daegon 100 Songs" },
  artists: { url: SHEET + "157219648", title: "Daegon Artists 50" },
  top100Albums: { url: SHEET + "677909186", title: "Daegon Albums 100" },
} as const;

export const weeklyChartIds = ["songs", "artists", "albums", "radioSongs", "topStreamingAlbums", "topAlbumSales", "streamingSongs", "digitalSongsSales"];
export const yearEndChartIds = ["yearEndSongs", "yearEndArtists", "yearEndAlbums", "yearEndRadio", "yearEndDigitalSongsSales", "yearEndStreamingSongs", "yearEndTopAlbumSales", "yearEndTopStreamingAlbums", "yecHot100Artists", "yecArtist50Female", "yecArtist50Male", "yecArtist50DuoGroup", "yearEndNewArtists", "yecTop100AlbumsArtists", "yecRadioSongsArtists"];
export const goatChartIds = ["goatSongs", "goatArtists", "goatAlbums", "goatRadio"];
export const decadeEndChartIds = ["decadeEndSongs", "decadeEndAlbums", "decadeEndArtists", "decadeEndRadio", "decadeEndStreamingSongs", "decadeEndTopAlbumSales", "decadeEndTopStreamingAlbums", "decadeEndDigitalSongsSales"];

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const slugifyArtist = slugify;

export function songSlug(name: string, artist: string): string {
  return `${slugify(name)}---${slugify(artist)}`;
}

export function parseSongSlug(slug: string): { nameSlug: string; artistSlug: string } | null {
  const sep = slug.indexOf("---");
  if (sep === -1) return null;
  return { nameSlug: slug.slice(0, sep), artistSlug: slug.slice(sep + 3) };
}

export function stripAlbumEdition(name: string): string {
  return name
    .replace(/\s*[-–]?\s*Deluxe\s*(Edition)?/gi, "")
    .replace(/\s*\((?:Digital Deluxe Version|Special Edition|International Version|Platinum Edition)\)/gi, "")
    .trim();
}
