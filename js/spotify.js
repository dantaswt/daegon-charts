// --- SPOTIFY FUNCTIONS ---
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
        
        if (!response.ok) {
            throw new Error('Failed to get Spotify token');
        }
        
        const data = await response.json();
        SPOTIFY_ACCESS_TOKEN = data.access_token;
        return SPOTIFY_ACCESS_TOKEN;
    } catch (error) {
        console.error('Error getting Spotify token:', error);
        return null;
    }
}

async function getSpotifyImage(query, type) {
    // Aplicar correções específicas para artistas
    let correctedQuery = query;
    if (type === 'artist') {
        // Verificar se há correção específica para este artista
        for (const [wrongName, correctName] of Object.entries(artistImageCorrections)) {
            if (query.toLowerCase().includes(wrongName.toLowerCase())) {
                correctedQuery = correctName;
                break;
            }
        }
    }
    
    const cacheKey = `${type}:${correctedQuery}`.toLowerCase();
    
    // Verificar se já está em cache
    if (imageCache[cacheKey]) {
        return imageCache[cacheKey];
    }
    
    // Verificar se já há uma requisição pendente para esta imagem
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
    
    // Marcar como requisição pendente
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
            {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            }
        );
        
        if (!response.ok) {
            throw new Error('Spotify search failed');
        }
        
        const data = await response.json();
        let imageUrl = null;
        
        if (type === 'artist' && data.artists && data.artists.items.length > 0) {
            imageUrl = data.artists.items?.[0]?.images?.[0]?.url || null;
        } else if (type !== 'artist' && data.albums && data.albums.items.length > 0) {
            imageUrl = data.albums.items?.[0]?.images?.[0]?.url || null;
        }
        
        if (imageUrl) {
            imageCache[cacheKey] = imageUrl;
            
            // Pré-carregar a imagem
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
    
    let items = [];
    const isYearEnd = chartType.includes('yearEnd');
    const isGoat = chartType.includes('goat');

    if (isYearEnd) {
        const yearsData = appState.chartData[chartType];
        if (!yearsData) return;
        
        const yearData = yearsData[appState.currentYear];
        if (!yearData) return;
        items = yearData;
    } else if (isGoat) {
        items = appState.chartData[chartType];
    } else {
        if (!appState.currentDate || !appState.chartData[chartType][appState.currentDate]) {
            return;
        }
        items = appState.chartData[chartType][appState.currentDate];
    }
    
    for (let i = 0; i < items.length; i++) {
        const row = items[i];
        const artist = row[colMap.artist] || 'Unknown';
        
        let query = '';
        let type = '';
        
        if (chartType.includes('Songs') || chartType === 'songs') {
            // Para músicas, usar imagem do ARTISTA
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
        
        let query = '';
        let type = '';
        
        if (chartType === 'songs') {
            // Para songs, buscar imagem do ARTISTA
            query = topItem.artist;
            type = 'artist';
        } else if (chartType === 'albums') {
            const album = topItem.name.includes('(') ? topItem.name.substring(0, topItem.name.indexOf('(')).trim() : topItem.name;
            query = `${topItem.artist} ${album}`;
            type = 'album';
        } else {
            query = topItem.name;
            type = 'artist';
        }
        
        if (query && query !== 'Unknown') {
            const imageUrl = await getSpotifyImage(query, type);
            const imageElement = document.getElementById(`circle-image-${chartType}`);
            
            if (imageElement && imageUrl) {
                imageElement.innerHTML = `<img src="${imageUrl}" alt="${query}" class="w-full h-full object-cover">`;
                imageElement.classList.remove('placeholder-art');
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
                    if (imageUrl) {
                        article.imageUrl = imageUrl;
                    }
                } catch (error) {
                    console.error('Error loading blog image:', error);
                }
            }
        }
    }
}
