// Captura global del evento de instalación de PWA (beforeinstallprompt).
type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };

let deferred: BIPEvent | null = null;
const listeners = new Set<() => void>();
function emit() { listeners.forEach(l => l()); }

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as BIPEvent;
    emit();
  });
  window.addEventListener('appinstalled', () => { deferred = null; emit(); });
}

export function puedeInstalarNativo(): boolean { return deferred !== null; }
export function suscribir(fn: () => void): () => void { listeners.add(fn); return () => { listeners.delete(fn); }; }
export async function instalarNativo(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferred) return 'unavailable';
  await deferred.prompt();
  const { outcome } = await deferred.userChoice;
  if (outcome === 'accepted') deferred = null;
  return outcome;
}

export type Plataforma = 'android' | 'ios' | 'pc';
export function detectarPlataforma(): Plataforma {
  if (typeof navigator === 'undefined') return 'pc';
  const ua = navigator.userAgent || '';
  const esIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (esIOS) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'pc';
}
export function yaInstalada(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as unknown as { standalone?: boolean }).standalone === true;
}
