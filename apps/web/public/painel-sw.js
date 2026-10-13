/* Minimal service worker so the panel can be installed as an app.
   It never caches authenticated pages or API responses: the panel always shows live data. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(
        () =>
          new Response(
            '<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sem internet</title><body style="font:18px system-ui;padding:2rem"><h1>Sem internet</h1><p>Confira a conexão e abra o painel de novo.</p></body></html>',
            { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
          ),
      ),
    );
  }
});
