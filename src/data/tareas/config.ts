// Configuración de niveles y cupos del módulo de Tareas.
// Los cupos son MÁXIMOS de arbitraje, no obligaciones de uso:
// el límite duro del estudiante es siempre el tope diario.

import { CONTRAJORNADAS_MT } from './calendario';
import { esGrupoDePrimaria } from '../maestros';

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
  // Primaria se pregunta PRIMERO y por lista explicita: su notacion (3°1) usa el
  // simbolo de grado y la tarde de bachillerato (3º1) el ordinal, que son
  // caracteres distintos. Distinguirlos por el texto seria un error silencioso —
  // un grupo de primaria caeria en 'basica' y tomaria 4 momentos diarios y
  // estudio de 20 minutos, que no es su politica.
  if (esGrupoDePrimaria(grupo)) return 'primaria';
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

// Primaria: las nueve asignaturas que se dictan en la jornada de la tarde de
// Gustavo Rodas, deducidas de su cuadro de horario. En la MANANA una sola
// docente dicta todas las asignaturas de su grupo, asi que no hay competencia
// entre docentes que arbitrar y el cupo por asignatura pierde sentido — ver la
// nota al final de este archivo.
//
// El valor 1 es PROVISIONAL: reparte 9 de los 15 momentos semanales y deja
// holgura. La coordinacion de primaria tiene que fijar la tabla real, igual que
// hizo la de bachillerato. Se edita desde el panel del coordinador sin tocar
// codigo (NIVELES_CUPO ya incluye primaria).
const CUPOS_PRIMARIA: Record<string, number> = {
  matematicas: 1, lengua: 1, ingles: 1, naturales: 1, sociales: 1,
  ed_fisica: 1, artistica: 1, etica: 1, tecnologia: 1,
};

export const CUPOS_DEFAULT: Record<Nivel, Record<string, number>> = {
  primaria: CUPOS_PRIMARIA,
  basica:   CUPOS_BASICA,
  media:    CUPOS_MEDIA,
  mt:       CUPOS_MT,
};

// El override lo edita el coordinador; se guarda por (nivel, asignatura).
// Clave del override: `${nivel}:${asignaturaId}`.
export function claveCupo(nivel: Nivel, asignaturaId: string): string {
  return `${nivel}:${asignaturaId}`;
}

export function cupoDeAsignatura(grupo: string, asignaturaId: string, override?: Record<string, number>): number {
  const nivel = nivelDeGrupo(grupo);
  const clave = claveCupo(nivel, asignaturaId);
  if (override && clave in override) return override[clave];
  return CUPOS_DEFAULT[nivel][asignaturaId] ?? 0;
}

// Máximo de momentos que se pueden repartir entre todas las asignaturas de un
// nivel, por período. Es la capacidad de ejecución del período:
//   básica/media: 4 momentos/día × 5 días = 20 por semana
//   media técnica: 4 × 3 días (2 en contrajornada) × 2 semanas = 24 por quincena
//   primaria: 3 momentos/día × 5 días = 15 por semana
export const MAX_MOMENTOS_NIVEL: Record<Nivel, number> = {
  basica: 20,
  media: 20,
  mt: 24,
  primaria: 15,
};

// Niveles con cupos editables (para el panel del coordinador).
export const NIVELES_CUPO: { nivel: Nivel; label: string }[] = [
  { nivel: 'basica', label: 'Básica (6º–9°)' },
  { nivel: 'media',  label: 'Media académica (10°–11°)' },
  { nivel: 'mt',     label: 'Media técnica' },
  { nivel: 'primaria', label: 'Primaria' },
];

// ── Nota sobre primaria, para quien retome esto ──────────────────────────────
// El modulo de Tareas existe para ARBITRAR entre docentes que compiten por el
// tiempo del mismo grupo: por eso hay cupos por asignatura. En la jornada de la
// TARDE de primaria esa competencia es real (siete docentes, una asignatura cada
// uno, repartidos entre los grupos) y el modulo aplica igual que en
// bachillerato. En la MANANA no existe: una sola docente dicta todo a su grupo y
// decide sola. Ahi el modulo no le resuelve un problema, le anade un tramite.
// Pendiente de preguntarle a la coordinacion si quiere la manana dentro o fuera.
