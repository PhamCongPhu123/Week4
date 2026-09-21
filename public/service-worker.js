const CACHE_NAME = 'market-survey-shell-v2';
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icons/icon.svg'];
const DB_NAME = 'market-survey-db';
const DB_VERSION = 2;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).then((response) => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', copy));
      return response;
    }).catch(() => caches.match('/index.html')));
    return;
  }
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
    if (response.ok && new URL(event.request.url).origin === self.location.origin) {
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
    }
    return response;
  })));
});

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function idbRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function backgroundSync() {
  const db = await openDatabase();
  const readTx = db.transaction(['surveys', 'settings'], 'readonly');
  const surveys = await idbRequest(readTx.objectStore('surveys').index('syncStatus').getAll('pending'));
  const setting = await idbRequest(readTx.objectStore('settings').get('syncUrl'));
  if (!setting?.value) { db.close(); return; }
  let count = 0;
  for (const survey of surveys) {
    const response = await fetch(setting.value, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(survey) });
    if (!response.ok) throw new Error(`Sync failed: ${response.status}`);
    survey.syncStatus = 'synced';
    survey.syncedAt = new Date().toISOString();
    const writeTx = db.transaction('surveys', 'readwrite');
    await idbRequest(writeTx.objectStore('surveys').put(survey));
    count += 1;
  }
  db.close();
  if (count) await self.registration.showNotification('Đồng bộ hoàn tất', { body: `${count} phiếu đã được gửi lên Google Sheets.`, icon: '/icons/icon.svg', badge: '/icons/icon.svg' });
}

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-surveys') event.waitUntil(backgroundSync());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => clients[0]?.focus() || self.clients.openWindow('/')));
});
