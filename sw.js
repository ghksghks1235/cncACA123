// Network-only application: no student data or stale screens are stored in CacheStorage.
self.addEventListener('install',()=>{});
self.addEventListener('activate',event=>{event.waitUntil(self.clients.claim())});
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 // Leave database, cross-origin, and save requests completely untouched.
 if(request.method!=='GET'||url.origin!==self.location.origin||request.mode!=='navigate')return;
 event.respondWith(fetch(request,{cache:'no-store'}).catch(()=>new Response('<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>씨앤씨 · 연결 확인</title><body style="font-family:sans-serif;padding:32px;line-height:1.7;color:#324664"><h2>인터넷 연결을 확인해주세요</h2><p>출결·진도 기록은 인터넷에 연결된 상태에서 사용할 수 있어요.</p><button onclick="location.reload()" style="padding:12px 18px">다시 연결</button></body></html>',{status:503,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}})));
});
