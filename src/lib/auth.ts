import { GoogleAuthProvider, signInWithPopup, signInWithCustomToken, signOut, getIdTokenResult } from 'firebase/auth';
import { clearIndexedDbPersistence, doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { auth, db, functions } from './firebase';

const DOMAIN = 'iemanueljbetancur.edu.co';

export async function loginConGoogle() {
  if (!auth) throw new Error('Firebase no está configurado.');
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ hd: DOMAIN, prompt: 'select_account' });
  const cred = await signInWithPopup(auth, provider);
  const email = cred.user.email?.toLowerCase() ?? '';
  if (!email.endsWith('@' + DOMAIN)) {
    await signOut(auth);
    throw new Error('Usa tu cuenta institucional.');
  }
  return cred.user;
}

export async function cerrarSesionGoogle() {
  if (!auth) return;
  await signOut(auth);
  // La cache persistente (IndexedDB) sobrevive al cierre de sesion. En un
  // telefono institucional compartido eso dejaria datos de estudiantes del
  // docente anterior en el dispositivo para el siguiente que entre.
  // clearIndexedDbPersistence() exige que NINGUNA pestaña tenga Firestore
  // activo -- con persistentMultipleTabManager (necesario porque Julian usa
  // varias pestañas) casi siempre habra otra abierta y esto fallara en
  // silencio. Es un best-effort para el caso comun de un telefono con una
  // sola pestaña (el de la coordinadora, por ejemplo), no una garantia.
  if (db) {
    try { await clearIndexedDbPersistence(db); } catch { /* ver nota arriba */ }
  }
}

export interface PerfilFirestore { displayName: string; role: string; active: boolean; sede?: string; }

export async function cargarPerfil(email: string): Promise<PerfilFirestore> {
  if (!db) throw new Error('Firebase no está configurado.');
  const snap = await getDoc(doc(db, 'users', email.toLowerCase()));
  if (!snap.exists()) throw new Error('Usuario no registrado.');
  return snap.data() as PerfilFirestore;
}

export async function getIdTokenActual(): Promise<string | null> {
  return auth?.currentUser ? auth.currentUser.getIdToken() : null;
}

// ── Suplantación real de solo lectura (docs/plan-suplantacion.md) ─────────
// A diferencia del mecanismo viejo (simularUsuario, retirado de store.ts),
// esto no disfraza la interfaz: pide un token personalizado real a la Cloud
// Function `suplantar` y abre sesión de Firebase con él, así que el SERVIDOR
// también evalúa las reglas como si fuera esa persona -- ni más ni menos.

/**
 * Llama a la Cloud Function `suplantar` (región us-central1, mismo patrón que
 * `replaceTeacher` en PanelSuperusuario) y abre sesión con el token que
 * devuelve. La función ya valida en el servidor que quien llama es
 * superusuario, que no viene ya suplantando, y que el objetivo existe, está
 * activo y no es superusuario -- aquí solo se propaga su mensaje de error.
 */
export async function suplantarUsuario(correo: string): Promise<void> {
  if (!auth) throw new Error('Firebase no está configurado.');
  if (!functions) throw new Error('Firebase Functions no está configurado.');
  const llamar = httpsCallable<{ correo: string }, { token: string }>(functions, 'suplantar');
  let token: string;
  try {
    const res = await llamar({ correo });
    token = res.data.token;
  } catch (e) {
    // La función ya devuelve mensajes en español (permission-denied, etc.);
    // se propagan tal cual en vez del "internal" opaco por defecto.
    throw new Error((e as { message?: string })?.message || 'No se pudo suplantar al usuario.');
  }
  await signInWithCustomToken(auth, token);
}

/**
 * Sale de la suplantación: cierra la sesión suplantada y vuelve a entrar con
 * la cuenta institucional real por el mismo flujo de Google que el login
 * normal. Recarga al final porque cachés locales (reservas, notificaciones)
 * quedaron con datos de la identidad suplantada.
 */
export async function salirDeSuplantacion(): Promise<void> {
  await cerrarSesionGoogle();
  await loginConGoogle();
  window.location.reload();
}

/**
 * El claim `suplantadoPor` del token vigente es la ÚNICA fuente de verdad de
 * si la sesión actual está suplantada -- nunca se debe decidir con estado
 * local, que es justamente lo que hacía inservible al mecanismo viejo
 * (la interfaz decía una cosa y el servidor otra).
 */
export async function estaSuplantando(): Promise<boolean> {
  if (!auth?.currentUser) return false;
  const r = await getIdTokenResult(auth.currentUser);
  return Boolean(r.claims.suplantadoPor);
}

/** Correo del superusuario que está suplantando, según el claim del token vigente. */
export async function quienSuplanta(): Promise<string | null> {
  if (!auth?.currentUser) return null;
  const r = await getIdTokenResult(auth.currentUser);
  return (r.claims.suplantadoPor as string | undefined) ?? null;
}
