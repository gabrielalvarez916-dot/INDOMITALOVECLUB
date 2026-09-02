// ============================================================
// sw-libro.js — Indómita Love Club
// Service Worker chico y conservador: solo se encarga de que la
// APP (el HTML/JS/CSS) pueda seguir abriendo sin internet. El
// contenido cifrado de los libros en sí se maneja aparte, en
// IndexedDB, desde js/offline-libros.js — este archivo no lo toca.
//
// Estrategia: "red primero, cache como salvavidas".
// - Si hay internet: siempre pide la versión más nueva a Vercel
//   y la deja guardada como respaldo. Así nadie queda pegado
//   viendo una versión vieja del sitio por error de caché.
// - Si NO hay internet: recién ahí sirve lo último que había
//   guardado.
// Si algo de esto rompe algo, lo más simple es dejar de registrar
// este archivo en app.html — el sitio vuelve a comportarse exactamente
// como antes (el Service Worker no queda "atascado": cuando el
// navegador no encuentra el registro, lo desactiva solo).
// ============================================================

var CACHE_NOMBRE = 'indomita-shell-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((nombres) =>
      Promise.all(
        nombres
          .filter((nombre) => nombre !== CACHE_NOMBRE)
          .map((nombre) => caches.delete(nombre))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Solo GET, y solo mismo origen (deja pasar de largo Supabase, R2, CDNs, etc.
  // esos ya tienen su propio manejo de red/errores y no queremos cachearlos acá).
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    fetch(req)
      .then((respuestaRed) => {
        const copia = respuestaRed.clone();
        caches.open(CACHE_NOMBRE).then((cache) => cache.put(req, copia));
        return respuestaRed;
      })
      .catch(() => caches.match(req))
  );
});
