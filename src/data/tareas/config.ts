// Configuración de niveles y cupos del módulo de Tareas.
// Los cupos son MÁXIMOS de arbitraje, no obligaciones de uso:
// el límite duro del estudiante es siempre el tope diario.

import { CONTRAJORNADAS_MT } from './calendario';

export type Nivel = 'primaria' | 'basica' | 'media' | 'mt';

export interface ConfigNivel {
  topeDiario: number;          // momentos de tarea máximos por día
  estudioMin: number;          // momento fijo de estudio personal (minutos)
  duracionMomentoMin: number;  // duración de un momento (minutos)
  periodoCupo: 'semana' | 'quincena';
}

export const CONFIG_NIVEL: Record<Nivel, ConfigNivel> = {
  primaria: { topeDiario: 3, estudioMin: 15, duracionMomentoMin: 25, periodoCupo: 'semana' },
  basica:   { topeDiario: 4, estudioMin: 20, duracionMomentoMin: 25, periodoCupo: 'semana' },
  media:    { topeDiario: 4, estudioMin: 20, duracionMomentoMin: 25, periodoCupo: 'semana' },
  // Media técnica: 2 días de contrajornada → solo 3 días de ejecución.
  // 15 asignaturas vs 12 espacios semanales → cupo por QUINCENA (24 espacios).
  mt:       { topeDiario: 4, estudioMin: 20, duracionMomentoMin: 25, periodoCupo: 'quincena' },
};

export const GRUPOS_MT = Object.keys(CONTRAJORNADAS_MT);

export function nivelDeGrupo(grupo: string): Nivel {
  if (GRUPOS_MT.includes(grupo)) return 'mt';
  if (grupo.startsWith('10.') || grupo.startsWith('11.')) return 'media';
  return 'basica'; // 6º–8º (tarde) y 9.x (mañana)
}

// ── Cupos por defecto (momentos por período, según tablas de coordinación) ────

const CUPOS_BASICA: Record<string, number> = {
  matematicas: 2, naturales: 2, lengua: 2, ingles: 2, artistica: 2,
  etica: 2, religion: 2, sociales: 2, ed_fisica: 2, tecnologia: 2,
};

const CUPOS_MEDIA: Record<string, number> = {
  matematicas: 1, biologia: 1, lengua: 2, ingles: 2, artistica: 2,
  etica: 2, religion: 1, sociales: 1, ed_fisica: 2, tecnologia: 2,
  fisica: 1, quimica: 1, filosofia: 2, economia: 2,
};

// MT: 1 momento por asignatura por quincena (15 asignaturas, 24 espacios/quincena)
const CUPOS_MT: Record<string, number> = {
  matematicas: 1, biologia: 1, lengua: 1, ingles: 1, artistica: 1,
  etica: 1, religion: 1, sociales: 1, ed_fisica: 1, tecnologia: 1,
  fisica: 1, quimica: 1, filosofia: 1, economia: 1,
  mt_software: 1, mt_audiovisual: 1,
};

export const CUPOS_DEFAULT: Record<Nivel, Record<string, number>> = {
  primaria: CUPOS_BASICA, // provisional hasta tener los datos de primaria
  basica:   CUPOS_BASICA,
  media:    CUPOS_MEDIA,
  mt:       CUPOS_MT,
};

export function cupoDeAsignatura(grupo: string, asignaturaId: string, override?: Record<string, number>): number {
  if (override && asignaturaId in override) return override[asignaturaId];
  return CUPOS_DEFAULT[nivelDeGrupo(grupo)][asignaturaId] ?? 0;
}
