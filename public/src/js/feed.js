var sharedMomentsArea = document.querySelector('#shared-moments');
var shareImageButton = document.querySelector('#share-image-button');
var createPostArea = document.querySelector('#create-post');
var closeCreatePostModalButton = document.querySelector('#close-create-post-modal-btn');
var form = document.querySelector('#create-post form');
var titleInput = document.querySelector('#title');
var locationInput = document.querySelector('#location');
var fallbackImage = '/src/imagenes/main-image.jpg';

function createCard(post) {
  var cardWrapper = document.createElement('div');
  cardWrapper.className = 'shared-moment-card feed-card mdl-card mdl-shadow--2dp';

  var cardTitle = document.createElement('div');
  cardTitle.className = 'mdl-card__title feed-image';
  cardTitle.style.backgroundImage = 'url("' + fallbackImage + '")';
  // Si la imagen del post no carga (URL rota o sin conexión), se queda la imagen local
  if (post.image && post.image !== fallbackImage) {
    var img = new Image();
    img.onload = function () {
      cardTitle.style.backgroundImage = 'url("' + post.image + '")';
    };
    img.src = post.image;
  }
  cardTitle.style.backgroundSize = 'cover';
  cardTitle.style.backgroundPosition = 'center';
  cardWrapper.appendChild(cardTitle);

  var title = document.createElement('h2');
  title.className = 'mdl-card__title-text';
  title.textContent = post.title || 'Sin título';
  title.style.color = 'white';
  title.style.textShadow = '0 1px 3px rgba(0, 0, 0, 0.85)';
  cardTitle.appendChild(title);

  var location = document.createElement('div');
  location.className = 'mdl-card__supporting-text';
  location.textContent = post.location || 'Ubicación desconocida';
  location.style.textAlign = 'center';
  cardWrapper.appendChild(location);

  if (window.componentHandler) {
    window.componentHandler.upgradeElement(cardWrapper);
  }
  sharedMomentsArea.appendChild(cardWrapper);
}

function clearCards() {
  while (sharedMomentsArea.firstChild) {
    sharedMomentsArea.removeChild(sharedMomentsArea.firstChild);
  }
}

function normalizePosts(data) {
  if (!data || typeof data !== 'object') return [];
  return Object.keys(data).map(function (key) {
    var post = data[key];
    if (!post || typeof post !== 'object') return null;
    // Firebase records commonly keep the key separately; IndexedDB requires an id.
    if (!post.id) post.id = key;
    return post;
  }).filter(Boolean);
}

function renderPosts(posts) {
  clearCards();
  if (!posts.length) {
    sharedMomentsArea.textContent = 'Aún no hay publicaciones.';
    return;
  }
  posts.forEach(createCard);
}

// Dibuja los posts y agrega al inicio los que siguen pendientes en 'sync-posts',
// así no desaparecen del feed al recargar mientras esperan a sincronizarse.
function updateUI(data) {
  var posts = Array.isArray(data) ? data : normalizePosts(data);
  if (typeof readAllData !== 'function') {
    renderPosts(posts);
    return Promise.resolve();
  }
  return readAllData('sync-posts')
    .catch(function () { return []; })
    .then(function (pending) {
      var ids = posts.map(function (post) { return String(post.id); });
      var pendingPosts = (pending || [])
        .filter(function (post) { return ids.indexOf(String(post.id)) === -1; })
        .map(function (post) {
          return {
            id: post.id,
            title: post.title,
            location: post.location + ' (pendiente de sincronizar)',
            image: post.image
          };
        });
      renderPosts(pendingPosts.reverse().concat(posts));
    });
}

var databaseUrl = (window.FIREBASE_DATABASE_URL || '').replace(/\/+$/, '');
var postsUrl = databaseUrl ? databaseUrl + '/post.json' : '';
var networkDataReceived = false;

// Show saved posts immediately, then replace them when the network responds.
if ('indexedDB' in window && typeof readAllData === 'function') {
  readAllData('posts')
    .then(function (posts) {
      if (!networkDataReceived) updateUI(posts || []);
    })
    .catch(function (error) {
      console.warn('[Feed] No se pudieron leer publicaciones guardadas.', error);
    });
}

