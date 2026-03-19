// sw.js - Service Worker para cache offline
const CACHE_NAME = 'daegon-charts-v1';
const API_CACHE = 'api-cache-v1';

// URLs para cachear
const urlsToCache = [
    '/',
    '/css/styles.css',
    '/js/config.js',
    '/js/utils.js',
    'https://cdn.tailwindcss.com',
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css'
];

// Instalação
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
    );
});

// Interceptar requisições
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    
    // Cachear requisições para o Google Sheets
    if (url.href.includes('docs.google.com/spreadsheets')) {
        event.respondWith(
            caches.open(API_CACHE).then(async cache => {
                // Tentar pegar do cache primeiro
                const cachedResponse = await cache.match(event.request);
                if (cachedResponse) {
                    // Atualizar cache em background
                    fetch(event.request).then(networkResponse => {
                        cache.put(event.request, networkResponse.clone());
                    });
                    return cachedResponse;
                }
                
                // Se não tiver cache, buscar da rede
                const networkResponse = await fetch(event.request);
                cache.put(event.request, networkResponse.clone());
                return networkResponse;
            })
        );
        return;
    }
    
    // Para outros recursos, usar estratégia network-first
    event.respondWith(
        fetch(event.request)
            .catch(() => caches.match(event.request))
    );
});

// Limpar caches antigos
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME && cacheName !== API_CACHE) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});
