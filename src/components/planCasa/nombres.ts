import { asignaturasDelGrupo } from '../../data/planCasa/persistencia';

/** asignaturaId → nombres legibles de la asignatura y su docente, para un grupo. */
export function asignaturasConNombre(grupo: string): Record<string, { asignatura: string; docente: string }> {
  return Object.fromEntries(asignaturasDelGrupo(grupo).map(a => [a.asignaturaId, { asignatura: a.asignaturaNombre, docente: a.docenteNombre }]));
}

/** '8º1' → '8º', '10.2' → '10°' (para el aviso a la IA). */
export function gradoDeGrupo(grupo: string): string {
  if (grupo.includes('º')) return `${grupo.split('º')[0]}º`;
  return `${grupo.split('.')[0]}°`;
}
