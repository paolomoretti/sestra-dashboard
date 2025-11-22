// Service Worker for Sestra Dashboard
// Use timestamp-based cache name for better invalidation
const CACHE_VERSION = 'v1';
const CACHE_NAME = `sestra-dashboard-${CACHE_VERSION}`;
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

  // Use network-first strategy for HTML files (better for development)
  // Cache-first for static assets (images, icons, etc.)
  const isHTMLRequest = event.request.headers.get('accept')?.includes('text/html') || 
                        event.request.mode === 'navigate';
  
  if (isHTMLRequest) {
    // Network-first for HTML: try network first, fallback to cache
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // If network succeeds, update cache and return response
          if (response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache).catch((err) => {
                console.debug('Cache put failed (non-critical):', err);
              });
            });
          }
          return response;
        })
        .catch(() => {
          // Network failed, try cache
          return caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // If both fail, return offline page for navigation requests
            if (event.request.mode === 'navigate') {
              return caches.match('/index.html');
            }
          });
        })
    );
  } else {
    // Cache-first for static assets (images, CSS, JS, etc.)
    event.respondWith(
      caches.match(event.request)
        .then((response) => {
          // Return cached version if available
          if (response) {
            return response;
          }
          
          // Fetch from network and cache for future use
          return fetch(event.request).then((response) => {
            // Only cache successful GET requests
            if (response.status === 200 && event.request.method === 'GET' &&
                !event.request.url.startsWith('chrome-extension://') &&
                !event.request.url.startsWith('moz-extension://') &&
                !event.request.url.startsWith('safari-extension://')) {
              try {
                const responseToCache = response.clone();
                caches.open(CACHE_NAME).then((cache) => {
                  cache.put(event.request, responseToCache).catch((err) => {
                    console.debug('Cache put failed (non-critical):', err);
                  });
                });
              } catch (err) {
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
  }
});

