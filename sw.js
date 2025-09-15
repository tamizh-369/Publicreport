const CACHE_NAME = 'chennai-clean-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/assets/style.css',
  '/assets/app.js',
  '/assets/supabase.js',
  '/citizen/register.html',
  '/citizen/dashboard.html',
  '/citizen/report.html',
  '/worker/login.html',
  '/worker/dashboard.html',
  '/worker/complete.html',
  '/admin/login.html',
  '/admin/dashboard.html',
  '/admin/verify.html',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css'
];

// Install service worker
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Cache opened successfully');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('Service Worker installed successfully');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('Service Worker installation failed:', error);
      })
  );
});

// Improved fetch event handler - UPDATED
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests and chrome-extension requests
  if (event.request.method !== 'GET' ||
      event.request.url.startsWith('chrome-extension://') ||
      event.request.url.startsWith('moz-extension://')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }

        return fetch(event.request).catch(() => {
          if (event.request.destination === 'document') {
            return caches.match('/index.html');
          }
          return new Response('Offline', { status: 503 });
        });
      })
      .catch((error) => {
        console.log('Fetch error:', error);
        return new Response('Offline', { status: 503 });
      })
  );
});

// Activate service worker
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('Service Worker activated successfully');
        return self.clients.claim();
      })
      .catch((error) => {
        console.error('Service Worker activation failed:', error);
      })
  );
});

// Improved message event handler - NEW
self.addEventListener('message', (event) => {
  console.log('SW received message:', event.data);

  try {
    if (event.data && event.data.type === 'SKIP_WAITING') {
      self.skipWaiting();
    }

    // Always send a response to prevent the error
    if (event.ports && event.ports[0]) {
      event.ports[0].postMessage({ success: true });
    }
  } catch (error) {
    console.log('Message handling error:', error);
  }
});

// Background sync (simplified)
self.addEventListener('sync', (event) => {
  console.log('Background sync triggered:', event.tag);
  if (event.tag === 'background-sync') {
    event.waitUntil(
      syncOfflineReports().catch((error) => {
        console.error('Sync error:', error);
      })
    );
  }
});

// Push notifications (simplified)
self.addEventListener('push', (event) => {
  console.log('Push notification received');
  const title = 'Chennai Clean';
  const options = {
    body: event.data ? event.data.text() : 'New task assigned!',
    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🍃</text></svg>',
    badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🍃</text></svg>',
    vibrate: [200, 100, 200],
    tag: 'chennai-clean-notification'
  };

  event.waitUntil(
    self.registration.showNotification(title, options).catch((error) => {
      console.log('Notification error:', error);
    })
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked');
  event.notification.close();

  event.waitUntil(
    clients.openWindow('/').catch((error) => {
      console.log('Open window error:', error);
    })
  );
});

// Error handler - NEW
self.addEventListener('error', (event) => {
  console.log('Service Worker error:', event.error);
});

// Unhandled rejection handler - NEW
self.addEventListener('unhandledrejection', (event) => {
  console.log('Service Worker unhandled rejection:', event.reason);
  event.preventDefault();
});

async function syncOfflineReports() {
  try {
    console.log('Syncing offline reports...');
    // This will be implemented in Day 2
    return Promise.resolve();
  } catch (error) {
    console.error('Sync failed:', error);
    throw error;
  }
}
