importScripts('/src/js/firebase-config.js');
importScripts('/src/js/idb.js');
importScripts('/src/js/utility.js');

var CACHE_STATIC_NAME = 'uteqgram-static-v16';
var CACHE_DYNAMIC_NAME = 'uteqgram-dynamic-v5';
var APP_SHELL = [
  '/',
  '/index.html',
  '/help/index.html',
  '/offline.html',
  '/src/js/app.js',
  '/src/js/feed.js',
  '/src/js/firebase-config.js',
  '/src/js/idb.js',
  '/src/js/utility.js',
  '/src/js/material.min.js',
  '/src/css/app.css',
  '/src/css/feed.css',
  '/src/css/help.css',
  '/src/css/material.indigo-pink.min.css',
  '/src/imagenes/main-image.jpg',
  '/manifest.json',
  '/src/imagenes/icons/icon-192x192.png',
  '/src/imagenes/icons/icon-512x512.png'
];

self.addEventListener('install', function (event) {
  console.log('[Service Worker] Instalando y guardando los archivos de la aplicación.');
  event.waitUntil(
    caches.open(CACHE_STATIC_NAME)
      .then(function (cache) {
        return cache.addAll(APP_SHELL);
      })
      .then(function () {
        return self.skipWaiting();
      })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (cacheNames) {
        return Promise.all(cacheNames.map(function (cacheName) {
          if (cacheName !== CACHE_STATIC_NAME && cacheName !== CACHE_DYNAMIC_NAME) {
            return caches.delete(cacheName);
          }
        }));
      })
      .then(function () {
        return self.clients.claim();
      })
  );
});

function isAppShellRequest(requestUrl) {
  var url = new URL(requestUrl);
  return url.origin === self.location.origin &&
    APP_SHELL.indexOf(url.pathname) !== -1;
}

self.addEventListener('fetch', function (event) {
  var request = event.request;
  if (request.method !== 'GET') return;
  // Solo se manejan peticiones http(s); se ignoran las de extensiones del navegador
  if (!request.url.startsWith('http')) return;

  var databaseUrl = (self.FIREBASE_DATABASE_URL || '').replace(/\/+$/, '');
  var postsUrl = databaseUrl ? databaseUrl + '/post.json' : '';

  // Firebase posts are refreshed from the network and read from Cache API offline.
  if (postsUrl && request.url === postsUrl) {
    event.respondWith(
      fetch(request)
        .then(function (response) {
          if (!response.ok) return response;
          var responseCopy = response.clone();
          return caches.open(CACHE_DYNAMIC_NAME)
            .then(function (cache) {
              return cache.put(request, responseCopy).then(function () {
                return response;
              }).catch(function () {
                return response;
              });
            });
        })
        .catch(function () {
          return caches.match(request);
        })
    );
    return;
  }

  if (isAppShellRequest(request.url)) {
    // App shell files are cached on install; fall back to network if a cache is missing.
    event.respondWith(
      caches.match(request)
        .then(function (cachedResponse) {
          return cachedResponse || fetch(request);
        })
    );
    return;
  }

  event.respondWith(
    caches.match(request)
      .then(function (cachedResponse) {
        if (cachedResponse) return cachedResponse;
        return fetch(request).then(function (response) {
          if (response && (response.ok || response.type === 'opaque')) {
            var responseCopy = response.clone();
            caches.open(CACHE_DYNAMIC_NAME).then(function (cache) {
              return cache.put(request, responseCopy).catch(function () {});
            });
          }
          return response;
        });
      })
      .catch(function () {
        // Only navigation requests can use an HTML offline fallback.
        if (request.mode === 'navigate') {
          return caches.match('/offline.html');
        }
        return Response.error();
      })
  );
});

// Ids de posts que se están enviando, para no mandar el mismo post dos veces
// si el sync del navegador y el aviso de la página llegan al mismo tiempo.
var sendingPostIds = {};

function notifyClients() {
  return self.clients.matchAll().then(function(clients) {
    clients.forEach(function(client) {
      client.postMessage({ type: 'sync-posts-done' });
    });
  });
}

function sendPendingPosts() {
  return readAllData('sync-posts')
    .then(function(data) {
      var toSend = data.filter(function(dt) { return !sendingPostIds[dt.id]; });
      if (!toSend.length) return;

      // Se devuelven todas las peticiones para que waitUntil espere a que terminen.
      // Si alguna falla, la promesa se rechaza y el navegador reintenta el sync después.
      return Promise.all(toSend.map(function(dt) {
        sendingPostIds[dt.id] = true;
        return fetch(self.FIREBASE_DATABASE_URL + '/post.json', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            id: dt.id,
            title: dt.title,
            location: dt.location,
            image: '/src/imagenes/main-image.jpg'
          })
        })
          .then(function(res) {
            console.log('Sent data', res);
            if (!res.ok) {
              throw new Error('Firebase respondió ' + res.status);
            }
            // dt pertenece a esta función, así que se borra el post correcto
            return deleteItemFromData('sync-posts', dt.id);
          })
          .finally(function() {
            delete sendingPostIds[dt.id];
          });
      }))
        .then(notifyClients);
    });
}

self.addEventListener('sync', function(event) {
  console.log('[Service Worker] Background syncing', event);
  if (event.tag === 'sync-new-posts') {
    console.log('[Service Worker] Syncing new Posts');
    event.waitUntil(
      sendPendingPosts()
        .catch(function(err) {
          console.log('Error while sending data', err);
          throw err;
        })
    );
  }
});

// La página pide enviar los pendientes en cuanto detecta conexión. Así no hay que esperar
// al reintento del navegador, que después de varios fallos puede tardar varios minutos.
self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'flush-sync-posts') {
    console.log('[Service Worker] Enviando posts pendientes por aviso de la página');
    event.waitUntil(
      sendPendingPosts()
        .catch(function(err) {
          console.log('Error while sending data', err);
        })
    );
  }
});
