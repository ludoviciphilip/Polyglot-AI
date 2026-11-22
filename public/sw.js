/* Polyglot i+1 service worker
 *
 * - App shell (index.html + hashed Vite assets + vocab lists) is cached for offline use.
 * - Navigations: network-first, falling back to the cached shell when offline.
 * - Same-origin static assets: cache-first (Vite asset names are content-hashed).
 * - CDN assets (Tailwind, Google Fonts, esm.sh): stale-while-revalidate, so the UI
 *   keeps its styling offline after the first visit.
 * - Gemini API calls (and every non-GET request) are never intercepted.
 */
const VERSION = 'v1';
const SHELL_CACHE = `polyglot-shell-${VERSION}`;
const RUNTIME_CACHE = `polyglot-runtime-${VERSION}`;
const CDN_HOSTS = ['cdn.tailwindcss.com', 'fonts.googleapis.com', 'fonts.gstatic.com', 'esm.sh'];
const NEVER_CACHE_HOSTS = ['generativelanguage.googleapis.com', 'aiplatform.googleapis.com'];

const scopeUrl = (path) => new URL(path, self.registration.scope).toString();

const STATIC_SHELL = [
  './',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'vocab/en_a1.json',
  'vocab/en_a2.json',
  'vocab/en_b1.json',
  'vocab/en_b2.json',
];

// Extracts same-origin script/style/modulepreload URLs from the built index.html
const extractShellAssets = (html) => {
  const urls = new Set();
  const re = /(?:src|href)="([^"]+\.(?:js|css|ico|png|svg|woff2?))"/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const url = new URL(m[1], self.registration.scope);
    if (url.origin === self.location.origin) urls.add(url.toString());
  }
  return Array.from(urls);
};

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    await Promise.all(STATIC_SHELL.map(async (path) => {
      try {
        await cache.add(new Request(scopeUrl(path), { cache: 'reload' }));
      } catch (e) {
        // Optional files (e.g. vocab lists) must not block installation
      }
    }));
    try {
      const response = await fetch(scopeUrl('./'), { cache: 'reload' });
      const html = await response.clone().text();
      await cache.put(scopeUrl('./'), response);
      await Promise.all(extractShellAssets(html).map((url) => cache.add(url).catch(() => undefined)));
    } catch (e) {
      // Offline during install: the runtime cache will fill in on the next online visit
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keep = new Set([SHELL_CACHE, RUNTIME_CACHE]);
    const names = await caches.keys();
    await Promise.all(names.filter((n) => n.startsWith('polyglot-') && !keep.has(n)).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

const networkFirstNavigation = async (request) => {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(SHELL_CACHE);
      cache.put(scopeUrl('./'), response.clone());
    }
    return response;
  } catch (e) {
    const cached = await caches.match(scopeUrl('./'));
    if (cached) return cached;
    throw e;
  }
};

const cacheFirst = async (request) => {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(RUNTIME_CACHE);
    cache.put(request, response.clone());
  }
  return response;
};

const staleWhileRevalidate = async (request) => {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      // Opaque (no-cors) CDN responses have status 0 but are still usable
      if (response.ok || response.type === 'opaque') cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);
  return cached || network;
};

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (NEVER_CACHE_HOSTS.some((h) => url.hostname.endsWith(h))) return;

  if (request.mode === 'navigate' && url.origin === self.location.origin) {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (CDN_HOSTS.some((h) => url.hostname === h || url.hostname.endsWith(`.${h}`))) {
    event.respondWith(staleWhileRevalidate(request));
  }
});
