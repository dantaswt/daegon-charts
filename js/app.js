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

// --- FUNÇÕES DE UTILIDADE ---
function showMessage(type, text, container = appContainer) {
    if (!container) return;
    
    let html = '';
    if (type === 'loading') {
        html = `
            <div class="flex flex-col items-center justify-center p-8 text-secondary">
                <div class="loader mb-4"></div>
                <p class="text-gray-400">${text}</p>
            </div>
        `;
    } else if (type === 'error') {
        html = `
            <div class="flex flex-col items-center justify-center p-8 text-secondary">
                <i class="fas fa-exclamation-triangle text-red-500 text-4xl mb-4"></i>
                <p class="text-center text-red-500 font-semibold">${text}</p>
                <button id="retryButton" class="mt-4 px-4 py-2 bg-accent text-secondary rounded-md hover:bg-accent-dark transition-colors">
                    Try Again
                </button>
            </div>
        `;
    }
    
    container.innerHTML = html;
    
    if (type === 'error') {
        document.getElementById('retryButton')?.addEventListener('click', initializeApp);
    }
}

function setupBackToTopButton() {
    const existingButton = document.querySelector('.back-to-top');
    if (existingButton) {
        existingButton.remove();
    }
    
    const backToTopButton = document.createElement('button');
    backToTopButton.className = 'back-to-top';
    backToTopButton.innerHTML = '<i class="fas fa-arrow-up"></i>';
    backToTopButton.title = 'Back to top';
    backToTopButton.style.display = 'none';
    
    document.body.appendChild(backToTopButton);
    
    window.addEventListener('scroll', function() {
        if (window.scrollY > 300) {
            backToTopButton.style.display = 'flex';
            setTimeout(() => {
                backToTopButton.classList.add('visible');
            }, 10);
        } else {
            backToTopButton.classList.remove('visible');
            setTimeout(() => {
                if (!backToTopButton.classList.contains('visible')) {
                    backToTopButton.style.display = 'none';
                }
            }, 300);
        }
    });
    
    backToTopButton.addEventListener('click', function() {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
}

// --- FUNÇÕES DE RENDERIZAÇÃO ---
function renderHomePage() {
    appState.currentView = 'home';
    
    const hot100Articles = appState.chartBeatData.hot100 || [];
    const top100Articles = appState.chartBeatData.top100Albums || [];
    
    const featuredHot100 = hot100Articles?.[0];
    const featuredTop100 = top100Articles?.[0];
    
    appContainer.innerHTML = `
        <div class="max-w-7xl mx-auto">
            <div class="text-center mb-12">
                <h2 class="text-4xl font-bold mb-4 text-white glow-text">daegon charts</h2>
                <p class="text-gray-400 max-w-2xl mx-auto">Your personal charts based on Last.fm data. Track your most played songs, artists, and albums.</p>
            </div>
            
            <!-- Cards Circulares -->
            <div class="circle-cards-grid mb-16">
                ${renderCircleCard('songs', 'Hot 100')}
                ${renderCircleCard('artists', 'Artist 50')}
                ${renderCircleCard('albums', 'Top Albums')}
            </div>
            
            ${(featuredHot100 || featuredTop100) ? `
            <div class="mb-16">
                <h3 class="text-2xl font-bold mb-6 section-title text-white">Chart Beat - Latest News</h3>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    ${featuredHot100 ? `
                        <div class="blog-card-animated blog-card bg-gray-800 rounded-lg overflow-hidden border border-gray-700 shadow-sm cursor-pointer" onclick="showChartBeatPage()">
                            <div class="h-48 overflow-hidden relative">
                                ${featuredHot100.imageUrl ? `
                                    <img src="${featuredHot100.imageUrl}" alt="${featuredHot100.artist}" class="w-full h-full object-cover article-image">
                                ` : `
                                    <div class="w-full h-48 placeholder-art">
                                        <i class="fas fa-newspaper text-3xl text-gray-400"></i>
                                    </div>
                                `}
                                <div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-gray-800 to-transparent p-4">
                                    <span class="text-xs text-accent font-semibold">${featuredHot100.publicationDate}</span>
                                    <h4 class="font-bold text-lg mt-1 text-white truncate">${featuredHot100.title}</h4>
                                </div>
                            </div>
                        </div>
                    ` : ''}
                    
                    ${featuredTop100 ? `
                        <div class="blog-card-animated blog-card bg-gray-800 rounded-lg overflow-hidden border border-gray-700 shadow-sm cursor-pointer" onclick="showChartBeatPage()">
                            <div class="h-48 overflow-hidden relative">
                                ${featuredTop100.imageUrl ? `
                                    <img src="${featuredTop100.imageUrl}" alt="${featuredTop100.artist}" class="w-full h-full object-cover article-image">
                                ` : `
                                    <div class="w-full h-48 placeholder-art">
                                        <i class="fas fa-newspaper text-3xl text-gray-400"></i>
                                    </div>
                                `}
                                <div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-gray-800 to-transparent p-4">
                                    <span class="text-xs text-accent font-semibold">${featuredTop100.publicationDate}</span>
                                    <h4 class="font-bold text-lg mt-1 text-white truncate">${featuredTop100.title}</h4>
                                </div>
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
            ` : ''}
            
            <div class="mb-16">
                <h3 class="text-2xl font-bold mb-6 section-title text-white">Weekly Charts</h3>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                    ${renderChartCard('songs', 'Hot 100')}
                    ${renderChartCard('artists', 'Artist 50')}
                    ${renderChartCard('albums', 'Top 100 Albums')}
                </div>
            </div>
            
            <div class="mb-16">
                <h3 class="text-2xl font-bold mb-6 section-title text-white">Year-End Charts</h3>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                    ${renderChartCard('yearEndSongs', 'Year-End Songs')}
                    ${renderChartCard('yearEndArtists', 'Year-End Artists')}
                    ${renderChartCard('yearEndAlbums', 'Year-End Albums')}
                </div>
            </div>

            <div class="mb-16">
                <h3 class="text-2xl font-bold mb-6 section-title goat-title text-white">Greatest of All Time</h3>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                    ${renderChartCard('goatSongs', 'GOAT Songs')}
                    ${renderChartCard('goatArtists', 'GOAT Artists')}
                    ${renderChartCard('goatAlbums', 'GOAT Albums')}
                </div>
            </div>
        </div>
    `;
    
    document.querySelectorAll('.chart-card').forEach(card => {
        card.addEventListener('click', function() {
            const chartType = this.dataset.chart;
            showChartPage(chartType);
        });
    });

    document.querySelectorAll('.circle-card-container').forEach(card => {
        card.addEventListener('click', function() {
            const chartType = this.dataset.chart;
            showChartPage(chartType);
        });
    });

    loadCircleCardImages();
    setupBackToTopButton();
}

function renderCircleCard(chartType, title) {
    const topItem = appState.top3Data[chartType]?.[0];
    
    return `
        <div class="circle-card-container" data-chart="${chartType}">
            <div class="circle-card" id="circle-image-${chartType}">
                <div class="w-full h-full placeholder-art">
                    <i class="fas ${chartsConfig[chartType]?.icon || 'fa-music'} text-3xl text-gray-400"></i>
                </div>
                <div class="circle-card-content">
                    <h3 class="circle-card-title">${title}</h3>
                </div>
            </div>
            <div class="circle-card-label">${title}</div>
        </div>
    `;
}

function renderChartCard(chartType, title) {
    const top3 = appState.top3Data[chartType] || [];
    
    return `
        <div class="chart-card cursor-pointer bg-gray-800 border border-gray-700 rounded-lg p-4 transition-all duration-300 hover:border-accent shadow-sm ${chartType.includes('goat') ? 'hover:border-gold goat-card-border' : ''}" data-chart="${chartType}">
            <div class="flex items-center justify-between mb-3">
                <h4 class="font-semibold text-white">${title}</h4>
                <span class="text-xs text-gray-400 bg-gray-700 px-2 py-1 rounded-full">Top ${top3.length}</span>
            </div>
            <div class="space-y-2">
                ${top3.length > 0 ? top3.map((item, index) => `
                    <div class="flex items-center text-sm text-gray-300">
                        <span class="font-bold w-6 ${index === 0 ? 'text-accent' : 'text-gray-400'} ${chartType.includes('goat') && index === 0 ? 'goat-text' : ''}">${item.position || index+1}</span>
                        <span class="truncate break-text">${item.name || 'Loading...'}</span>
                    </div>
                `).join('') : `
                    <div class="text-center py-4">
                        <div class="loader mx-auto mb-2" style="width: 20px; height: 20px;"></div>
                        <p class="text-xs text-gray-400">Loading...</p>
                    </div>
                `}
            </div>
        </div>
    `;
}

function renderChartItems() {
    const chartType = appState.activeChart;
    const colMap = appState.colMaps[chartType];
    
    if (!colMap) {
        return '<div class="text-center p-8 text-gray-400">No data available</div>';
    }
    
    let items = [];
    const isYearEnd = chartType.includes('yearEnd');
    const isGoat = chartType.includes('goat');

    if (isYearEnd) {
        const yearsData = appState.chartData[chartType];
        if (!yearsData) return '<div class="text-center p-8 text-gray-400">No data available</div>';
        
        const yearData = yearsData[appState.currentYear];
        if (!yearData) return '<div class="text-center p-8 text-gray-400">No data available for this year</div>';
        
        items = yearData;
    } else if (isGoat) {
         items = appState.chartData[chartType];
         if (!items || items.length === 0) {
            return '<div class="text-center p-8 text-gray-400">No data available</div>';
        }
    } else {
        if (!appState.currentDate || !appState.chartData[chartType] || !appState.chartData[chartType][appState.currentDate]) {
            return '<div class="text-center p-8 text-gray-400">No data available</div>';
        }
        items = appState.chartData[chartType][appState.currentDate];
    }
    
    if (!items || items.length === 0) {
        return '<div class="text-center p-8 text-gray-400">No data available</div>';
    }
    
    const sortedItems = [...items].sort((a, b) => {
        const posA = parseInt(a[colMap.position]) || 999;
        const posB = parseInt(b[colMap.position]) || 999;
        return posA - posB;
    });
    
    const displayItems = sortedItems.slice(0, 100);
    
    return displayItems.map((row, index) => {
        const position = parseInt(row[colMap.position]) || index + 1;
        const artist = row[colMap.artist] || 'Unknown';
        const diff = colMap.diff !== -1 ? row[colMap.diff] : null;
        const lastWeek = colMap.lastWeek !== -1 && !isYearEnd && !isGoat ? row[colMap.lastWeek] : null;
        const peak = colMap.peak !== -1 ? parseInt(row[colMap.peak]) : null;
        const weeks = colMap.weeks !== -1 ? parseInt(row[colMap.weeks]) : null;
        
        const name = chartType.includes('Songs') || chartType === 'songs' ? (row[colMap.song] || 'Unknown') : 
                     chartType.includes('Albums') || chartType === 'albums' ? (row[colMap.album] || 'Unknown') : 
                     (row[colMap.artist] || 'Unknown');
        
        return `
            <div class="chart-row py-4 px-4 ${position === 1 ? 'rank-1' : ''}">
                <div class="flex items-center">
                    <div class="flex-shrink-0 w-10 text-center relative text-white">
                        <span class="text-xl font-bold">${position}</span>
                    </div>
                    <div class="flex-shrink-0 mx-4">
                        <div class="w-12 h-12 rounded-md shadow-md overflow-hidden spotify-image" id="image-${chartType}-${index}">
                            <div class="w-full h-full placeholder-art">
                                <i class="fas ${chartsConfig[chartType]?.icon || 'fa-music'} text-gray-400"></i>
                            </div>
                        </div>
                    </div>
                    <div class="flex-grow min-w-0 text-white">
                        <div class="break-text w-full">
                            <p class="font-bold item-name break-text">${name}</p>
                            <p class="text-gray-400 text-sm mt-1">
                                <span class="artist-link" data-artist="${artist}">${artist}</span>
                            </p>
                        </div>
                        ${!isYearEnd && !isGoat ? `
                        <div class="flex items-center gap-4 mt-1 text-xs text-gray-400">
                            <span>LW: ${lastWeek || '-'}</span>
                            ${peak ? `<span>PK: ${peak}</span>` : ''}
                            ${weeks ? `<span>WOC: ${weeks}</span>` : ''}
                        </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function showChartPage(chartType, dateToSet = null) {
    if (appState.currentView === 'chart' && appState.activeChart) {
        appState.navigationHistory.push({
            view: 'chart',
            chart: appState.activeChart,
            date: appState.currentDate,
            year: appState.currentYear
        });
    }
    
    appState.activeChart = chartType;
    appState.currentView = 'chart';
    
    const isYearEnd = chartType.includes('yearEnd');
    const isGoat = chartType.includes('goat');
    
    if (isYearEnd) {
        const yearsData = appState.chartData[chartType];
        const years = Object.keys(yearsData || {}).sort((a, b) => b - a);
        const mostRecentYear = years?.[0] || new Date().getFullYear().toString();
        appState.currentYear = mostRecentYear;
    } else {
        const dates = Object.keys(appState.chartData[chartType] || {});
        const mostRecentDate = dates.length > 0 ? dates[dates.length - 1] : null;
        
        appState.currentDate = dateToSet || appState.sharedDate || mostRecentDate;
    }
    
    const headerTitle = isYearEnd ? 'Year-End Charts' : isGoat ? 'Greatest of All Time' : 'Weekly Charts';
    
    appContainer.innerHTML = `
        <div class="max-w-4xl mx-auto">
            <button id="backButton" class="back-button mb-6 flex items-center text-accent hover:text-accent-dark font-semibold transition-colors">
                <i class="fas fa-arrow-left mr-2"></i> Back to Home
            </button>
            
            <div class="mb-6">
                <h2 class="text-2xl sm:text-3xl font-bold text-center mb-2 text-white">${headerTitle}</h2>
                <h3 class="text-xl font-bold text-center mb-4 text-white">
                    ${chartsConfig[chartType]?.title || chartType}
                </h3>
            </div>
            
            <div id="chartContainer" class="bg-gray-800 rounded-lg overflow-hidden border border-gray-700 shadow-sm">
                ${renderChartItems()}
            </div>
        </div>
    `;
    
    document.getElementById('backButton').addEventListener('click', navigateBack);
    loadSpotifyImages();
    setupBackToTopButton();
}

function showChartBeatPage() {
    appState.currentView = 'chartBeat';
    
    appContainer.innerHTML = `
        <div class="max-w-6xl mx-auto">
            <button id="backButton" class="back-button mb-6 flex items-center text-accent hover:text-accent-dark font-semibold transition-colors">
                <i class="fas fa-arrow-left mr-2"></i> Back to Home
            </button>
            
            <div class="text-center mb-8">
                <h2 class="text-3xl font-bold mb-2 text-white">Chart Beat</h2>
                <p class="text-gray-400">News and insights about the music charts</p>
            </div>
            
            <div class="text-center text-gray-400 p-8">
                <i class="fas fa-newspaper text-4xl mb-3"></i>
                <p>Articles loading...</p>
            </div>
        </div>
    `;
    
    document.getElementById('backButton').addEventListener('click', navigateBack);
    setupBackToTopButton();
}

function renderAllEntriesPage() {
    appState.currentView = 'allEntries';
    
    appContainer.innerHTML = `
        <div class="max-w-6xl mx-auto">
            <button id="backButton" class="back-button mb-6 flex items-center text-accent hover:text-accent-dark font-semibold transition-colors">
                <i class="fas fa-arrow-left mr-2"></i> Back to Home
            </button>
            
            <h2 class="text-3xl font-bold mb-6 section-title text-white">All Entries</h2>
            
            <div class="text-center text-gray-400 p-8">
                <i class="fas fa-music text-4xl mb-3"></i>
                <p>Loading entries...</p>
            </div>
        </div>
    `;
    
    document.getElementById('backButton').addEventListener('click', navigateBack);
    setupBackToTopButton();
}

function navigateBack() {
    const previousState = appState.navigationHistory.pop();
    
    if (previousState) {
        if (previousState.view === 'chart') {
            showChartPage(previousState.chart);
        } else {
            renderHomePage();
        }
    } else {
        renderHomePage();
    }
}

function renderArtistPage(artistName) {
    appContainer.innerHTML = `
        <div class="max-w-4xl mx-auto">
            <button id="backButton" class="back-button mb-6 flex items-center text-accent hover:text-accent-dark font-semibold transition-colors">
                <i class="fas fa-arrow-left mr-2"></i> Back
            </button>
            <div class="text-center p-8">
                <h2 class="text-3xl font-bold text-white mb-2">${artistName}</h2>
                <p class="text-gray-400">Artist page loading...</p>
            </div>
        </div>
    `;
    document.getElementById('backButton').addEventListener('click', navigateBack);
}

// --- FUNÇÕES DE IMAGEM ---
async function loadSpotifyImages() {
    // Implementação simplificada - será melhorada depois
}

async function loadCircleCardImages() {
    // Implementação simplificada - será melhorada depois
}

// --- FUNÇÕES DE DADOS (WRAPPERS) ---
async function fetchAndProcessChartData(chartType) {
    // Esta função deve estar no data.js
    // Se não existir, retorna erro silencioso
    if (typeof window.fetchAndProcessChartData === 'function') {
        return window.fetchAndProcessChartData(chartType);
    }
    return false;
}

async function fetchAndProcessChartBeatData() {
    if (typeof window.fetchAndProcessChartBeatData === 'function') {
        return window.fetchAndProcessChartBeatData();
    }
    return false;
}

// --- INITIALIZATION ---
async function initializeApp() {
    showMessage('loading', 'Loading charts data...');
    
    try {
        // Carregar dados
        if (typeof fetchAndProcessChartData === 'function') {
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
        }
        
        renderHomePage();
        
    } catch (error) {
        console.error('Initialization error:', error);
        showMessage('error', 'Error loading data: ' + error.message);
    }
}

// --- EVENT LISTENERS ---
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    
    document.getElementById('mainTitle').addEventListener('click', () => {
        if (appState.currentView !== 'home') {
            appState.navigationHistory = [];
            renderHomePage();
        }
    });
    
    document.getElementById('navAllEntries').addEventListener('click', () => {
        renderAllEntriesPage();
    });
    
    document.getElementById('navChartBeat').addEventListener('click', () => {
        showChartBeatPage();
    });
    
    if (closeModal) {
        closeModal.addEventListener('click', () => {
            itemDetailsModal.classList.remove('active');
        });
    }
    
    if (itemDetailsModal) {
        itemDetailsModal.addEventListener('click', (e) => {
            if (e.target === itemDetailsModal) {
                itemDetailsModal.classList.remove('active');
            }
        });
    }
    
    setupBackToTopButton();
});
