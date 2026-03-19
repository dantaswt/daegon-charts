// cache-manager.js
const DataCache = {
    // Cache em memória para acesso rápido
    memoryCache: new Map(),
    
    // Cache no IndexedDB para dados grandes
    async initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('DaegonChartsDB', 1);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Store para dados das planilhas
                if (!db.objectStoreNames.contains('spreadsheetData')) {
                    const store = db.createObjectStore('spreadsheetData', { keyPath: 'id' });
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                }
                
                // Store para imagens Spotify
                if (!db.objectStoreNames.contains('spotifyImages')) {
                    db.createObjectStore('spotifyImages', { keyPath: 'id' });
                }
                
                // Store para dados processados
                if (!db.objectStoreNames.contains('processedData')) {
                    db.createObjectStore('processedData', { keyPath: 'id' });
                }
            };
        });
    },
    
    // Salvar dados da planilha
    async saveSpreadsheetData(id, data) {
        const db = await this.initDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['spreadsheetData'], 'readwrite');
            const store = transaction.objectStore('spreadsheetData');
            
            const record = {
                id: id,
                data: data,
                timestamp: Date.now()
            };
            
            const request = store.put(record);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    },
    
    // Carregar dados da planilha (com validade de 1 hora)
    async loadSpreadsheetData(id) {
        const db = await this.initDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['spreadsheetData'], 'readonly');
            const store = transaction.objectStore('spreadsheetData');
            
            const request = store.get(id);
            request.onsuccess = () => {
                const record = request.result;
                if (record && (Date.now() - record.timestamp) < 3600000) { // 1 hora
                    resolve(record.data);
                } else {
                    resolve(null); // Expirado ou não encontrado
                }
            };
            request.onerror = () => reject(request.error);
        });
    },
    
    // Salvar imagem Spotify
    async saveSpotifyImage(id, imageUrl) {
        const db = await this.initDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['spotifyImages'], 'readwrite');
            const store = transaction.objectStore('spotifyImages');
            
            const request = store.put({ id: id, url: imageUrl });
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    },
    
    // Carregar imagem Spotify
    async loadSpotifyImage(id) {
        const db = await this.initDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['spotifyImages'], 'readonly');
            const store = transaction.objectStore('spotifyImages');
            
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result?.url);
            request.onerror = () => reject(request.error);
        });
    },
    
    // Salvar dados processados
    async saveProcessedData(id, data) {
        const db = await this.initDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['processedData'], 'readwrite');
            const store = transaction.objectStore('processedData');
            
            const request = store.put({ id: id, data: data });
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    },
    
    // Carregar dados processados
    async loadProcessedData(id) {
        const db = await this.initDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['processedData'], 'readonly');
            const store = transaction.objectStore('processedData');
            
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result?.data);
            request.onerror = () => reject(request.error);
        });
    }
};

// Expor globalmente
window.DataCache = DataCache;
