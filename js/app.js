// MODIFIQUE a função getSpotifyImage no seu spotify.js
// Adicione este código NO INÍCIO da função:

async function getSpotifyImage(query, type) {
    const correctedQuery = applyArtistCorrections(query, type);
    const cacheKey = `${type}:${correctedQuery}`.toLowerCase();
    
    // TENTAR CARREGAR DO CACHE PRIMEIRO
    const cachedImage = loadImageFromCache(cacheKey);
    if (cachedImage) {
        return cachedImage;
    }
    
    // Verificar se já está em cache
    if (imageCache[cacheKey]) {
        return imageCache[cacheKey];
    }
    
    // Verificar se já há uma requisição pendente
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
            // SALVAR NO CACHE
            saveImageToCache(cacheKey, imageUrl);
            
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
