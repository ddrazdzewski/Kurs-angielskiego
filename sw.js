/* Service worker: strona ma działać offline, np. w pociągu albo w metrze.
   Po zmianie plików podnieś numer wersji, żeby telefony pobrały nową paczkę. */
var CACHE = "kurs-angielskiego-v1";
var ASSETS = [
  ".",
  "index.html",
  "css/style.css",
  "js/app.js",
  "js/data/words.js",
  "js/data/patterns.js",
  "js/data/mistakes.js",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/apple-touch-icon.png"
];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(ASSETS); }).then(function () {
    return self.skipWaiting();
  }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.map(function (k) { return k === CACHE ? null : caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request).then(function (hit) {
      if (hit) {
        // odświeżamy w tle, ale użytkownik dostaje odpowiedź natychmiast
        fetch(e.request).then(function (res) {
          if (res && res.ok) caches.open(CACHE).then(function (c) { c.put(e.request, res.clone()); });
        }).catch(function () { });
        return hit;
      }
      return fetch(e.request).then(function (res) {
        if (res && res.ok && e.request.url.indexOf("http") === 0) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
        }
        return res;
      }).catch(function () { return caches.match("index.html"); });
    })
  );
});
