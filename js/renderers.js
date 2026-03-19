// ADICIONAR no início do arquivo:
const imageCache = new Map();

// MODIFICAR renderChartItems para usar lazy loading nas imagens
function renderChartItems() {
    const chartType = appState.activeChart;
    const colMap = appState.colMaps[chartType];
    
    let items = [];
    // ... existing code to get items ...
    
    const displayItems = sortedItems.slice(0, 100);
    
    // Usar virtual scrolling para grandes listas
    if (displayItems.length > 50) {
        return renderVirtualizedList(displayItems, chartType, colMap);
    }
    
    return displayItems.map((row, index) => {
        // ... existing rendering code ...
        
        // MODIFICAR a parte da imagem para usar Intersection Observer
        const imageHtml = `
            <div class="w-12 h-12 rounded-md shadow-md overflow-hidden spotify-image" 
                 id="image-${chartType}-${index}"
                 data-src-type="${chartType}"
                 data-src-index="${index}"
                 data-src-artist="${artist}">
                <div class="w-full h-full placeholder-art">
                    <i class="fas ${chartsConfig[chartType].icon} text-gray-400"></i>
                </div>
            </div>
        `;
        
        // ... rest of rendering ...
    }).join('');
}

// NOVA FUNÇÃO: Virtual scrolling para lists grandes
function renderVirtualizedList(items, chartType, colMap) {
    // Renderizar apenas os primeiros 30 itens
    const visibleItems = items.slice(0, 30);
    
    const html = visibleItems.map((row, index) => {
        // ... render item ...
    }).join('');
    
    // Adicionar um placeholder para o resto
    html += `
        <div class="text-center py-4 text-gray-400" id="loadMoreTrigger">
            <i class="fas fa-spinner fa-spin mr-2"></i> Loading more...
        </div>
    `;
    
    // Setup Intersection Observer para carregar mais
    setTimeout(() => {
        setupInfiniteScroll(items, chartType, colMap);
    }, 100);
    
    return html;
}

// NOVA FUNÇÃO: Infinite scroll
function setupInfiniteScroll(allItems, chartType, colMap) {
    const trigger = document.getElementById('loadMoreTrigger');
    if (!trigger) return;
    
    let currentIndex = 30;
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && currentIndex < allItems.length) {
                // Carregar próximos 20 itens
                const nextItems = allItems.slice(currentIndex, currentIndex + 20);
                const container = document.getElementById('chartContainer');
                
                nextItems.forEach((row, offset) => {
                    const actualIndex = currentIndex + offset;
                    const itemHtml = renderSingleItem(row, actualIndex, chartType, colMap);
                    container.insertAdjacentHTML('beforeend', itemHtml);
                });
                
                currentIndex += 20;
                
                // Atualizar trigger
                if (currentIndex >= allItems.length) {
                    trigger.remove();
                }
            }
        });
    }, { threshold: 0.1 });
    
    observer.observe(trigger);
}

// NOVA FUNÇÃO: Renderizar item único (para infinite scroll)
function renderSingleItem(row, index, chartType, colMap) {
    // Mesmo código de renderização de item, mas sem depender do loop
    // ... copy the item rendering code from renderChartItems ...
}

