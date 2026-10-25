# Diagnóstico: los avisos push no llegan con la app cerrada (2026-10-26)

## Causa raíz

El token FCM del celular **cambió** y la app **nunca guardó el nuevo**.

1. FCM rota los tokens: el SDK los renueva periódicamente y emite otro si cambia la
   suscripción push, si se borran los datos del sitio o si se reinstala la PWA.
2. Al abrir la app, `refrescarUltimoUso()` (src/data/notificacionesPush.ts, antes
   líneas 122-140) pedía el token actual pero **solo actualizaba `ultimoUso` si ese
   token ya existía en Firestore**. Un token nuevo se descartaba en silencio.
3. El servidor seguía enviando al token viejo → FCM responde
   `messaging/registration-token-not-registered` (log de notifPrueba, 2026-10-18 04:06).
4. `enviar.ts` (líneas 94-95 y 155-156) borra correctamente el token muerto. A partir
   de ahí el correo queda **sin ningún dispositivo**: por eso los intentos de las 04:07
   no registran warning (no había a quién enviar). El celular no se re-registra solo
   hasta que la persona vuelva a pulsar «Activar».

## Lo que se descartó (con evidencia)

- **Registración del SW:** `getToken` recibe `serviceWorkerRegistration: await
  navigator.serviceWorker.ready` (notificacionesPush.ts:84-85), es decir, la del SW de
  VitePWA con scope `/mjb-prestamos/`. No se registra un `firebase-messaging-sw.js`
  aparte. `skipWaiting/clientsClaim` (vite.config.ts) no cambian la suscripción push:
  ésta pertenece a la registración, no a la versión del script.
- **push-sw.js importado:** `dist/sw.js` contiene `importScripts("push-sw.js")` tras
  `npm run build`; `dist/push-sw.js` existe.
- **Evento push:** push-sw.js:29-78 llama `showNotification` dentro de
  `event.waitUntil`, desenvolviendo el sobre `data` de FCM. Correcto.
- **Envío:** enviar.ts:82-83 y 146 usan `webpush.headers` con `Urgency: high` y TTL.
- **VAPID:** la clave pública (notificacionesPush.ts:12) no figura en ningún otro
  archivo ni documento del repo, así que no se puede contrastar desde el código. Si
  no coincidiera, `getToken` fallaría al activar (no daría un token que luego caduca),
  así que es improbable; comprobarla en Consola Firebase → Cloud Messaging →
  Certificados push web.
- **Samsung / ahorro de batería:** factor a comprobar, no demostrado. Sin evidencia de
  que sea la causa (el error es NotRegistered, que es del lado del token).

## Corrección (implementada, sin desplegar)

`src/data/notificacionesPush.ts`:
- `refrescarUltimoUso()` ahora **guarda el token actual si no existía** (mismo
  formato que `activar()`), y borra el doc del token que ESTE navegador tenía antes
  (hash recordado en `localStorage` `mjb-push-hash-token`). Así no quedan tokens
  viejos junto al bueno.
- `activar()` recuerda el hash y quita la marca de desactivado.
- `desactivarEsteDispositivo()` pone la marca `mjb-push-desactivado` para que la
  re-sincronización no reactive un dispositivo que la persona apagó.

Verificado: `npx tsc -b` (0), `npm run build` (0), build de functions-notificaciones (0).
No requiere cambios en functions ni redespliegue del backend.

## Comprobación en el teléfono (tras desplegar)

1. Abrir la PWA con sesión (dejar que se actualice; cerrar y abrir una vez más).
2. «Mis notificaciones»: el diagnóstico debe mostrar un `hashToken` y
   «este dispositivo tiene token» = sí. Si no, pulsar «Activar» una vez.
3. Cerrar la app del todo (quitarla de recientes) y, desde el PC, enviar la prueba
   (o pedir a alguien un mensaje de chat). Debe aparecer el aviso del sistema.
4. Revisar `npx firebase functions:log --only notifPrueba`: no debe aparecer
   `registration-token-not-registered`.
5. Si llega con la app abierta en segundo plano pero no tras horas cerrada: Ajustes →
   Aplicaciones → Chrome → Batería → «Sin restricciones», y comprobar que Chrome y el
   sitio tienen notificaciones permitidas.
