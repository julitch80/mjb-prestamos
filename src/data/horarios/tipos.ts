/**
 * Contrato de intercambio con el motor de horarios.
 *
 * El motor vive aparte (proyecto Horarios, en Python con OR-Tools) porque esta
 * app es un sitio estático y no puede ejecutar el solver. Se comunican por dos
 * archivos JSON: la app escribe `entrada.json` y el motor devuelve `salida.json`.
 *
 * Estos tipos son el espejo exacto de `motor/contrato.py`. Si uno cambia, el
 * otro tiene que cambiar con él: son las dos caras del mismo acuerdo.
 */

import type { EntradaHorario } from '../horarioBase';

export type Dia = EntradaHorario['dia'];
export type Jornada = EntradaHorario['jornada'];

export const DIAS: Dia[] = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'];

/** Una franja concreta de la semana: qué día y qué hora. */
export interface Franja {
  dia: Dia;
  bloque: number;
}

export interface ConfigGenerador {
  dias: Dia[];
  bloques_por_jornada: Record<Jornada, number>;
  /** Franja reservada al Centro de Interés. Se puede omitir una jornada. */
  centro_interes: Partial<Record<Jornada, Franja>>;
  contrajornada_media_tecnica: Array<{
    grupo: string;
    dias: Dia[];
    docente: string;
    horas: number;
  }>;
}

export interface AsignaturaGenerador {
  id: string;
  nombre: string;
  abrev?: string;
  /** Conviene ponerla en las primeras horas del día. */
  exigente: boolean;
}

export interface DocenteGenerador {
  id: string;
  nombre: string;
  jornada: Jornada | 'ambas';
  /** En la mañana el aula es del docente. Sin esto, es rotativo. */
  aula_fija?: string;
  /** Solo las franjas en que NO puede: son muchas menos que las que sí. */
  no_disponible: Array<{ jornada: Jornada; dia: Dia; bloques: number[] }>;
}

export interface GrupoGenerador {
  id: string;
  jornada: Jornada;
  /** En la tarde el aula es del grupo. */
  aula_fija?: string;
}

export interface AulaGenerador {
  id: string;
  tipo: string;
  /** El Auditorio existe pero no es un salón de clase. */
  apta_para_clase?: boolean;
  /** Espacio escaso: dos clases no pueden usarlo a la vez. */
  compartida: boolean;
  /**
   * Si dos clases a la vez ahí son un problema. El Patio no lo es: dos grupos de
   * educación física comparten cancha. Si falta, se asume que sí, que es lo normal.
   */
  exclusiva?: boolean;
}

export interface FilaAsignacion {
  docente: string;
  asignatura: string;
  grupo: string;
  horas: number;
}

/** Una clase que el coordinador ya decidió y el motor debe respetar. */
export interface ClaseFijada {
  dia: Dia;
  bloque: number;
  docente: string;
  grupo: string;
  asignatura: string;
}

export interface PesosGenerador {
  bloques_dobles: number;
  exigentes_temprano: number;
  mixtos_concentrados: number;
  /** Penaliza el segundo día completo de un docente y los siguientes. */
  dias_llenos?: number;
}

/**
 * Qué parte del colegio cubre un archivo.
 *
 * El horario no se construye de una vez para todo el colegio: se hace de una
 * jornada y una sede a la vez. Son problemas independientes —ocurren a horas
 * distintas y los grupos son disjuntos— y así cada coordinador trabaja el suyo.
 */
export interface Alcance {
  sede: string;
  sede_nombre: string;
  jornada: Jornada;
}

export interface EntradaGenerador {
  version: string;
  colegio: string;
  anio: number;
  notas?: string;
  alcance: Alcance;
  config: ConfigGenerador;
  asignaturas: AsignaturaGenerador[];
  docentes: DocenteGenerador[];
  grupos: GrupoGenerador[];
  aulas: AulaGenerador[];
  asignacion: FilaAsignacion[];
  fijadas: ClaseFijada[];
  pesos: PesosGenerador;
  limite_segundos: number;
}

/**
 * Una clase del horario generado.
 *
 * Extiende `EntradaHorario` de la app con la materia, que el formato original
 * no guarda. La app la deduce por (docente, grupo), cosa que falla cuando un
 * docente da dos materias al mismo grupo; aquí viene dada.
 */
export interface ClaseGenerada extends EntradaHorario {
  asignatura?: string;
}

export interface SalidaGenerador {
  version: string;
  estado: 'completo' | 'parcial' | 'infactible';
  generado_en: string;
  horario: ClaseGenerada[];
  sin_ubicar: Array<{
    docente: string;
    asignatura: string;
    grupo: string;
    horas_faltantes: number;
    motivo: string;
  }>;
  recomendaciones: Array<{ regla: string; descripcion: string }>;
  calidad: {
    pct_horas_en_bloques_dobles: number;
    pct_exigentes_en_primeras_horas: number;
    dias_por_docente_mixto: Array<{ docente: string; dias: number }>;
    huecos_por_docente_mixto: Array<{ docente: string; huecos: number }>;
    docentes_con_varios_dias_llenos: Array<{ docente: string; dias: number }>;
  };
  metricas: {
    segundos: number;
    estado_solver: string;
    cobertura_pct: number;
  };
}

/** Resultado de leer un archivo del motor: o sirve, o se dice exactamente por qué no. */
export type Lectura<T> =
  | { ok: true; valor: T }
  | { ok: false; errores: string[] };
