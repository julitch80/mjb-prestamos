/**
 * De donde sale la identidad de quien escribe. Punto unico, a proposito.
 *
 * ⚠️ LA REGLA MAS FACIL DE ROMPER DE TODO EL MODULO.
 *
 * MJB tiene un modo "Ver como": el superusuario puede simular ser otro usuario, y
 * entonces `userId`, `rol` y `jornada` del store reflejan la identidad SIMULADA. El
 * propio `store.ts` de MJB advierte que el chat toma el remitente de
 * `auth.currentUser.email` y no del store, porque las reglas exigen que coincida con el
 * usuario realmente autenticado.
 *
 * Asistencia tiene el mismo problema y peor consecuencia. Si el autor saliera del
 * store, durante una simulacion pasaria una de dos cosas:
 *   - la regla rechazaria la escritura (`ultimaEscrituraPor != callerEmail()`), o
 *   - quedaria un registro de asistencia atribuido a un docente que no lo hizo.
 * En un modulo cuya unica garantia es la trazabilidad, lo segundo la vaciaria de
 * sentido.
 *
 * Por eso: el store decide QUE MOSTRAR; esto decide QUIEN FIRMA.
 */

import { auth, esperarAuth } from '../lib/firebase';

/** Correo autenticado real, en minusculas. `null` si no hay sesion resuelta. */
export function correoAutor(): string | null {
  return auth?.currentUser?.email?.toLowerCase() ?? null;
}

/**
 * Correo autenticado, esperando a que Firebase resuelva la sesion.
 *
 * Al recargar, el store persistido conoce al usuario cientos de milisegundos antes de
 * que `auth.currentUser` exista; sin esperar, toda lectura o escritura disparada en ese
 * hueco falla en silencio.
 */
export async function correoAutorAsync(): Promise<string | null> {
  const hay = await esperarAuth();
  return hay ? correoAutor() : null;
}

/** Lanza si no hay sesion. Para usar justo antes de escribir. */
export async function exigirAutor(): Promise<string> {
  const correo = await correoAutorAsync();
  if (!correo) {
    throw new Error('No hay sesion activa. Vuelva a entrar antes de registrar.');
  }
  return correo;
}