function fetchPosts() {
  if (!postsUrl) return;
  fetch(postsUrl)
    .then(function (response) {
      if (!response.ok) throw new Error('Respuesta HTTP ' + response.status);
      return response.json();
    })
    .then(function (data) {
      networkDataReceived = true;
      var posts = normalizePosts(data);
      updateUI(posts);
      if (typeof clearAllData === 'function' && typeof writeData === 'function') {
        return clearAllData('posts').then(function () {
          return Promise.all(posts.map(function (post) {
            return writeData('posts', post);
          }));
        });
      }
    })
    .catch(function (error) {
      // Network failure is expected offline; cached IndexedDB posts remain visible.
      console.info('[Feed] Se mostrarán las publicaciones guardadas si no hay conexión.', error);
    });
}

fetchPosts();

// Cuando el service worker termina de sincronizar, se recargan los posts desde Firebase
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', function (event) {
    if (event.data && event.data.type === 'sync-posts-done') {
      fetchPosts();
    }
  });
}

// Si hay posts pendientes y hay internet, se le pide al service worker que los envíe ya.
// Justo al regresar la red la conexión puede fallar unos segundos, así que se reintenta
// varias veces (2, 4, 8, 16 y 32 segundos) mientras sigan quedando pendientes.
var flushRetryTimer = null;

function flushPendingPosts(attempt) {
  attempt = attempt || 0;
  clearTimeout(flushRetryTimer);
  if (!navigator.onLine || !('serviceWorker' in navigator) || typeof readAllData !== 'function') return;
  readAllData('sync-posts')
    .then(function (pending) {
      if (!pending || !pending.length) return;
      if (attempt > 0) {
        console.log('[Feed] Reintentando enviar ' + pending.length + ' post(s) pendiente(s), intento ' + (attempt + 1));
      }
      navigator.serviceWorker.ready.then(function (registration) {
        if (registration.active) {
          registration.active.postMessage({ type: 'flush-sync-posts' });
        }
      });
      if (attempt < 5) {
        flushRetryTimer = setTimeout(function () {
          flushPendingPosts(attempt + 1);
        }, 2000 * Math.pow(2, attempt));
      }
    })
    .catch(function (err) {
      console.log(err);
    });
}

window.addEventListener('online', function () {
  flushPendingPosts(0);
});
window.addEventListener('offline', function () {
  clearTimeout(flushRetryTimer);
});
flushPendingPosts(0);

function openCreatePostModal() {
  // createPostArea.style.display = 'block';
  createPostArea.style.transform = 'translateY(0)';
  if (deferredPrompt) {
    deferredPrompt.prompt();

    deferredPrompt.userChoice.then(function (choiceResult) {
      console.log(choiceResult.outcome);

      if (choiceResult.outcome === 'dismissed') {
        console.log('User cancelled installation');
      } else {
        console.log('User added to home screen');
      }
    });

    deferredPrompt = null;
  }
}

function closeCreatePostModal() {
  // createPostArea.style.display = 'none';
  createPostArea.style.transform = 'translateY(100vh)';
}

shareImageButton.addEventListener('click', openCreatePostModal);
closeCreatePostModalButton.addEventListener('click', closeCreatePostModal);

function sendData() {
  fetch(postsUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      id: new Date().toISOString(),
      title: titleInput.value,
      location: locationInput.value,
      image: '/src/imagenes/main-image.jpg'
    })
  })
    .then(function (res) {
      console.log('Sent data', res);
      if (!res.ok) throw new Error('Firebase respondió ' + res.status);
      fetchPosts();
    })
    .catch(function (err) {
      console.log('Error while sending data', err);
    });
}

form.addEventListener('submit', function (event) {
  event.preventDefault();

  if (titleInput.value.trim() === '' || locationInput.value.trim() === '') {
    showToast('Please enter valid data!');
    return;
  }

  closeCreatePostModal();

  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    var post = {
      id: new Date().toISOString(),
      title: titleInput.value,
      location: locationInput.value
    };
    form.reset();
    navigator.serviceWorker.ready
      .then(function (sw) {
        writeData('sync-posts', post)
          .then(function () {
            return sw.sync.register('sync-new-posts');
          })
          .then(function () {
            // Muestra el post en el feed (como pendiente) mientras se sincroniza
            return readAllData('posts').then(updateUI);
          })
          .then(function () {
            var snackbarContainer = document.querySelector('#confirmation-toast');
            var data = {message: 'Your Post was saved for syncing!'};
            snackbarContainer.MaterialSnackbar.showSnackbar(data);
          })
          .catch(function (err) {
            console.log(err);
          });
      });
  } else {
    sendData();
    form.reset();
  }
});
