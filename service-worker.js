// Service Worker - معهد الإمام سحنون
// يسمح بتثبيت التطبيق واستخدامه بدون إنترنت (Offline)

const CACHE_NAME = 'sahnoun-app-v1';

// الملفات الأساسية التي تُخزَّن للعمل offline
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './logo_16.png',
  './logo_32.png',
  './logo_192.png',
  './logo_512.png',
  './logo_180.png',
  './favicon.ico'
];

// عند التثبيت (Install) - تخزين الملفات
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('تم فتح Cache');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting()) // تفعيل فوري
  );
});

// عند التفعيل (Activate) - حذف الإصدارات القديمة من Cache
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('حذف Cache قديم:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// عند طلب موارد (Fetch) - التحقق من Cache أولاً
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // إن وجد في Cache، أعرضه
        if (response) {
          return response;
        }
        // وإلا اذهب للشبكة (Network)
        return fetch(event.request)
          .then((networkResponse) => {
            // تجاهل الطلبات غير الصالحة أو من مواقع خارجية
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
              return networkResponse;
            }
            // تخزين نسخة في Cache للمرة القادمة
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
            return networkResponse;
          })
          .catch(() => {
            // إذا فشلت الشبكة ولم يوجد في Cache، أعرض صفحة offline بسيطة
            if (event.request.mode === 'navigate') {
              return caches.match('./index.html');
            }
          });
      })
  );
});
