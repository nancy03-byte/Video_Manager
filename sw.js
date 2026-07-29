// ═══════════════════════════════════════════════════════════════════════════
// Star Library — Service Worker
// Cache-first for images, network-first for API and navigation.
// ═══════════════════════════════════════════════════════════════════════════

const CACHE_NAME = 'star-library-v3';
const IMAGE_CACHE = 'star-library-images-v3';
const API_CACHE = 'star-library-api-v3';
const MAX_IMAGE_CACHE = 800;

const IS_IMAGE = /\.(jpg|jpeg|png|gif|webp|svg|ico|bmp|avif)(\?|#|$)/i;

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  const clean = async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((k) => ![CACHE_NAME, IMAGE_CACHE, API_CACHE].includes(k))
        .map((k) => caches.delete(k))
    );
    await self.clients.claim();
  };
  event.waitUntil(clean());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (!['http:', 'https:'].includes(url.protocol)) return;

  if (IS_IMAGE.test(url.pathname)) {
    event.respondWith(cacheFirst(request, IMAGE_CACHE, MAX_IMAGE_CACHE));
    return;
  }

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request, API_CACHE));
    return;
  }

  event.respondWith(networkFirst(request, CACHE_NAME));
});

async function cacheFirst(request, cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok || response.type === 'opaque') {
      await trimCache(cache, maxEntries);
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch (_err) {
    return cached || new Response('', { status: 503, statusText: 'Offline' });
  }
}

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok || response.type === 'opaque') {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch (_err) {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);
    return cached || new Response('', { status: 503, statusText: 'Offline' });
  }
}

async function trimCache(cache, maxEntries) {
  if (!maxEntries) return;
  try {
    const keys = await cache.keys();
    if (keys.length >= maxEntries) {
      const toDelete = keys.slice(0, keys.length - maxEntries + 1);
      await Promise.all(toDelete.map((key) => cache.delete(key)));
    }
  } catch (_) {}
}
