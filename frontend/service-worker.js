// Service Worker for SwiftRide Delivery App
const CACHE_VERSION = 'v1.0.1'; // Updated version
const CACHE_NAME = `swiftride-cache-${CACHE_VERSION}`;

// ✅ UPDATE THIS LIST to match YOUR actual project files
// ✅ CORRECTED: Asset paths for your project structure
// Assumes your website root is the 'frontend' folder
const STATIC_ASSETS = [
  './',                    // Your index.html
  './index.html',
  './admin.html',
  './driver.html',
  // Removed './customer.html' and './customer.js' as they don't exist
  './styles.css',
  './app.js',
  './admin.js',
  './driver.js',
  './manifest.json',
  // Icons - these paths now match your folder
  './icons/icon-192x192.png',
  './icons/icon-512x512.png',
  './icons/favicon.ico',
  // Your logo
  './assets/logo.png'
];
// Install event: caches the app shell
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing and caching app shell...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting()) // Activate immediately
  );
});

// Activate event: cleans up old caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim()) // Take control of all open pages
  );
});

// Fetch event: "Cache First" strategy for static assets
self.addEventListener('fetch', (event) => {
  const request = event.request;
  
  // Only handle GET requests and non-API requests
  if (request.method !== 'GET' || request.url.includes('/api/')) {
    return; // Let the browser handle these normally
  }
  
  // For static assets, try cache first, then network
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      // Return cached version if found
      if (cachedResponse) {
        return cachedResponse;
      }
      // Not in cache, fetch from network
      return fetch(request).then((networkResponse) => {
        // Optionally cache the new response for future visits
        // caches.open(CACHE_NAME).then(cache => cache.put(request, networkResponse.clone()));
        return networkResponse;
      }).catch(() => {
        // If both cache and network fail, you could return a custom offline page
        // e.g., return caches.match('/offline.html');
        return new Response('You are offline.');
      });
    })
  );
});

// ... (Your push and sync event handlers can remain) ...