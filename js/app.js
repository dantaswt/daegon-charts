async function initializeApp() {
    showMessage('loading', 'Loading charts data...');
    
    try {
        // 1️⃣ PRIMEIRO: Carregar apenas o ESSENCIAL para a página inicial
        console.log('Carregando dados essenciais...');
        
        // Carregar apenas os TOP 3 de cada chart (dados leves)
        await Promise.all([
            fetchTop3Data('songs'),
            fetchTop3Data('artists'),
            fetchTop3Data('albums'),
            fetchTop3Data('yearEndSongs'),
            fetchTop3Data('yearEndArtists'),
            fetchTop3Data('yearEndAlbums'),
            fetchTop3Data('goatSongs'),
            fetchTop3Data('goatArtists'),
            fetchTop3Data('goatAlbums'),
            fetchChartBeatPreview() // Apenas últimos 3 artigos
        ]);
        
        // Renderizar a página imediatamente (2-3 segundos mais rápido!)
        renderHomePage();
        
        // 2️⃣ DEPOIS: Carregar o restante dos dados em BACKGROUND
        console.log('Carregando dados completos em background...');
        
        // Carregar sem bloquear a interface
        setTimeout(() => {
            loadFullDataInBackground();
        }, 100);
        
        setupBackToTopButton();
        
    } catch (error) {
        showMessage('error', 'Error loading data: ' + error.message);
    }
}

// NOVA FUNÇÃO: Carregar apenas TOP 3
async function fetchTop3Data(chartType) {
    try {
        const config = chartsConfig[chartType];
        const url = `${config.url}&_=${new Date().getTime()}`;
        
        const response = await fetch(url);
        if (!response.ok) return;
        
        let csvText = await response.text();
        if (csvText.charCodeAt(0) === 0xFEFF) {
            csvText = csvText.substring(1);
        }

        const rows = csvText.trim().split('\n').map(row => parseCsvRow(row));
        if (rows.length < 2) return;
        
        const header = rows[0].map(h => h.toLowerCase().trim());
        const data = rows.slice(1);
        
        // Processar apenas para pegar os TOP 3
        if (chartType.includes('yearEnd')) {
            const yearIndex = header.indexOf('year');
            if (yearIndex === -1) return;
            
            const dataByYear = {};
            data.forEach(row => {
                const year = row[yearIndex];
                if (!year) return;
                if (!dataByYear[year]) dataByYear[year] = [];
                dataByYear[year].push(row);
            });
            
            const years = Object.keys(dataByYear).sort((a, b) => b - a);
            const mostRecentYear = years[0];
            
            if (mostRecentYear && dataByYear[mostRecentYear]) {
                const positionIndex = header.indexOf('position');
                const artistIndex = header.indexOf('artist');
                const songIndex = header.indexOf('song');
                const albumIndex = header.indexOf('album');
                
                appState.top3Data[chartType] = dataByYear[mostRecentYear]
                    .slice(0, 3)
                    .map(row => ({
                        position: row[positionIndex] || 0,
                        artist: row[artistIndex] || 'Unknown',
                        name: chartType === 'yearEndSongs' ? row[songIndex] : 
                              chartType === 'yearEndAlbums' ? row[albumIndex] : 
                              row[artistIndex] || 'Unknown',
                        year: mostRecentYear
                    }));
            }
        } else {
            // Para charts normais, pegar a data mais recente
            const dateIndex = header.indexOf('date');
            if (dateIndex === -1) return;
            
            // Agrupar por data
            const dateGroups = {};
            data.forEach(row => {
                const date = row[dateIndex];
                if (!date) return;
                if (!dateGroups[date]) dateGroups[date] = [];
                dateGroups[date].push(row);
            });
            
            const sortedDates = Object.keys(dateGroups).sort((a, b) => new Date(b) - new Date(a));
            const mostRecentDate = sortedDates[0];
            
            if (mostRecentDate && dateGroups[mostRecentDate]) {
                const positionIndex = header.indexOf('position');
                const artistIndex = header.indexOf('artist');
                const songIndex = header.indexOf('song');
                const albumIndex = header.indexOf('album');
                
                appState.top3Data[chartType] = dateGroups[mostRecentDate]
                    .sort((a, b) => parseInt(a[positionIndex]) - parseInt(b[positionIndex]))
                    .slice(0, 3)
                    .map(row => ({
                        position: row[positionIndex] || 0,
                        artist: row[artistIndex] || 'Unknown',
                        name: chartType === 'songs' ? row[songIndex] : 
                              chartType === 'albums' ? row[albumIndex] : 
                              row[artistIndex] || 'Unknown'
                    }));
            }
        }
        
        // Guardar URL para carregamento posterior
        if (!appState.pendingCharts) appState.pendingCharts = {};
        appState.pendingCharts[chartType] = url;
        
    } catch (error) {
        console.error(`Error fetching top3 for ${chartType}:`, error);
    }
}

