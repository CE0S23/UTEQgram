// app.js - Lógica principal de UTEQGram
// Registra el service worker, guarda el aviso de instalación y maneja las notificaciones.

// Guarda el evento de instalación para mostrarlo al abrir el modal de crear post
var deferredPrompt;

window.addEventListener('beforeinstallprompt', function (event) {
  console.log('beforeinstallprompt fired');
  event.preventDefault();
  deferredPrompt = event;
  return false;
});

// Registra el service worker (sw.js)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
}

// Muestra un mensaje usando el snackbar de Material Design Lite
function showToast(message) {
  var toast = document.querySelector('#confirmation-toast');
  if (toast && toast.MaterialSnackbar) {
    toast.MaterialSnackbar.showSnackbar({ message: message, timeout: 3000 });
  } else {
    alert(message);
  }
}

// Botones "Habilitar Notificaciones" (menú superior y drawer)
var notificationButtons = document.querySelectorAll('.enable-notifications');
notificationButtons.forEach(function (button) {
  button.addEventListener('click', function () {
    if ('Notification' in window) {
      Notification.requestPermission().then(function (permission) {
        if (permission === 'granted') {
          showToast('¡Notificaciones habilitadas!');
        } else {
          showToast('Permiso denegado');
        }
      });
    } else {
      showToast('Tu navegador no soporta notificaciones');
    }
  });
});
