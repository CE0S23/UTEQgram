# UTEQGram-PWAS: Firebase y Supabase Storage

Proyecto configurado siguiendo el material **06. Proyecto - Firebase**.

## Servicios configurados

- **Firebase:** proyecto `uteqgram-pwas`.
- **Realtime Database:** `https://uteqgram-pwas-default-rtdb.firebaseio.com` en `us-central1`. Se importó `post/first-post` desde [firebase-seed.json](firebase-seed.json).
- **Reglas:** [database.rules.json](database.rules.json) permite leer solo `post` y bloquea las escrituras de clientes. Las reglas ya están publicadas en Firebase Console.
- **Storage:** Firebase Storage requiere actualizar el plan Spark, así que la imagen está en el proyecto `UTEQGram-PWAS-Storage` de Supabase. El bucket público `post-images` admite JPEG de hasta 5 MB. Solo la lectura de archivos es pública; no se creó una política para subidas o borrados de clientes.
- **Imagen de la publicación:** [main-image.jpg](public/src/imagenes/main-image.jpg) está disponible en `https://ytrmgrcvcucwimdbjrcy.supabase.co/storage/v1/object/public/post-images/main-image.jpg`. La misma URL figura en `post/first-post/image`.

## Ejecutar

```powershell
npm install
npm start
```

Abre `http://127.0.0.1:8080/`. [firebase-config.js](public/src/js/firebase-config.js) contiene la URL de la base. [feed.js](public/src/js/feed.js) lee `/post.json` y reemplaza la tarjeta de ejemplo con la publicación remota. [sw.js](public/sw.js) guarda la respuesta para uso sin conexión. El formulario de nuevas publicaciones sigue siendo local, como en el alcance de la guía.

## Evidencias

- [Proyecto Firebase creado](evidencias/01-proyecto-creado.jpg)
- [Realtime Database creada](evidencias/02-realtime-database-creada.jpg)
- [Datos importados](evidencias/03-datos-importados.jpg)
- [Reglas publicadas](evidencias/04-reglas-publicadas.jpg)
- [Requisito de actualización para Firebase Storage](evidencias/05-firebase-storage-requiere-plan.jpg)
- [Código de configuración](evidencias/06-codigo-config-firebase.jpg), [feed](evidencias/08-codigo-feed.jpg) y [service worker](evidencias/09-codigo-service-worker.jpg)
- [Bucket de Supabase](evidencias/11-supabase-bucket-creado.jpg) e [imagen subida](evidencias/12-supabase-imagen-subida.jpg)
- [URL de imagen en Firebase](evidencias/13-firebase-imagen-actualizada.jpg)
- [Ejecución final](evidencias/14-ejecucion-final.jpg)
