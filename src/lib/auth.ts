import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { clearIndexedDbPersistence, doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';

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
