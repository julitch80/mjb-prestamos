// Espejo de los directores de grupo en Firestore, para que las reglas de
// seguridad del módulo de asistencia puedan resolver quién dirige cada grupo.
//
// POR QUÉ EXISTE: las reglas no pueden leer el código de la app, y "director de
// grupo" no es un valor de `role`. Así que se escribe un único documento,
// `asistenciaConfig/directores`, con el mapa grado → slotId. La fuente de verdad
// sigue siendo maestros.ts; este documento es solo su proyección.
//
// Se escribe desde la app (superusuario) y no con un script de servidor: las
// reglas ya permiten a isSuper() escribir en asistenciaConfig, así que no hace
// falta descargar la clave de servicio cada vez que cambie un director.
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { DIRECTORES_MANANA, DIRECTORES_TARDE } from './maestros';

export const RUTA_DIRECTORES = 'asistenciaConfig/directores';

/** Mapa grado → slotId con las dos jornadas juntas. */
export function mapaDirectores(): Record<string, string> {
  return { ...DIRECTORES_MANANA, ...DIRECTORES_TARDE };
}

/**
 * Sincroniza el espejo con lo que dice maestros.ts. Idempotente: se puede
 * volver a correr cuando cambie un director de grupo.
 * Devuelve cuántos grupos quedaron registrados.
 */
export async function sincronizarDirectores(): Promise<number> {
  if (!db || !auth?.currentUser) throw new Error('No hay sesión de Firebase.');
  const mapa = mapaDirectores();
  // El mapa va anidado bajo `mapa` y se escribe con setDoc (no updateDoc)
  // porque un grado de la mañana como "9.1" se interpretaría como ruta de campo
  // anidada: el punto es el separador de rutas en Firestore.
  await setDoc(doc(db, 'asistenciaConfig', 'directores'), {
    mapa,
    actualizadoPor: auth.currentUser.email?.toLowerCase() ?? '',
    actualizadoEn: serverTimestamp(),
  });
  return Object.keys(mapa).length;
}
