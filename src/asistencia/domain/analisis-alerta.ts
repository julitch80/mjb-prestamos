/**
 * Analisis de la alerta academica de un grupo (Julian, 2026-10-24): lo que el director
 * presenta y discute con su grupo despues de cada alerta. Graficos simples, sin terminos de
 * estadistica («7 estudiantes», no «23,3 % de la muestra»).
 *
 * Con NOMBRES en la app (el director siempre los ve). Al exportar o presentar elige: con
 * nombres, o SIN nombres para el salon. Sin nombres solo van graficos de conjunto, y una
 * asignatura con UN solo estudiante en alerta se agrupa en «Otras» para que no se adivine
 * quien es.
 */

import { combinarPlanillas, MINIMO_PARA_CITAR, type FilaConsolidado } from './alerta-academica';
import type { PlanillaAlerta } from './types';

export interface Barra {
  clave: string;
  etiqueta: string;
  /** Estudiantes (no alertas). */
  n: number;
  /** Quienes son: solo para la vista con nombres. */
  ids: string[];
  /** Barra de los que se citan (dos o mas asignaturas). */
  seCita?: boolean;
  /** Asignatura que aun no entrega: su 0 todavia no dice nada. */
  pendiente?: boolean;
}

export interface AnalisisGrupo {
  total: number;
  sinAlerta: number;
  conAlguna: number;
  citados: number;
  /** 0..100, entero. */
  porcentajeSinAlerta: number;
  porcentajeCitados: number;
  /** 0, 1, 2, 3 y «4 o más» asignaturas en alerta. */
  distribucion: Barra[];
  /** TODAS las asignaturas del grupo, tambien las de 0 (Julian, 2026-10-25), de mas a menos. */
  porAsignatura: Barra[];
  /** Asignaturas que entregaron sin nadie en alerta. */
  sinNadieEnAlerta: string[];
  /** Asignaturas que aun no entregan: los numeros pueden subir. */
  pendientes: string[];
}

export const porcentaje = (n: number, total: number): number => (total > 0 ? Math.round((n / total) * 100) : 0);

export function analizarGrupo(
  filas: FilaConsolidado[],
  esperadas: { subjectId: string; nombre: string }[],
  faltantes: string[],
): AnalisisGrupo {
  const total = filas.length;
  const nombre = (s: string) => esperadas.find((e) => e.subjectId === s)?.nombre ?? s;
  const cubos = [0, 1, 2, 3, 4].map((k) => ({
    clave: String(k),
    etiqueta: k === 4 ? '4 o más' : String(k),
    n: 0,
    ids: [] as string[],
    seCita: k >= MINIMO_PARA_CITAR,
  }));
  const porAsig = new Map<string, string[]>();
  for (const f of filas) {
    const c = cubos[Math.min(4, f.total)];
    c.n++;
    c.ids.push(f.studentId);
    for (const s of f.enAlerta) porAsig.set(s, [...(porAsig.get(s) ?? []), f.studentId]);
  }
  const claves = [...new Set([...esperadas.map((e) => e.subjectId), ...porAsig.keys()])];
  const porAsignatura: Barra[] = claves
    .map((s) => {
      const ids = porAsig.get(s) ?? [];
      return { clave: s, etiqueta: nombre(s), n: ids.length, ids, ...(faltantes.includes(s) ? { pendiente: true } : {}) };
    })
    .sort((a, b) => b.n - a.n || a.etiqueta.localeCompare(b.etiqueta, 'es'));
  const sinAlerta = cubos[0].n;
  const citados = filas.filter((f) => f.citar).length;
  return {
    total,
    sinAlerta,
    conAlguna: total - sinAlerta,
    citados,
    porcentajeSinAlerta: porcentaje(sinAlerta, total),
    porcentajeCitados: porcentaje(citados, total),
    distribucion: cubos,
    porAsignatura,
    sinNadieEnAlerta: esperadas
      .filter((e) => !porAsig.has(e.subjectId) && !faltantes.includes(e.subjectId))
      .map((e) => e.nombre),
    pendientes: faltantes.map(nombre),
  };
}

