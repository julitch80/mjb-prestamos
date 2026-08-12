import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, type Auth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, type Firestore } from 'firebase/firestore';
import { getFunctions, type Functions } from 'firebase/functions';

const cfg = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
};

export const firebaseConfigurado = Boolean(cfg.apiKey && cfg.projectId);

export const app: FirebaseApp | null = firebaseConfigurado ? initializeApp(cfg as Record<string, string>) : null;
export const auth: Auth | null = app ? getAuth(app) : null;
// Cache persistente en IndexedDB, no solo en memoria: un docente pasando
// lista en un salon sin señal necesita que la planilla abra con los datos
// que ya bajaron antes y que sus marcas sobrevivan a cerrar la app. El
// service worker permite abrir sin red; sin esto, abria "vacio" y parecia
// funcionar sin funcionar. `persistentMultipleTabManager` es obligatorio:
// Julian trabaja con varias pestañas abiertas, y sin el la persistencia solo
// funciona en la primera. `initializeFirestore` debe llamarse antes de
// cualquier otro uso de Firestore -- aqui es la primera linea que lo toca,
// asi que la posicion ya es correcta. Modo incognito y algunos navegadores
// con almacenamiento restringido rechazan la persistencia: el SDK cae de
// vuelta a memoria en vez de fallar, asi que no rompe, solo pierde el
// beneficio offline en esos casos.
export const db: Firestore | null = app
  ? initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    })
  : null;
export const functions: Functions | null = app ? getFunctions(app, 'us-central1') : null;

/**
 * Resuelve cuando Firebase Auth ya restauró (o descartó) la sesión.
 * Al recargar la página, el store persistido conoce al usuario mucho antes de
 * que `auth.currentUser` exista; sin esperar, toda lectura de Firestore se
 * dispara sin credenciales y falla en silencio.
 */
export function esperarAuth(): Promise<boolean> {
  return new Promise((resolve) => {
    if (!auth) return resolve(false);
    if (auth.currentUser) return resolve(true);
    const off = onAuthStateChanged(auth, (user) => {
      off();
      resolve(Boolean(user));
    });
  });
}
