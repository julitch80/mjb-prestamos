// Cliente de notificaciones push (Etapa 1 — docs/notificaciones-push/PRD.md).
// Firebase-only, no-op si `db`/`auth` no están configurados (modo PIN).
import { doc, getDoc, serverTimestamp, setDoc, deleteDoc } from 'firebase/firestore';
import { getMessaging, getToken, deleteToken, isSupported, type Messaging } from 'firebase/messaging';
import { app, auth, db } from '../lib/firebase';
import { PREFERENCIAS_DEFAULT, type PreferenciasNotif } from './notificacionesPushLogica';

// Clave pública VAPID del proyecto (docs/notificaciones-push/PLAN.md — no es
// secreta, es la contraparte pública de la llave que Julián generó una vez en
// la consola de Firebase; Cloud Messaging → Configuración web).
const VAPID_KEY = 'BHBocftm1oCP-FJSCVL-P2LvOkG2Zzi2GCERHYTiH_kOed2JuqCnYpheIdt1S8LABgIUyINu_OSNLRDNU7e1WTQ';

function miEmail(): string | null {
  return auth?.currentUser?.email?.toLowerCase() ?? null;
}

/** true si este navegador puede recibir push de la app instalada. En iOS,
 * SOLO cuando la app corre en modo standalone (agregada a pantalla de inicio,
 * iOS 16.4+): Safari normal no soporta Push aunque las APIs existan. */
export async function soportado(): Promise<boolean> {
  if (!app) return false;
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return false;
  }
  const esIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  if (esIOS) {
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (!standalone) return false;
  }
  try {
    return await isSupported();
  } catch {
    return false;
  }
}

/** Hash corto y estable del token, para usarlo como id de documento sin
 * guardar el token completo en la ruta (Firestore admite hasta 1500 bytes en
 * un id, pero un token FCM es largo y no aporta nada legible ahí). */
async function hashToken(token: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

function plataformaActual(): string {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  if (/Windows/.test(ua)) return 'windows';
  if (/Mac/.test(ua)) return 'mac';
  return 'otro';
}

function userAgentCorto(): string {
  return navigator.userAgent.slice(0, 120);
}

let messagingCache: Messaging | null | undefined;
async function obtenerMessaging(): Promise<Messaging | null> {
  if (messagingCache !== undefined) return messagingCache;
  if (!app || !(await soportado())) { messagingCache = null; return null; }
  try {
    messagingCache = getMessaging(app);
  } catch {
    messagingCache = null;
  }
  return messagingCache;
}

/** Pide permiso y activa este dispositivo: registra el token FCM en
 * `notifDispositivos/{correo}/items/{hash}`. Devuelve el resultado del
 * permiso ('granted' | 'denied' | 'default'). */
export async function activar(): Promise<NotificationPermission> {
  const correo = miEmail();
  if (!db || !correo) return 'default';
  const messaging = await obtenerMessaging();
  if (!messaging) return 'default';

  const permiso = await Notification.requestPermission();
  if (permiso !== 'granted') return permiso;

  const registro = await navigator.serviceWorker.ready;
  const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registro });
  if (!token) return 'denied';

  const id = await hashToken(token);
  await setDoc(doc(db, 'notifDispositivos', correo, 'items', id), {
    token,
    creadoEn: serverTimestamp(),
    ultimoUso: serverTimestamp(),
    plataforma: plataformaActual(),
    userAgentCorto: userAgentCorto(),
  });
  return 'granted';
}

/** Desactiva SOLO este dispositivo: borra su token de FCM y de Firestore.
 * Los demás dispositivos de la persona (si los hay) siguen activos. */
export async function desactivarEsteDispositivo(): Promise<void> {
  const correo = miEmail();
  const messaging = await obtenerMessaging();
  if (messaging) {
    try {
      const registro = await navigator.serviceWorker.ready;
      const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registro });
      if (token && db && correo) {
        const id = await hashToken(token);
        await deleteDoc(doc(db, 'notifDispositivos', correo, 'items', id));
      }
      await deleteToken(messaging);
    } catch {
      // Si el token ya no existe o el navegador lo rechaza, no hay nada que
      // deshacer: el objetivo (que este dispositivo no reciba más) ya se cumple.
    }
  }
}

/** Refresca `ultimoUso` del token de este dispositivo, si ya estaba activo.
 * Se llama al abrir la app con sesión — no pide permiso ni crea nada nuevo. */
export async function refrescarUltimoUso(): Promise<void> {
  const correo = miEmail();
  if (!db || !correo || Notification.permission !== 'granted') return;
  const messaging = await obtenerMessaging();
  if (!messaging) return;
  try {
    const registro = await navigator.serviceWorker.ready;
    const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registro });
    if (!token) return;
    const id = await hashToken(token);
    const ref = doc(db, 'notifDispositivos', correo, 'items', id);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      await setDoc(ref, { ultimoUso: serverTimestamp() }, { merge: true });
    }
  } catch {
    // No crítico: el próximo `activar()` vuelve a dejarlo al día.
  }
}

/** Preferencias guardadas de la persona, o el default (todo encendido) si
 * nunca las guardó. */
export async function leerPreferencias(): Promise<PreferenciasNotif> {
  const correo = miEmail();
  if (!db || !correo) return { ...PREFERENCIAS_DEFAULT };
  const snap = await getDoc(doc(db, 'notifPreferencias', correo));
  if (!snap.exists()) return { ...PREFERENCIAS_DEFAULT };
  return { ...PREFERENCIAS_DEFAULT, ...(snap.data() as Partial<PreferenciasNotif>) };
}

export async function guardarPreferencias(prefs: PreferenciasNotif): Promise<void> {
  const correo = miEmail();
  if (!db || !correo) return;
  await setDoc(doc(db, 'notifPreferencias', correo), prefs);
}

/** Deep link tras tocar una notificación: limpia el badge del ícono. Se llama
 * al abrir la app con sesión (App.tsx). */
export function limpiarBadge(): void {
  const nav = navigator as unknown as { clearAppBadge?: () => Promise<void> };
  nav.clearAppBadge?.().catch(() => {});
}