/**
 * Para presentar SIN nombres: las asignaturas con un solo estudiante en alerta se juntan
 * en una barra «Otras» (cuantos estudiantes distintos suman), para que no se adivine quien.
 * Si solo hay una asi, tambien se esconde en «Otras».
 */
export function agruparParaSalon(barras: Barra[]): Barra[] {
  const solas = barras.filter((b) => b.n === 1);
  if (solas.length === 0) return barras;
  const ids = [...new Set(solas.flatMap((b) => b.ids))];
  // Las de 0 se quedan (no señalan a nadie), al final.
  return [
    ...barras.filter((b) => b.n > 1),
    { clave: 'otras', etiqueta: solas.length === 1 ? 'Otra asignatura' : `Otras ${solas.length} asignaturas`, n: ids.length, ids },
    ...barras.filter((b) => b.n === 0),
  ];
}

/** Lo mismo para la jornada o el periodo anterior: solo los porcentajes. */
export interface Referencia {
  porcentajeSinAlerta: number;
  porcentajeCitados: number;
}

/**
 * Promedio de la jornada a partir de las planillas (ya combinadas por asignatura): por cada
 * estudiante que aparece marcado, cuantas asignaturas lo tienen en alerta. No necesita las
 * listas de los grupos: cuenta a quien tiene alguna marca.
 */
export function referenciaDePlanillas(planillas: { estudiantes: Record<string, string> }[]): Referencia | null {
  const cuenta = new Map<string, number>();
  for (const p of planillas) {
    for (const [id, m] of Object.entries(p.estudiantes ?? {})) cuenta.set(id, (cuenta.get(id) ?? 0) + (m === 'alerta' ? 1 : 0));
  }
  if (cuenta.size === 0) return null;
  const n = [...cuenta.values()];
  return {
    porcentajeSinAlerta: porcentaje(n.filter((x) => x === 0).length, n.length),
    porcentajeCitados: porcentaje(n.filter((x) => x >= MINIMO_PARA_CITAR).length, n.length),
  };
}

// ── comparaciones: periodos y grupos (2026-10-24) ───────────────────────────────────

/** Un periodo en la evolucion del grupo: % sin ninguna alerta, del grupo y de la jornada. */
export interface PuntoPeriodo {
  periodo: number;
  grupo: number | null;
  jornada: number | null;
}

/** Un grupo en la comparacion con los demas de la jornada. */
export interface FilaGrupo {
  grado: string;
  porcentajeSinAlerta: number;
  /** El grupo que se esta analizando: se resalta. */
  propio: boolean;
}

/** % sin alerta de cada grupo a partir de las planillas de la jornada, de mejor a peor. */
export function gruposDeJornada(planillas: PlanillaAlerta[], propio: string): FilaGrupo[] {
  const grados = [...new Set(planillas.map((p) => p.grado))];
  return grados
    .map((g) => ({ g, r: referenciaDePlanillas(combinarPlanillas(planillas.filter((p) => p.grado === g))) }))
    .filter((x): x is { g: string; r: Referencia } => !!x.r)
    .map(({ g, r }) => ({ grado: g, porcentajeSinAlerta: r.porcentajeSinAlerta, propio: g === propio }))
    .sort((a, b) => b.porcentajeSinAlerta - a.porcentajeSinAlerta || a.grado.localeCompare(b.grado, 'es', { numeric: true }));
}

// ── niveles: basica y media (2026-10-25) ───────────────────────────────────────────

export type Nivel = 'primaria' | 'basica' | 'media';

export const NOMBRE_NIVEL: Record<Nivel, string> = {
  primaria: 'Primaria',
  basica: 'Básica (6° a 9°)',
  media: 'Media (10° y 11°)',
};

/** El nivel de un grado literal (`9.1`, `6º1`, `10.2`, `Transición`...). */
export function nivelDeGrado(grado: string): Nivel {
  const n = parseInt(grado, 10);
  if (Number.isNaN(n) || n <= 5) return 'primaria';
  return n >= 10 ? 'media' : 'basica';
}

