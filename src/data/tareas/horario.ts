// Puente entre el módulo de Tareas y los datos académicos de la app:
// qué grupos puede atender un docente y qué días les dicta clase.

import { horarioBase } from '../horarioBase';
import { ASIGNACION_2026 } from '../asignacionAcademica';
import { CONTRAJORNADAS_MT } from './calendario';
import type { DiaSemana } from './tipos';

function gradoLimpio(grado: string): string {
  return grado.includes('/') ? grado.split('/')[0] : grado;
}

/** Días de la semana en que el docente dicta clase a un grupo (ventana de asignación). */
export function diasDeClase(docenteId: string, grupo: string): DiaSemana[] {
  const dias = new Set<DiaSemana>();
  for (const e of horarioBase) {
    if (e.docente === docenteId && gradoLimpio(e.grado) === grupo) dias.add(e.dia);
  }
  // Las clases de media técnica van en contrajornada y no están en horarioBase
  const tieneMT = ASIGNACION_2026.some(a =>
    a.docenteId === docenteId && a.grupo === grupo && a.asignaturaId.startsWith('mt_'));
  if (tieneMT) (CONTRAJORNADAS_MT[grupo] ?? []).forEach(d => dias.add(d));
  return [...dias];
}

/** Grupos a los que el docente puede dejar tareas, con sus asignaturas (sin CI). */
export function gruposAsignables(docenteId: string): { grupo: string; asignaturaIds: string[] }[] {
  const porGrupo = new Map<string, Set<string>>();
  for (const e of ASIGNACION_2026) {
    if (e.docenteId !== docenteId || e.asignaturaId === 'ci') continue;
    if (!porGrupo.has(e.grupo)) porGrupo.set(e.grupo, new Set());
    porGrupo.get(e.grupo)!.add(e.asignaturaId);
  }
  return [...porGrupo.entries()]
    .map(([grupo, ids]) => ({ grupo, asignaturaIds: [...ids] }))
    .sort((a, b) => a.grupo.localeCompare(b.grupo, 'es', { numeric: true }));
}

/** Todos los grupos con plan de estudios (para paneles y agenda pública). */
export function todosLosGrupos(): string[] {
  const grupos = new Set(
    ASIGNACION_2026.filter(e => e.asignaturaId !== 'ci').map(e => e.grupo)
  );
  return [...grupos].sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));
}

export function esGrupoDeTarde(grupo: string): boolean {
  return grupo.includes('º');
}