// --- RENDER FUNCTIONS ---
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
                    <i class="fas ${chartsConfig[chartType].icon} text-3xl text-gray-400"></i>
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
                        <span class="font-bold w-6 ${index === 0 ? 'text-accent' : 'text-gray-400'} ${chartType.includes('goat') && index === 0 ? 'goat-text' : ''}">${item.position}</span>
                        <span class="truncate break-text">${item.name}</span>
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
        if (!appState.currentDate || !appState.chartData[chartType][appState.currentDate]) {
            return '<div class="text-center p-8 text-gray-400">No data available</div>';
        }
        items = appState.chartData[chartType][appState.currentDate];
    }
    
    const sortedItems = [...items].sort((a, b) => {
        const posA = parseInt(a[colMap.position]);
        const posB = parseInt(b[colMap.position]);
        return posA - posB;
    });
    
    const displayItems = sortedItems.slice(0, 100);
    
    if (displayItems.length === 0) {
        return '<div class="text-center p-8 text-gray-400">No data available</div>';
    }
    
    return displayItems.map((row, index) => {
        const position = parseInt(row[colMap.position]) || 0;
        const artist = row[colMap.artist] || 'Unknown';
        const diff = colMap.diff !== -1 ? row[colMap.diff] : null;
        const lastWeek = colMap.lastWeek !== -1 && !isYearEnd && !isGoat ? row[colMap.lastWeek] : null;
        const peak = colMap.peak !== -1 ? parseInt(row[colMap.peak]) : null;
        const weeks = colMap.weeks !== -1 ? parseInt(row[colMap.weeks]) : null;
        const weeksAt1 = colMap.weeksAt1 !== -1 ? parseInt(row[colMap.weeksAt1]) : null;
        const units = colMap.units !== -1 ? row[colMap.units] : null;
        const totalUnits = colMap.totalUnits !== -1 ? row[colMap.totalUnits] : null;
        const certification = colMap.certification !== -1 ? row[colMap.certification] : null;
        
        const name = chartType.includes('Songs') || chartType === 'songs' ? (row[colMap.song] || 'Unknown') : 
                     chartType.includes('Albums') || chartType === 'albums' ? (row[colMap.album] || 'Unknown') : 
                     (row[colMap.artist] || 'Unknown');
        
        const diffClass = getDiffClass(diff);
        const diffSymbol = getDiffSymbol(diff);

        // Marcador NEW PEAK
        let newPeakBadge = '';
        if (!isYearEnd && !isGoat) {
            const hasNewPeak = (peak && position < peak);
            const isNewEntry = (diff?.toLowerCase() === 'new' || diff?.toLowerCase() === 're' || lastWeek?.toString() === '0');
            if (hasNewPeak && !isNewEntry) {
                newPeakBadge = `<span class="badge badge-new-peak">NEW PEAK</span>`;
            }
        }
        
        let weeksAt1Badge = '';
        if (weeksAt1 && weeksAt1 > 0) {
            weeksAt1Badge = `<span class="badge badge-weeks-at-1">${weeksAt1} WKS AT #1</span>`;
        }
        
        const chartRunKey = `${name.toLowerCase().trim()}:${artist.toLowerCase().trim()}`;
        const chartRun = appState.chartRunData[chartType]?.[chartRunKey] || [];

        return `
            <div class="chart-row py-4 px-4 ${position === 1 ? (isGoat ? 'rank-1 goat pulse-animation' : 'rank-1 pulse-animation') : ''}">
                <div class="flex items-center">
                    <div class="flex-shrink-0 w-10 text-center relative text-white">
                        <span class="text-xl font-bold">${position}</span>
                        ${!isYearEnd && !isGoat && diffSymbol ? `<span class="diff-indicator ml-1 text-xs font-semibold ${diffClass}">${diffSymbol}</span>` : ''}
                    </div>
                    <div class="flex-shrink-0 mx-4">
                        <div class="w-12 h-12 rounded-md shadow-md overflow-hidden spotify-image" id="image-${chartType}-${index}">
                            <div class="w-full h-full placeholder-art">
                                <i class="fas ${chartsConfig[chartType].icon} text-gray-400"></i>
                            </div>
                        </div>
                    </div>
                    <div class="flex-grow min-w-0 text-white">
                        <div class="flex items-center justify-between">
                            <div class="break-text w-full">
                                <div class="flex flex-wrap items-center gap-1">
                                    <p class="font-bold item-name break-text">${name}</p>
                                    ${weeksAt1Badge}
                                    ${newPeakBadge}
                                </div>
                                <p class="text-gray-400 text-sm mt-1">
                                    ${!chartType.includes('Artists') && chartType !== 'artists' ? 
                                        `<span class="artist-link" data-artist="${artist}">${artist}</span>` : 
                                        `<span class="artist-page-link" data-artist="${artist}">View Artist Page</span>`}
                                </p>
                                ${renderUnitsInfo(units, totalUnits, certification, weeksAt1, chartType)}
                            </div>
                        </div>
                        ${!isYearEnd && !isGoat ? `
                        <div class="flex items-center gap-4 mt-1 text-xs text-gray-400">
                            <span>LW: ${lastWeek === '0' || lastWeek?.toLowerCase() === 're' ? '-' : lastWeek}</span>
                            ${peak ? `<span>PK: ${peak}</span>` : ''}
                            ${weeks ? `<span>WOC: ${weeks}</span>` : ''}
                        </div>
                        ` : ''}
                        ${isGoat ? `
                        <div class="flex items-center gap-4 mt-1 text-xs text-gray-400">
                            ${peak ? `<span>Peak: #${peak}</span>` : ''}
                            ${weeks ? `<span>Weeks: ${weeks}</span>` : ''}
                        </div>
                        ` : ''}
                        ${isYearEnd ? `
                        <div class="flex items-center gap-4 mt-1 text-xs text-gray-400">
                            ${peak ? `<span>Peak: #${peak}</span>` : ''}
                            ${weeks ? `<span>Weeks: ${weeks}</span>` : ''}
                        </div>
                        ` : ''}
                        ${renderChartRunLink(chartRun, chartType, name, artist)}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function renderUnitsInfo(units, totalUnits, certification, weeksAt1, chartType) {
    let html = '';
    
    if (chartType === 'yearEndAlbums') {
        if (units && units !== '0') {
            html += `<span class="text-xs text-gray-400 mt-1 block">${units} units</span>`;
        }
    } else if (units && units !== '0') {
         html += `<span class="text-xs text-gray-400 mt-1 block">${units} units</span>`;
    }
    
    if (totalUnits) {
        html += `<span class="text-xs text-gray-400">${totalUnits} total</span>`;
    }
    
    if (certification) {
        html += `<span class="text-sm ml-2">${certification}</span>`;
    }
    
    return html ? `<div class="mt-1">${html}</div>` : '';
}

function renderChartRunLink(chartRun, chartType, name, artist) {
    if (!chartRun || chartRun.length === 0 || chartType.includes('yearEnd') || chartType.includes('goat')) return '';
    const key = `${name.toLowerCase().trim()}:${artist.toLowerCase().trim()}`;
    return `
        <div class="mt-2 text-xs font-semibold">
            <button class="text-accent hover:text-accent-dark transition-colors chart-run-link-btn" data-chart="${chartType}" data-key="${key.replace(/"/g, '')}">
                View Chart Run <i class="fas fa-arrow-right text-xs ml-1"></i>
            </button>
        </div>
    `;
}

function renderDropouts(chartType) {
    if (!appState.currentDate || !appState.chartData[chartType]) {
        return '';
    }
    
    const dates = Object.keys(appState.chartData[chartType]).sort();
    const currentIndex = dates.indexOf(appState.currentDate);
    
    if (currentIndex <= 0) {
        return '';
    }
    
    const previousDate = dates[currentIndex - 1];
    const currentItems = appState.chartData[chartType][appState.currentDate] || [];
    const previousItems = appState.chartData[chartType][previousDate] || [];
    
    const colMap = appState.colMaps[chartType];
    const currentPositions = new Set();
    
    // Coletar todos os itens da semana atual
    currentItems.forEach(row => {
        const name = chartType.includes('Songs') ? row[colMap.song] : 
                     chartType.includes('Albums') ? row[colMap.album] : 
                     row[colMap.artist];
        const artist = row[colMap.artist];
        const key = `${name}:${artist}`.toLowerCase();
        currentPositions.add(key);
    });
    
    // Encontrar itens da semana anterior que não estão na atual
    const dropouts = previousItems.filter(row => {
        const name = chartType.includes('Songs') ? row[colMap.song] : 
                     chartType.includes('Albums') ? row[colMap.album] : 
                     row[colMap.artist];
        const artist = row[colMap.artist];
        const key = `${name}:${artist}`.toLowerCase();
        return !currentPositions.has(key);
    });
    
    if (dropouts.length === 0) {
        return '';
    }
    
    // Ordenar por posição anterior
    dropouts.sort((a, b) => {
        const posA = parseInt(a[colMap.position]);
        const posB = parseInt(b[colMap.position]);
        return posA - posB;
    });
    
    const dropoutsHtml = dropouts.map(row => {
        const position = parseInt(row[colMap.position]) || 0;
        const artist = row[colMap.artist] || 'Unknown';
        const name = chartType.includes('Songs') ? row[colMap.song] : 
                     chartType.includes('Albums') ? row[colMap.album] : 
                     row[colMap.artist];
        const weeks = colMap.weeks !== -1 ? parseInt(row[colMap.weeks]) : null;
        const peak = colMap.peak !== -1 ? parseInt(row[colMap.peak]) : null;
        
        return `
            <div class="chart-row py-3 px-4 border-b border-gray-700 last:border-b-0 dropout-item">
                <div class="flex items-center">
                    <div class="flex-shrink-0 w-10 text-center">
                        <span class="text-lg font-bold text-gray-500">${position}</span>
                    </div>
                    <div class="flex-grow ml-4">
                        <p class="font-medium text-gray-400">${name}</p>
                        <p class="text-sm text-gray-500">${artist}</p>
                        <div class="flex items-center gap-4 mt-1 text-xs text-gray-500">
                            ${peak ? `<span>Peak: #${peak}</span>` : ''}
                            ${weeks ? `<span>Weeks: ${weeks}</span>` : ''}
                            <span class="text-red-400 font-semibold">DROPPED OUT</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    return `
        <div class="mt-8 pt-6 border-t border-gray-700">
            <h4 class="text-lg font-bold mb-4 text-gray-400">Dropouts from Previous Week</h4>
            <div class="bg-gray-800 rounded-lg border border-gray-700">
                ${dropoutsHtml}
            </div>
        </div>
    `;
}

