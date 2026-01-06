const CACHE_NAME = 'swiftride-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/customer.html',
  '/driver.html',
  '/admin.html',
  '/styles.css',
  '/app.js',
  '/customer.js',
  '/driver.js',
  '/admin.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});