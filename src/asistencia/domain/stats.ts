/**
 * Motor de estadistica — docs/modelo-datos-asistencia.md, seccion 4.4.
 *
 * REGLA DE ORO: el universo son las SESIONES REGISTRADAS del cruce consultado. Jamas el
 * calendario. Si no existe la sesion de un dia, ese dia no existe para el calculo — sea
 * festivo, jornada especial o un docente que no registro.
 *
 * REGLA DEL DENOMINADOR: quien consuma esto debe mostrar SIEMPRE `sessionsCount` junto
 * al porcentaje. Por eso el resultado no expone un porcentaje suelto.
 *
 * CASILLA VACIA: una sesion sin marca para un estudiante NO es una ausencia. Se cuenta
 * aparte en `sinRegistrar`.
 */

import { findMark, type MarkCode } from './marks';
import type { Enrollment, Period, Session, SubjectConfig } from './types';

export interface StatsInput {
  studentId: string;
  sessions: Session[];
  enrollments: Enrollment[];
  desde?: string;
  hasta?: string;
  subjectId?: string;
}

export interface StatsResult {
  /** Denominador. Se muestra SIEMPRE. */
  sessionsCount: number;
  /** Detalle de las siete marcas, tal como Julian lo pidio. */
  porMarca: Record<MarkCode, number>;
  /** Todas las marcas con isAbsence, justificadas o no. */
  ausenciasTotales: number;
  /** Lo unico que se transcribe a Master2000: ausencia + evasion. */
  aMaster2000: number;
  retrasosTotales: number;
  sinRegistrar: number;
  /** ausenciasTotales / sessionsCount en porcentaje. */
  tasaInasistencia: number;
}

function marcaVacia(): Record<MarkCode, number> {
  return {
    asistencia: 0,
    ausencia: 0,
    retraso: 0,
    ausencia_justificada: 0,
    retraso_justificado: 0,
    evasion: 0,
    ausencia_autorizada: 0,
  };
}

/**
 * Matricula vigente en una fecha. `desde` inclusivo, `hasta` exclusivo: el dia en que
 * el estudiante cambia de grupo pertenece ya al grupo nuevo.
 */
export function estaMatriculado(enrollments: Enrollment[], grado: string, fecha: string): boolean {
  return enrollments.some(
    (e) => e.grado === grado && e.desde <= fecha && (e.hasta === null || fecha < e.hasta),
  );
}

function enRango(fecha: string, desde?: string, hasta?: string): boolean {
  if (desde && fecha < desde) return false;
  if (hasta && fecha > hasta) return false;
  return true;
}

/** Sesiones que cuentan para este estudiante (denominador). */
export function sesionesRelevantes(input: StatsInput): Session[] {
  return input.sessions.filter(
    (s) =>
      (!input.subjectId || s.subjectId === input.subjectId) &&
      enRango(s.fecha, input.desde, input.hasta) &&
      // Una sesion de un grado al que el estudiante aun no pertenecia (o ya no) no es
      // suya y no puede contar en su contra.
      estaMatriculado(input.enrollments, s.grado, s.fecha),
  );
}

export function computeStats(input: StatsInput): StatsResult {
  const sesiones = sesionesRelevantes(input);
  const porMarca = marcaVacia();

  let ausenciasTotales = 0;
  let aMaster2000 = 0;
  let retrasosTotales = 0;
  let conRegistro = 0;

  for (const s of sesiones) {
    const m = s.estudiantes?.[input.studentId];
    if (!m) continue;
    const def = findMark(m.estado);
    // Una marca desconocida (retirada del catalogo) no se cuenta ni a favor ni en
    // contra: contarla seria inventar un dato que nadie registro.
    if (!def) continue;
    conRegistro++;
    porMarca[def.code] += 1;
    if (def.isAbsence) ausenciasTotales++;
    if (def.goesToMaster2000) aMaster2000++;
    if (def.isTardy) retrasosTotales++;
  }

  const sessionsCount = sesiones.length;
  return {
    sessionsCount,
    porMarca,
    ausenciasTotales,
    aMaster2000,
    retrasosTotales,
    sinRegistrar: Math.max(0, sessionsCount - conRegistro),
    tasaInasistencia: sessionsCount === 0 ? 0 : round1((ausenciasTotales / sessionsCount) * 100),
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Presentacion obligatoria: nunca un porcentaje a secas. */
export function conDenominador(numerador: number, denominador: number, sustantivo = 'sesiones'): string {
  if (denominador === 0) return `sin ${sustantivo} registradas`;
  return `${numerador} de ${denominador} ${sustantivo} (${round1((numerador / denominador) * 100)}%)`;
}

/** El periodo se deriva de la fecha; no se guarda en la sesion. */
export function periodoDeFecha(periods: Period[], fecha: string): Period | null {
  return periods.find((p) => p.desde <= fecha && fecha <= p.hasta) ?? null;
}

/**
 * Racha de ausencias consecutivas en una asignatura — alerta pedida por Julian.
 *
 * "Consecutivas" se cuenta sobre SESIONES REGISTRADAS de esa asignatura, no sobre dias
 * de calendario: si no, un puente festivo romperia la racha sin que haya pasado nada.
 *
 * Una `ausencia_justificada` ROMPE la racha: el docente ya sabe por que falto, y la
 * alerta existe para detectar lo que nadie ha explicado.
 */
export function rachaAusenciasConsecutivas(input: StatsInput): number {
  const sesiones = sesionesRelevantes(input).sort((a, b) =>
    (a.fecha + String(a.bloque).padStart(2, '0')).localeCompare(
      b.fecha + String(b.bloque).padStart(2, '0'),
    ),
  );

  let racha = 0;
  for (const s of sesiones) {
    const m = s.estudiantes?.[input.studentId];
    if (!m) continue; // sin registrar no informa nada: no suma ni rompe
    const def = findMark(m.estado);
    if (!def) continue;
    const noExplicada = def.isAbsence && def.goesToMaster2000; // ausencia o evasion
    if (noExplicada) racha++;
    else racha = 0;
  }
  return racha;
}

export type Cobertura =
  | { subjectId: string; estado: 'app'; sesiones: number }
  | { subjectId: string; estado: 'master2000' }
  | { subjectId: string; estado: 'sin_configurar'; sesiones: number };

/**
 * "Sin datos en la app" NUNCA se puede pintar como "0 faltas": es la diferencia entre
 * saber que no falto y no saber nada.
 */
export function computeCobertura(
  subjectIds: string[],
  configs: SubjectConfig[],
  sessions: Session[],
  grado: string,
  periodo: number,
  anio: number,
): Cobertura[] {
  return subjectIds.map((subjectId) => {
    const cfg = configs.find(
      (c) => c.subjectId === subjectId && c.grado === grado && c.periodo === periodo && c.anio === anio,
    );
    if (cfg?.fuente === 'master2000') return { subjectId, estado: 'master2000' };
    const sesiones = sessions.filter((s) => s.subjectId === subjectId && s.grado === grado).length;
    return cfg
      ? { subjectId, estado: 'app', sesiones }
      : { subjectId, estado: 'sin_configurar', sesiones };
  });
}