export interface AsignaturaDeNivel {
  subjectId: string;
  /** Estudiantes en alerta en esa asignatura, sumando los grupos del nivel. */
  n: number;
  /** % de los estudiantes del nivel (los de los grupos que la ven). */
  porcentaje: number;
}

export interface BloqueNivel {
  nivel: Nivel;
  estudiantes: number;
  asignaturas: AsignaturaDeNivel[];
}

/**
 * Asignaturas por nivel (Julian, 2026-10-25: «que salgan TODAS, tambien las de 0»): en basica
 * todos ven las mismas; media tiene las suyas. `esperadasDe` dice que asignaturas tiene cada
 * grupo (la asignacion academica), para que las de 0 aparezcan. El % es sobre los estudiantes
 * de los grupos que ven esa asignatura.
 */
export function asignaturasPorNivel(
  grupos: Record<string, ResumenGrado>,
  esperadasDe: (grado: string) => string[],
): BloqueNivel[] {
  const bloques = new Map<Nivel, { estudiantes: number; n: Map<string, number>; base: Map<string, number> }>();
  for (const [grado, g] of Object.entries(grupos)) {
    if (g.estudiantes === 0) continue;
    const nivel = nivelDeGrado(grado);
    const b = bloques.get(nivel) ?? { estudiantes: 0, n: new Map(), base: new Map() };
    b.estudiantes += g.estudiantes;
    for (const s of new Set([...esperadasDe(grado), ...Object.keys(g.asignaturas ?? {})])) {
      b.n.set(s, (b.n.get(s) ?? 0) + (g.asignaturas?.[s] ?? 0));
      b.base.set(s, (b.base.get(s) ?? 0) + g.estudiantes);
    }
    bloques.set(nivel, b);
  }
  return (['primaria', 'basica', 'media'] as Nivel[])
    .filter((nv) => bloques.has(nv))
    .map((nivel) => {
      const b = bloques.get(nivel)!;
      return {
        nivel,
        estudiantes: b.estudiantes,
        asignaturas: [...b.n.entries()]
          .map(([subjectId, n]) => ({ subjectId, n, porcentaje: porcentaje(n, b.base.get(subjectId) ?? 0) }))
          .sort((x, y) => y.n - x.n || x.subjectId.localeCompare(y.subjectId)),
      };
    });
}

// ── resumen SIN NOMBRES por grupo (2026-10-24) ──────────────────────────────────────
// Lo escribe el servidor (`onAlertaEscrita`) en `asistenciaAlertaResumen/{anio_periodo_sede_jornada}`
// cada vez que se marca o entrega una planilla. Solo cuentas, ningun estudiante: cualquier
// docente puede leerlo, y con el el director ve los otros grupos y las directivas el
// panorama por jornada y por sede.

export interface ResumenGrado {
  /** Estudiantes con alguna marca (al entregar, todos los del grupo quedan marcados). */
  estudiantes: number;
  sinAlerta: number;
  citados: number;
  planillas: number;
  entregadas: number;
  /** Estudiantes en alerta por asignatura. */
  asignaturas: Record<string, number>;
}

export interface ResumenJornada {
  resumenId: string;
  sede: string;
  jornada: string;
  anio: number;
  periodo: number;
  grupos: Record<string, ResumenGrado>;
}

/** El resumen de un grupo a partir de sus planillas (las de una asignatura compartida, combinadas). */
export function resumenDeGrado(planillas: PlanillaAlerta[]): ResumenGrado {
  const combinadas = combinarPlanillas(planillas);
  const cuenta = new Map<string, number>();
  const asignaturas: Record<string, number> = {};
  for (const p of combinadas) {
    for (const [id, m] of Object.entries(p.estudiantes ?? {})) {
      cuenta.set(id, (cuenta.get(id) ?? 0) + (m === 'alerta' ? 1 : 0));
      if (m === 'alerta') asignaturas[p.subjectId] = (asignaturas[p.subjectId] ?? 0) + 1;
    }
  }
  const n = [...cuenta.values()];
  return {
    estudiantes: n.length,
    sinAlerta: n.filter((x) => x === 0).length,
    citados: n.filter((x) => x >= MINIMO_PARA_CITAR).length,
    planillas: combinadas.length,
    entregadas: combinadas.filter((p) => p.entregada).length,
    asignaturas,
  };
}