function showChartRunModal(chartType, itemKey) {
    const chartRun = appState.chartRunData[chartType]?.[itemKey] || [];
    const [name, artist] = itemKey.split(':');

    if (chartRun.length === 0) {
        modalContent.innerHTML = '<p class="text-center text-gray-400">No chart run data available.</p>';
    } else {
        const listItems = chartRun.map(run => {
            const isPeak = run.position === run.peak;
            const isNumberOne = run.position === 1;

            let highlightClass = '';
            if (isNumberOne) {
                highlightClass = 'text-accent font-bold';
            } else if (isPeak) {
                highlightClass = 'text-green-500 font-semibold';
            }
            
            // Data como link para a semana específica
            return `
                <div class="flex justify-between items-center py-2 px-4 border-b border-gray-700">
                    <span class="font-medium text-white">
                        <button class="date-link" onclick="goToChartWeek('${chartType}', '${run.date}')">
                            Week of ${run.date}
                        </button>
                    </span>
                    <span class="text-sm font-semibold ${highlightClass}">#${run.position}</span>
                    ${isPeak && run.weeks > 1 ? `<span class="bg-yellow-400 text-black text-xs font-bold px-2 py-0.5 rounded-full ml-2">NEW PEAK</span>` : ''}
                </div>
            `;
        }).join('');

        modalContent.innerHTML = `
            <h3 class="text-2xl font-bold mb-4 text-white">${name} by ${artist} - Chart Run</h3>
            <div class="bg-gray-700 rounded-lg overflow-hidden">
                ${listItems}
            </div>
        `;
    }

    itemDetailsModal.classList.add('active');
}

