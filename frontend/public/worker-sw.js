const WORKER_CACHE="workhive-worker-shell-v1";
self.addEventListener("activate",event=>event.waitUntil(self.clients.claim()));
self.addEventListener("fetch",event=>{
    const url=new URL(event.request.url);
    if(event.request.method!=="GET"||url.origin!==self.location.origin)return;
    const page=event.request.mode==="navigate"&&(url.pathname==="/worker"||url.pathname.startsWith("/worker/"));
    const asset=url.pathname.startsWith("/_next/static/");
    if(!page&&!asset)return;
    event.respondWith((async()=>{const cache=await caches.open(WORKER_CACHE),key=page?url.pathname.replace(/\/$/,""):event.request;try{const response=await fetch(event.request);if(response.ok&&!response.redirected)await cache.put(key,response.clone());return response;}catch(error){const stored=await cache.match(key);if(stored)return stored;throw error;}})());
});
