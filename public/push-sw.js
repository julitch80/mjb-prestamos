// Service worker de notificaciones push (Etapa 1 — docs/notificaciones-push).
//
// NO es un service worker aparte: se importa DENTRO del que ya genera
// VitePWA (workbox.importScripts en vite.config.ts), porque dos service
// workers compitiendo por el mismo scope se estorban. Este archivo solo
// agrega los listeners 'push' y 'notificationclick'; el ciclo de vida
// (install/activate/fetch/cache) lo sigue llevando Workbox.
//
// El payload que manda functions-notificaciones/src/enviar.ts es SOLO DATOS
// (data-only, no 'notification'): así el navegador nunca decide el texto por
// su cuenta y el SW puede decidir si mostrarla (ver más abajo).

self.addEventListener('push', (event) => {
  let datos = {};
  try {
    const crudo = event.data ? event.data.json() : {};
    // FCM entrega los mensajes de solo datos envueltos: { data: {...}, from,
    // fcmMessageId, ... }. Sin desenvolverlo, título y cuerpo salían vacíos.
    datos = (crudo && typeof crudo.data === 'object' && crudo.data) ? crudo.data : (crudo || {});
  } catch (e) {
    datos = {};
  }
  const titulo = datos.title || 'MJB Préstamos';
  const cuerpo = datos.body || '';
  const url = datos.url || '/mjb-prestamos/';
  const tag = datos.tag || 'mjb-generico';
  const tipo = datos.tipo || '';

  event.waitUntil((async () => {
    // Diagnóstico: anota que FCM SÍ entregó al SW (Cache API, legible desde la
    // página) y avisa a las ventanas abiertas. Se hace ANTES de todo lo demás.
    let estado = 'recibido';
    const anotar = async (extra) => {
      const reg = { cuando: Date.now(), titulo, estado: extra || estado };
      try {
        const cache = await caches.open('mjb-diag');
        await cache.put('/mjb-prestamos/__ultimo-push', new Response(JSON.stringify(reg)));
      } catch (e) { /* diagnóstico, no crítico */ }
      try {
        const cl = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        cl.forEach((c) => c.postMessage({ tipo: 'mjb-push-recibido', ...reg }));
      } catch (e) { /* idem */ }
    };
    await anotar();
    // Si la app está abierta y visible, el hook useNotificacionesSistema ya la
    // muestra dentro de la interfaz: no duplicar el aviso del sistema
    // operativo, pero sí dejar el número en el ícono.
    const clientes = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const hayVisible = clientes.some((c) => c.visibilityState === 'visible');

    if (!hayVisible) {
      try {
        await self.registration.showNotification(titulo, {
          body: cuerpo,
          tag,
          renotify: true,
          icon: '/mjb-prestamos/icons/icon-192-v3.png',
          badge: '/mjb-prestamos/icons/icon-192-v3.png',
          data: { url, tipo },
        });
        await anotar('mostrado');
      } catch (e) {
        await anotar('showNotification falló: ' + (e && e.message ? e.message : e));
      }
    } else {
      await anotar('omitido: la app está visible (se muestra dentro de la app)');
    }

    if ('setAppBadge' in self.navigator) {
      try {
        const actual = await self.registration.getNotifications();
        await self.navigator.setAppBadge(Math.max(actual.length, 1));
      } catch (e) {
        // Algunos navegadores exponen setAppBadge pero lo rechazan (p. ej. sin
        // instalar como app): no es un error que deba romper la entrega.
      }
    }
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/mjb-prestamos/';
  const urlAbsoluta = new URL(url, self.location.origin).href;

  event.waitUntil((async () => {
    const clientes = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of clientes) {
      // Ya hay una ventana de la app abierta: enfocarla y navegarla ahí,
      // en vez de abrir una pestaña nueva (móvil ya tiene poco espacio).
      if (c.url.startsWith(self.location.origin + '/mjb-prestamos/')) {
        await c.focus();
        if ('navigate' in c) {
          try {
            await c.navigate(urlAbsoluta);
          } catch (e) {
            c.postMessage({ tipo: 'mjb-push-navegar', url: urlAbsoluta });
          }
        } else {
          c.postMessage({ tipo: 'mjb-push-navegar', url: urlAbsoluta });
        }
        return;
      }
    }
    await self.clients.openWindow(urlAbsoluta);
  })());
});
