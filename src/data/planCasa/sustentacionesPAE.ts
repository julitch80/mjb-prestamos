// Sustentaciones del Plan Académico Especial (jornada de la mañana, 10.° y 11.°).
// Cada docente marca, en el plan del estudiante, si el estudiante se presentó a la asesoría y a la
// sustentación. Se guarda en planesCasa/{id}.sustentacionesPAE.{docenteId}.
import { asignacionDeGrupo } from '../asignacionAcademica';
import { USUARIOS } from '../maestros';

import type { MarcaSustentacionPAE } from './tipos';

export type MarcaPAE = MarcaSustentacionPAE;
export type Valoracion = 'aprobo' | 'no_aprobo' | null | undefined;

/** Mañana = notación con punto (10.1, 11.2); la tarde usa «º». Solo 10.° y 11.°. */
export function esPAEManana(grupo: string): boolean {
  return !grupo.includes('º') && /^1[01]\b|^1[01]\./.test(grupo.trim());
}

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
  return USUARIOS.find(u => u.id === id)?.nombreCorto ?? id;
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

export function resumenPlanPAE(grupo: string, marcas: Record<string, MarcaPAE> | undefined): ResumenPAE {
  const filas: FilaDocentePAE[] = docentesPAE(grupo).map(d => {
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
