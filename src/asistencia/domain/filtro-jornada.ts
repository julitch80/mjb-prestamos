/**
 * Separar por jornada lo que ve cada coordinador (Julián, 2026-09-23).
 *
 * En la sede central hay dos coordinadores, uno por jornada, y la restriccion ya existe
 * desde el 2026-08-12 (`autoridadSede.soloJornada`, ver `leerAlcanceUsuario`). La planilla
 * y Programas la respetaban; evasiones, permanencia y llegadas tarde no, y a la
 * coordinadora de la manana le llegaban los casos de sexto a octavo, que son de la tarde.
 *
 * ── Es una separacion de VISTA, no de permisos ────────────────────────────────
 * Lo que se filtra es lo que se MUESTRA. Lo que se CALCULA sigue siendo la sede entera, y
 * es a proposito: la apertura automatica de casos de permanencia corre cuando un
 * coordinador abre la pantalla, y si se calculara solo su jornada, un caso de la tarde se
 * abriria unicamente el dia que entrara la coordinadora de la tarde. Julián lo pidio para
 * no abrumar, no para ocultar: las reglas de casos, contactos y evasiones siguen
 * permitiendo a los dos coordinadores leer toda la sede.
 *
 * ── Quien ve que ─────────────────────────────────────────────────────────────
 *  - Coordinador limitado a una jornada: solo la suya, sin selector.
 *  - Todos los demas (el de la otra sede, rectoria, quien no aparezca en `soloJornada`):
 *    ven las dos, como hasta hoy, y pueden escoger una.
 */

import { jornadaDeGrado } from './ids';
import type { Jornada } from './types';

export type FiltroJornada = Jornada | 'ambas';

export const ETIQUETA_JORNADA: Record<Jornada, string> = {
  manana: 'Jornada de la mañana',
  tarde: 'Jornada de la tarde',
};

/** Con que filtro arranca la pantalla: la jornada del coordinador, o las dos. */
export function filtroInicial(limitada: Jornada | null | undefined): FiltroJornada {
  return limitada ?? 'ambas';
}

/**
 * El filtro que de verdad se aplica. Un coordinador limitado NO puede salirse de su
 * jornada aunque el estado de la pantalla dijera otra cosa: la restriccion manda sobre
 * cualquier seleccion.
 */
export function filtroEfectivo(limitada: Jornada | null | undefined, elegido: FiltroJornada): FiltroJornada {
  return limitada ?? elegido;
}

export function coincideJornada(jornada: Jornada, filtro: FiltroJornada): boolean {
  return filtro === 'ambas' || jornada === filtro;
}

/** Por grado: `9.1` es de la mañana y `6º1` de la tarde (la `º` marca la jornada). */
export function gradoEnJornada(grado: string, filtro: FiltroJornada): boolean {
  return coincideJornada(jornadaDeGrado(grado), filtro);
}
