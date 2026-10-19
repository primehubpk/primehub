const CACHE='primehub-social-ai-v3';
const ASSETS=['/','/index.html','/styles.css','/app.js?v=2','/apps.js?v=2','/account-hub.js?v=3','/icon.svg'];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return;
  event.respondWith(fetch(req).then(resp=>{
    if(resp.ok){const clone=resp.clone();caches.open(CACHE).then(cache=>cache.put(req,clone)).catch(()=>{});}
    return resp;
  }).catch(()=>caches.match(req).then(cached=>cached||(req.mode==='navigate'?caches.match('/'):Response.error()))));
});