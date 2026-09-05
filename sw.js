// Service worker: deixa o app funcionar sem internet e cuida dos cliques nas notificações.
const VERSAO = 'nossa-casa-v1';
const ARQUIVOS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/styles.css',
  './js/app.js',
  './js/store.js',
  './js/util.js',
  './js/ui.js',
  './js/notify.js',
  './js/financas.js',
  './js/tema.js',
  './js/icones.js',
  './js/nuvem.js',
  './js/views/inicio.js',
  './js/views/agenda.js',
  './js/views/farmacia.js',
  './js/views/mercado.js',
  './js/views/contas.js',
  './js/views/financeiro.js',
  './js/views/config.js',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/favicon-32.png',
  './assets/icons/apple-touch-icon.png'
];

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches.open(VERSAO)
      .then((cache) => cache.addAll(ARQUIVOS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((chaves) => Promise.all(chaves.filter((c) => c !== VERSAO).map((c) => caches.delete(c))))
      .then(() => self.clients.claim())
  );
});

// Rede primeiro para os arquivos do app (pega atualizações), cache como reserva offline.
self.addEventListener('fetch', (evento) => {
  const req = evento.request;
  if (req.method !== 'GET' || !req.url.startsWith(self.location.origin)) return;

  evento.respondWith(
    fetch(req)
      .then((resposta) => {
        const copia = resposta.clone();
        caches.open(VERSAO).then((cache) => cache.put(req, copia)).catch(() => {});
        return resposta;
      })
      .catch(async () => {
        const emCache = await caches.match(req);
        if (emCache) return emCache;
        if (req.mode === 'navigate') return caches.match('./index.html');
        return new Response('Offline', { status: 503, statusText: 'Offline' });
      })
  );
});

// Abre o app na tela certa quando a pessoa toca no aviso.
self.addEventListener('notificationclick', (evento) => {
  evento.notification.close();
  const destino = evento.notification.data?.url || '#/inicio';
  evento.waitUntil((async () => {
    const janelas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const janela of janelas) {
      if (janela.url.includes(self.registration.scope)) {
        await janela.focus();
        janela.postMessage({ tipo: 'navegar', url: destino });
        return;
      }
    }
    await self.clients.openWindow(`./index.html${destino}`);
  })());
});

// Quando o sistema acorda o app em segundo plano, pede uma verificação de alertas.
self.addEventListener('periodicsync', (evento) => {
  if (evento.tag !== 'verificar-alertas') return;
  evento.waitUntil((async () => {
    const janelas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    janelas.forEach((j) => j.postMessage({ tipo: 'verificar-alertas' }));
  })());
});
