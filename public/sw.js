/* Service worker: cache cangkang aplikasi + terima Web Push.
   Ini satu-satunya bagian yang tetap hidup saat aplikasi ditutup. */

const CACHE = 'tank-shell-v1';
const SHELL = ['/', '/devices', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Network-first untuk navigasi, agar data konfigurasi tidak basi,
// tapi tetap bisa dibuka saat kandang tidak ada sinyal.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
          return res;
        })
        .catch(() => caches.match(request).then((r) => r || caches.match('/'))),
    );
  }
});

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { /* payload bukan JSON */ }

  const critical = data.severity === 'critical';
  const title = data.title || 'Peringatan suhu tanki';
  const options = {
    body: data.body || '',
    tag: data.tag || `tank-${data.tankId || 'unknown'}`,
    renotify: true,
    requireInteraction: critical,
    // Getaran panjang-pendek-panjang untuk kondisi kritis agar terasa beda di saku.
    vibrate: critical ? [300, 120, 300, 120, 300] : [200, 100, 200],
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    timestamp: data.ts || Date.now(),
    data: { url: data.url || `/?tank=${data.tankId || ''}` },
    actions: [{ action: 'open', title: 'Lihat tanki' }],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) { c.navigate(url); return c.focus(); }
      }
      return self.clients.openWindow(url);
    }),
  );
});
