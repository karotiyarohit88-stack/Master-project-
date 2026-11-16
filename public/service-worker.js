/* Master Project app-shell cache. Never cache API, auth, HTML data or user responses. */
const CACHE_NAME = 'master-project-shell-v1';
const APP_SHELL = '/';

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    try { await cache.add(new Request(APP_SHELL, { cache: 'reload' })); } catch { /* online install can retry on next visit */ }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.startsWith('master-project-shell-') && name !== CACHE_NAME).map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/') || url.pathname.includes('socket')) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(APP_SHELL, response.clone());
        }
        return response;
      } catch {
        return (await caches.match(APP_SHELL)) || Response.error();
      }
    })());
    return;
  }

  // Only immutable Vite build assets are cache-first. Do not cache arbitrary pages or API data.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      if (cached) return cached;
      try {
        const response = await fetch(request);
        if (response.ok) await cache.put(request, response.clone());
        return response;
      } catch {
        return Response.error();
      }
    })());
  }
});
