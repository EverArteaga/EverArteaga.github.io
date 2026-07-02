// sw.js — Service Worker: habilita instalación PWA + recibe push reales
const CACHE_NAME = "recuerdos-cache-v1";
const CORE_ASSETS = [
    "/Index.html",
    "/manifest.json",
    "/icon-192.png",
    "/icon-512.png"
];

// ── INSTALL: precachear lo básico — si algo falla, no bloquear la instalación ──
self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) =>
            Promise.allSettled(CORE_ASSETS.map(url => cache.add(url)))
        )
    );
    self.skipWaiting();
});

// ── ACTIVATE: limpiar caches viejos ──
self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
        )
    );
    self.clients.claim();
});

// ── FETCH: cache-first para lo estático, red directa para todo lo demás ──
self.addEventListener("fetch", (event) => {
    const url = new URL(event.request.url);
    if (url.origin !== location.origin) return;

    event.respondWith(
        caches.match(event.request).then((cached) => {
            return cached || fetch(event.request).catch(() => caches.match("/Index.html"));
        })
    );
});

// ── PUSH: llega una notificación real desde el servidor (Edge Function) ──
self.addEventListener("push", (event) => {
    let payload = { title: "💌 Nuestros Recuerdos", body: "Tienes algo nuevo", icon: "/icon-192.png" };
    try {
        if (event.data) payload = { ...payload, ...event.data.json() };
    } catch (e) {
        if (event.data) payload.body = event.data.text();
    }

    const options = {
        body: payload.body,
        icon: payload.icon || "/icon-192.png",
        badge: "/icon-192.png",
        vibrate: [100, 50, 100],
        data: { url: payload.url || "/" },
        tag: payload.tag || "recuerdos-notif"
    };

    event.waitUntil(self.registration.showNotification(payload.title, options));
});

// ── CLICK en la notificación: abrir/enfocar la app ──
self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const targetUrl = event.notification.data?.url || "/";

    event.waitUntil(
        self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientsArr) => {
            const existing = clientsArr.find((c) => c.url.includes(location.origin));
            if (existing) {
                existing.focus();
                return existing.navigate(targetUrl);
            }
            return self.clients.openWindow(targetUrl);
        })
    );
});
