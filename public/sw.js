// Service Worker for Sestra Dashboard
const CACHE_NAME = 'sestra-dashboard-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

// Install event - cache resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        // Cache basic resources, but don't fail if some are missing
        return Promise.allSettled(
          urlsToCache.map(url => 
            cache.add(url).catch(err => {
              console.warn(`Failed to cache ${url}:`, err);
            })
          )
        );
      })
  );
  // Force the waiting service worker to become the active service worker
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // Take control of all pages immediately
  return self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  // Skip caching for API requests (they should always be fresh)
  if (event.request.url.includes('/api/')) {
    return;
  }

  // Skip caching for WebSocket connections
  if (event.request.url.startsWith('ws://') || event.request.url.startsWith('wss://')) {
    return;
  }

  // Skip caching for chrome-extension:// and other unsupported schemes
  if (event.request.url.startsWith('chrome-extension://') || 
      event.request.url.startsWith('moz-extension://') ||
      event.request.url.startsWith('safari-extension://')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        if (response) {
          return response;
        }
        
        // Fetch from network and cache for future use (for static assets)
        return fetch(event.request).then((response) => {
          // Only cache successful GET requests
          // Skip caching if the request URL has an unsupported scheme
          if (response.status === 200 && event.request.method === 'GET' &&
              !event.request.url.startsWith('chrome-extension://') &&
              !event.request.url.startsWith('moz-extension://') &&
              !event.request.url.startsWith('safari-extension://')) {
            try {
              const responseToCache = response.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, responseToCache).catch((err) => {
                  // Silently ignore cache errors (e.g., for unsupported schemes)
                  console.debug('Cache put failed (non-critical):', err);
                });
              });
            } catch (err) {
              // Silently ignore cache errors
              console.debug('Cache error (non-critical):', err);
            }
          }
          return response;
        });
      })
      .catch(() => {
        // If both cache and network fail, return offline page for navigation requests
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      })
  );
});

