const CACHE_NAME = 'heightmate-v6.4';

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(k => k !== CACHE_NAME)
                    .map(k => caches.delete(k))
            );
        })
    );
});

const ASSETS = [
    './',
    './index.html',
    './css/styles.css',
    './js/app.js',
    './js/auth.js',
    './js/db.js',
    './js/profiles.js',
    './js/utils.js',
    './js/who_data.js',
    './icon.png'
];

self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
    );
});

self.addEventListener('fetch', event => {
    // Network first, fallback to cache
    event.respondWith(
        fetch(event.request)
            .then(response => {
                // If valid, clone and update cache
                if (response && response.status === 200 && response.type === 'basic') {
                    const resClone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, resClone));
                }
                return response;
            })
            .catch(() => caches.match(event.request))
    );
});
