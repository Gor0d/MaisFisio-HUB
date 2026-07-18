const CACHE = "maisfisio-v2";
const APP_SHELL = ["/login", "/icon.svg", "/manifest.webmanifest"];
// Apenas recursos estáticos podem ser cacheados. Páginas autenticadas carregam
// dados clínicos e nunca devem permanecer no cache do dispositivo (LGPD,
// computadores compartilhados nos hospitais).
const STATIC = /^\/(_next\/static\/|icon\.svg$|manifest\.webmanifest$)/;

self.addEventListener("install", (event) => event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL))));
self.addEventListener("activate", (event) => event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))));
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== location.origin) return;
  if (STATIC.test(url.pathname)) {
    event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
      const copy = response.clone();
      caches.open(CACHE).then((cache) => cache.put(event.request, copy));
      return response;
    })));
    return;
  }
  // Páginas: sempre rede; offline cai na tela de login em cache, sem dados.
  event.respondWith(fetch(event.request).catch(() => caches.match("/login")));
});
