// Flowr service worker.
// Strategy:
//   - Precache critical shell URLs on install.
//   - Static assets (/_next/static/*, icons, manifest): stale-while-revalidate.
//   - HTML navigations: network-first, fall back to cached / on failure.
//   - API / Supabase / non-GET: pass through, never cached.
// The cache name is a fixed constant. Updates to JS/CSS propagate via Next.js
// content-hashed URLs (a new deploy = new URL = fresh fetch), not via the cache
// name. Bump CACHE_NAME manually only if you need to force-purge all caches.

const CACHE_NAME = 'flowr-shell-v1';

const PRECACHE_URLS = [
  '/',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k.startsWith('flowr-shell-') && k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

function isStaticAsset(url) {
  return url.pathname.startsWith('/_next/static/')
    || url.pathname.startsWith('/icons/')
    || url.pathname === '/manifest.webmanifest'
    || url.pathname === '/favicon.svg';
}

function isApiOrSupabase(url) {
  return url.pathname.startsWith('/api/') || url.hostname.endsWith('.supabase.co');
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Same-origin only for caching decisions; everything cross-origin (CDN images etc.) passes through.
  if (url.origin !== self.location.origin && !isApiOrSupabase(url)) return;

  if (isApiOrSupabase(url)) return; // network only

  if (isStaticAsset(url)) {
    event.respondWith(staleWhileRevalidate(req));
    return;
  }

  if (req.mode === 'navigate') {
    event.respondWith(networkFirst(req));
    return;
  }
});

async function staleWhileRevalidate(req) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(req);
  const network = fetch(req).then((res) => {
    if (res && res.status === 200) cache.put(req, res.clone());
    return res;
  }).catch(() => cached);
  return cached || network;
}

async function networkFirst(req) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const res = await fetch(req);
    if (res && res.status === 200) cache.put(req, res.clone());
    return res;
  } catch {
    const cached = await cache.match(req) || await cache.match('/');
    if (cached) return cached;
    throw new Error('offline and no cached shell');
  }
}
