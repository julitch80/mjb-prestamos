import { asignaturasDelGrupo } from '../../data/planCasa/persistencia';

/** asignaturaId → nombres legibles de la asignatura y su docente, para un grupo. */
export function asignaturasConNombre(grupo: string): Record<string, { asignatura: string; docente: string }> {
  return Object.fromEntries(asignaturasDelGrupo(grupo).map(a => [a.asignaturaId, { asignatura: a.asignaturaNombre, docente: a.docenteNombre }]));
}

export { gradoDeGrupo } from '../../data/planCasa/completarPlan';