function renderArtistPage(artistName) {
    appState.currentView = 'artist';
    appState.currentArtist = artistName;
    const artistData = appState.artistDetailsData[artistName];

    if (!artistData) {
        appContainer.innerHTML = `
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
        setupBackToTopButton();
        return;
    }

    const getChartSectionHtml = (chartName, chartData) => {
        if (!chartData || chartData.count === 0) return '';
        
        const isArtistChart = chartName === 'Top 50 Artists';
        const chartHeader = `
            <h3 class="text-xl font-bold mb-4 text-white section-title-artist">${chartName}</h3>
            <div class="bg-gray-700 rounded-lg p-4 mb-4">
                ${isArtistChart ? 
                    `<p class="text-sm text-gray-400">Peak <span class="font-semibold text-white">#${chartData.entries?.[0]?.peak}</span> / <span class="font-semibold text-white">${chartData.entries?.[0]?.weeks}</span> Weeks</p>` :
                    `<p class="text-sm text-gray-400"><span class="font-semibold text-white">${chartData.count}</span> Entries / <span class="font-semibold text-white">${chartData.numberOnes}</span> #1's / <span class="font-semibold text-white">${chartData.topTens}</span> Top 10's</p>`
                }
            </div>
        `;
        
        if (isArtistChart) return `<div class="mb-8">${chartHeader}</div>`;

        const chartEntriesHtml = chartData.entries.map(entry => {
            // Determinar qual chart mostrar baseado no tipo
            let chartToShow = 'songs';
            let dateToShow = entry.peakDate || entry.firstEntry;
            
            if (chartName.includes('Albums')) {
                chartToShow = 'albums';
            }
            
            const firstEntryLink = entry.firstEntry ? `
                <button class="date-badge" onclick="goToChartWeek('${chartToShow}', '${entry.firstEntry}')">
                    First: ${entry.firstEntry}
                </button>
            ` : '';
            
            const peakDateLink = entry.peakDate && entry.peakDate !== entry.firstEntry ? `
                <button class="date-badge" onclick="goToChartWeek('${chartToShow}', '${entry.peakDate}')">
                    Peak: ${entry.peakDate}
                </button>
            ` : '';
            
            const unitsBadge = entry.unitsSold && entry.unitsSold !== '0' ? `
                <span class="units-badge">${entry.unitsSold} units</span>
            ` : '';
            
            return `
                <div class="flex justify-between items-center py-2 px-4 border-b border-gray-700 last:border-b-0">
                    <div class="flex-grow min-w-0">
                        <span class="font-medium text-white truncate break-text">${entry.item}</span>
                        <div class="flex flex-wrap gap-1 mt-1">
                            ${firstEntryLink}
                            ${peakDateLink}
                            ${unitsBadge}
                        </div>
                    </div>
                    <div class="flex items-center space-x-4 text-sm text-gray-400 flex-shrink-0 ml-4">
                        <span>Peak <span class="font-semibold text-white">#${entry.peak}</span></span>
                        <span><span class="font-semibold text-white">${entry.weeks}</span> Weeks</span>
                    </div>
                </div>
            `;
        }).join('');

        return `
            <div class="mb-8">
                ${chartHeader}
                <div class="bg-gray-800 rounded-lg border border-gray-700 shadow-sm">
                    ${chartEntriesHtml}
                </div>
            </div>
        `;
    };

    const hot100Html = getChartSectionHtml('Hot 100 Songs', artistData['Hot 100 Songs']);
    const top100AlbumsHtml = getChartSectionHtml('Top 100 Albums', artistData['Top 100 Albums']);
    const top50ArtistsHtml = getChartSectionHtml('Top 50 Artists', artistData['Top 50 Artists']);

    appContainer.innerHTML = `
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
                ${top50ArtistsHtml}
                ${hot100Html}
                ${top100AlbumsHtml}
            </div>
        </div>
    `;
    
    document.getElementById('backButton').addEventListener('click', navigateBack);
    loadArtistImage(artistName);
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
    
    document.getElementById('backButton').addEventListener('click', function() {
        navigateBack();
    });
    
    document.getElementById('allSongsBtn').addEventListener('click', () => showAllEntriesList('songs'));
    document.getElementById('allArtistsBtn').addEventListener('click', showAllArtistsPage);
    document.getElementById('allAlbumsBtn').addEventListener('click', () => showAllEntriesList('albums'));
    
    setupBackToTopButton();
}

function showAllEntriesList(entryType) {
    appState.currentView = 'allEntriesList';
    appState.currentEntryType = entryType;
    
    const entries = appState.allEntries[entryType];
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
    
    document.getElementById('backButton').addEventListener('click', function() {
        showAllEntriesPage();
    });
    
    // Configurar o evento de busca corretamente
    const searchInput = document.getElementById('entriesSearch');
    searchInput.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase();
        const filteredEntries = entries.filter(entry => 
            entry.name.toLowerCase().includes(searchTerm) || 
            (entry.artist && entry.artist.toLowerCase().includes(searchTerm))
        );
        document.getElementById('entriesList').innerHTML = renderEntriesList(entryType, filteredEntries);
        
        // Reconfigurar os listeners de artist-link após atualizar a lista
        setTimeout(() => {
            document.querySelectorAll('.artist-link').forEach(link => {
                link.addEventListener('click', function() {
                    const artist = this.dataset.artist;
                    appState.navigationHistory.push({
                        view: 'allEntriesList',
                        entryType: entryType
                    });
                    renderArtistPage(artist);
                });
            });
        }, 10);
    });
    
    setupBackToTopButton();
}

function renderEntriesList(entryType, entries) {
    if (entries.length === 0) {
        return '<div class="text-center p-8 text-gray-400">No entries found</div>';
    }
    
    const sortedEntries = [...entries].sort((a, b) => a.name.localeCompare(b.name));
    
    return sortedEntries.map(entry => {
        return `
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
        `;
    }).join('');
}

function showAllArtistsPage() {
    appState.currentView = 'allArtists';
    
    appState.navigationHistory.push({
        view: 'allEntries'
    });
    
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
                ${renderArtistsList()}
            </div>
        </div>
    `;
    
    document.getElementById('backButton').addEventListener('click', function() {
        navigateBack();
    });
    
    // Configurar o evento de busca corretamente
    document.getElementById('artistsSearch').addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase();
        const filteredArtists = Object.keys(appState.artistDetailsData).filter(artist => 
            artist.toLowerCase().includes(searchTerm)
        );
        document.getElementById('artistsList').innerHTML = renderArtistsList(filteredArtists);
        
        // Reconfigurar os listeners após atualizar a lista
        setTimeout(() => {
            document.querySelectorAll('#artistsList .chart-row').forEach(row => {
                row.addEventListener('click', function() {
                    const artist = this.dataset.artist;
                    appState.navigationHistory.push({
                        view: 'allArtists'
                    });
                    renderArtistPage(artist);
                });
            });
        }, 10);
    });

    // Configurar os listeners iniciais
    setTimeout(() => {
        document.querySelectorAll('#artistsList .chart-row').forEach(row => {
            row.addEventListener('click', function() {
                const artist = this.dataset.artist;
                appState.navigationHistory.push({
                    view: 'allArtists'
                });
                renderArtistPage(artist);
            });
        });
    }, 100);
    
    setupBackToTopButton();
}

