import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
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
  if (auth) await signOut(auth);
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
