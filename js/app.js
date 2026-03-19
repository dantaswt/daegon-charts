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

// ========== FUNÇÕES DE UTILIDADE ==========

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
        const retryBtn = document.getElementById('retryButton');
        if (retryBtn) retryBtn.addEventListener('click', initializeApp);
    }
}

function setupBackToTopButton() {
    const existingButton = document.querySelector('.back-to-top');
    if (existingButton) existingButton.remove();
    
    const backToTopButton = document.createElement('button');
    backToTopButton.className = 'back-to-top';
    backToTopButton.innerHTML = '<i class="fas fa-arrow-up"></i>';
    backToTopButton.title = 'Back to top';
    backToTopButton.style.display = 'none';
    
    document.body.appendChild(backToTopButton);
    
    window.addEventListener('scroll', function() {
        if (window.scrollY > 300) {
            backToTopButton.style.display = 'flex';
            setTimeout(() => backToTopButton.classList.add('visible'), 10);
        } else {
            backToTopButton.classList.remove('visible');
            setTimeout(() => {
                if (!backToTopButton.classList.contains('visible')) {
                    backToTopButton.style.display = 'none';
                }
            }, 300);
        }
    });
    
    backToTopButton.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

function getDiffClass(diff) {
    if (!diff) return '';
    const lowerDiff = diff.toString().toLowerCase().trim();
    if (lowerDiff.includes('▲') || lowerDiff.includes('+')) return 'diff-up';
    if (lowerDiff.includes('▼') || lowerDiff.includes('-')) return 'diff-down';
    if (lowerDiff.includes('new') || lowerDiff.includes('re')) return 'diff-new';
    return '';
}

function getDiffSymbol(diff) {
    if (!diff) return '';
    const lowerDiff = diff.toString().toLowerCase().trim();
    if (lowerDiff === '0') return '=';
    if (lowerDiff.includes('▲') || lowerDiff.includes('+')) return '▲';
    if (lowerDiff.includes('▼') || lowerDiff.includes('-')) return '▼';
    if (lowerDiff.includes('re')) return 'RE';
    if (lowerDiff.includes('new')) return 'NEW';
    return diff;
}

function updateWeekNavButtons() {
    const chartType = appState.activeChart;
    const dates = Object.keys(appState.chartData[chartType] || {}).sort();
    const currentIndex = dates.indexOf(appState.currentDate);
    
    const prevBtn = document.getElementById('prevWeekBtn');
    const nextBtn = document.getElementById('nextWeekBtn');
    const bottomPrevBtn = document.getElementById('bottomPrevWeekBtn');
    const bottomNextBtn = document.getElementById('bottomNextWeekBtn');
    
    if (prevBtn) prevBtn.disabled = currentIndex <= 0;
    if (nextBtn) nextBtn.disabled = currentIndex >= dates.length - 1;
    if (bottomPrevBtn) bottomPrevBtn.disabled = currentIndex <= 0;
    if (bottomNextBtn) bottomNextBtn.disabled = currentIndex >= dates.length - 1;
}

function navigateToPrevWeek() {
    const chartType = appState.activeChart;
    const dates = Object.keys(appState.chartData[chartType] || {}).sort();
    const currentIndex = dates.indexOf(appState.currentDate);
    
    if (currentIndex > 0) {
        appState.currentDate = dates[currentIndex - 1];
        appState.sharedDate = appState.currentDate;
        
        document.getElementById('chartContainer').innerHTML = renderChartItems();
        updateWeekNavButtons();
        loadSpotifyImages();
        
        const datePicker = document.getElementById('weekSelector')?._flatpickr;
        if (datePicker) datePicker.setDate(appState.currentDate);
    }
}

function navigateToNextWeek() {
    const chartType = appState.activeChart;
    const dates = Object.keys(appState.chartData[chartType] || {}).sort();
    const currentIndex = dates.indexOf(appState.currentDate);
    
    if (currentIndex < dates.length - 1) {
        appState.currentDate = dates[currentIndex + 1];
        appState.sharedDate = appState.currentDate;
        
        document.getElementById('chartContainer').innerHTML = renderChartItems();
        updateWeekNavButtons();
        loadSpotifyImages();
        
        const datePicker = document.getElementById('weekSelector')?._flatpickr;
        if (datePicker) datePicker.setDate(appState.currentDate);
    }
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

function goToChartWeek(chartType, date) {
    appState.navigationHistory.push({
        view: 'chart',
        chart: appState.activeChart,
        date: appState.currentDate,
        year: appState.currentYear
    });
    
    appState.currentDate = date;
    appState.sharedDate = date;
    showChartPage(chartType, date);
    itemDetailsModal.classList.remove('active');
}

// ========== FUNÇÕES DO SPOTIFY ==========

async function getSpotifyAccessToken() {
    if (SPOTIFY_ACCESS_TOKEN) return SPOTIFY_ACCESS_TOKEN;
    
    try {
        const response = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': 'Basic ' + btoa(SPOTIFY_CLIENT_ID + ':' + SPOTIFY_CLIENT_SECRET)
            },
            body: 'grant_type=client_credentials'
        });
        
        if (!response.ok) throw new Error('Failed to get Spotify token');
        
        const data = await response.json();
        SPOTIFY_ACCESS_TOKEN = data.access_token;
        return SPOTIFY_ACCESS_TOKEN;
    } catch (error) {
        console.error('Error getting Spotify token:', error);
        return null;
    }
}

