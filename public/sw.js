/* TEAM HEX service worker: offline shell + cached media. Never caches the visit API. */
const VERSION = 'hex-v6-1';
const SHELL = `${VERSION}-shell`;
const ASSETS = `${VERSION}-assets`;
const PRECACHE = ['/', '/index.html', '/manifest.webmanifest', '/favicon.png', '/images/hex-wolf.webp'];

async function precacheBuild() {
  const cache = await caches.open(SHELL);
  await Promise.all(PRECACHE.map(url => cache.add(url).catch(() => {})));
  try {
    const html = await (await fetch('/index.html', { cache: 'reload' })).text();
    const urls = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map(match => match[1]);
    const assets = await caches.open(ASSETS);
    await Promise.all([...new Set(urls)].map(url => assets.add(url).catch(() => {})));
  } catch { /* Offline install is fine; runtime caching fills the gaps. */ }
}

self.addEventListener('install', event => {
  event.waitUntil(precacheBuild().then(() => self.skipWaiting()));
});

self.addEventListener('message', event => {
  if (event.data?.type !== 'precache' || !Array.isArray(event.data.urls)) return;
  const urls = event.data.urls.filter(url => typeof url === 'string' && url.startsWith(self.location.origin) && !url.includes('/api/'));
  event.waitUntil(caches.open(ASSETS).then(cache => Promise.all(urls.map(url => cache.add(url).catch(() => {})))).then(() => trim(ASSETS, 140)));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => !key.startsWith(VERSION)).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

async function trim(cacheName, limit) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > limit) await Promise.all(keys.slice(0, keys.length - limit).map(key => cache.delete(key)));
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/.netlify/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(SHELL).then(cache => cache.put('/index.html', copy));
          return response;
        })
        .catch(() => caches.match('/index.html').then(cached => cached || caches.match('/')))
    );
    return;
  }

  if (/\.(?:webp|png|jpe?g|svg|woff2?|css|js|webmanifest)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(request, { ignoreVary: true }).then(cached => cached || fetch(request).then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(ASSETS).then(cache => cache.put(request, copy).then(() => trim(ASSETS, 140)));
        }
        return response;
      }).catch(() => cached || Response.error()))
    );
  }
});
