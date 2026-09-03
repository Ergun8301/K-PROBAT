/* ============================================================================
 *  Service worker — K-ProBat
 *
 *  Rôle : rendre le site installable comme application (Chrome/Android exigent
 *  un service worker en plus du manifeste, sans quoi « Ajouter à l'écran
 *  d'accueil » ne crée qu'un raccourci de page web), et le rendre consultable
 *  hors connexion.
 *
 *  Stratégie, volontairement prudente :
 *    - pages HTML : réseau d'abord, cache en secours (jamais de page périmée
 *      tant que le réseau répond) ;
 *    - images, CSS, JS, polices : cache d'abord, puis réseau (rapide et stable).
 *
 *  À CHAQUE MISE EN LIGNE d'un changement visuel, incrémenter CACHE_VERSION :
 *  cela purge l'ancien cache chez tous les visiteurs.
 * ========================================================================== */
const CACHE_VERSION = 'kprobat-v1';
const PRECACHE = [
  '/',
  '/assets/css/style.css',
  '/assets/css/hover.css',
  '/assets/js/main.js',
  '/assets/js/vendor/gsap.min.js',
  '/assets/js/vendor/ScrollTrigger.min.js',
  '/assets/js/vendor/lenis.min.js',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png',
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE_VERSION)
      .then(function (c) { return c.addAll(PRECACHE); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.filter(function (k) { return k !== CACHE_VERSION; })
          .map(function (k) { return caches.delete(k); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  // Pages : réseau d'abord (contenu toujours à jour), cache en secours.
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    e.respondWith(
      fetch(req)
        .then(function (res) {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then(function (c) { c.put(req, copy); });
          return res;
        })
        .catch(function () { return caches.match(req).then(function (r) { return r || caches.match('/'); }); })
    );
    return;
  }

  // Ressources statiques : cache d'abord.
  e.respondWith(
    caches.match(req).then(function (cached) {
      return cached || fetch(req).then(function (res) {
        const copy = res.clone();
        caches.open(CACHE_VERSION).then(function (c) { c.put(req, copy); });
        return res;
      });
    })
  );
});
