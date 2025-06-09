/**
 * Service Worker for PDF Hub Pro
 * Implements caching strategies and offline functionality
 */

const CACHE_NAME = 'pdfhub-v2';
const OFFLINE_PAGE = '/offline.html';

// Cacheable assets
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/assets/css/main.css',
  '/assets/js/app.js',
  '/assets/images/logo.png',
  '/assets/images/offline.svg'
];

// Install event - Pre-cache essential assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('ServiceWorker: Caching core assets');
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('ServiceWorker: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
    .then(() => self.clients.claim())
  );
});

// Fetch event - Custom caching strategy
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Skip non-GET requests and Chrome extensions
  if (request.method !== 'GET' || url.protocol === 'chrome-extension:') {
    return;
  }

  // Network first for API calls
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful API responses
          const responseClone = response.clone();
          caches.open(CACHE_NAME)
            .then((cache) => cache.put(request, responseClone));
          return response;
        })
        .catch(() => {
          // Fallback to cached API response if available
          return caches.match(request);
        })
    );
    return;
  }

  // Cache first with network fallback for static assets
  if (PRECACHE_ASSETS.includes(url.pathname)) {
    event.respondWith(
      caches.match(request)
        .then((cachedResponse) => {
          return cachedResponse || fetch(request)
            .then((response) => {
              // Cache new static assets
              const responseClone = response.clone();
              caches.open(CACHE_NAME)
                .then((cache) => cache.put(request, responseClone));
              return response;
            });
        })
    );
    return;
  }

  // Special handling for PDF files
  if (url.pathname.endsWith('.pdf')) {
    event.respondWith(
      caches.match(request)
        .then((cachedResponse) => {
          // Return cached PDF if available
          if (cachedResponse) {
            return cachedResponse;
          }

          // Fetch and cache new PDF
          return fetch(request)
            .then((response) => {
              const responseClone = response.clone();
              caches.open(CACHE_NAME)
                .then((cache) => cache.put(request, responseClone));
              return response;
            })
            .catch(() => {
              // Show offline page if PDF not cached
              return caches.match(OFFLINE_PAGE);
            });
        })
    );
    return;
  }

  // Default behavior: Network first with cache fallback
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cache successful responses
        const responseClone = response.clone();
        caches.open(CACHE_NAME)
          .then((cache) => cache.put(request, responseClone));
        return response;
      })
      .catch(() => {
        // Fallback to cached response if available
        return caches.match(request)
          .then((response) => response || caches.match(OFFLINE_PAGE));
      })
  );
});

// Background sync support
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-actions') {
    console.log('ServiceWorker: Background sync triggered');
    event.waitUntil(handleBackgroundSync());
  }
});

async function handleBackgroundSync() {
  // Implement background sync logic here
  // Example: Sync offline actions with server
}

// Push notifications support
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'PDF Hub Pro';
  const options = {
    body: data.body || 'You have a new notification',
    icon: '/assets/images/notification-icon.png',
    badge: '/assets/images/badge.png'
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' })
      .then((clientList) => {
        if (clientList.length > 0) {
          return clientList[0].focus();
        }
        return clients.openWindow('/');
      })
  );
});

// Periodic background updates
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'update-content') {
    console.log('ServiceWorker: Periodic sync triggered');
    event.waitUntil(handlePeriodicSync());
  }
});

async function handlePeriodicSync() {
  // Implement periodic content updates here
  // Example: Check for new PDFs or updates
}

// Cache cleanup function
function cleanupCache() {
  caches.open(CACHE_NAME)
    .then((cache) => {
      return cache.keys()
        .then((keys) => {
          const currentTime = Date.now();
          keys.forEach((request) => {
            cache.match(request)
              .then((response) => {
                if (response) {
                  const cacheDate = new Date(response.headers.get('date')).getTime();
                  const cacheAge = (currentTime - cacheDate) / (1000 * 60 * 60 * 24);
                  if (cacheAge > 30) { // Delete items older than 30 days
                    cache.delete(request);
                  }
                }
              });
          });
        });
    });
}

// Clean up cache every 24 hours
setInterval(cleanupCache, 24 * 60 * 60 * 1000);
