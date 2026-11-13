/* 可樂工程行 · 出工指揮台 Service Worker v1.0.0 */
const CACHE_NAME = 'cola-crew-v1.0.0';
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './sheets.html',
  './passbook.html',
  './manifest.webmanifest',
  './assets/logo_160.png',
  './assets/logo_320.png',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/icon-maskable-512.png',
  './assets/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SW] precache error (non-fatal):', err);
      });
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((k) => {
          if (k !== CACHE_NAME) {
            console.log('[SW] 移除舊快取:', k);
            return caches.delete(k);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (req.method !== 'GET') return;
  if (url.port === '5001' || url.hostname === '100.117.16.1' || url.hostname === '127.0.0.1') {
    return;
  }
  if (!url.protocol.startsWith('http')) return;

  // 動態加密資料與 HTML 頁面：Network First (失敗時使用快取 fallback)
  if (url.pathname.includes('data.enc.js') || url.pathname.endsWith('.html') || url.pathname.endsWith('/')) {
    event.respondWith(
      fetch(req)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const resClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              if (url.pathname.includes('data.enc.js')) {
                cache.keys().then((keys) => {
                  keys.forEach((k) => {
                    if (k.url.includes('data.enc.js') && k.url !== req.url) {
                      cache.delete(k);
                    }
                  });
                });
              }
              cache.put(req, resClone);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          const cached = await caches.match(req, { ignoreSearch: url.pathname.includes('data.enc.js') });
          if (cached) return cached;
          if (req.mode === 'navigate') {
            return caches.match('./index.html');
          }
          return new Response('離線模式且無快取', { status: 503, statusText: 'Service Unavailable' });
        })
    );
    return;
  }

  // 靜態資源：Stale-While-Revalidate
  event.respondWith(
    caches.match(req).then((cachedResponse) => {
      const fetchPromise = fetch(req).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const resClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(req, resClone);
          });
        }
        return networkResponse;
      }).catch(() => null);

      return cachedResponse || fetchPromise;
    })
  );
});
