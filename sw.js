// Review-only shell update. Retains every prior cache and all report/auth storage.
const VERSION='0.5.30';
const CACHE='work-report-shell-review-20261112-v1';
const ROOT=new URL('./',self.location.href);
const ASSETS=['index.html','review-app.js','styles.css','ledger-panel.css','master-reorder.css','invoice.css','manifest.webmanifest','icons/invoice-seal-lowres.png','icons/icon.svg','icons/icon-192.png','icons/icon-512.png','icons/icon-maskable.png','icons/apple-touch-icon.png'];
const urls=ASSETS.map(path=>new URL(path,ROOT).href);
self.addEventListener('install',event=>{
  // Complete the new shell first. Do not skip waiting or delete older caches.
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(urls.map(url=>new Request(url,{cache:'reload'})))));
});
self.addEventListener('message',event=>{
  if(event.data?.type==='SKIP_WAITING')event.waitUntil(self.skipWaiting());
  if(event.data?.type==='GET_VERSION')event.ports?.[0]?.postMessage({version:VERSION});
});
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
async function reviewShell(url){
  const cache=await caches.open(CACHE);
  try{const response=await fetch(new Request(url,{cache:'no-cache'}));if(response.ok){await cache.put(url,response.clone());return response;}}catch{}
  const saved=await cache.match(url);
  return saved||new Response('確認用画面を取得できません。接続を確認して再度開いてください。保存済みデータは変更していません。',{status:503,headers:{'Content-Type':'text/plain;charset=UTF-8'}});
}
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.origin!==ROOT.origin)return;
  const navigation=event.request.mode==='navigate'&&(url.pathname===ROOT.pathname||url.pathname===new URL('index.html',ROOT).pathname);
  if(navigation)event.respondWith(reviewShell(new URL('index.html',ROOT).href));
  else if(urls.includes(url.href))event.respondWith(reviewShell(url.href));
});
