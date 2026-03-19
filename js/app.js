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

// ===== NOVAS FUNÇÕES DE CACHE =====
// Função para salvar no cache
function saveToCache(key, data) {
    try {
        localStorage.setItem(`daegon_${key}`, JSON.stringify({
            data: data,
            timestamp: Date.now()
        }));
        return true;
    } catch (e) {
        console.log('Cache save error:', e);
        return false;
    }
}

// Função para carregar do cache (válido por 1 hora)
function loadFromCache(key) {
    try {
        const cached = localStorage.getItem(`daegon_${key}`);
        if (!cached) return null;
        
        const { data, timestamp } = JSON.parse(cached);
        
        // Cache válido por 1 hora (3600000 ms)
        if (Date.now() - timestamp < 3600000) {
            return data;
        }
        
        return null;
    } catch (e) {
        return null;
    }
}

// Função para salvar imagens
function saveImageToCache(key, url) {
    try {
        const images = JSON.parse(localStorage.getItem('daegon_images') || '{}');
        images[key] = url;
        localStorage.setItem('daegon_images', JSON.stringify(images));
    } catch (e) {}
}

// Função para carregar imagens
function loadImageFromCache(key) {
    try {
        const images = JSON.parse(localStorage.getItem('daegon_images') || '{}');
        return images[key] || null;
    } catch (e) {
        return null;
    }
}

// --- INITIALIZATION ---
async function initializeApp() {
    showMessage('loading', 'Loading charts data...');
    
    try {
        // PRIMEIRO: Tentar carregar do cache (MAIS RÁPIDO)
        const cachedHomeData = loadFromCache('homepage');
        
        if (cachedHomeData) {
            console.log('Carregando homepage do cache');
            
            // Restaurar dados do cache
            appState.top3Data = cachedHomeData.top3Data || {};
            appState.artistDetailsData = cachedHomeData.artistDetailsData || {};
            appState.allEntries = cachedHomeData.allEntries || { songs: [], artists: [], albums: [] };
            
            // Renderizar IMEDIATAMENTE
            renderHomePage();
            
            // Depois atualizar em background
            setTimeout(() => {
                refreshDataInBackground();
            }, 100);
            
            return;
        }
        
        // PRIMEIRO ACESSO: Carregar apenas o MÍNIMO necessário
        console.log('Primeiro acesso, carregando dados essenciais...');
        
        // Carregar apenas SONGS (Hot 100) - o mais importante
        await fetchAndProcessChartData('songs');
        
        // Renderizar página com dados parciais
        renderHomePage();
        
        // Carregar o resto em background
        setTimeout(() => {
            loadRemainingCharts();
        }, 500);
        
    } catch (error) {
        showMessage('error', 'Error loading data: ' + error.message);
    }
}

// NOVA FUNÇÃO: Carregar charts restantes em background
async function loadRemainingCharts() {
    console.log('Carregando charts restantes em background...');
    
    const otherCharts = [
        'artists',
        'albums', 
        'yearEndSongs',
        'yearEndArtists',
        'yearEndAlbums',
        'goatSongs',
        'goatArtists',
        'goatAlbums',
        'artistStats'
    ];
    
    for (const chart of otherCharts) {
        try {
            await fetchAndProcessChartData(chart);
        } catch (e) {
            console.error(`Erro carregando ${chart}:`, e);
        }
    }
    
    await fetchAndProcessChartBeatData();
    
    // Salvar tudo no cache
    saveToCache('homepage', {
        top3Data: appState.top3Data,
        artistDetailsData: appState.artistDetailsData,
        allEntries: appState.allEntries,
        timestamp: Date.now()
    });
    
    console.log('Background loading completo!');
}

// NOVA FUNÇÃO: Atualizar dados em background
async function refreshDataInBackground() {
    // Verificar se precisa atualizar
    const lastUpdate = loadFromCache('last_update') || 0;
    
    // Se já atualizou hoje, não faz nada
    if (Date.now() - lastUpdate < 86400000) { // 24 horas
        return;
    }
    
    console.log('Atualizando dados em background...');
    
    // Recarregar dados principais
    await fetchAndProcessChartData('songs');
    await fetchAndProcessChartData('artists');
    await fetchAndProcessChartData('albums');
    
    // Atualizar cache
    saveToCache('homepage', {
        top3Data: appState.top3Data,
        artistDetailsData: appState.artistDetailsData,
        allEntries: appState.allEntries
    });
    
    saveToCache('last_update', Date.now());
    
    // Re-renderizar se ainda estiver na home
    if (appState.currentView === 'home') {
        renderHomePage();
    }
}

