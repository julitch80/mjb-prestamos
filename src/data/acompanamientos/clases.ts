/**
 * Cuántas clases tiene un docente cada día, en cada jornada — la base de la
 * regla «el acompañamiento va donde el profesor tiene menos clases» (ver PRD.md
 * § «Reglas de reparto»).
 *
 * Cuenta BLOQUES DISTINTOS con clase de ese docente ese día (no filas de
 * `horarioBase`: un bloque con dos filas —por ejemplo un CI compartido— cuenta
 * una sola vez).
 */

import { horarioBase } from '../horarioBase';
import type { Dia, JornadaAcomp } from './tipos';
import { DIAS } from './tipos';

/**
 * DIA_CARGADO: un día con 5 o más clases se evita para el acompañamiento
 * (decisión de Julián, PRD.md § «Reglas de reparto»: «Un día con 5 o 6 clases
 * se evita»).
 */
export const DIA_CARGADO = 5;

/** Bloques distintos con clase de `docenteId`, en `jornada`, el día `dia`. */
export function clasesEnDia(docenteId: string, jornada: JornadaAcomp, dia: Dia): number {
  const bloques = new Set<number>();
  for (const e of horarioBase) {
    if (e.docente === docenteId && e.jornada === jornada && e.dia === dia) {
      bloques.add(e.bloque);
    }
  }
  return bloques.size;
}

/** El mapa día -> número de clases, para los 5 días de la semana. */
export function clasesPorDia(docenteId: string, jornada: JornadaAcomp): Record<Dia, number> {
  const resultado = {} as Record<Dia, number>;
  for (const dia of DIAS) {
    resultado[dia] = clasesEnDia(docenteId, jornada, dia);
  }
  return resultado;
}

/**
 * Profesores reales con algún día de 5 o 6 clases (calculado sobre
 * `horarioBase` el 2026-09-13, para que el generador (6.1) sepa evitarlos y
 * las pruebas puedan verificarlo con nombres concretos):
 *
 * Mañana: monica_c (viernes 6), uriel (martes 6), claudia (miércoles 6),
 * carlos (lunes 5, miércoles 5, jueves 5), julian (miércoles 6),
 * margara (martes 5), beatriz (martes 5, jueves 6), marta (lunes 5),
 * johana (miércoles 6), gloria_a (lunes 5, viernes 5), ledis (lunes 6,
 * jueves 5), adolfo (lunes 6, martes 5), jorge (miércoles 6),
 * doris (martes 5, miércoles 6).
 *
 * Tarde: edgar (miércoles 6), carolina (lunes 6, martes 5),
 * monica_rave (lunes 6), fredy_g (viernes 6), fredy_garcia (lunes 5,
 * jueves 6), marta (jueves 6), luis_javier (martes 5, jueves 6),
 * marina (martes 5, miércoles 6), luis_angel (martes 5, jueves 6),
 * juan_pablo (lunes 6, viernes 5), hugo (lunes 5, martes 5),
 * valentina (viernes 6), monica_c (lunes 5, miércoles 5),
 * yanet (lunes 6, viernes 6), yoguis (miércoles 6),
 * harol (martes 5, viernes 5).
 */
