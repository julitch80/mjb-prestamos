/**
 * Metas automáticas por profesor: cuántos acompañamientos por semana le
 * tocarían a cada uno si se reparte el total de casillas en proporción a su
 * peso de carga (mixtos = 0.5, los demás = 1) — la misma cuenta que ya hacía
 * el generador para la equidad, pero expuesta como función pura y testable
 * para poder inicializar `Distribucion.metas` (ver tipos.ts, borrador.ts).
 *
 * Reparto: cada docente parte de `round(peso * totalCasillas / sumaPesos)`;
 * la suma de esos redondeos casi nunca da exacto el total de casillas, así
 * que se ajusta en 1 a la vez —sumando o restando— a quien tenga el resto
 * más favorable (el docente cuyo valor real está más lejos de su entero
 * redondeado, en la dirección que hace falta), hasta que la suma cuadre.
 * Si no hay a quién ajustar (por ejemplo cero docentes), se deja como está.
 */

import type { Distribucion } from './tipos';
import { DIAS } from './tipos';
import { docentesDeLaJornada, pesoDeCarga } from './disponibilidad';

export function metasAutomaticas(dist: Distribucion): Record<string, number> {
  const docentes = docentesDeLaJornada(dist.jornada);
  const totalCasillas = dist.zonas.reduce((s, z) => s + z.cupo * DIAS.length, 0);
  const sumaPesos = docentes.reduce((s, u) => s + pesoDeCarga(u.id, dist.jornada), 0);

  const metas: Record<string, number> = {};
  if (docentes.length === 0 || sumaPesos === 0) {
    for (const u of docentes) metas[u.id] = 0;
    return metas;
  }

  const reales = new Map<string, number>();
  for (const u of docentes) {
    const real = (pesoDeCarga(u.id, dist.jornada) * totalCasillas) / sumaPesos;
    reales.set(u.id, real);
    metas[u.id] = Math.round(real);
  }

  let sumaActual = docentes.reduce((s, u) => s + metas[u.id], 0);

  // Ajusta de a 1 hasta que la suma cuadre con el total de casillas, cediendo
  // primero a quien tenga el resto más favorable en esa dirección. Tope de
  // iteraciones por seguridad (nunca se necesitan más que unas pocas decenas
  // con los tamaños reales del colegio).
  let vueltas = 0;
  while (sumaActual !== totalCasillas && vueltas < 1000) {
    vueltas += 1;
    const subir = sumaActual < totalCasillas;
    let elegido: string | null = null;
    let mejorResto = subir ? -Infinity : Infinity;
    for (const u of docentes) {
      const real = reales.get(u.id)!;
      const resto = real - metas[u.id]; // positivo: le deben más; negativo: le sobra
      if (subir ? resto > mejorResto : resto < mejorResto) {
        mejorResto = resto;
        elegido = u.id;
      }
    }
    if (!elegido) break; // no debería pasar con docentes.length > 0, pero por seguridad
    metas[elegido] += subir ? 1 : -1;
    if (metas[elegido] < 0) metas[elegido] = 0; // nunca meta negativa
    sumaActual = docentes.reduce((s, u) => s + metas[u.id], 0);
  }

  return metas;
}

/**
 * Metas iguales a lo que cada profesor tiene hoy en la distribución. Es el punto
 * de partida del editor cuando la vigente no trae metas: Julián pidió que el
 * número arranque en la carga actual (Uriel con 3) y desde ahí se ajuste. El
 * reparto parejo queda en «Volver a lo automático».
 */
export function metasDesdeCargaActual(dist: Distribucion): Record<string, number> {
  const metas: Record<string, number> = {};
  for (const u of docentesDeLaJornada(dist.jornada)) metas[u.id] = 0;
  for (const a of dist.asignaciones) metas[a.docenteId] = (metas[a.docenteId] ?? 0) + 1;
  return metas;
}
