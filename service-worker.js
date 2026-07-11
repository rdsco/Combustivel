const CACHE_NAME='abastecimentos-v21';
const ASSETS=['./','./index.html','./manifest.json','./abastecimentos-dados.json'];

self.addEventListener('install',e=>{
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(c=>c.addAll(ASSETS))
      .then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate',e=>{
  e.waitUntil(
    caches.keys().then(keys=>{
      return Promise.all(
        keys.map(key=>{
          if(key !== CACHE_NAME){
            return caches.delete(key);
          }
        })
      );
    }).then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',e=>{
  // Nao intercepta requisicoes de gravacao (POST, PUT, etc.) ou chamadas para o Supabase e mapas
  if(
    e.request.method !== 'GET' || 
    e.request.url.includes('supabase.co') || 
    e.request.url.includes('nominatim') || 
    e.request.url.includes('tile.openstreetmap.org')
  ){
    return;
  }
  
  e.respondWith(
    fetch(e.request)
      .then(res=>{
        if(res && res.status === 200 && res.type === 'basic'){
          const resClone = res.clone();
          caches.open(CACHE_NAME).then(c=>c.put(e.request, resClone));
        }
        return res;
      })
      .catch(()=>caches.match(e.request))
  );
});