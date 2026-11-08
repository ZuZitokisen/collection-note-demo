const VERSION = '0.5.26';
const CACHE = 'work-report-shell-v41';
const PREFIX = 'work-report-shell-';
const ROOT = new URL('./', self.location.href);
const ASSETS = ['index.html', 'styles.css', 'ledger-panel.css', 'src/ledger-panel.js', 'src/sheet-connection.js', 'src/ledger-read-client.js', 'src/reports-client.js', 'src/reports-panel.js', 'src/reports-pending.js', 'invoice.css', 'master-reorder.css', 'src/master-reorder.js', 'src/app.js', 'src/original-app.js', 'src/original-data-adapter.js', 'src/legacy-reference.js', 'src/workspace-client.js', 'src/workspace-pending.js', 'src/workspace-recovery-ui.js', 'src/connected-original-app.js', 'src/connection-entry.js', 'src/app-entry.js', 'src/workspace-config.js', 'src/account-seal-store.js', 'src/modal-suspension.js', 'src/browse-record-sync.js', 'src/google-entry.js', 'src/firebase-driver.js', 'src/google-session.js', 'src/session.js', 'src/input-assist.js', 'src/invoice.js', 'src/invoice-document.js', 'src/invoice-settings.js', 'src/invoice-seal.js', 'src/model.js', 'src/domain.js', 'src/updates.js', 'manifest.webmanifest', 'icons/invoice-seal-lowres.png', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable.png', 'icons/apple-touch-icon.png'];
const urls = ASSETS.map(path => new URL(path, ROOT).href);
self.addEventListener('install', event => {
  // Complete this release before activation; failed precache leaves the old worker usable.
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(urls.map(url=>new Request(url,{cache:'reload'})))));
});
self.addEventListener('message', event => {
  if(event.data?.type==='SKIP_WAITING')event.waitUntil(self.skipWaiting());
  if(event.data?.type==='GET_VERSION')event.ports?.[0]?.postMessage({version:VERSION});
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
const fromThisRelease = async request => (await (await caches.open(CACHE)).match(request)) || fetch(request);
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== ROOT.origin) return;
  // version.json and the recovery page deliberately bypass all shell caches.
  if (event.request.mode === 'navigate' && (url.pathname === ROOT.pathname || url.pathname === new URL('index.html', ROOT).pathname)) {
    event.respondWith(fromThisRelease(new URL('index.html', ROOT).href));
  } else if (urls.includes(url.href)) {
    event.respondWith(fromThisRelease(event.request));
  }
});
