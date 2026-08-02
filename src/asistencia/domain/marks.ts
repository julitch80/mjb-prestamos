/**
 * Taxonomia de asistencia — dictada y aprobada por Julian el 2026-07-29.
 * Documento de referencia: docs/modelo-datos-asistencia.md, seccion 1.
 *
 * NO se inventa nada aqui. Las siete marcas son planas: la justificacion NO es un
 * campo aparte, es OTRA MARCA. Cuando el estudiante llega dias despues con la excusa,
 * el docente cambia `ausencia` por `ausencia_justificada` y el valor anterior queda en
 * el historial.
 */

export type MarkCode =
  | 'asistencia'
  | 'ausencia'
  | 'retraso'
  | 'ausencia_justificada'
  | 'retraso_justificado'
  | 'evasion'
  | 'ausencia_autorizada';

export interface Mark {
  code: MarkCode;
  /** Texto que ve el docente. Interfaz en espanol (contrato, seccion 4). */
  label: string;
  /** Cuenta como inasistencia en la estadistica interna. */
  isAbsence: boolean;
  /** Cuenta como retraso a esa clase. NO es la llegada tarde a la institucion. */
  isTardy: boolean;
  /** Se transcribe a Master2000 al cierre de periodo. Solo ausencia y evasion. */
  goesToMaster2000: boolean;
  /** Token semantico, nunca un color literal (contrato, seccion 5). */
  colorToken: 'success' | 'danger' | 'warning' | 'purple' | 'info';
  order: number;
}

export const MARKS: Mark[] = [
  { code: 'asistencia',           label: 'Asistencia',              isAbsence: false, isTardy: false, goesToMaster2000: false, colorToken: 'success', order: 1 },
  { code: 'ausencia',             label: 'Ausencia',                isAbsence: true,  isTardy: false, goesToMaster2000: true,  colorToken: 'danger',  order: 2 },
  { code: 'retraso',              label: 'Retraso',                 isAbsence: false, isTardy: true,  goesToMaster2000: false, colorToken: 'warning', order: 3 },
  { code: 'ausencia_justificada', label: 'Ausencia justificada',    isAbsence: true,  isTardy: false, goesToMaster2000: false, colorToken: 'info',    order: 4 },
  { code: 'retraso_justificado',  label: 'Retraso justificado',     isAbsence: false, isTardy: true,  goesToMaster2000: false, colorToken: 'info',    order: 5 },
  { code: 'evasion',              label: 'Evasion',                 isAbsence: true,  isTardy: false, goesToMaster2000: true,  colorToken: 'purple',  order: 6 },
  { code: 'ausencia_autorizada',  label: 'Ausencia con autorizacion', isAbsence: true, isTardy: false, goesToMaster2000: false, colorToken: 'info',   order: 7 },
];

const BY_CODE = new Map<string, Mark>(MARKS.map((m) => [m.code, m]));

export function findMark(code: string): Mark | undefined {
  return BY_CODE.get(code);
}

/** Las marcas que el docente puede poner sin intervencion de coordinacion. */
export const JUSTIFIED_CODES: MarkCode[] = [
  'ausencia_justificada',
  'retraso_justificado',
  'ausencia_autorizada',
];

export function isJustified(code: string): boolean {
  return (JUSTIFIED_CODES as string[]).includes(code);
}

/**
 * Advertencia de lectura, dicha por Julian: hoy casi toda evasion se registra como
 * `ausencia` y rara vez se corrige. El conteo de evasiones SUBESTIMA el fenomeno y no
 * debe presentarse como una medicion de el. Quien construya un reporte de evasiones
 * tiene que mostrar esta salvedad junto a la cifra.
 */
export const EVASION_WARNING =
  'El registro de evasiones subestima el fenomeno: en la practica la mayoria se marca ' +
  'como ausencia. Esta cifra no es una medicion de la evasion real.';

// ---------------------------------------------------------------------------
//  Llegada tarde a la institucion — NO es el retraso de clase (seccion 1.2)
// ---------------------------------------------------------------------------

export type LateArrivalState = 'sin_justificar' | 'pendiente_verificacion' | 'justificada';

export const LATE_ARRIVAL_STATES: { state: LateArrivalState; label: string; countsForAlerts: boolean }[] = [
  { state: 'sin_justificar',         label: 'Sin justificar',            countsForAlerts: true },
  // Dijo tener excusa pero no la trajo: falta llamar al acudiente. Sin este estado, el
  // coordinador tendria que elegir entre disparar una alerta que quiza no corresponde
  // o no registrar el hecho.
  { state: 'pendiente_verificacion', label: 'Pendiente de verificacion', countsForAlerts: false },
  { state: 'justificada',            label: 'Justificada',               countsForAlerts: false },
];

export type ExcuseReason = 'salud' | 'calamidad' | 'otro';

export const EXCUSE_REASONS: { reason: ExcuseReason; label: string }[] = [
  { reason: 'salud',     label: 'Salud' },
  { reason: 'calamidad', label: 'Calamidad domestica o laboral de la familia' },
  { reason: 'otro',      label: 'Otro (describir)' },
];

/**
 * Principio institucional dictado por Julian: el colegio tiene el DEBER DE CREER lo que
 * la familia informa. El coordinador no investiga la veracidad; verifica que la familia
 * este al tanto, registra y firma.
 */
export const EXCUSE_PRINCIPLE =
  'El colegio tiene el deber de creer lo que la familia informa. Coordinacion verifica ' +
  'que la familia este al tanto, registra y firma.';
