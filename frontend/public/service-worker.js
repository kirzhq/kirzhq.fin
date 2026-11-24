// Only the app entry point has an offline response. API calls and sign-in always use the network.
const offlinePage = `<!doctype html>
<html lang="ru">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>Нет соединения · Финансы</title>
<style>
  body { margin: 0; min-height: 100svh; display: grid; place-items: center; font: 1rem/1.5 system-ui, sans-serif; }
  main { width: min(24rem, 84vw); }
  h1 { font-size: 1.75rem; line-height: 1.2; }
  button { font: inherit; cursor: pointer; border: 0; display: inline-block; padding: .65rem 1rem; border-radius: .65rem; background: #2c52d1; color: white; }
</style>
<main><p>Финансы</p><h1>Нет соединения</h1>
<p>Подключитесь к интернету, чтобы открыть операции и баланс.</p>
<button type="button" onclick="location.reload()">Попробовать снова</button></main>
</html>`;

self.addEventListener('install', (event) => event.waitUntil(self.skipWaiting()));

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.startsWith('kirzhq-fin-shell-')).map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || request.mode !== 'navigate') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname !== '/') return;

  event.respondWith(fetch(request).catch(() => new Response(offlinePage, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  })));
});