async function getSpotifyImage(query, type) {
    let correctedQuery = query;
    if (type === 'artist') {
        for (const [wrongName, correctName] of Object.entries(artistImageCorrections)) {
            if (query.toLowerCase().includes(wrongName.toLowerCase())) {
                correctedQuery = correctName;
                break;
            }
        }
    }
    
    const cacheKey = `${type}:${correctedQuery}`.toLowerCase();
    
    if (imageCache[cacheKey]) return imageCache[cacheKey];
    
    if (pendingImageRequests[cacheKey]) {
        return new Promise((resolve) => {
            const checkInterval = setInterval(() => {
                if (imageCache[cacheKey]) {
                    clearInterval(checkInterval);
                    resolve(imageCache[cacheKey]);
                }
            }, 50);
        });
    }
    
    pendingImageRequests[cacheKey] = true;
    
    const token = await getSpotifyAccessToken();
    if (!token) {
        delete pendingImageRequests[cacheKey];
        return null;
    }
    
    try {
        const searchType = type === 'artist' ? 'artist' : 'album';
        const response = await fetch(
            `https://api.spotify.com/v1/search?q=${encodeURIComponent(correctedQuery)}&type=${searchType}&limit=1`,
            { headers: { 'Authorization': `Bearer ${token}` } }
        );
        
        if (!response.ok) throw new Error('Spotify search failed');
        
        const data = await response.json();
        let imageUrl = null;
        
        if (type === 'artist' && data.artists?.items?.length > 0) {
            imageUrl = data.artists.items[0]?.images?.[0]?.url || null;
        } else if (type !== 'artist' && data.albums?.items?.length > 0) {
            imageUrl = data.albums.items[0]?.images?.[0]?.url || null;
        }
        
        if (imageUrl) {
            imageCache[cacheKey] = imageUrl;
            const img = new Image();
            img.src = imageUrl;
        }
        
        delete pendingImageRequests[cacheKey];
        return imageUrl;
    } catch (error) {
        console.error('Error fetching Spotify image:', error);
        delete pendingImageRequests[cacheKey];
        return null;
    }
}

async function loadSpotifyImages() {
    const chartType = appState.activeChart;
    const colMap = appState.colMaps[chartType];
    if (!colMap) return;
    
    let items = [];
    const isYearEnd = chartType.includes('yearEnd');
    const isGoat = chartType.includes('goat');

    if (isYearEnd) {
        items = appState.chartData[chartType]?.[appState.currentYear] || [];
    } else if (isGoat) {
        items = appState.chartData[chartType] || [];
    } else {
        items = appState.chartData[chartType]?.[appState.currentDate] || [];
    }
    
    for (let i = 0; i < Math.min(items.length, 20); i++) {
        const row = items[i];
        const artist = row[colMap.artist] || 'Unknown';
        
        let query = '', type = '';
        
        if (chartType.includes('Songs') || chartType === 'songs') {
            query = artist;
            type = 'artist';
        } else if (chartType.includes('Albums') || chartType === 'albums') {
            const album = row[colMap.album] || '';
            query = `${artist} ${album}`;
            type = 'album';
        } else {
            query = artist;
            type = 'artist';
        }
        
        if (query && query !== 'Unknown') {
            try {
                const imageUrl = await getSpotifyImage(query, type);
                const imageElement = document.getElementById(`image-${chartType}-${i}`);
                if (imageElement && imageUrl) {
                    imageElement.innerHTML = `<img src="${imageUrl}" alt="${query}" class="w-full h-full object-cover">`;
                    imageElement.classList.remove('placeholder-art');
                }
            } catch (error) {
                console.error('Error loading image:', error);
            }
        }
    }
}

async function loadCircleCardImages() {
    for (const chartType of ['songs', 'artists', 'albums']) {
        const topItem = appState.top3Data[chartType]?.[0];
        if (!topItem) continue;
        
        let query = '', type = '';
        
        if (chartType === 'songs') {
            query = topItem.artist;
            type = 'artist';
        } else if (chartType === 'albums') {
            const album = topItem.name.includes('(') ? 
                topItem.name.substring(0, topItem.name.indexOf('(')).trim() : 
                topItem.name;
            query = `${topItem.artist} ${album}`;
            type = 'album';
        } else {
            query = topItem.name;
            type = 'artist';
        }
        
        if (query && query !== 'Unknown') {
            try {
                const imageUrl = await getSpotifyImage(query, type);
                const imageElement = document.getElementById(`circle-image-${chartType}`);
                if (imageElement && imageUrl) {
                    imageElement.innerHTML = `<img src="${imageUrl}" alt="${query}" class="w-full h-full object-cover">`;
                    imageElement.classList.remove('placeholder-art');
                }
            } catch (error) {
                console.error('Erro ao carregar imagem:', error);
            }
        }
    }
}

