// MODIFICAR getSpotifyImage
async function getSpotifyImage(query, type, priority = 'normal') {
    const correctedQuery = applyArtistCorrections(query, type);
    const cacheKey = `${type}:${correctedQuery}`.toLowerCase();
    
    // Verificar cache em memória
    if (imageCache[cacheKey]) {
        return imageCache[cacheKey];
    }
    
    // Verificar IndexedDB
    const cachedImage = await DataCache.loadSpotifyImage(cacheKey);
    if (cachedImage) {
        imageCache[cacheKey] = cachedImage;
        return cachedImage;
    }
    
    // Se não tiver cache, adicionar à fila
    return new Promise((resolve) => {
        spotifyRequestQueue.push({
            query: correctedQuery,
            type,
            cacheKey,
            priority,
            resolve
        });
        
        if (!isProcessingQueue) {
            processSpotifyQueue();
        }
    });
}

// MODIFICAR fetchSpotifyImage para salvar no cache
async function fetchSpotifyImage(query, type) {
    const token = await getSpotifyAccessToken();
    if (!token) return null;
    
    try {
        const searchType = type === 'artist' ? 'artist' : 'album';
        const response = await fetch(
            `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=${searchType}&limit=1`,
            {
                headers: { 'Authorization': `Bearer ${token}` }
            }
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
            // Salvar no cache
            await DataCache.saveSpotifyImage(cacheKey, imageUrl);
        }
        
        return imageUrl;
    } catch (error) {
        console.error('Error fetching Spotify image:', error);
        return null;
    }
}
