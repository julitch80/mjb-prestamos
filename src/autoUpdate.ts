// Auto-limpiador de caché: si hay una versión más nueva publicada, limpia el
// service worker y las cachés y recarga una sola vez. Evita el "baile del caché".
const GUARD = 'mjb-auto-reloaded';
const REINTENTO_MS = 15 * 60_000;

async function check(): Promise<void> {
  try {
    const url = `${import.meta.env.BASE_URL}version.json?t=${Date.now()}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return;
    const data = (await res.json()) as { buildId?: string };
    if (!data.buildId || data.buildId === __BUILD_ID__) {
      sessionStorage.removeItem(GUARD); // versión al día: permite futuras detecciones
      return;
    }
    // Evita el bucle, pero sin rendirse para siempre. Antes la marca era
    // permanente en la sesión: si justo después de un despliegue GitHub Pages
    // aún servía la página vieja (su caché dura ~10 min), la recarga traía la
    // misma versión, la marca quedaba puesta y la app NO volvía a intentarlo
    // hasta cerrarla. Así pasó el 15-09-2026: los profesores siguieron con una
    // versión anterior a los acompañamientos publicados. Ahora reintenta cada 15 min.
    const ultimo = Number(sessionStorage.getItem(GUARD) || 0);
    if (Date.now() - ultimo < REINTENTO_MS) return;
    sessionStorage.setItem(GUARD, String(Date.now()));

    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
    window.location.reload();
  } catch {
    // sin conexión u otro error: ignorar silenciosamente
  }
}

export function initAutoUpdate(): void {
  check();
  setInterval(check, 60_000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check();
  });
}