// --- CHART PAGE FUNCTIONS ---
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
        const years = Object.keys(yearsData).sort((a, b) => b - a);
        const mostRecentYear = years?.[0] || new Date().getFullYear().toString();
        appState.currentYear = mostRecentYear;
    } else {
        const dates = Object.keys(appState.chartData[chartType]);
        const mostRecentDate = dates.length > 0 ? dates[dates.length - 1] : null;
        
        appState.currentDate = dateToSet || appState.sharedDate || mostRecentDate;
        
        if (!appState.chartData[chartType][appState.currentDate] && !isGoat) {
            appState.currentDate = mostRecentDate;
            appState.sharedDate = mostRecentDate;
        }
    }
    
    const headerTitle = isYearEnd ? 'Year-End Charts' : isGoat ? 'Greatest of All Time' : 'Weekly Charts';
    const navCharts = isYearEnd ? 
        Object.entries(chartsConfig).filter(([key]) => key.includes('yearEnd')) :
        isGoat ? 
        Object.entries(chartsConfig).filter(([key]) => key.includes('goat')) :
        Object.entries(chartsConfig).filter(([key]) => !key.includes('yearEnd') && !key.includes('goat') && key !== 'artistStats');

    appContainer.innerHTML = `
        <div class="max-w-4xl mx-auto">
            <button id="backButton" class="back-button mb-6 flex items-center text-accent hover:text-accent-dark font-semibold transition-colors">
                <i class="fas fa-arrow-left mr-2"></i> Back to Home
            </button>
            
            <div class="mb-6">
                <h2 class="text-2xl sm:text-3xl font-bold text-center mb-2 text-white">${headerTitle}</h2>
                <div id="chartNav" class="flex flex-wrap justify-center border-b border-gray-700">
                    ${navCharts.map(([key, config]) => `
                        <button data-chart="${key}" class="chart-nav-btn btn-hover ${appState.activeChart === key ? (isGoat ? 'goat-active' : 'active') : ''} text-sm font-semibold py-2 px-4 text-gray-400 hover:text-white focus:outline-none transition-all">
                            ${config.title}
                        </button>
                    `).join('')}
                </div>
            </div>
            
            <div id="chartHeader" class="mb-6">
                <h3 id="chartTitle" class="text-xl font-bold text-center mb-4 text-white">
                    ${chartsConfig[appState.activeChart].title}
                </h3>
                
                ${isYearEnd ? `
                    <div class="flex justify-center items-center mb-4">
                        <div class="year-selector flex gap-2 flex-wrap justify-center">
                            ${getYearButtons(chartType)}
                        </div>
                    </div>
                ` : isGoat ? '' : `
                    <div class="flex flex-col sm:flex-row justify-center items-center gap-3 sm:gap-4">
                        <div class="flex items-center gap-2 text-white">
                            <label for="weekSelector" class="text-gray-400 font-medium">Select Week:</label>
                            <button id="prevWeekBtn" class="p-2 rounded-md bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors btn-hover" title="Previous Week">
                                <i class="fas fa-chevron-left text-sm"></i>
                            </button>
                            <input type="text" id="weekSelector" class="flatpickr-input" placeholder="Select date">
                            <button id="nextWeekBtn" class="p-2 rounded-md bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors btn-hover" title="Next Week">
                                <i class="fas fa-chevron-right text-sm"></i>
                            </button>
                        </div>
                    </div>
                `}
            </div>
            
            <div id="chartContainer" class="bg-gray-800 rounded-lg overflow-hidden border border-gray-700 shadow-sm">
                ${renderChartItems()}
            </div>
            
            ${!isYearEnd && !isGoat ? `
                <div class="bottom-nav flex justify-center items-center gap-3 mt-6">
                    <button id="bottomPrevWeekBtn" class="p-2 rounded-md bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors btn-hover" title="Previous Week">
                        <i class="fas fa-chevron-left text-sm mr-1"></i> Previous Week
                    </button>
                    <button id="bottomNextWeekBtn" class="p-2 rounded-md bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors btn-hover" title="Next Week">
                        Next Week <i class="fas fa-chevron-right text-sm ml-1"></i>
                    </button>
                </div>
            ` : ''}
            
            ${!isYearEnd && !isGoat ? renderDropouts(chartType) : ''}
            
            ${!isYearEnd && !isGoat ? `
                <div class="text-center mt-6">
                    <button id="backToTopBtn" class="px-4 py-2 bg-accent text-white rounded-md hover:bg-accent-dark transition-colors btn-hover">
                        <i class="fas fa-arrow-up mr-2"></i> Back to Top
                    </button>
                </div>
            ` : ''}
        </div>
    `;
    
    setupChartPageListeners();
    loadSpotifyImages();
    setupBackToTopButton();
    
    if (!isYearEnd && !isGoat) {
        const dates = Object.keys(appState.chartData[chartType]);
        if (dates.length > 0) {
            const datePicker = flatpickr("#weekSelector", {
                enable: dates,
                defaultDate: appState.currentDate,
                dateFormat: "Y-m-d",
                theme: "dark",
                position: "auto",
                animate: true,
                showMonths: 1,
                static: false,
                closeOnSelect: true,
                nextArrow: '<i class="fas fa-chevron-right"></i>',
                prevArrow: '<i class="fas fa-chevron-left"></i>',
                onChange: function(selectedDates, dateStr, instance) {
                    if (dateStr) {
                        appState.currentDate = dateStr;
                        appState.sharedDate = dateStr;
                        
                        const otherCharts = ['songs', 'artists', 'albums'].filter(c => c !== chartType);
                        for(const otherChart of otherCharts) {
                            if (appState.chartData[otherChart][dateStr]) {
                                appState.chartData[otherChart].activeDate = dateStr;
                            }
                        }

                        document.getElementById('chartContainer').innerHTML = renderChartItems();
                        updateWeekNavButtons();
                        loadSpotifyImages();
                    }
                }
            });
        }
    }
    
    if (isYearEnd) {
        document.querySelectorAll('.year-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                appState.currentYear = this.dataset.year;
                document.querySelectorAll('.year-btn').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                document.getElementById('chartContainer').innerHTML = renderChartItems();
                loadSpotifyImages();
            });
        });
    }
}

