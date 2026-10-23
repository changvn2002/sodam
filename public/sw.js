/* Sổ Đám — hand-written app-shell service worker (no library, no build step).
 *
 * Scope of responsibility (W5-01): serve the app shell + static brand assets
 * offline so a reload never shows the browser error page. Book data lives on
 * the server — /api/* is NEVER intercepted or cached here; loading a book
 * still requires network. Queued "new entry" writes are handled separately
 * by the IndexedDB outbox in components/sodam/lib/offline.ts.
 */

const CACHE = 'sodam-shell-v2';

const PRECACHE_URLS = [
  '/',
  '/manifest.webmanifest',
  '/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png',
  '/products/sodam-empty.webp',
  '/products/brand/sodam-logo.svg',
  '/og.jpg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // Precache each URL individually: one failing asset must not kill the
      // whole install (allSettled, never one bulk precache call).
      await Promise.allSettled(PRECACHE_URLS.map((url) => cache.add(url)));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith('sodam-shell-') && key !== CACHE)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

const STATIC_EXTENSIONS = [
  '.woff2',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.svg',
  '.ico',
  '.css',
  '.js',
];

function isStaticAsset(url, request) {
  if (request.method !== 'GET') return false;
  if (url.pathname.startsWith('/_next/static/')) return true;
  if (url.pathname.startsWith('/icons/')) return true;
  if (url.pathname.startsWith('/products/')) return true;
  return STATIC_EXTENSIONS.some((ext) => url.pathname.endsWith(ext));
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Cross-origin: never intercept (fonts CDNs, analytics, etc. pass through).
  if (url.origin !== self.location.origin) return;

  // API: straight to network, absolutely no caching — responses contain
  // private book data and must never be stored in the shell cache.
  if (url.pathname.startsWith('/api/')) return;

  // Navigations: network-first; on network failure serve the cached app
  // shell so the browser error page is never shown.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          return await fetch(request);
        } catch {
          const shell = await caches.match('/');
          if (shell) return shell;
          throw new Error('offline and no cached app shell');
        }
      })(),
    );
    return;
  }

  // Same-origin static assets: cache-first, populate the shell cache on miss.
  if (isStaticAsset(url, request)) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(CACHE);
          await cache.put(request, response.clone());
        }
        return response;
      })(),
    );
  }
});
