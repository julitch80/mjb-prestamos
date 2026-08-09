/**
 * Resolucion del bloque de clase segun la hora de llegada.
 *
 * Se usa para que "llegadas tarde a la institucion" registre el bloque REAL en el que
 * el estudiante entra a clase, en vez de un numero fijo que no refleja a quien llega a
 * media manana o media tarde.
 */

import type { BloqueHorario } from '../../data/maestros';

/**
 * Comparamos horas como texto 'HH:MM' (comparacion lexicografica) y no con objetos
 * Date: alcanza porque el formato es de ancho fijo, y evita arrastrar zona horaria —
 * la misma clase de error que ya nos dio problemas con las fechas (ver domain/ids.ts).
 */
export function bloqueDeHora(bloques: BloqueHorario[], hhmm: string): number {
  if (bloques.length === 0) throw new Error('No hay bloques definidos para esta jornada');

  // Antes del primer bloque: quien llega antes de empezar la jornada entra al primero.
  if (hhmm < bloques[0].inicio) return bloques[0].id;

  for (const b of bloques) {
    if (hhmm >= b.inicio && hhmm < b.fin) return b.id;
  }

  // No cayo dentro de ningun bloque: o esta en un descanso (hueco entre el fin de uno y
  // el inicio del siguiente) o es posterior al ultimo bloque del dia.
  const siguiente = bloques.find((b) => hhmm < b.inicio);
  if (siguiente) return siguiente.id;

  // Posterior al ultimo bloque: se registra en el ultimo, no se inventa un bloque 7.
  return bloques[bloques.length - 1].id;
}
