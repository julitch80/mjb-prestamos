// Auto-limpiador de caché: si hay una versión más nueva publicada, limpia el
// service worker y las cachés y recarga una sola vez. Evita el "baile del caché".
const GUARD = 'mjb-auto-reloaded';

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
    if (sessionStorage.getItem(GUARD)) return; // ya intentamos en esta sesión: no repetir (evita bucle)
    sessionStorage.setItem(GUARD, '1');

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
