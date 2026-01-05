// Service Worker for SwiftRide Delivery PWA
const CACHE_NAME = 'swiftride-v1.0';
const urlsToCache = [
  './',
  './index.html',
  './login.html',
  './admin.html',
  './driver.html',
  './customer.html',
  './app.js',
  './admin.js',
  './driver.js',
  './customer.js',
  './styles.css',
  './manifest.json',
  './icons/icon-192x192.png',
  './icons/icon-512x512.png',
  './icons/favicon.ico',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://cdn.socket.io/4.6.0/socket.io.min.js'
];

// Install Event
self.addEventListener('install', event => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Caching files');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate Event
self.addEventListener('activate', event => {
  console.log('Service Worker: Activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('Service Worker: Clearing old cache');
            return caches.delete(cache);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// Fetch Event
self.addEventListener('fetch', event => {
  console.log('Service Worker: Fetching', event.request.url);
  
  // Skip socket.io and external resources
  if (event.request.url.includes('socket.io') || 
      event.request.url.includes('cdnjs.cloudflare.com') ||
      event.request.url.includes('fonts.googleapis.com') ||
      event.request.url.includes('unpkg.com') ||
      event.request.url.includes('tile.openstreetmap.org')) {
    return fetch(event.request);
  }
  
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Return cached version or fetch new
        return response || fetch(event.request)
          .then(fetchResponse => {
            // Don't cache API requests
            if (event.request.url.includes('/api/')) {
              return fetchResponse;
            }
            
            // Cache successful responses
            if (fetchResponse && fetchResponse.status === 200) {
              const responseToCache = fetchResponse.clone();
              caches.open(CACHE_NAME)
                .then(cache => {
                  cache.put(event.request, responseToCache);
                });
            }
            return fetchResponse;
          })
          .catch(() => {
            // Return offline page for HTML requests
            if (event.request.headers.get('accept').includes('text/html')) {
              return caches.match('./index.html');
            }
          });
      })
  );
});

// Push Notification Event
self.addEventListener('push', event => {
  console.log('Service Worker: Push received');
  
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'SwiftRide Delivery';
  const options = {
    body: data.body || 'You have a new notification',
    icon: './icons/icon-192x192.png',
    badge: './icons/icon-192x192.png',
    vibrate: [200, 100, 200],
    data: {
      url: data.url || './'
    }
  };
  
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Notification Click Event
self.addEventListener('notificationclick', event => {
  console.log('Service Worker: Notification clicked');
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ type: 'window' })
      .then(clientList => {
        for (const client of clientList) {
          if (client.url === event.notification.data.url && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(event.notification.data.url);
        }
      })
  );
});