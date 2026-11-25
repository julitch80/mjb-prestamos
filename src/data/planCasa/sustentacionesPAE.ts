// Sustentaciones del Plan Académico Especial (jornada de la mañana: 9.°, 10.° y 11.°).
// Cada docente marca, en el plan del estudiante, si el estudiante se presentó a la asesoría y a la
// sustentación. Se guarda en planesCasa/{id}.sustentacionesPAE.{docenteId}.
import { asignacionDeGrupo } from '../asignacionAcademica';
import { USUARIOS } from '../maestros';

import type { MarcaSustentacionPAE } from './tipos';

export type MarcaPAE = MarcaSustentacionPAE;
export type Valoracion = 'aprobo' | 'no_aprobo' | null | undefined;

/** Mañana = notación con punto (9.1, 10.1, 11.2); la tarde usa «º». 9.°, 10.° y 11.°. */
export function esPAEManana(grupo: string): boolean {
  // La tarde solo tiene 6.° a 8.°: el número de grado basta (vale 9.1, 10°1, 11.2...).
  return /^(9|10|11)(\D|$)/.test(grupo.trim());
}

/** Tarde: 6.° a 8.° (solo seguimiento: sin horario ni propuesta). */
export function esPAETarde(grupo: string): boolean {
  return /^(6|7|8)(\D|$)/.test(grupo.trim());
}

/** Cualquier plan con seguimiento de sustentación (mañana o tarde). */
export const esPAE = (grupo: string) => esPAEManana(grupo) || esPAETarde(grupo);

export const esOnce = (grupo: string) => grupo.trim().startsWith('11');

/**
 * Docentes que atienden al estudiante del grupo (ids de USUARIOS): los de la asignación académica,
 * sin media técnica. Claudia no estará: sus estudiantes de 10.° los cubre Uriel y no hay Matemáticas 11.°.
 */
export function docentesPAE(grupo: string): string[] {
  const g = grupo.trim();
  const ids = new Set<string>();
  for (const e of asignacionDeGrupo(g)) {
    if (e.asignaturaId.startsWith('mt_')) continue;
    if (e.docenteId === 'claudia') { if (!esOnce(g)) ids.add('uriel'); continue; }
    ids.add(e.docenteId);
  }
  return [...ids].sort((a, b) => nombreDocente(a).localeCompare(nombreDocente(b), 'es'));
}

export function nombreDocente(id: string): string {
  const u = USUARIOS.find(x => x.id === id || (x.correo || '').toLowerCase() === id.toLowerCase());
  if (u) return u.nombreCorto ?? u.nombre ?? id;
  return id.includes('@') ? id.split('@')[0].replace(/[._]/g, ' ') : id;
}

/** Id con que se guardan las marcas de un docente: el de USUARIOS si existe, si no el correo. */
export function idDocentePorCorreo(correo: string): string {
  const c = correo.trim().toLowerCase();
  return USUARIOS.find(u => (u.correo || '').toLowerCase() === c)?.id ?? c;
}

/**
 * Docentes del plan para la sustentación: los de la asignación del grupo (docentesPAE) MÁS los que
 * figuran en el plan (docentesCorreos: reemplazos, docentes nuevos que no están en la asignación)
 * MÁS cualquiera que ya haya marcado. Así un reemplazo (p. ej. Camilo) también ve su casilla.
 */
export function docentesDelPlanPAE(plan: { grupo: string; docentesCorreos?: string[]; sustentacionesPAE?: Record<string, unknown> }): string[] {
  const base = docentesPAE(plan.grupo);
  const ids = new Set(base);
  for (const c of plan.docentesCorreos ?? []) {
    const id = idDocentePorCorreo(c);
    if (id === 'claudia') continue;
    ids.add(id);
  }
  for (const k of Object.keys(plan.sustentacionesPAE ?? {})) ids.add(k);
  const extra = [...ids].filter(i => !base.includes(i)).sort((a, b) => nombreDocente(a).localeCompare(nombreDocente(b), 'es'));
  return [...base, ...extra];
}

/** ¿Le toca a este usuario (id del store o correo) marcar en este plan? */
export function participaEnPAE(plan: { grupo: string; docentesCorreos?: string[]; sustentacionesPAE?: Record<string, unknown> }, yo: string, correo?: string): boolean {
  if (!yo) return false;
  if (docentesDelPlanPAE(plan).includes(yo)) return true;
  const c = (correo ?? '').toLowerCase();
  return !!c && (plan.docentesCorreos ?? []).some(x => x.toLowerCase() === c);
}

export type EstadoPAE = 'si' | 'no' | 'pendiente';
/** Asesoría/sustentación son casillas: marcada = se presentó; sin marcar = pendiente. */
export const estadoDe = (b: boolean | undefined): EstadoPAE => (b === true ? 'si' : 'pendiente');

export interface FilaDocentePAE {
  docenteId: string;
  asesoria: boolean;
  sustentacion: boolean;
  valoracion: Valoracion;
  observacion: string;
  /** Lo que le falta a este docente con el estudiante (vacío si está completo). */
  faltan: string[];
}

export interface ResumenPAE {
  filas: FilaDocentePAE[];
  /** Cosas por hacer (asesorías + sustentaciones sin marcar). */
  pendientes: number;
  total: number;
  asesoriasHechas: number;
  sustentacionesHechas: number;
  aprobadas: number;
  noAprobadas: number;
  completo: boolean;
}

export function resumenPlanPAE(grupo: string, marcas: Record<string, MarcaPAE> | undefined, docentesCorreos?: string[]): ResumenPAE {
  const filas: FilaDocentePAE[] = docentesDelPlanPAE({ grupo, docentesCorreos, sustentacionesPAE: marcas }).map(d => {
    const m = marcas?.[d];
    const asesoria = m?.asesoria === true, sustentacion = m?.sustentacion === true;
    const faltan = [...(asesoria ? [] : ['asesoría']), ...(sustentacion ? [] : ['sustentación'])];
    return { docenteId: d, asesoria, sustentacion, valoracion: m?.valoracion ?? null, observacion: m?.observacion ?? '', faltan };
  });
  const total = filas.length * 2;
  const hechas = filas.reduce((n, f) => n + Number(f.asesoria) + Number(f.sustentacion), 0);
  return {
    filas, total, pendientes: total - hechas,
    asesoriasHechas: filas.filter(f => f.asesoria).length, sustentacionesHechas: filas.filter(f => f.sustentacion).length,
    aprobadas: filas.filter(f => f.valoracion === 'aprobo').length, noAprobadas: filas.filter(f => f.valoracion === 'no_aprobo').length,
    completo: total > 0 && hechas === total,
  };
}