function renderArtistsList(artists = null) {
    const artistsData = artists || Object.keys(appState.artistDetailsData);
    
    if (artistsData.length === 0) {
        return '<div class="text-center p-8 text-gray-400">No artists found</div>';
    }
    
    const sortedArtists = [...artistsData].sort((a, b) => a.localeCompare(b));
    
    return sortedArtists.map(artist => {
        const stats = appState.artistDetailsData[artist];
        const totalSongs = stats['Hot 100 Songs']?.count || 0;
        const totalAlbums = stats['Top 100 Albums']?.count || 0;
        const numberOneHits = (stats['Hot 100 Songs']?.numberOnes || 0) + (stats['Top 100 Albums']?.numberOnes || 0);

        return `
            <div class="chart-row py-4 px-4 cursor-pointer" data-artist="${artist}">
                <div class="flex items-center">
                    <div class="flex-grow min-w-0 text-white">
                        <p class="font-bold truncate break-text">${artist}</p>
                        <div class="flex items-center gap-4 mt-1 text-xs text-gray-400">
                            <span>Songs: ${totalSongs}</span>
                            <span>Albums: ${totalAlbums}</span>
                            <span>#1 Hits: ${numberOneHits}</span>
                        </div>
                    </div>
                    <div class="flex-shrink-0">
                        <i class="fas fa-chevron-right text-gray-400"></i>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function renderChartBeatPage() {
    appState.currentView = 'chartBeat';
    
    const hot100Articles = appState.chartBeatData.hot100 || [];
    const top100Articles = appState.chartBeatData.top100Albums || [];
    
    const featuredHot100 = hot100Articles?.[0];
    const featuredTop100 = top100Articles?.[0];
    
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
                <button class="chart-beat-nav-btn px-4 py-2 font-medium ${appState.currentBlog === 'hot100' ? 'text-accent border-b-2 border-accent' : 'text-gray-400'}" data-blog="hot100">
                    Hot 100 Songs
                </button>
                <button class="chart-beat-nav-btn px-4 py-2 font-medium ${appState.currentBlog === 'top100Albums' ? 'text-accent border-b-2 border-accent' : 'text-gray-400'}" data-blog="top100Albums">
                    Top 100 Albums
                </button>
            </div>
            
            <div class="mb-12">
                <h3 class="text-xl font-bold mb-6 section-title text-white">Featured Articles</h3>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
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
            
            <div>
                <h3 class="text-xl font-bold mb-6 section-title text-white">All Articles</h3>
                <div class="space-y-6">
                    ${(appState.chartBeatData[appState.currentBlog] || []).length > 0 ? (appState.chartBeatData[appState.currentBlog] || []).map((article, index) => `
                        <div class="blog-card-animated blog-card bg-gray-800 rounded-lg border border-gray-700 p-4 shadow-sm">
                            <div class="flex flex-col md:flex-row">
                                <div class="md:w-1/4 mb-4 md:mb-0">
                                    ${article.imageUrl ? `
                                        <img src="${article.imageUrl}" alt="${article.artist}" class="w-full h-32 object-cover rounded article-image">
                                    ` : `
                                        <div class="w-full h-32 placeholder-art rounded">
                                            <i class="fas fa-newspaper text-xl text-gray-400"></i>
                                        </div>
                                    `}
                                </div>
                                <div class="md:w-3/4 md:pl-6">
                                    <span class="text-xs text-accent font-semibold">${article.publicationDate}</span>
                                    <h4 class="font-bold text-lg mt-1 mb-2 text-white break-text">${article.title}</h4>
                                    <p class="text-gray-400 text-sm">${article.fullText.substring(0, 200)}...</p>
                                    <button class="read-more-btn mt-3 text-accent text-sm font-semibold" data-article-index="${index}">
                                        Read More <i class="fas fa-arrow-right ml-1 text-xs"></i>
                                    </button>
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
        </div>
    `;
    
    setupChartBeatListeners();
    setupBackToTopButton();
}

function renderArticleModal(articleIndex) {
    const articles = appState.chartBeatData[appState.currentBlog] || [];
    const article = articles?.[articleIndex];
    
    if (!article) return;
    
    const chartLinkHtml = article.chartLink ? `
        <div class="mt-8 text-center">
            <button class="px-4 py-2 bg-accent text-white rounded-md hover:bg-accent-dark transition-colors" onclick="showChartPage('${article.chartLink}', '${article.publicationDate}')">
                See the full chart here <i class="fas fa-arrow-right ml-2"></i>
            </button>
        </div>
    ` : '';
    
    modalContent.innerHTML = `
        <div class="max-h-screen overflow-y-auto">
            <div class="mb-6">
                ${article.imageUrl ? `
                    <img src="${article.imageUrl}" alt="${article.artist}" class="w-full h-64 object-cover rounded-lg mb-4">
                ` : `
                    <div class="w-full h-64 placeholder-art rounded-lg mb-4 flex items-center justify-center">
                        <i class="fas fa-newspaper text-4xl text-gray-400"></i>
                    </div>
                `}
                <span class="text-sm text-accent font-semibold">${article.publicationDate}</span>
                <h3 class="text-2xl font-bold mt-1 mb-3 text-white break-text">${article.title}</h3>
                <div class="prose max-w-none">
                    <p class="text-gray-300 whitespace-pre-line">${article.fullText}</p>
                </div>
                ${chartLinkHtml}
            </div>
        </div>
    `;
    
    itemDetailsModal.classList.add('active');
}