export interface Totales {
  grupos: number;
  estudiantes: number;
  sinAlerta: number;
  citados: number;
  porcentajeSinAlerta: number;
  porcentajeCitados: number;
}

/** La suma de varios grupos (una jornada, una sede o el colegio). */
export function totalesDe(grupos: ResumenGrado[]): Totales {
  const t = grupos.reduce((s, g) => ({ e: s.e + g.estudiantes, s: s.s + g.sinAlerta, c: s.c + g.citados }), { e: 0, s: 0, c: 0 });
  return {
    grupos: grupos.length,
    estudiantes: t.e,
    sinAlerta: t.s,
    citados: t.c,
    porcentajeSinAlerta: porcentaje(t.s, t.e),
    porcentajeCitados: porcentaje(t.c, t.e),
  };
}

/** Los grupos de un resumen, de mejor a peor, con el propio resaltado. */
export function filasDeResumen(r: Pick<ResumenJornada, 'grupos'>, propio: string | null): FilaGrupo[] {
  return Object.entries(r.grupos)
    .filter(([, g]) => g.estudiantes > 0)
    .map(([grado, g]) => ({ grado, porcentajeSinAlerta: porcentaje(g.sinAlerta, g.estudiantes), propio: grado === propio }))
    .sort((a, b) => b.porcentajeSinAlerta - a.porcentajeSinAlerta || a.grado.localeCompare(b.grado, 'es', { numeric: true }));
}

/** Estudiantes en alerta por asignatura, sumando los grupos; de mas a menos. */
export function asignaturasDeResumen(grupos: ResumenGrado[]): { subjectId: string; n: number }[] {
  const t = new Map<string, number>();
  for (const g of grupos) for (const [s, n] of Object.entries(g.asignaturas ?? {})) t.set(s, (t.get(s) ?? 0) + n);
  return [...t.entries()].map(([subjectId, n]) => ({ subjectId, n })).sort((a, b) => b.n - a.n || a.subjectId.localeCompare(b.subjectId));
}

/** «8 puntos más que en el periodo 2» / «igual que …» / «5 puntos menos que …». */
export function comparar(actual: number, otro: number, contra: string): string {
  const d = actual - otro;
  if (d === 0) return `igual que ${contra}`;
  return `${Math.abs(d)} ${Math.abs(d) === 1 ? 'punto' : 'puntos'} ${d > 0 ? 'más' : 'menos'} que ${contra}`;
}

/** Frases para leer los graficos en voz alta, en el salon. */
export function frases(a: AnalisisGrupo, salon = false): string[] {
  const f: string[] = [];
  if (a.total === 0) return f;
  f.push(`${a.sinAlerta} de ${a.total} estudiantes no tienen ninguna asignatura en alerta.`);
  if (a.citados > 0) {
    f.push(`${a.citados} ${a.citados === 1 ? 'estudiante tiene' : 'estudiantes tienen'} ${MINIMO_PARA_CITAR} o más asignaturas en alerta: a sus familias se les cita.`);
  }
  const [primera, segunda] = a.porAsignatura;
  // En el salon no se nombra una asignatura con un solo estudiante: se adivinaria quien es.
  if (primera && primera.n > 0 && !(salon && primera.n < 2)) {
    f.push(segunda && segunda.n === primera.n
      ? `Las asignaturas con más estudiantes en alerta son ${primera.etiqueta} y ${segunda.etiqueta} (${primera.n} cada una).`
      : `La asignatura con más estudiantes en alerta es ${primera.etiqueta} (${primera.n}).`);
  }
  if (a.sinNadieEnAlerta.length) f.push(`Sin nadie en alerta: ${a.sinNadieEnAlerta.join(', ')}.`);
  return f;
}
