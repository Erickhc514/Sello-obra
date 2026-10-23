/* Sello de Obra — service worker: funciona sin conexión y recibe fotos compartidas */
const VERSION = "sello-v1";
const FILES = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "vendor/exifr.lite.umd.js",
  "vendor/jszip.min.js",
  "fonts/archivo-latin-400-normal.woff2",
  "fonts/archivo-latin-400-italic.woff2",
  "fonts/archivo-latin-500-normal.woff2",
  "fonts/archivo-latin-600-normal.woff2",
  "fonts/archivo-latin-700-normal.woff2",
  "fonts/archivo-latin-800-normal.woff2",
  "fonts/ibm-plex-mono-latin-400-normal.woff2",
  "fonts/ibm-plex-mono-latin-500-normal.woff2",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
  "icons/apple-touch-icon.png",
  "icons/favicon-48.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== "sello-shared").map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  // Fotos compartidas desde la galería (Android): se guardan y se abre la app
  if (e.request.method === "POST" && url.pathname.endsWith("/share-target")) {
    e.respondWith((async () => {
      try {
        const form = await e.request.formData();
        const files = form.getAll("photos");
        const cache = await caches.open("sello-shared");
        for (const k of await cache.keys()) await cache.delete(k);
        let i = 0;
        for (const f of files) {
          if (!f || typeof f === "string") continue;
          await cache.put(new Request("shared/" + (i++)), new Response(f, {
            headers: {
              "Content-Type": f.type || "image/jpeg",
              "X-Name": encodeURIComponent(f.name || "foto_" + i + ".jpg"),
              "X-LastModified": String(f.lastModified || Date.now())
            }
          }));
        }
      } catch (err) {}
      return Response.redirect(new URL("./?shared=1", self.registration.scope).href, 303);
    })());
    return;
  }

  if (e.request.method !== "GET" || url.origin !== self.location.origin) return;

  // Página: primero red (para recibir actualizaciones), si no hay conexión usa la copia guardada
  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request)
        .then((r) => { const copy = r.clone(); caches.open(VERSION).then((c) => c.put("index.html", copy)); return r; })
        .catch(() => caches.match("index.html"))
    );
    return;
  }

  // Recursos: primero la copia guardada
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request)));
});
