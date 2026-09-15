/**
 * Acompañamientos de descanso: el modelo de datos.
 *
 * Una DISTRIBUCION es la semana completa de una jornada: qué zonas hay, cuántos
 * profesores pide cada una por día, y quién cubre cada casilla. Una PUBLICACION es
 * una distribución que un coordinador dejó en firme, con la fecha desde la que rige.
 *
 * ⚠️ LAS PUBLICACIONES NO SE EDITAN NI SE BORRAN. Corregir un error es publicar otra.
 * Así el historial dice siempre la verdad de lo que rigió, y la distribución de
 * cualquier día se reconstruye: es la última publicación cuya fecha ya había llegado
 * (ver `vigente.ts`). La regla de Firestore lo impone también en el servidor.
 *
 * Ver PRD.md y PLAN.md en la raíz del repo.
 */

import type { EntradaHorario } from '../horarioBase';

export type Dia = EntradaHorario['dia'];
/** Una jornada concreta. Aquí no existe 'ambas': cada distribución es de una sola. */
export type JornadaAcomp = EntradaHorario['jornada'];
/** 'YYYY-MM-DD' */
export type FechaISO = string;

export const DIAS: Dia[] = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'];

export interface Zona {
  /** Estable dentro de la jornada. Las asignaciones apuntan aquí, no al nombre. */
  id: string;
  nombre: string;
  /** Cuántos profesores cubren la zona cada día. 1 por defecto. */
  cupo: number;
}

export interface Asignacion {
  zonaId: string;
  dia: Dia;
  /** El id de `USUARIOS` en maestros.ts. */
  docenteId: string;
  /** Con candado, las alternativas automáticas no la mueven. */
  candado: boolean;
}

export interface Distribucion {
  jornada: JornadaAcomp;
  zonas: Zona[];
  asignaciones: Asignacion[];
  /**
   * Metas de acompañamientos por semana, por docente (opcional — distribuciones y
   * publicaciones viejas no la traen y siguen funcionando: ver `metasAutomaticas`
   * en `metas.ts` y `borradorDesdeVigente` en `borrador.ts`).
   */
  metas?: Record<string, number>;
}

export interface Publicacion extends Distribucion {
  /** Id del documento en Firestore. La distribución inicial usa 'inicial'. */
  id: string;
  vigenteDesde: FechaISO;
  /** Correo de quien publicó. Vacío en la distribución inicial. */
  publicadoPor: string;
  publicadoPorNombre: string;
  /** Milisegundos, con la hora del servidor. null en la inicial y mientras llega. */
  publicadoEn: number | null;
  /** La distribución escrita en el programa, vigente mientras no haya publicaciones. */
  esInicial: boolean;
  /** Si se canceló antes de empezar a regir. Queda en el historial pero no rige nunca. */
  canceladaPor?: string;
  canceladaPorNombre?: string;
  canceladaEn?: number | null;
}

/** Colección de Firestore. Un documento por publicación, inmutable. */
export const COLECCION_PUBLICACIONES = 'acompanamientosPublicaciones';
