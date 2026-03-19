// --- SPOTIFY CONFIGURATION ---
const SPOTIFY_CLIENT_ID = '60d65b0ac9f14d6aa91c08a66894cea9';
const SPOTIFY_CLIENT_SECRET = 'caf3f20ae798475e8dec65697f210c2a';
let SPOTIFY_ACCESS_TOKEN = '';
let imageCache = {};
let pendingImageRequests = {};

// --- CORREÇÃO PARA IMAGENS ESPECÍFICAS ---
const artistImageCorrections = {
    'Anitta': 'Anitta cantora',
    'anitta': 'Anitta cantora',
    'Jão': 'Jão cantor',
    'jão': 'Jão cantor',
    'João': 'Jão cantor',
    'joão': 'Jão cantor'
};

// --- CHARTS CONFIGURATION ---
const chartsConfig = {
    songs: {
        url: 'https://docs.google.com/spreadsheets/d/1t6_7SOlspmNYrXq8PSfJ74frIdrWwQBFITQ3bQmRzeg/export?format=csv&gid=904867620',
        title: 'Hot 100',
        entityType: 'song',
        icon: 'fa-music',
        loaded: false
    },
    artists: {
        url: 'https://docs.google.com/spreadsheets/d/1t6_7SOlspmNYrXq8PSfJ74frIdrWwQBFITQ3bQmRzeg/export?format=csv&gid=1568177610',
        title: 'Artist 50',
        entityType: 'artist',
        icon: 'fa-user',
        loaded: false
    },
    albums: {
        url: 'https://docs.google.com/spreadsheets/d/1t6_7SOlspmNYrXq8PSfJ74frIdrWwQBFITQ3bQmRzeg/export?format=csv&gid=1940039611',
        title: 'Top 100 Albums',
        entityType: 'album',
        icon: 'fa-compact-disc',
        loaded: false
    },
    yearEndSongs: {
        url: 'https://docs.google.com/spreadsheets/d/1t6_7SOlspmNYrXq8PSfJ74frIdrWwQBFITQ3bQmRzeg/export?format=csv&gid=530686468',
        title: 'Year-End Songs',
        entityType: 'song',
        icon: 'fa-calendar',
        loaded: false
    },
    yearEndArtists: {
        url: 'https://docs.google.com/spreadsheets/d/1t6_7SOlspmNYrXq8PSfJ74frIdrWwQBFITQ3bQmRzeg/export?format=csv&gid=1597569311',
        title: 'Year-End Artists',
        entityType: 'artist',
        icon: 'fa-calendar',
        loaded: false
    },
    yearEndAlbums: {
        url: 'https://docs.google.com/spreadsheets/d/1t6_7SOlspmNYrXq8PSfJ74frIdrWwQBFITQ3bQmRzeg/export?format=csv&gid=897935603',
        title: 'Year-End Albums',
        entityType: 'album',
        icon: 'fa-calendar',
        loaded: false
    },
    goatSongs: {
        url: 'https://docs.google.com/spreadsheets/d/1t6_7SOlspmNYrXq8PSfJ74frIdrWwQBFITQ3bQmRzeg/export?format=csv&gid=1157278896',
        title: 'Songs',
        entityType: 'song',
        icon: 'fa-trophy',
        loaded: false
    },
    goatArtists: {
        url: 'https://docs.google.com/spreadsheets/d/1t6_7SOlspmNYrXq8PSfJ74frIdrWwQBFITQ3bQmRzeg/export?format=csv&gid=222299678',
        title: 'Artists',
        entityType: 'artist',
        icon: 'fa-trophy',
        loaded: false
    },
    goatAlbums: {
        url: 'https://docs.google.com/spreadsheets/d/1t6_7SOlspmNYrXq8PSfJ74frIdrWwQBFITQ3bQmRzeg/export?format=csv&gid=1548244755',
        title: 'Albums',
        entityType: 'album',
        icon: 'fa-trophy',
        loaded: false
    },
    artistStats: {
        url: 'https://docs.google.com/spreadsheets/d/1t6_7SOlspmNYrXq8PSfJ74frIdrWwQBFITQ3bQmRzeg/export?format=csv&gid=1519606558',
        title: 'Artist Statistics',
        entityType: 'artist',
        icon: 'fa-chart-bar',
        loaded: false
    }
};

// --- CONFIGURAÇÃO DO CHART BEAT ---
const chartBeatConfig = {
    hot100: {
        url: 'https://docs.google.com/spreadsheets/d/1t6_7SOlspmNYrXq8PSfJ74frIdrWwQBFITQ3bQmRzeg/export?format=csv&gid=1019123057',
        title: 'Hot 100 Songs',
        type: 'blog',
        colMap: {
            date: ['date', 'data'],
            title: ['title', 'título'],
            text: ['text', 'conteúdo'],
            artist: ['artist', 'artista'],
            chartLink: ['chartlink'],
            tags: ['tags']
        }
    },
    top100Albums: {
        url: 'https://docs.google.com/spreadsheets/d/1t6_7SOlspmNYrXq8PSfJ74frIdrWwQBFITQ3bQmRzeg/export?format=csv&gid=677909186',
        title: 'Top 100 Albums',
        type: 'blog',
        colMap: {
            date: ['date', 'data'],
            title: ['title', 'título'],
            text: ['text', 'conteúdo'],
            artist: ['artist', 'artista'],
            chartLink: ['chartlink'],
            tags: ['tags']
        }
    }
};
