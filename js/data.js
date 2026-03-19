// MODIFICAR fetchAndProcessChartData para usar cache

async function fetchAndProcessChartData(chartType) {
    if (chartsConfig?.[chartType]?.loaded) return true;
    
    // Tentar carregar do cache primeiro
    const cachedData = await DataCache.loadProcessedData(`chart_${chartType}`);
    if (cachedData) {
        console.log(`Carregando ${chartType} do cache`);
        restoreFromCache(chartType, cachedData);
        chartsConfig[chartType].loaded = true;
        return true;
    }
    
    console.log(`Carregando ${chartType} da rede...`);
    
    const config = chartsConfig?.[chartType];
    const url = `${config.url}&_=${new Date().getTime()}`;
    
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Could not access spreadsheet for ${config.title}.`);
        }
        
        let csvText = await response.text();
        if (csvText.charCodeAt(0) === 0xFEFF) {
            csvText = csvText.substring(1);
        }

        const rows = csvText.trim().split('\n').map(row => parseCsvRow(row));
        if (rows.length < 2) {
            throw new Error(`Spreadsheet for ${config.title} doesn't have enough data.`);
        }
        
        const header = rows?.[0]?.map(h => h.toLowerCase().trim());
        const data = rows.slice(1);
        
        // Processar dados
        const processedData = await processChartData(chartType, header, data);
        
        // Salvar no cache
        await DataCache.saveProcessedData(`chart_${chartType}`, processedData);
        
        // Restaurar no appState
        restoreFromCache(chartType, processedData);
        
        chartsConfig[chartType].loaded = true;
        return true;
    } catch (error) {
        console.error(`Error processing ${chartType} data:`, error);
        return false;
    }
}

// NOVA FUNÇÃO: Processar dados de forma estruturada
async function processChartData(chartType, header, data) {
    const findIndex = (keys) => {
        for (const key of keys) {
            const index = header.indexOf(key);
            if (index !== -1) return index;
        }
        return -1;
    };

    const colMap = {
        date: findIndex(['date', 'chart date']),
        position: findIndex(['position', 'rank', 'pos']),
        diff: findIndex(['dif', 'diff', '▲▼']),
        song: findIndex(['song', 'title', 'track']),
        album: findIndex(['album']),
        artist: findIndex(['artist', 'artists']),
        lastWeek: findIndex(['last week', 'lw']),
        peak: findIndex(['peak']),
        weeks: findIndex(['weeks', 'wks']),
        weeksAt1: findIndex(['weeks at 1', 'wks at 1']),
        units: findIndex(['units']),
        totalUnits: findIndex(['total units']),
        certification: findIndex(['certification']),
        year: findIndex(['year', 'ano']),
        chart: findIndex(['chart']),
        item: findIndex(['item']),
        record: findIndex(['record']),
        firstEntry: findIndex(['first entry', 'first', 'debut']),
        peakDate: findIndex(['peak date', 'peakdate', 'date peak']),
        unitsSold: findIndex(['units sold', 'sales', 'total sales'])
    };
    
    return {
        colMap,
        data,
        header
    };
}

// NOVA FUNÇÃO: Restaurar dados do cache
function restoreFromCache(chartType, cachedData) {
    appState.colMaps[chartType] = cachedData.colMap;
    
    if (chartType === 'artistStats') {
        processArtistStats(cachedData.data);
    } else if (chartType.includes('yearEnd')) {
        processYearEndData(chartType, cachedData.data, cachedData.colMap);
    } else if (chartType.includes('goat')) {
        processGoatData(chartType, cachedData.data, cachedData.colMap);
    } else {
        processWeeklyData(chartType, cachedData.data, cachedData.colMap);
    }
}

// Funções separadas para cada tipo de processamento
function processArtistStats(data) {
    appState.artistDetailsData = {};
    data.forEach(row => {
        const artistName = row[appState.colMaps.artistStats.artist];
        if (!artistName) return;
        // ... resto do processamento
    });
}

function processYearEndData(chartType, data, colMap) {
    const dataByYear = {};
    data.forEach(row => {
        const year = row[colMap.year];
        if (!year) return;
        if (!dataByYear[year]) dataByYear[year] = [];
        dataByYear[year].push(row);
    });
    appState.chartData[chartType] = dataByYear;
    
    // Processar top3
    const years = Object.keys(dataByYear).sort((a, b) => b - a);
    const mostRecentYear = years?.[0];
    if (mostRecentYear && dataByYear[mostRecentYear]) {
        appState.top3Data[chartType] = dataByYear[mostRecentYear]
            .slice(0, 3)
            .map(row => ({
                position: row[colMap.position] || 0,
                artist: row[colMap.artist] || 'Unknown',
                name: chartType === 'yearEndSongs' ? row[colMap.song] : 
                      chartType === 'yearEndAlbums' ? row[colMap.album] : 
                      row[colMap.artist] || 'Unknown',
                year: mostRecentYear
            }));
    }
}

function processGoatData(chartType, data, colMap) {
    appState.chartData[chartType] = data;
    appState.top3Data[chartType] = data.slice(0, 3).map(row => ({
        position: row[colMap.position] || 0,
        artist: row[colMap.artist] || 'Unknown',
        name: chartType.includes('Songs') ? row[colMap.song] : 
              chartType.includes('Albums') ? row[colMap.album] : 
              row[colMap.artist] || 'Unknown',
        year: row[colMap.year] || 'N/A'
    }));
}

function processWeeklyData(chartType, data, colMap) {
    const dateGroups = {};
    data.forEach(row => {
        const date = row[colMap.date];
        if (!date) return;
        if (!dateGroups[date]) dateGroups[date] = [];
        dateGroups[date].push(row);
    });
    
    const sortedDates = Object.keys(dateGroups).sort((a, b) => new Date(a) - new Date(b));
    sortedDates.forEach(date => {
        appState.chartData[chartType][date] = dateGroups[date];
    });
    
    // Processar top3
    const dates = Object.keys(appState.chartData[chartType]);
    if (dates.length > 0) {
        const mostRecentDate = dates[dates.length - 1];
        const recentData = appState.chartData[chartType][mostRecentDate];
        if (recentData) {
            appState.top3Data[chartType] = recentData
                .sort((a, b) => parseInt(a[colMap.position]) - parseInt(b[colMap.position]))
                .slice(0, 3)
                .map(row => ({
                    position: row[colMap.position] || 0,
                    artist: row[colMap.artist] || 'Unknown',
                    name: chartType === 'songs' ? row[colMap.song] : 
                          chartType === 'albums' ? row[colMap.album] : 
                          row[colMap.artist] || 'Unknown'
                }));
        }
    }
    
    // Processar chart run data
    appState.chartRunData[chartType] = {};
    data.forEach(row => {
        const date = row[colMap.date];
        if (!date) return;
        const name = row[colMap.song] || row[colMap.album] || row[colMap.artist];
        const artist = row[colMap.artist] || 'Unknown';
        const key = `${name.toLowerCase()}:${artist.toLowerCase()}`;
        
        if (!appState.chartRunData[chartType][key]) {
            appState.chartRunData[chartType][key] = [];
        }
        
        appState.chartRunData[chartType][key].push({
            date: date,
            position: parseInt(row[colMap.position]),
            peak: parseInt(row[colMap.peak]),
            weeks: parseInt(row[colMap.weeks]),
            name: name,
            artist: artist
        });
    });
}
