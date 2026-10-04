// Service worker : permet d'installer la page comme une appli et de l'ouvrir sans connexion.
// La page est toujours redemandée au réseau d'abord, pour que les mises à jour arrivent tout de suite ;
// la copie en cache ne sert que hors connexion, ou si le réseau met plus de 4 secondes à répondre.
const CACHE = 'nsi-v1';
const PAGE = './';
const NETWORK_TIMEOUT = 4000;
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.add(PAGE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Seuls la page, ses fichiers et les polices passent par le cache : la sauvegarde en ligne
// (Supabase) doit toujours aller au réseau.
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (event.request.mode === 'navigate') event.respondWith(networkFirst(event));
  else if (url.origin === location.origin || FONT_HOSTS.includes(url.hostname)) event.respondWith(staleWhileRevalidate(event));
});

// Page : réseau d'abord, copie en cache en secours.
async function networkFirst(event) {
  const cache = await caches.open(CACHE);
  const network = fetch(event.request).then(res => {
    if (res.ok) cache.put(PAGE, res.clone());
    return res;
  });
  event.waitUntil(network.catch(() => {}));
  try {
    return await Promise.race([network, new Promise((_, reject) => setTimeout(reject, NETWORK_TIMEOUT))]);
  } catch (e) {
    return (await cache.match(PAGE)) || network;
  }
}

// Polices et icônes : copie en cache tout de suite, rafraîchie en arrière-plan.
async function staleWhileRevalidate(event) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(event.request);
  const network = fetch(event.request).then(res => {
    if (res.ok || res.type === 'opaque') cache.put(event.request, res.clone());
    return res;
  });
  if (cached) {
    event.waitUntil(network.catch(() => {}));
    return cached;
  }
  return network;
}
