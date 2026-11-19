const CACHE = "workhive-offline-v1";
self.addEventListener("activate", event => {
    event.waitUntil(self.clients.claim());
});
self.addEventListener("fetch", event => {
    const url = new URL(event.request.url);
    if (event.request.method !== "GET" || url.origin !== self.location.origin) return;
    const isPage = event.request.mode === "navigate" && url.pathname === "/dashboard/mi-jornada";
    const isAsset = url.pathname.startsWith("/_next/static/");
    if (!isPage && !isAsset) return;
    event.respondWith((async () => {
        const cache = await caches.open(CACHE);
        const key = isPage ? "/dashboard/mi-jornada" : event.request;
        try {
            const response = await fetch(event.request);
            if (response.ok && !response.redirected) await cache.put(key, response.clone());
            return response;
        } catch (error) {
            const cached = await cache.match(key);
            if (cached) return cached;
            throw error;
        }
    })());
});
