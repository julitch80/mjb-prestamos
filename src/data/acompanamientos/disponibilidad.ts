/**
 * Quién puede cubrir un acompañamiento de descanso, en qué jornada y qué día.
 *
 * Estas reglas NO se deducen del código existente (`getDocentes` sirve a otras
 * pantallas y no las cumple): las dio Julián a mano, ver PRD.md § «Reglas de
 * reparto» y las instrucciones de la tarea 3.1.
 *
 * Resumen de las reglas:
 * - Un profesor cubre solo acompañamientos de SU jornada.
 * - Un MIXTO (tiene entrada en `MIXTOS_TARDE`) cubre en cada jornada solo los
 *   días que le corresponden a esa jornada: los de `MIXTOS_TARDE[id]` en la
 *   tarde, y el resto de días de la semana en la mañana.
 * - EDGAR es caso especial: `MIXTOS_TARDE['edgar']` tiene los 5 días, así que
 *   no le queda ningún día de mañana. No es "mixto" a efectos de reparto (su
 *   peso de carga es 1, no 0.5): es un profesor de tarde de tiempo completo.
 *   Su Centro de Interés del martes en la mañana NO lo hace parte de la
 *   mañana — el CI no participa en absoluto de este módulo.
 * - Un usuario con `jornada: 'ambas'` que NO está en `MIXTOS_TARDE` (yuri,
 *   alexander: docentes de apoyo sin grupos) no participa en acompañamientos
 *   en ninguna jornada.
 * - Solo rol 'docente' y sede central (misma sede que ya usa `getDocentes`).
 */

import { USUARIOS, MIXTOS_TARDE, type Usuario } from '../maestros';
import type { Dia, JornadaAcomp } from './tipos';
import { DIAS } from './tipos';

/** Docentes de sede central con rol 'docente' — la población de este módulo. */
function docentesCentral(): Usuario[] {
  return USUARIOS.filter((u) => u.rol === 'docente' && (u.sede ?? 'central') === 'central');
}

/**
 * ¿Es un docente "mixto" para efectos de reparto? Tiene entrada en
 * `MIXTOS_TARDE` con entre 1 y 4 días (no los 5): con los 5 días no le queda
 * ningún día de mañana, así que es de tarde completo, no mixto (caso Edgar).
 */
export function esMixto(docenteId: string): boolean {
  const dias = MIXTOS_TARDE[docenteId];
  return !!dias && dias.length >= 1 && dias.length <= 4;
}

/** ¿Puede este docente cubrir un acompañamiento de esa jornada, ese día? */
export function puedeCubrir(docenteId: string, jornada: JornadaAcomp, dia: Dia): boolean {
  const usuario = docentesCentral().find((u) => u.id === docenteId);
  if (!usuario) return false;

  const diasTarde = MIXTOS_TARDE[docenteId];

  if (jornada === 'tarde') {
    if (usuario.jornada === 'tarde') return true;
    if (usuario.jornada === 'ambas' && diasTarde) return diasTarde.includes(dia);
    return false;
  }

  // jornada === 'manana'
  if (usuario.jornada === 'manana') return true;
  if (usuario.jornada === 'ambas' && esMixto(docenteId)) {
    // Sus días de mañana son los que NO le tocan en la tarde.
    return !diasTarde!.includes(dia);
  }
  // 'ambas' sin ser mixto (yuri, alexander) o de tarde completo (edgar): no cubre mañana.
  return false;
}

/** Docentes que pueden cubrir al menos un día de esa jornada, por nombre. */
export function docentesDeLaJornada(jornada: JornadaAcomp): Usuario[] {
  return docentesCentral()
    .filter((u) => DIAS.some((dia) => puedeCubrir(u.id, jornada, dia)))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

/** Días de la semana en los que este docente puede cubrir esa jornada. */
export function diasDisponibles(docenteId: string, jornada: JornadaAcomp): Dia[] {
  return DIAS.filter((dia) => puedeCubrir(docenteId, jornada, dia));
}

/**
 * Peso de carga para la equidad y la meta de los mixtos: 1 para tiempo
 * completo en la jornada, 0.5 para un mixto (su meta es la mitad).
 */
export function pesoDeCarga(docenteId: string, _jornada: JornadaAcomp): number {
  return esMixto(docenteId) ? 0.5 : 1;
}
