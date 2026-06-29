const CACHE_NAME = 'farm-app-v2';
const urlsToCache = [
    '/',
    '/index.html',
    '/style.css',
    '/script.js',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
    'https://cdn.jsdelivr.net/npm/chart.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
];

// تثبيت Service Worker
self.addEventListener('install', function(event) {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(function(cache) {
                console.log('✅ تم فتح الكاش');
                return cache.addAll(urlsToCache);
            })
            .catch(function(error) {
                console.error('❌ فشل في تحميل الملفات للكاش:', error);
            })
    );
});

// استرجاع الملفات من الكاش
self.addEventListener('fetch', function(event) {
    event.respondWith(
        caches.match(event.request)
            .then(function(response) {
                // لو الملف موجود في الكاش، ارجعه
                if (response) {
                    return response;
                }
                // لو مش موجود، جيبه من الإنترنت
                return fetch(event.request)
                    .then(function(response) {
                        // لو مش ملف من نوع HTML أو CSS أو JS، متحفظش في الكاش
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }
                        // احفظ النسخة الجديدة في الكاش
                        const responseToCache = response.clone();
                        caches.open(CACHE_NAME)
                            .then(function(cache) {
                                cache.put(event.request, responseToCache);
                            });
                        return response;
                    });
            })
    );
});

// تنظيف الكاش القديم عند تفعيل Service Worker جديد
self.addEventListener('activate', function(event) {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then(function(cacheNames) {
            return Promise.all(
                cacheNames.map(function(cacheName) {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        console.log('🗑️ حذف الكاش القديم:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});س