// NOVA FUNÇÃO: Carregar preview do Chart Beat
async function fetchChartBeatPreview() {
    try {
        // Carregar apenas o primeiro artigo de cada blog
        for (const [key, config] of Object.entries(chartBeatConfig)) {
            const response = await fetch(config.url);
            if (!response.ok) continue;
            
            let csvText = await response.text();
            if (csvText.charCodeAt(0) === 0xFEFF) {
                csvText = csvText.substring(1);
            }

            const rows = csvText.trim().split('\n').map(row => parseCsvRow(row));
            if (rows.length < 2) continue;
            
            const header = rows[0].map(h => h.toLowerCase().trim());
            const data = rows.slice(1).reverse(); // Mais recentes primeiro
            
            // Processar apenas o primeiro artigo
            if (data.length > 0) {
                const row = data[0];
                
                const findIndex = (keys) => {
                    for (const k of keys) {
                        const index = header.indexOf(k);
                        if (index !== -1) return index;
                    }
                    return -1;
                };

                const dateIndex = findIndex(config.colMap.date);
                const titleIndex = findIndex(config.colMap.title);
                const textIndex = findIndex(config.colMap.text);
                const artistIndex = findIndex(config.colMap.artist);
                
                const article = {
                    title: row[titleIndex] || 'NO TITLE',
                    publicationDate: row[dateIndex] || 'NO DATE',
                    artist: row[artistIndex] || null,
                    fullText: row[textIndex] || 'No content available.',
                    imageUrl: null
                };
                
                // Tentar carregar imagem do artista
                if (article.artist) {
                    getSpotifyImage(article.artist, 'artist').then(url => {
                        article.imageUrl = url;
                    }).catch(() => {});
                }
                
                if (!appState.chartBeatData) appState.chartBeatData = {};
                appState.chartBeatData[key] = [article];
            }
        }
    } catch (error) {
        console.error('Error fetching chart beat preview:', error);
    }
}

// NOVA FUNÇÃO: Carregar dados completos em background
async function loadFullDataInBackground() {
    try {
        // Carregar charts principais primeiro (mais importantes)
        await Promise.allSettled([
            fetchAndProcessChartData('songs'),
            fetchAndProcessChartData('artists'),
            fetchAndProcessChartData('albums')
        ]);
        
        // Depois carregar o resto
        setTimeout(() => {
            Promise.allSettled([
                fetchAndProcessChartData('yearEndSongs'),
                fetchAndProcessChartData('yearEndArtists'),
                fetchAndProcessChartData('yearEndAlbums'),
                fetchAndProcessChartData('goatSongs'),
                fetchAndProcessChartData('goatArtists'),
                fetchAndProcessChartData('goatAlbums'),
                fetchAndProcessChartData('artistStats'),
                fetchAndProcessChartBeatData() // Carregar todos os artigos
            ]);
        }, 1000);
        
    } catch (error) {
        console.error('Background loading error:', error);
    }
}
