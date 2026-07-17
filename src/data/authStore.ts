// Bootstrap del login con Google Workspace (Etapa 2 de la migración a Firebase).
// SOLO actúa cuando VITE_AUTH_MODE === 'google' Y Firebase está configurado.
// En modo 'pin' (default) este módulo no hace nada y la app funciona igual
// que hoy — login por PIN, MODO_LOCAL, sin tocar Firebase.
import { onAuthStateChanged } from 'firebase/auth';
import { auth, firebaseConfigurado } from '../lib/firebase';
import { cargarPerfil, cerrarSesionGoogle } from '../lib/auth';
import { useAppStore } from './store';
import { USUARIOS } from './maestros';

export const AUTH_MODE = (import.meta.env.VITE_AUTH_MODE as string) || 'pin';

export function initAuthGoogle() {
  if (AUTH_MODE !== 'google' || !firebaseConfigurado || !auth) return;
  onAuthStateChanged(auth, async (user) => {
    if (!user) { return; }
    const email = user.email?.toLowerCase() ?? '';
    try {
      const perfil = await cargarPerfil(email);
      if (!perfil.active) { await cerrarSesionGoogle(); return; }
      // Etapa 5: resolver puesto→persona. Carga one-shot de users/ para
      // sobreescribir en USUARIOS los datos de quien ocupa cada slot.
      // try/catch silencioso: si las reglas aún no lo permiten, no rompe el login.
      try {
        const [{ collection, getDocs }, { db }, { aplicarPlantillaFirestore }] = await Promise.all([
          import('firebase/firestore'),
          import('../lib/firebase'),
          import('./plantilla'),
        ]);
        if (db) {
          const snap = await getDocs(collection(db, 'users'));
          aplicarPlantillaFirestore(snap.docs.map(d => d.data() as import('./adminUsers').UsuarioFirestore));
        }
      } catch { /* silencioso */ }
      const interno = USUARIOS.find(u => (u.correo || '').toLowerCase() === email);
      const id = interno?.id ?? email;
      const jornada = interno?.jornada === 'ambas' ? 'manana' : (interno?.jornada ?? 'manana');
      const rol = perfil.role || interno?.rol || 'docente';
      const nombre = perfil.displayName || interno?.nombre || email;
      useAppStore.getState().setUsuario(id, nombre, rol, jornada);
    } catch {
      await cerrarSesionGoogle();
    }
  });
}