async function loadArtistImage(artistName) {
    const imageUrl = await getSpotifyImage(artistName, 'artist');
    const imageElement = document.getElementById('artistImagePlaceholder');
    if (imageElement && imageUrl) {
        imageElement.innerHTML = `<img src="${imageUrl}" alt="${artistName}" class="w-full h-full object-cover">`;
        imageElement.classList.remove('placeholder-art');
    }
}

async function loadBlogImages() {
    for (const [blogType, articles] of Object.entries(appState.chartBeatData)) {
        for (let i = 0; i < articles.length; i++) {
            const article = articles[i];
            if (article.artist && article.artist !== 'Unknown') {
                try {
                    const imageUrl = await getSpotifyImage(article.artist, 'artist');
                    if (imageUrl) article.imageUrl = imageUrl;
                } catch (error) {
                    console.error('Error loading blog image:', error);
                }
            }
        }
    }
}

// ========== FUNÇÕES DE RENDERIZAÇÃO ==========

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
                <p class="text-gray-400 max-w-2xl mx-auto">Your personal charts based on Last.fm data.</p>
            </div>
            
            <div class="circle-cards-grid mb-16">
                ${renderCircleCard('songs', 'Hot 100')}
                ${renderCircleCard('artists', 'Artist 50')}
                ${renderCircleCard('albums', 'Top Albums')}
            </div>
            
            ${(featuredHot100 || featuredTop100) ? `
            <div class="mb-16">
                <h3 class="text-2xl font-bold mb-6 section-title text-white">Chart Beat - Latest News</h3>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    ${featuredHot100 ? renderChartBeatCard(featuredHot100) : ''}
                    ${featuredTop100 ? renderChartBeatCard(featuredTop100) : ''}
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
        card.addEventListener('click', () => showChartPage(card.dataset.chart));
    });

    document.querySelectorAll('.circle-card-container').forEach(card => {
        card.addEventListener('click', () => showChartPage(card.dataset.chart));
    });

    setTimeout(loadCircleCardImages, 500);
    setupBackToTopButton();
}

function renderCircleCard(chartType, title) {
    const icon = chartsConfig[chartType]?.icon || 'fa-music';
    
    return `
        <div class="circle-card-container" data-chart="${chartType}">
            <div class="circle-card" id="circle-image-${chartType}">
                <div class="w-full h-full placeholder-art">
                    <i class="fas ${icon} text-3xl text-gray-400"></i>
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
    
    if (top3.length === 0) {
        return `
            <div class="chart-card cursor-pointer bg-gray-800 border border-gray-700 rounded-lg p-4" data-chart="${chartType}">
                <h4 class="font-semibold text-white mb-3">${title}</h4>
                <div class="text-center py-4">
                    <div class="loader mx-auto mb-2" style="width: 20px; height: 20px;"></div>
                    <p class="text-xs text-gray-400">Loading...</p>
                </div>
            </div>
        `;
    }
    
    return `
        <div class="chart-card cursor-pointer bg-gray-800 border border-gray-700 rounded-lg p-4 transition-all duration-300 hover:border-accent shadow-sm ${chartType.includes('goat') ? 'hover:border-gold goat-card-border' : ''}" data-chart="${chartType}">
            <div class="flex items-center justify-between mb-3">
                <h4 class="font-semibold text-white">${title}</h4>
                <span class="text-xs text-gray-400 bg-gray-700 px-2 py-1 rounded-full">Top ${top3.length}</span>
            </div>
            <div class="space-y-2">
                ${top3.map((item, index) => `
                    <div class="flex items-center text-sm text-gray-300">
                        <span class="font-bold w-6 ${index === 0 ? 'text-accent' : 'text-gray-400'} ${chartType.includes('goat') && index === 0 ? 'goat-text' : ''}">${item.position || index+1}</span>
                        <span class="truncate break-text">${item.name || 'Unknown'}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function renderChartBeatCard(article) {
    return `
        <div class="blog-card-animated blog-card bg-gray-800 rounded-lg overflow-hidden border border-gray-700 shadow-sm cursor-pointer" onclick="showChartBeatPage()">
            <div class="h-48 overflow-hidden relative">
                ${article.imageUrl ? 
                    `<img src="${article.imageUrl}" alt="${article.artist}" class="w-full h-full object-cover article-image">` : 
                    `<div class="w-full h-48 placeholder-art"><i class="fas fa-newspaper text-3xl text-gray-400"></i></div>`
                }
                <div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-gray-800 to-transparent p-4">
                    <span class="text-xs text-accent font-semibold">${article.publicationDate}</span>
                    <h4 class="font-bold text-lg mt-1 text-white truncate">${article.title}</h4>
                </div>
            </div>
        </div>
    `;
}

function renderChartItems() {
    const chartType = appState.activeChart;
    const colMap = appState.colMaps[chartType];
    
    if (!colMap) return '<div class="text-center p-8 text-gray-400">No data available</div>';
    
    let items = [];
    const isYearEnd = chartType.includes('yearEnd');
    const isGoat = chartType.includes('goat');

    try {
        if (isYearEnd) {
            items = appState.chartData[chartType]?.[appState.currentYear] || [];
        } else if (isGoat) {
            items = appState.chartData[chartType] || [];
        } else {
            items = appState.chartData[chartType]?.[appState.currentDate] || [];
        }
    } catch (e) {
        return '<div class="text-center p-8 text-gray-400">Error loading data</div>';
    }
    
    if (!items.length) return '<div class="text-center p-8 text-gray-400">No data available</div>';
    
    const sortedItems = [...items].sort((a, b) => {
        const posA = parseInt(a[colMap.position]) || 999;
        const posB = parseInt(b[colMap.position]) || 999;
        return posA - posB;
    });
    
    return sortedItems.slice(0, 100).map((row, index) => {
        const position = parseInt(row[colMap.position]) || index + 1;
        const artist = row[colMap.artist] || 'Unknown';
        const lastWeek = (!isYearEnd && !isGoat && colMap.lastWeek !== -1) ? row[colMap.lastWeek] : null;
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
                        ${(!isYearEnd && !isGoat) ? `
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

function renderDropouts(chartType) {
    if (!appState.currentDate || !appState.chartData[chartType]) return '';
    
    const dates = Object.keys(appState.chartData[chartType]).sort();
    const currentIndex = dates.indexOf(appState.currentDate);
    
    if (currentIndex <= 0) return '';
    
    const previousDate = dates[currentIndex - 1];
    const currentItems = appState.chartData[chartType][appState.currentDate] || [];
    const previousItems = appState.chartData[chartType][previousDate] || [];
    const colMap = appState.colMaps[chartType];
    
    const currentKeys = new Set(currentItems.map(row => {
        const name = row[colMap.song] || row[colMap.album] || row[colMap.artist];
        const artist = row[colMap.artist];
        return `${name}:${artist}`.toLowerCase();
    }));
    
    const dropouts = previousItems.filter(row => {
        const name = row[colMap.song] || row[colMap.album] || row[colMap.artist];
        const artist = row[colMap.artist];
        return !currentKeys.has(`${name}:${artist}`.toLowerCase());
    });
    
    if (!dropouts.length) return '';
    
    return `
        <div class="mt-8 pt-6 border-t border-gray-700">
            <h4 class="text-lg font-bold mb-4 text-gray-400">Dropouts from Previous Week</h4>
            <div class="bg-gray-800 rounded-lg border border-gray-700">
                ${dropouts.map(row => {
                    const position = parseInt(row[colMap.position]) || 0;
                    const artist = row[colMap.artist] || 'Unknown';
                    const name = row[colMap.song] || row[colMap.album] || row[colMap.artist];
                    
                    return `
                        <div class="chart-row py-3 px-4 border-b border-gray-700 last:border-b-0 dropout-item">
                            <div class="flex items-center">
                                <div class="flex-shrink-0 w-10 text-center">
                                    <span class="text-lg font-bold text-gray-500">${position}</span>
                                </div>
                                <div class="flex-grow ml-4">
                                    <p class="font-medium text-gray-400">${name}</p>
                                    <p class="text-sm text-gray-500">${artist}</p>
                                    <span class="text-red-400 text-xs font-semibold">DROPPED OUT</span>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}

function showChartRunModal(chartType, itemKey) {
    const chartRun = appState.chartRunData[chartType]?.[itemKey] || [];
    const [name, artist] = itemKey.split(':');

    modalContent.innerHTML = chartRun.length ? `
        <h3 class="text-2xl font-bold mb-4 text-white">${name} by ${artist} - Chart Run</h3>
        <div class="bg-gray-700 rounded-lg overflow-hidden">
            ${chartRun.map(run => `
                <div class="flex justify-between items-center py-2 px-4 border-b border-gray-700">
                    <span class="font-medium text-white">
                        <button class="date-link" onclick="goToChartWeek('${chartType}', '${run.date}')">
                            Week of ${run.date}
                        </button>
                    </span>
                    <span class="text-sm font-semibold ${run.position === 1 ? 'text-accent' : run.position === run.peak ? 'text-green-500' : ''}">#${run.position}</span>
                </div>
            `).join('')}
        </div>
    ` : '<p class="text-center text-gray-400">No chart run data available.</p>';

    itemDetailsModal.classList.add('active');
}

function renderArtistPage(artistName) {
    const artistData = appState.artistDetailsData[artistName];
    
    appContainer.innerHTML = artistData ? `
        <div class="max-w-4xl mx-auto fade-in">
            <button id="backButton" class="back-button mb-6 flex items-center text-accent hover:text-accent-dark font-semibold transition-colors">
                <i class="fas fa-arrow-left mr-2"></i> Back
            </button>
            <div class="flex flex-col sm:flex-row items-center sm:items-end mb-6">
                <div id="artistImagePlaceholder" class="w-24 h-24 sm:w-32 sm:h-32 rounded-full overflow-hidden mr-0 sm:mr-6 mb-4 sm:mb-0 shadow-lg flex-shrink-0 placeholder-art">
                    <i class="fas fa-user text-4xl text-gray-400"></i>
                </div>
                <div class="text-center sm:text-left">
                    <h2 class="text-4xl font-extrabold text-white mb-1 break-text">${artistName}</h2>
                    <p class="text-gray-400 text-lg">Detailed Chart History</p>
                </div>
            </div>
            <div id="artistPageContent" class="artist-page-content">
                ${renderArtistChartSection('Top 50 Artists', artistData['Top 50 Artists'])}
                ${renderArtistChartSection('Hot 100 Songs', artistData['Hot 100 Songs'])}
                ${renderArtistChartSection('Top 100 Albums', artistData['Top 100 Albums'])}
            </div>
        </div>
    ` : `
        <div class="max-w-4xl mx-auto text-center p-8">
            <button id="backButton" class="back-button mb-6 flex items-center text-accent hover:text-accent-dark font-semibold transition-colors">
                <i class="fas fa-arrow-left mr-2"></i> Back
            </button>
            <i class="fas fa-user-circle text-6xl text-gray-400 mb-4"></i>
            <h2 class="text-3xl font-bold text-white mb-2">Artist not found</h2>
            <p class="text-gray-400">The requested artist page could not be found.</p>
        </div>
    `;
    
    document.getElementById('backButton').addEventListener('click', navigateBack);
    if (artistData) loadArtistImage(artistName);
    setupBackToTopButton();
}

function renderArtistChartSection(chartName, chartData) {
    if (!chartData || !chartData.count) return '';
    
    const isArtistChart = chartName === 'Top 50 Artists';
    
    return `
        <div class="mb-8">
            <h3 class="text-xl font-bold mb-4 text-white">${chartName}</h3>
            <div class="bg-gray-700 rounded-lg p-4 mb-4">
                ${isArtistChart ? 
                    `<p class="text-sm text-gray-400">Peak <span class="font-semibold text-white">#${chartData.entries?.[0]?.peak}</span> / <span class="font-semibold text-white">${chartData.entries?.[0]?.weeks}</span> Weeks</p>` :
                    `<p class="text-sm text-gray-400"><span class="font-semibold text-white">${chartData.count}</span> Entries / <span class="font-semibold text-white">${chartData.numberOnes}</span> #1's / <span class="font-semibold text-white">${chartData.topTens}</span> Top 10's</p>`
                }
            </div>
            ${!isArtistChart ? `
                <div class="bg-gray-800 rounded-lg border border-gray-700 shadow-sm">
                    ${chartData.entries.map(entry => {
                        const chartToShow = chartName.includes('Albums') ? 'albums' : 'songs';
                        return `
                            <div class="flex justify-between items-center py-2 px-4 border-b border-gray-700 last:border-b-0">
                                <div class="flex-grow min-w-0">
                                    <span class="font-medium text-white truncate break-text">${entry.item}</span>
                                    <div class="flex flex-wrap gap-1 mt-1">
                                        ${entry.firstEntry ? `<button class="date-badge" onclick="goToChartWeek('${chartToShow}', '${entry.firstEntry}')">First: ${entry.firstEntry}</button>` : ''}
                                        ${entry.peakDate && entry.peakDate !== entry.firstEntry ? `<button class="date-badge" onclick="goToChartWeek('${chartToShow}', '${entry.peakDate}')">Peak: ${entry.peakDate}</button>` : ''}
                                        ${entry.unitsSold && entry.unitsSold !== '0' ? `<span class="units-badge">${entry.unitsSold} units</span>` : ''}
                                    </div>
                                </div>
                                <div class="flex items-center space-x-4 text-sm text-gray-400 flex-shrink-0 ml-4">
                                    <span>Peak <span class="font-semibold text-white">#${entry.peak}</span></span>
                                    <span><span class="font-semibold text-white">${entry.weeks}</span> Weeks</span>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            ` : ''}
        </div>
    `;
}

function renderAllEntriesPage() {
    appState.currentView = 'allEntries';
    
    appContainer.innerHTML = `
        <div class="max-w-6xl mx-auto">
            <button id="backButton" class="back-button mb-6 flex items-center text-accent hover:text-accent-dark font-semibold transition-colors">
                <i class="fas fa-arrow-left mr-2"></i> Back to Home
            </button>
            
            <h2 class="text-3xl font-bold mb-6 section-title text-white">All Entries</h2>
            
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div class="cursor-pointer bg-gray-800 border border-gray-700 rounded-lg p-4 transition-all duration-300 hover:border-accent shadow-sm" id="allSongsBtn">
                    <div class="flex items-center justify-between mb-3">
                        <h4 class="font-semibold text-white">All Songs</h4>
                        <span class="text-xs text-gray-400 bg-gray-700 px-2 py-1 rounded-full">${appState.allEntries.songs.length} entries</span>
                    </div>
                    <p class="text-sm text-gray-400">Browse all song entries from the Hot 100 chart</p>
                </div>
                
                <div class="cursor-pointer bg-gray-800 border border-gray-700 rounded-lg p-4 transition-all duration-300 hover:border-accent shadow-sm" id="allArtistsBtn">
                    <div class="flex items-center justify-between mb-3">
                        <h4 class="font-semibold text-white">All Artists</h4>
                        <span class="text-xs text-gray-400 bg-gray-700 px-2 py-1 rounded-full">${Object.keys(appState.artistDetailsData).length} artists</span>
                    </div>
                    <p class="text-sm text-gray-400">Browse all artist entries from the Artist 50 chart</p>
                </div>
                
                <div class="cursor-pointer bg-gray-800 border border-gray-700 rounded-lg p-4 transition-all duration-300 hover:border-accent shadow-sm" id="allAlbumsBtn">
                    <div class="flex items-center justify-between mb-3">
                        <h4 class="font-semibold text-white">All Albums</h4>
                        <span class="text-xs text-gray-400 bg-gray-700 px-2 py-1 rounded-full">${appState.allEntries.albums.length} entries</span>
                    </div>
                    <p class="text-sm text-gray-400">Browse all album entries from the Top Albums chart</p>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('backButton').addEventListener('click', navigateBack);
    document.getElementById('allSongsBtn').addEventListener('click', () => showAllEntriesList('songs'));
    document.getElementById('allArtistsBtn').addEventListener('click', showAllArtistsPage);
    document.getElementById('allAlbumsBtn').addEventListener('click', () => showAllEntriesList('albums'));
    setupBackToTopButton();
}

function showAllEntriesList(entryType) {
    const entries = appState.allEntries[entryType] || [];
    const title = entryType === 'songs' ? 'All Songs' : 'All Albums';
    
    appContainer.innerHTML = `
        <div class="max-w-6xl mx-auto">
            <button id="backButton" class="back-button mb-6 flex items-center text-accent hover:text-accent-dark font-semibold transition-colors">
                <i class="fas fa-arrow-left mr-2"></i> Back to All Entries
            </button>
            
            <h2 class="text-3xl font-bold mb-6 section-title text-white">${title}</h2>
            
            <div class="search-container mb-6">
                <i class="fas fa-search search-icon"></i>
                <input type="text" id="entriesSearch" class="search-input" placeholder="Search ${entryType}...">
            </div>
            
            <div id="entriesList" class="bg-gray-800 rounded-lg border border-gray-700 shadow-sm">
                ${renderEntriesList(entryType, entries)}
            </div>
        </div>
    `;
    
    document.getElementById('backButton').addEventListener('click', () => renderAllEntriesPage());
    
    document.getElementById('entriesSearch').addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase();
        const filtered = entries.filter(e => 
            e.name.toLowerCase().includes(searchTerm) || 
            (e.artist && e.artist.toLowerCase().includes(searchTerm))
        );
        document.getElementById('entriesList').innerHTML = renderEntriesList(entryType, filtered);
    });
    
    setupBackToTopButton();
}

function renderEntriesList(entryType, entries) {
    if (!entries.length) return '<div class="text-center p-8 text-gray-400">No entries found</div>';
    
    return [...entries].sort((a, b) => a.name.localeCompare(b.name)).map(entry => `
        <div class="chart-row py-4 px-4">
            <div class="flex items-center">
                <div class="flex-grow min-w-0 text-white">
                    <p class="font-bold break-text">${entry.name}</p>
                    <p class="text-gray-400 text-sm mt-1">
                        <span class="artist-link" data-artist="${entry.artist}">${entry.artist}</span>
                    </p>
                    <div class="flex items-center gap-4 mt-1 text-xs text-gray-400">
                        ${entry.peak ? `<span>Peak: #${entry.peak}</span>` : ''}
                        ${entry.weeks ? `<span>Weeks: ${entry.weeks}</span>` : ''}
                        ${entry.weeksAt1 > 0 ? `<span>Weeks at #1: ${entry.weeksAt1}</span>` : ''}
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

function showAllArtistsPage() {
    const artists = Object.keys(appState.artistDetailsData).sort();
    
    appContainer.innerHTML = `
        <div class="max-w-6xl mx-auto">
            <button id="backButton" class="back-button mb-6 flex items-center text-accent hover:text-accent-dark font-semibold transition-colors">
                <i class="fas fa-arrow-left mr-2"></i> Back to All Entries
            </button>
            
            <h2 class="text-3xl font-bold mb-6 section-title text-white">All Artists</h2>
            
            <div class="search-container mb-6">
                <i class="fas fa-search search-icon"></i>
                <input type="text" id="artistsSearch" class="search-input" placeholder="Search artists...">
            </div>
            
            <div id="artistsList" class="bg-gray-800 rounded-lg border border-gray-700 shadow-sm">
                ${renderArtistsList(artists)}
            </div>
        </div>
    `;
    
    document.getElementById('backButton').addEventListener('click', renderAllEntriesPage);
    
    document.getElementById('artistsSearch').addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase();
        const filtered = artists.filter(a => a.toLowerCase().includes(searchTerm));
        document.getElementById('artistsList').innerHTML = renderArtistsList(filtered);
    });
    
    setupBackToTopButton();
}

function renderArtistsList(artists) {
    if (!artists.length) return '<div class="text-center p-8 text-gray-400">No artists found</div>';
    
    return artists.map(artist => {
        const stats = appState.artistDetailsData[artist];
        return `
            <div class="chart-row py-4 px-4 cursor-pointer" data-artist="${artist}">
                <div class="flex items-center">
                    <div class="flex-grow min-w-0 text-white">
                        <p class="font-bold truncate break-text">${artist}</p>
                        <div class="flex items-center gap-4 mt-1 text-xs text-gray-400">
                            <span>Songs: ${stats['Hot 100 Songs']?.count || 0}</span>
                            <span>Albums: ${stats['Top 100 Albums']?.count || 0}</span>
                            <span>#1 Hits: ${(stats['Hot 100 Songs']?.numberOnes || 0) + (stats['Top 100 Albums']?.numberOnes || 0)}</span>
                        </div>
                    </div>
                    <div class="flex-shrink-0"><i class="fas fa-chevron-right text-gray-400"></i></div>
                </div>
            </div>
        `;
    }).join('');
}

function renderChartBeatPage() {
    appState.currentView = 'chartBeat';
    const articles = appState.chartBeatData[appState.currentBlog] || [];
    
    appContainer.innerHTML = `
        <div class="max-w-6xl mx-auto">
            <button id="backButton" class="back-button mb-6 flex items-center text-accent hover:text-accent-dark font-semibold transition-colors">
                <i class="fas fa-arrow-left mr-2"></i> Back to Home
            </button>
            
            <div class="text-center mb-8">
                <h2 class="text-3xl font-bold mb-2 text-white">Chart Beat</h2>
                <p class="text-gray-400">News and insights about the music charts</p>
            </div>
            
            <div class="flex justify-center mb-8 border-b border-gray-700">
                <button class="chart-beat-nav-btn px-4 py-2 font-medium ${appState.currentBlog === 'hot100' ? 'text-accent border-b-2 border-accent' : 'text-gray-400'}" data-blog="hot100">Hot 100 Songs</button>
                <button class="chart-beat-nav-btn px-4 py-2 font-medium ${appState.currentBlog === 'top100Albums' ? 'text-accent border-b-2 border-accent' : 'text-gray-400'}" data-blog="top100Albums">Top 100 Albums</button>
            </div>
            
            <div class="space-y-6">
                ${articles.length ? articles.map((article, index) => `
                    <div class="blog-card-animated blog-card bg-gray-800 rounded-lg border border-gray-700 p-4 shadow-sm">
                        <div class="flex flex-col md:flex-row">
                            <div class="md:w-1/4 mb-4 md:mb-0">
                                ${article.imageUrl ? 
                                    `<img src="${article.imageUrl}" alt="${article.artist}" class="w-full h-32 object-cover rounded article-image">` : 
                                    `<div class="w-full h-32 placeholder-art rounded"><i class="fas fa-newspaper text-xl text-gray-400"></i></div>`
                                }
                            </div>
                            <div class="md:w-3/4 md:pl-6">
                                <span class="text-xs text-accent font-semibold">${article.publicationDate}</span>
                                <h4 class="font-bold text-lg mt-1 mb-2 text-white break-text">${article.title}</h4>
                                <p class="text-gray-400 text-sm">${article.fullText.substring(0, 200)}...</p>
                                <button class="read-more-btn mt-3 text-accent text-sm font-semibold" data-article-index="${index}">Read More <i class="fas fa-arrow-right ml-1 text-xs"></i></button>
                            </div>
                        </div>
                    </div>
                `).join('') : `
                    <div class="text-center py-8 text-gray-400">
                        <i class="fas fa-newspaper text-4xl mb-3"></i>
                        <p>No articles available</p>
                    </div>
                `}
            </div>
        </div>
    `;
    
    setupChartBeatListeners();
    setupBackToTopButton();
}

function renderArticleModal(articleIndex) {
    const article = appState.chartBeatData[appState.currentBlog]?.[articleIndex];
    if (!article) return;
    
    modalContent.innerHTML = `
        <div class="max-h-screen overflow-y-auto">
            <div class="mb-6">
                ${article.imageUrl ? 
                    `<img src="${article.imageUrl}" alt="${article.artist}" class="w-full h-64 object-cover rounded-lg mb-4">` : 
                    `<div class="w-full h-64 placeholder-art rounded-lg mb-4 flex items-center justify-center"><i class="fas fa-newspaper text-4xl text-gray-400"></i></div>`
                }
                <span class="text-sm text-accent font-semibold">${article.publicationDate}</span>
                <h3 class="text-2xl font-bold mt-1 mb-3 text-white break-text">${article.title}</h3>
                <div class="prose max-w-none"><p class="text-gray-300 whitespace-pre-line">${article.fullText}</p></div>
                ${article.chartLink ? `
                    <div class="mt-8 text-center">
                        <button class="px-4 py-2 bg-accent text-white rounded-md hover:bg-accent-dark transition-colors" onclick="showChartPage('${article.chartLink}', '${article.publicationDate}')">
                            See the full chart here <i class="fas fa-arrow-right ml-2"></i>
                        </button>
                    </div>
                ` : ''}
            </div>
        </div>
    `;
    
    itemDetailsModal.classList.add('active');
}

function setupChartBeatListeners() {
    document.getElementById('backButton').addEventListener('click', navigateBack);
    
    document.querySelectorAll('.chart-beat-nav-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            appState.currentBlog = this.dataset.blog;
            renderChartBeatPage();
        });
    });
    
    document.querySelectorAll('.read-more-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            renderArticleModal(parseInt(this.dataset.articleIndex));
        });
    });
}

function setupChartPageListeners() {
    document.getElementById('backButton').addEventListener('click', navigateBack);
    
    document.querySelectorAll('.chart-nav-btn').forEach(btn => {
        btn.addEventListener('click', () => showChartPage(btn.dataset.chart));
    });
    
    const isYearEnd = appState.activeChart.includes('yearEnd');
    const isGoat = appState.activeChart.includes('goat');

    if (!isYearEnd && !isGoat) {
        document.getElementById('prevWeekBtn')?.addEventListener('click', navigateToPrevWeek);
        document.getElementById('nextWeekBtn')?.addEventListener('click', navigateToNextWeek);
        document.getElementById('bottomPrevWeekBtn')?.addEventListener('click', navigateToPrevWeek);
        document.getElementById('bottomNextWeekBtn')?.addEventListener('click', navigateToNextWeek);
        document.getElementById('backToTopBtn')?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
        updateWeekNavButtons();
    }
    
    setTimeout(() => {
        document.querySelectorAll('.artist-link, .artist-page-link').forEach(link => {
            link.addEventListener('click', function() {
                appState.navigationHistory.push({
                    view: 'chart',
                    chart: appState.activeChart,
                    date: appState.currentDate,
                    year: appState.currentYear
                });
                renderArtistPage(this.dataset.artist);
            });
        });
        
        document.querySelectorAll('.chart-run-link-btn').forEach(btn => {
            btn.addEventListener('click', () => showChartRunModal(btn.dataset.chart, btn.dataset.key));
        });
    }, 100);
}

// ========== INITIALIZATION ==========

async function initializeApp() {
    showMessage('loading', 'Loading charts data...');
    
    try {
        await Promise.allSettled([
            fetchAndProcessChartData('songs'),
            fetchAndProcessChartData('artists'),
            fetchAndProcessChartData('albums'),
            fetchAndProcessChartData('yearEndSongs'),
            fetchAndProcessChartData('yearEndArtists'),
            fetchAndProcessChartData('yearEndAlbums'),
            fetchAndProcessChartData('goatSongs'),
            fetchAndProcessChartData('goatArtists'),
            fetchAndProcessChartData('goatAlbums'),
            fetchAndProcessChartData('artistStats'),
            fetchAndProcessChartBeatData()
        ]);
        
        const yearEndCharts = ['yearEndSongs', 'yearEndArtists', 'yearEndAlbums'];
        for (const chartType of yearEndCharts) {
            const years = Object.keys(appState.chartData[chartType] || {}).sort((a, b) => b - a);
            if (years.length) {
                appState.currentYear = years[0];
                break;
            }
        }

        renderHomePage();
        setupBackToTopButton();
        
    } catch (error) {
        showMessage('error', 'Error loading data: ' + error.message);
    }
}

// ========== EVENT LISTENERS ==========

document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    
    document.getElementById('mainTitle').addEventListener('click', () => {
        if (appState.currentView !== 'home') {
            appState.navigationHistory = [];
            renderHomePage();
        }
    });
    
    document.getElementById('navAllEntries').addEventListener('click', renderAllEntriesPage);
    document.getElementById('navChartBeat').addEventListener('click', showChartBeatPage);
    
    closeModal.addEventListener('click', () => itemDetailsModal.classList.remove('active'));
    itemDetailsModal.addEventListener('click', (e) => {
        if (e.target === itemDetailsModal) itemDetailsModal.classList.remove('active');
    });
    
    setupBackToTopButton();
});
