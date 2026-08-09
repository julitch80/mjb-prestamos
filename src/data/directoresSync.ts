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
import { collection, doc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { AUTORIDAD_SEDE, DIRECTORES_MANANA, DIRECTORES_TARDE, SEDES, USUARIOS, type SedeId } from './maestros';

export const RUTA_DIRECTORES = 'asistenciaConfig/directores';
export const RUTA_AUTORIDAD = 'asistenciaConfig/autoridadSede';

/**
 * Mapa sede → correos de los coordinadores con autoridad en esa sede.
 *
 * Se guardan CORREOS y no slotId a propósito: en las reglas la identidad
 * garantizada es `callerEmail()`, mientras que `slotId` depende de que el
 * documento del usuario en Firestore lo tenga bien puesto. Si faltara, el
 * coordinador se quedaría sin acceso sin que nadie entienda por qué.
 */
export function mapaAutoridadSede(): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const sede of SEDES) {
    const ids = AUTORIDAD_SEDE[sede.id as SedeId] ?? [];
    out[sede.id] = ids
      .map((id) => USUARIOS.find((u) => u.id === id)?.correo?.toLowerCase() ?? '')
      .filter(Boolean);
  }
  return out;
}

/** Mapa grado → slotId con las dos jornadas juntas. */
export function mapaDirectores(): Record<string, string> {
  return { ...DIRECTORES_MANANA, ...DIRECTORES_TARDE };
}

/**
 * Mapa grado → CORREOS que pueden cambiar la fotografía de un estudiante de ese grado:
 * su director de grupo, los coordinadores y el superusuario.
 *
 * POR QUÉ CORREOS Y NO `slotId`, teniendo ya `mapa`: las reglas de Cloud Storage solo
 * admiten DOS consultas a Firestore por petición (medido contra producción el
 * 2026-08-05: con 2 pasa, con 3 falla). La regla gasta una en la ficha del estudiante
 * —para saber su grado— y otra en este documento. No queda ninguna para leer
 * `users/{correo}` y traducir el puesto, así que la traducción se hace aquí.
 *
 * Es la misma razón por la que `mapaAutoridadSede()` guarda correos, escrita arriba.
 *
 * `mapa` se conserva: las reglas de Firestore sí tienen presupuesto para resolver el
 * puesto, y ahí el `slotId` es preferible porque sobrevive al reemplazo de un docente.
 */
export function mapaFotosPorGrado(directivos: string[]): Record<string, string[]> {
  const correoDe = (id: string) =>
    USUARIOS.find((u) => u.id === id)?.correo?.toLowerCase() ?? '';

  const out: Record<string, string[]> = {};
  for (const [grado, slotId] of Object.entries(mapaDirectores())) {
    // Se filtran las vacías: una cadena vacía en la lista casaría con cualquier fallo de
    // resolución del correo y otorgaría el permiso por accidente.
    out[grado] = [...new Set([correoDe(slotId), ...directivos].filter(Boolean))];
  }
  return out;
}

/**
 * Correos de quienes mandan en cualquier grado: coordinación y superusuario.
 *
 * Salen de Firestore y NO de `USUARIOS`, por dos razones. La primera es que el rol
 * `superusuario` ni siquiera existe en el tipo de la lista estática — vive solo en
 * `users/{correo}.role`, que es lo que lee `authStore`. La segunda es que así se respeta
 * `active`: una cuenta desactivada no entra en la lista.
 *
 * El alcance es el mismo que tenía la regla anterior, que autorizaba a cualquier
 * coordinador sin acotar por sede. Al cambiar de mecanismo no se amplía nada.
 */
async function correosDirectivos(): Promise<string[]> {
  if (!db) return [];
  const snap = await getDocs(collection(db, 'users'));
  return snap.docs
    .map((d) => d.data())
    .filter((u) => u.active === true && (u.role === 'superusuario' || u.role === 'coordinador'))
    .map((u) => String(u.email ?? '').toLowerCase())
    .filter(Boolean);
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
    // Lo consumen las reglas de Storage, que no tienen presupuesto de consultas para
    // resolver el puesto. Ver `mapaFotosPorGrado()`.
    fotos: mapaFotosPorGrado(await correosDirectivos()),
    actualizadoPor: auth.currentUser.email?.toLowerCase() ?? '',
    actualizadoEn: serverTimestamp(),
  });
  return Object.keys(mapa).length;
}

/**
 * Sincroniza el espejo de autoridad por sede. Las reglas no pueden leer
 * AUTORIDAD_SEDE de maestros.ts, así que sin este documento cualquier
 * coordinador podría registrar asistencia en cualquier sede.
 * Devuelve cuántas sedes quedaron registradas.
 */
export async function sincronizarAutoridadSede(): Promise<number> {
  if (!db || !auth?.currentUser) throw new Error('No hay sesión de Firebase.');
  const mapa = mapaAutoridadSede();
  await setDoc(doc(db, 'asistenciaConfig', 'autoridadSede'), {
    mapa,
    actualizadoPor: auth.currentUser.email?.toLowerCase() ?? '',
    actualizadoEn: serverTimestamp(),
  });
  return Object.keys(mapa).length;
}
