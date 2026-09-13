/**
 * Textos puros para las pantallas de acompañamientos. Separado de los
 * componentes (tarea 7.4) para poder probarlo sin React.
 */

import type { Distribucion, FechaISO } from './tipos';
import { cargaPorDocente } from './revision';
import { docentesDeLaJornada, esMixto, pesoDeCarga } from './disponibilidad';

const DIAS_SEMANA: Record<string, string> = {
  lunes: 'lunes', martes: 'martes', miercoles: 'miércoles',
  jueves: 'jueves', viernes: 'viernes', sabado: 'sábado', domingo: 'domingo',
};
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** Día de la semana de una fecha 'YYYY-MM-DD', sin líos de huso horario. */
function diaSemana(f: FechaISO): string {
  const [y, m, d] = f.split('-').map(Number);
  // new Date(y, m-1, d) usa hora local; con horas en 12:00 se evita cualquier
  // corrimiento de día por DST/huso.
  const fecha = new Date(y, m - 1, d, 12);
  const dias = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
  return dias[fecha.getDay()];
}

/** «lunes 21 de septiembre» a partir de una fecha ISO. */
export function fechaLegibleAcomp(f: FechaISO): string {
  const [, m, d] = f.split('-').map(Number);
  return `${DIAS_SEMANA[diaSemana(f)]} ${d} de ${MESES[m - 1]}`;
}

/** El aviso de la pestaña Acompañamiento cuando hay una próxima publicación programada. */
export function textoCambiaDesde(vigenteDesde: FechaISO): string {
  return `Cambia desde el ${fechaLegibleAcomp(vigenteDesde)}`;
}

/**
 * Texto legible del aviso 'carga_desigual' que genera `revision.ts` (que dice
 * «diferencia normalizada 3.0», jerga que un coordinador no entiende). Arma
 * la frase «Fulano (mixto, cuenta a la mitad) queda con N acompañamientos, el
 * doble de su meta; Mengano tiene M» a partir de `cargaPorDocente` y
 * `pesoDeCarga` — sin tocar `revision.ts`.
 *
 * Si no hay docentes en la jornada, o nadie tiene carga, devuelve null (no
 * hay nada que explicar).
 */
export function textoCargaDesigual(dist: Distribucion): string | null {
  const docentes = docentesDeLaJornada(dist.jornada);
  if (docentes.length === 0) return null;
  const carga = cargaPorDocente(dist);

  let maxDocente = docentes[0];
  let minDocente = docentes[0];
  let maxNormalizada = -Infinity;
  let minNormalizada = Infinity;
  for (const u of docentes) {
    const total = carga.get(u.id)?.total ?? 0;
    const normalizada = total / pesoDeCarga(u.id, dist.jornada);
    if (normalizada > maxNormalizada) {
      maxNormalizada = normalizada;
      maxDocente = u;
    }
    if (normalizada < minNormalizada) {
      minNormalizada = normalizada;
      minDocente = u;
    }
  }
  if (maxNormalizada - minNormalizada <= 1) return null;

  const totalMax = carga.get(maxDocente.id)?.total ?? 0;
  const totalMin = carga.get(minDocente.id)?.total ?? 0;

  function frase(docente: typeof maxDocente, total: number, esElMax: boolean): string {
    const etiquetaMixto = esMixto(docente.id) ? ' (mixto, cuenta a la mitad)' : '';
    const plural = total === 1 ? 'acompañamiento' : 'acompañamientos';
    if (!esElMax) return `${docente.nombreCorto}${etiquetaMixto} tiene ${total} ${plural}`;
    // Compara el total del que más tiene contra la meta implícita del que menos
    // tiene (su propia carga normalizada), en veces — «el doble», «el triple» —
    // solo cuando es un múltiplo entero limpio; si no, en número llano.
    const veces = minNormalizada > 0 ? totalMax / (minNormalizada * pesoDeCarga(docente.id, dist.jornada)) : null;
    let comparacion = '';
    if (veces !== null && Number.isFinite(veces) && Math.abs(veces - Math.round(veces)) < 0.05 && Math.round(veces) >= 2) {
      const n = Math.round(veces);
      const PALABRAS: Record<number, string> = { 2: 'el doble', 3: 'el triple', 4: 'el cuádruple' };
      comparacion = `, ${PALABRAS[n] ?? `${n} veces más`} de su meta`;
    }
    return `${docente.nombreCorto}${etiquetaMixto} queda con ${total} ${plural}${comparacion}`;
  }

  return `${frase(maxDocente, totalMax, true)}; ${frase(minDocente, totalMin, false)}.`;
}
