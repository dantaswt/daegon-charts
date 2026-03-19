// --- APPLICATION STATE ---
let appState = {
    activeChart: 'songs',
    chartData: {
        songs: {},
        artists: {},
        albums: {},
        yearEndSongs: {},
        yearEndArtists: {},
        yearEndAlbums: {},
        goatSongs: {},
        goatArtists: {},
        goatAlbums: {},
        artistStats: {}
    },
    currentDate: null,
    isLoading: false,
    currentView: 'home',
    currentArtist: null,
    currentYear: new Date().getFullYear().toString(),
    colMaps: {
        songs: {},
        artists: {},
        albums: {},
        yearEndSongs: {},
        yearEndArtists: {},
        yearEndAlbums: {},
        goatSongs: {},
        goatArtists: {},
        goatAlbums: {},
        artistStats: {}
    },
    top3Data: {
        songs: [],
        artists: [],
        albums: [],
        yearEndSongs: [],
        yearEndArtists: [],
        yearEndAlbums: [],
        goatSongs: [],
        goatArtists: [],
        goatAlbums: []
    },
    artistData: {},
    chartRunData: {},
    artistStatsData: {},
    weeksAtNumberOne: {},
    itemDetails: {},
    navigationHistory: [],
    allEntries: {
        songs: [],
        artists: [],
        albums: []
    },
    chartBeatData: {
        hot100: [],
        top100Albums: []
    },
    currentBlog: 'hot100',
    sharedDate: null,
    artistDetailsData: {},
    chartHistoryData: {}
};

// --- DOM ELEMENTS ---
const appContainer = document.getElementById('app');
const itemDetailsModal = document.getElementById('itemDetailsModal');
const modalContent = document.getElementById('modalContent');
const closeModal = document.getElementById('closeModal');

// --- FUNÇÕES SIMPLES DE CACHE (SEGURAS) ---
function saveToCache(key, data) {
    try {
        localStorage.setItem('daegon_' + key, JSON.stringify({
            data: data,
            time: Date.now()
        }));
    } catch (e) {
        console.log('Cache error:', e);
    }
}

function loadFromCache(key) {
    try {
        const item = localStorage.getItem('daegon_' + key);
        if (!item) return null;
        
        const { data, time } = JSON.parse(item);
        
        // Cache por 1 hora
        if (Date.now() - time < 3600000) {
            return data;
        }
        return null;
    } catch (e) {
        return null;
    }
}

// --- INITIALIZATION SIMPLIFICADA ---
async function initializeApp() {
    // Mostrar loading
    appContainer.innerHTML = `
        <div class="flex flex-col items-center justify-center p-8 text-secondary">
            <div class="loader mb-4"></div>
            <p class="text-gray-400">Loading charts...</p>
        </div>
    `;
    
    try {
        // TENTAR CARREGAR DO CACHE PRIMEIRO
        const cachedHome = loadFromCache('homepage');
        
        if (cachedHome) {
            console.log('Usando cache');
            appState.top3Data = cachedHome.top3Data || {};
            appState.artistDetailsData = cachedHome.artistDetailsData || {};
            
            // Renderizar rápido do cache
            renderHomePage();
            
            // Atualizar em background
            setTimeout(() => {
                loadAllData();
            }, 100);
            
            return;
        }
        
        // PRIMEIRA VEZ: Carregar dados
        console.log('Primeiro acesso, carregando...');
        await loadAllData();
        renderHomePage();
        
    } catch (error) {
        appContainer.innerHTML = `
            <div class="text-center p-8 text-red-500">
                <p>Error: ${error.message}</p>
                <button onclick="location.reload()" class="mt-4 px-4 py-2 bg-accent text-white rounded">
                    Try Again
                </button>
            </div>
        `;
    }
}

