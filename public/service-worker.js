const nomeCache = "ctdemar-financeiro-v2";
const arquivosEssenciais = ["/", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png", "/apple-touch-icon.png", "/favicon-32.png"];

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches.open(nomeCache).then((cache) => {
      return cache.addAll(arquivosEssenciais);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches.keys().then((nomes) => {
      return Promise.all(nomes.filter((nome) => nome !== nomeCache).map((nome) => caches.delete(nome)));
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", (evento) => {
  if (evento.request.method !== "GET") return;

  evento.respondWith(
    fetch(evento.request)
      .then((resposta) => {
        const copia = resposta.clone();
        caches.open(nomeCache).then((cache) => cache.put(evento.request, copia));
        return resposta;
      })
      .catch(() => caches.match(evento.request).then((resposta) => resposta || caches.match("/")))
  );
});
