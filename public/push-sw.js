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
    datos = event.data ? event.data.json() : {};
  } catch (e) {
    datos = {};
  }
  const titulo = datos.title || 'MJB Préstamos';
  const cuerpo = datos.body || '';
  const url = datos.url || '/mjb-prestamos/';
  const tag = datos.tag || 'mjb-generico';
  const tipo = datos.tipo || '';

  event.waitUntil((async () => {
    // Si la app está abierta y visible, el hook useNotificacionesSistema ya la
    // muestra dentro de la interfaz: no duplicar el aviso del sistema
    // operativo, pero sí dejar el número en el ícono.
    const clientes = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const hayVisible = clientes.some((c) => c.visibilityState === 'visible');

    if (!hayVisible) {
      await self.registration.showNotification(titulo, {
        body: cuerpo,
        tag,
        renotify: true,
        icon: '/mjb-prestamos/icons/icon-192-v3.png',
        badge: '/mjb-prestamos/icons/icon-192-v3.png',
        data: { url, tipo },
      });
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
