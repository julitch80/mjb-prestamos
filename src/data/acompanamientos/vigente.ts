/**
 * Qué distribución de acompañamientos rige en una fecha dada.
 *
 * La regla (PLAN.md §3): cada publicación es un registro completo que nunca se
 * edita ni se borra. La distribución de cualquier día es la última publicación
 * de esa jornada cuya `vigenteDesde` ya llegó; si dos empatan en fecha, gana la
 * publicada más tarde (`publicadoEn`). Sin ninguna publicación, rige la inicial.
 *
 * Funciones puras: no tocan Firestore. Quien lee de la base de datos es
 * `almacen.ts`; estas funciones solo ordenan lo que ya se cargó.
 */

import { distribucionInicial } from './inicial';
import type { Asignacion, Dia, FechaISO, JornadaAcomp, Publicacion } from './tipos';

/**
 * Compara dos publicaciones por vigencia: primero `vigenteDesde` (más reciente
 * gana), y en empate `publicadoEn` (más reciente gana). `null` cuenta como el
 * mayor valor: es una publicación recién hecha cuya hora del servidor aún no
 * llega, así que es la última. La inicial también trae `null`, pero su fecha
 * del año 2000 nunca empata con una real.
 */
function compararVigencia(a: Publicacion, b: Publicacion): number {
  if (a.vigenteDesde !== b.vigenteDesde) {
    return a.vigenteDesde < b.vigenteDesde ? -1 : 1;
  }
  const ea = a.publicadoEn ?? Infinity;
  const eb = b.publicadoEn ?? Infinity;
  if (ea === eb) return 0;
  return ea < eb ? -1 : 1;
}

/** Las publicaciones de esa jornada, ordenadas de más antigua a más reciente. */
function deLaJornada(publicaciones: Publicacion[], jornada: JornadaAcomp): Publicacion[] {
  return publicaciones.filter((p) => p.jornada === jornada).sort(compararVigencia);
}

/** Las que pueden regir: una publicación cancelada queda en el historial pero no rige. */
function activasDeLaJornada(publicaciones: Publicacion[], jornada: JornadaAcomp): Publicacion[] {
  return deLaJornada(publicaciones, jornada).filter((p) => !p.canceladaPor);
}

/**
 * La distribución que rige en `fecha`: de las publicaciones de esa jornada con
 * `vigenteDesde <= fecha`, la de mayor vigencia. Si no hay ninguna (todavía no
 * llegó ninguna fecha, o la jornada no tiene publicaciones), rige la inicial.
 */
export function publicacionVigente(
  publicaciones: Publicacion[],
  jornada: JornadaAcomp,
  fecha: FechaISO,
): Publicacion {
  const candidatas = activasDeLaJornada(publicaciones, jornada).filter((p) => p.vigenteDesde <= fecha);
  if (candidatas.length === 0) return distribucionInicial(jornada);
  return candidatas[candidatas.length - 1];
}

/**
 * La próxima publicación que aún no rige en `fecha` (para el aviso «Cambia
 * desde…»): de las que tienen `vigenteDesde > fecha`, la de menor vigencia.
 * `null` si no hay ninguna programada.
 */
export function proximaPublicacion(
  publicaciones: Publicacion[],
  jornada: JornadaAcomp,
  fecha: FechaISO,
): Publicacion | null {
  const futuras = activasDeLaJornada(publicaciones, jornada).filter((p) => p.vigenteDesde > fecha);
  return futuras.length === 0 ? null : futuras[0];
}

/**
 * El historial completo de una jornada: la inicial primero, y luego las
 * publicaciones reales de más antigua a más reciente.
 */
export function historial(publicaciones: Publicacion[], jornada: JornadaAcomp): Publicacion[] {
  return [distribucionInicial(jornada), ...deLaJornada(publicaciones, jornada)];
}

/** Las asignaciones de un docente en un día concreto (0, 1 o varias si cubre >1 zona). */
export function asignacionesDeDocenteEnDia(pub: Publicacion, docenteId: string, dia: Dia): Asignacion[] {
  return pub.asignaciones.filter((a) => a.docenteId === docenteId && a.dia === dia);
}

/** Las asignaciones de una zona en un día concreto (tantas como su cupo). */
export function asignacionesDeZonaEnDia(pub: Publicacion, zonaId: string, dia: Dia): Asignacion[] {
  return pub.asignaciones.filter((a) => a.zonaId === zonaId && a.dia === dia);
}