// CARREGAR TODOS OS DADOS (SIMPLES)
async function loadAllData() {
    // Carregar dados um por um
    await fetchAndProcessChartData('songs');
    await fetchAndProcessChartData('artists');
    await fetchAndProcessChartData('albums');
    await fetchAndProcessChartData('yearEndSongs');
    await fetchAndProcessChartData('yearEndArtists');
    await fetchAndProcessChartData('yearEndAlbums');
    await fetchAndProcessChartData('goatSongs');
    await fetchAndProcessChartData('goatArtists');
    await fetchAndProcessChartData('goatAlbums');
    await fetchAndProcessChartData('artistStats');
    await fetchAndProcessChartBeatData();
    
    // Salvar no cache
    saveToCache('homepage', {
        top3Data: appState.top3Data,
        artistDetailsData: appState.artistDetailsData
    });
}

// --- FUNÇÕES DE RENDERIZAÇÃO BÁSICAS ---
function renderHomePage() {
    const hot100Articles = appState.chartBeatData.hot100 || [];
    const featuredHot100 = hot100Articles[0];
    
    appContainer.innerHTML = `
        <div class="max-w-7xl mx-auto">
            <div class="text-center mb-12">
                <h2 class="text-4xl font-bold mb-4 text-white">daegon charts</h2>
                <p class="text-gray-400">Your personal charts</p>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                ${renderChartCard('songs', 'Hot 100')}
                ${renderChartCard('artists', 'Artist 50')}
                ${renderChartCard('albums', 'Top Albums')}
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                ${renderChartCard('yearEndSongs', 'Year-End Songs')}
                ${renderChartCard('yearEndArtists', 'Year-End Artists')}
                ${renderChartCard('yearEndAlbums', 'Year-End Albums')}
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
                ${renderChartCard('goatSongs', 'GOAT Songs')}
                ${renderChartCard('goatArtists', 'GOAT Artists')}
                ${renderChartCard('goatAlbums', 'GOAT Albums')}
            </div>
        </div>
    `;
    
    // Adicionar eventos
    document.querySelectorAll('.chart-card').forEach(card => {
        card.addEventListener('click', function() {
            showChartPage(this.dataset.chart);
        });
    });
}

function renderChartCard(chartType, title) {
    const top3 = appState.top3Data[chartType] || [];
    
    return `
        <div class="chart-card cursor-pointer bg-gray-800 border border-gray-700 rounded-lg p-4" data-chart="${chartType}">
            <h4 class="font-semibold text-white mb-3">${title}</h4>
            <div class="space-y-2">
                ${top3.map((item, i) => `
                    <div class="text-sm text-gray-300">
                        <span class="font-bold w-6 inline-block">${item.position || i+1}</span>
                        <span class="truncate">${item.name || 'Loading...'}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function showChartPage(chartType) {
    appContainer.innerHTML = `
        <div class="text-center p-8 text-white">
            <button onclick="window.history.back()" class="mb-4 text-accent">← Back</button>
            <h2 class="text-2xl font-bold">${chartsConfig[chartType].title}</h2>
            <p class="text-gray-400 mt-4">Loading chart data...</p>
        </div>
    `;
}

function showChartBeatPage() {
    appContainer.innerHTML = `
        <div class="text-center p-8 text-white">
            <button onclick="window.history.back()" class="mb-4 text-accent">← Back</button>
            <h2 class="text-2xl font-bold">Chart Beat</h2>
            <p class="text-gray-400 mt-4">Coming soon...</p>
        </div>
    `;
}

function renderAllEntriesPage() {
    appContainer.innerHTML = `
        <div class="text-center p-8 text-white">
            <button onclick="window.history.back()" class="mb-4 text-accent">← Back</button>
            <h2 class="text-2xl font-bold">All Entries</h2>
            <p class="text-gray-400 mt-4">Coming soon...</p>
        </div>
    `;
}

// --- EVENT LISTENERS ---
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    
    document.getElementById('mainTitle').addEventListener('click', () => {
        initializeApp();
    });
    
    document.getElementById('navAllEntries').addEventListener('click', renderAllEntriesPage);
    document.getElementById('navChartBeat').addEventListener('click', showChartBeatPage);
    
    closeModal.addEventListener('click', () => {
        itemDetailsModal.classList.remove('active');
    });
});