function getYearButtons(chartType) {
    const yearsData = appState.chartData[chartType];
    if (!yearsData) return '';
    
    const years = Object.keys(yearsData).sort((a, b) => b - a);
    const currentYear = appState.currentYear;
    
    return years.map(year => `
        <button class="year-btn px-3 py-1 rounded ${year === currentYear ? 'active' : ''}" data-year="${year}">${year}</button>
    `).join('');
}

function showChartBeatPage() {
    if (appState.currentView === 'chart' && appState.activeChart) {
        appState.navigationHistory.push({
            view: 'chart',
            chart: appState.activeChart,
            date: appState.currentDate,
            year: appState.currentYear
        });
    }
    
    appState.currentView = 'chartBeat';
    renderChartBeatPage();
}

function setupChartBeatListeners() {
    document.getElementById('backButton').addEventListener('click', function() {
        navigateBack();
    });
    
    document.querySelectorAll('.chart-beat-nav-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const blogType = this.dataset.blog;
            appState.currentBlog = blogType;
            renderChartBeatPage();
        });
    });
    
    document.querySelectorAll('.read-more-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const articleIndex = parseInt(this.dataset.articleIndex);
            renderArticleModal(articleIndex);
        });
    });
}

function setupChartPageListeners() {
    document.getElementById('backButton').addEventListener('click', navigateBack);
    
    document.querySelectorAll('.chart-nav-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const chartType = this.dataset.chart;
            showChartPage(chartType);
        });
    });
    
    const isYearEnd = appState.activeChart.includes('yearEnd');
    const isGoat = appState.activeChart.includes('goat');

    if (!isYearEnd && !isGoat) {
        const dates = Object.keys(appState.chartData[appState.activeChart]).sort();
        const currentIndex = dates.indexOf(appState.currentDate);

        document.getElementById('prevWeekBtn').addEventListener('click', navigateToPrevWeek);
        document.getElementById('nextWeekBtn').addEventListener('click', navigateToNextWeek);
        document.getElementById('bottomPrevWeekBtn').addEventListener('click', navigateToPrevWeek);
        document.getElementById('bottomNextWeekBtn').addEventListener('click', navigateToNextWeek);
        
        // Botão voltar ao topo
        document.getElementById('backToTopBtn').addEventListener('click', function() {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
        
        updateWeekNavButtons();
    }
    
    setTimeout(() => {
        document.querySelectorAll('.artist-link, .artist-page-link').forEach(link => {
            link.addEventListener('click', function() {
                const artist = this.dataset.artist;
                appState.navigationHistory.push({
                    view: 'chart',
                    chart: appState.activeChart,
                    date: appState.currentDate,
                    year: appState.currentYear
                });
                renderArtistPage(artist);
            });
        });
    }, 100);

    setTimeout(() => {
        document.querySelectorAll('.chart-run-link-btn').forEach(btn => {
            const chartType = btn.dataset.chart;
            const itemKey = btn.dataset.key;
            btn.addEventListener('click', function() {
                 showChartRunModal(chartType, itemKey);
            });
        });
    }, 100);
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
    
    closeModal.addEventListener('click', () => {
        itemDetailsModal.classList.remove('active');
    });
    
    itemDetailsModal.addEventListener('click', (e) => {
        if (e.target === itemDetailsModal) {
            itemDetailsModal.classList.remove('active');
        }
    });
    
    // Inicializar botão voltar ao topo
    setupBackToTopButton();
});
