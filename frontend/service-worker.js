// Service Worker for SwiftRide Delivery App - CORRECTED VERSION
const CACHE_VERSION = 'v1.0.3';
const CACHE_NAME = `swiftride-cache-${CACHE_VERSION}`;

// ✅ CORRECTED: All paths are relative to frontend folder
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/admin.html',
  '/driver.html',
  '/styles.css',
  '/app.js',
  '/admin.js',
  '/driver.js',
  '/manifest.json',
  '/site.webmanifest',
  '/admin.css'
];

// Icons - check if they exist before adding
const ICON_ASSETS = [
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/favicon.ico'
];

// Assets directory
const ASSET_FILES = [
  '/assets/logo.png'
];

// Install event: caches the app shell
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  
  // Skip waiting to activate immediately
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(CACHE_NAME);
        console.log('✅ Cache opened');
        
        // Try to cache static assets
        const allAssets = [...STATIC_ASSETS];
        
        // Try to cache each asset individually
        const cachePromises = allAssets.map(async (asset) => {
          try {
            await cache.add(asset);
            console.log(`✅ Cached: ${asset}`);
            return { asset, success: true };
          } catch (error) {
            console.warn(`⚠️ Failed to cache ${asset}:`, error.message);
            return { asset, success: false, error: error.message };
          }
        });
        
        const results = await Promise.all(cachePromises);
        const failed = results.filter(r => !r.success);
        
        if (failed.length > 0) {
          console.warn(`⚠️ ${failed.length} assets failed to cache`);
        } else {
          console.log('✅ All assets cached successfully');
        }
        
        // Force the service worker to become active immediately
        return self.skipWaiting();
        
      } catch (error) {
        console.error('❌ Cache setup failed:', error);
        // Even if caching fails, activate anyway
        return self.skipWaiting();
      }
    })()
  );
});

// Activate event: cleans up old caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  
  event.waitUntil(
    (async () => {
      // Clean up old caches
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log(`🗑️ Deleting old cache: ${cacheName}`);
            return caches.delete(cacheName);
          }
        })
      );
      
      // Take control of all open pages immediately
      await self.clients.claim();
      console.log('✅ Service Worker activated and claiming clients');
    })()
  );
});

// Fetch event: Serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  
  // Skip non-GET requests and API requests
  if (request.method !== 'GET' || 
      url.pathname.startsWith('/api/') ||
      url.hostname !== self.location.hostname) {
    return;
  }
  
  // For navigation requests, always try network first, then cache
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          // Try network first
          const networkResponse = await fetch(request);
          if (networkResponse && networkResponse.status === 200) {
            // Cache the successful response
            const cache = await caches.open(CACHE_NAME);
            await cache.put(request, networkResponse.clone());
            return networkResponse;
          }
          throw new Error('Network failed');
        } catch (error) {
          // Network failed, try cache
          const cachedResponse = await caches.match('/index.html');
          return cachedResponse || new Response('Network error', { 
            status: 503, 
            statusText: 'Service Unavailable' 
          });
        }
      })()
    );
    return;
  }
  
  // For static assets: Cache First strategy
  event.respondWith(
    (async () => {
      // Try cache first
      const cachedResponse = await caches.match(request);
      if (cachedResponse) {
        return cachedResponse;
      }
      
      try {
        // Not in cache, fetch from network
        const networkResponse = await fetch(request);
        
        // Cache the response if it's successful
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          const cache = await caches.open(CACHE_NAME);
          await cache.put(request, responseToCache);
        }
        
        return networkResponse;
      } catch (error) {
        // Network failed, return offline fallback
        console.warn(`🌐 Offline: ${request.url}`);
        
        // Return appropriate fallback based on file type
        if (request.url.endsWith('.css')) {
          return new Response(`
            /* Offline CSS */
            body { 
              background: #f5f5f5; 
              color: #333; 
              font-family: 'Poppins', sans-serif;
              padding: 20px;
              text-align: center;
            }
            h1 { color: #6C63FF; }
          `, { 
            headers: { 
              'Content-Type': 'text/css',
              'Cache-Control': 'no-cache'
            } 
          });
        }
        
        if (request.url.endsWith('.js')) {
          return new Response(`
            // Offline mode
            console.log('App is offline');
            if (typeof showNotification === 'function') {
              showNotification('You are offline. Some features may not work.', 'warning');
            }
          `, { 
            headers: { 
              'Content-Type': 'application/javascript',
              'Cache-Control': 'no-cache'
            } 
          });
        }
        
        // Default offline page for HTML requests
        return new Response(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>SwiftRide - Offline</title>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body { 
                font-family: 'Poppins', sans-serif;
                background: linear-gradient(135deg, #6C63FF, #4A43C8);
                color: white;
                height: 100vh;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                text-align: center;
                padding: 20px;
              }
              .offline-icon {
                font-size: 64px;
                margin-bottom: 20px;
              }
              h1 { font-size: 2.5em; margin-bottom: 10px; }
              p { font-size: 1.2em; margin-bottom: 30px; max-width: 400px; }
              button {
                background: white;
                color: #6C63FF;
                border: none;
                padding: 12px 24px;
                border-radius: 8px;
                font-size: 1em;
                font-weight: 600;
                cursor: pointer;
                transition: transform 0.2s;
              }
              button:hover {
                transform: translateY(-2px);
              }
            </style>
          </head>
          <body>
            <div class="offline-icon">📡</div>
            <h1>You're Offline</h1>
            <p>Please check your internet connection and try again. Some features may not be available while offline.</p>
            <button onclick="window.location.reload()">Try Again</button>
          </body>
          </html>
        `, { 
          headers: { 
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-cache'
          } 
        });
      }
    })()
  );
});

// Handle messages from the main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Handle background sync
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-requests') {
    event.waitUntil(syncPendingRequests());
  }
});

async function syncPendingRequests() {
  // Implement background sync logic here
  console.log('🔄 Syncing data in background...');
  // You can sync any pending API requests here
}