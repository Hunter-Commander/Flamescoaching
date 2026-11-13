const CACHE='flames-coaching-shell-v1';
const SHELL=['./coaching.html','./coaching.css','./app.mjs','./config.js','./firebase-client.mjs','./persistence.mjs','./sample.mjs','./functions/domain.mjs'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('flames-coaching-shell-')&&k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET')return;
  const own=url.origin===self.location.origin && SHELL.some(p=>new URL(p,self.location.href).pathname===url.pathname);
  const sdk=url.origin==='https://www.gstatic.com' && url.pathname.startsWith('/firebasejs/13.3.0/');
  if(!own&&!sdk)return;
  // Network first ensures updated public Firebase config is not indefinitely stale.
  // Never cache auth/function/Firestore responses or personal records here.
  event.respondWith(fetch(event.request).then(response=>{
    if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));}return response;
  }).catch(()=>caches.match(event.request).then(cached=>cached||Response.error())));
});
