/**
 * Dia de entrega y seguimiento de la alerta academica — logica pura (Julian, 2026-10-03).
 * Ver docs/modelo-alerta-academica.md y la memoria `norma-citacion-acudientes`.
 *
 *  - El director marca quien vino y cierra la entrega.
 *  - El que no vino tiene un plazo para justificar (3 dias habiles por defecto; NO hay plazo
 *    nacional: es decision institucional).
 *  - El director genera UNA nueva citacion dentro de los 5 dias habiles: simple si justifico,
 *    con el fundamento normativo si no.
 *  - Si tampoco viene, o vencen los 5 dias sin cita, el caso pasa a coordinacion.
 *
 * Los estados NO se guardan: se DERIVAN de las fechas y de lo registrado. Asi «vencio el
 * plazo» no depende de que alguien abra la app ni de un proceso en el servidor.
 */
import type { AgendaCitaciones, CitaAlerta } from './types';

export const PLAZO_EXCUSA_DIAS = 3;
export const PLAZO_REPROGRAMAR_DIAS = 5;

/** Texto normativo VERIFICADO (2026-10-03) para la citacion de quien no justifico. */
export const FUNDAMENTO_CITACION =
  'De conformidad con el artículo 7, literal c, de la Ley 115 de 1994 y el artículo 2.3.3.3.3.15 del Decreto 1075 de 2015, ' +
  'corresponde a la familia informarse sobre el rendimiento académico de sus hijos, hacer seguimiento a su proceso evaluativo ' +
  'y participar en las acciones de mejoramiento. Nuestro Manual de Convivencia establece como deber de los padres asistir a ' +
  'las citaciones realizadas por los docentes o coordinación.';

// ── dias habiles ───────────────────────────────────────────────────────────────

const aFecha = (iso: string) => {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(a, m - 1, d);
};
const aISO = (f: Date) =>
  `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;

/** `true` si ese dia hay clase: no es sabado, domingo ni dia sin clases (festivo, etc.). */
export type EsDiaSinClases = (iso: string) => boolean;

export function esHabil(iso: string, sinClases: EsDiaSinClases): boolean {
  const dow = aFecha(iso).getDay();
  return dow !== 0 && dow !== 6 && !sinClases(iso);
}

/** La fecha `n` dias habiles despues de `iso` (sin contar `iso`). */
export function sumarDiasHabiles(iso: string, n: number, sinClases: EsDiaSinClases): string {
  const f = aFecha(iso);
  let faltan = n;
  while (faltan > 0) {
    f.setDate(f.getDate() + 1);
    if (esHabil(aISO(f), sinClases)) faltan--;
  }
  return aISO(f);
}

/** Los `n` dias habiles siguientes a `iso`, en orden. */
export function diasHabilesSiguientes(iso: string, n: number, sinClases: EsDiaSinClases): string[] {
  const res: string[] = [];
  const f = aFecha(iso);
  while (res.length < n) {
    f.setDate(f.getDate() + 1);
    if (esHabil(aISO(f), sinClases)) res.push(aISO(f));
  }
  return res;
}

// ── estado de cada citado ─────────────────────────────────────────────────────

export type EstadoSeguimiento =
  | 'pendiente_marcar'      // el dia de la entrega, sin marcar todavia
  | 'asistio'
  | 'esperando_excusa'      // no vino; corre el plazo de excusa
  | 'citar_simple'          // justifico: falta la nueva citacion
  | 'citar_con_norma'       // no justifico (o vencio el plazo): falta la nueva citacion
  | 'reprogramada'          // tiene nueva cita, aun no ocurre o no se ha marcado
  | 'asistio_reprogramada'
  | 'remitida';             // a coordinacion: a mano, por no venir a la segunda o por plazo

export interface ContextoSeguimiento {
  fechaEntrega: string;
  entregaCerrada: boolean;
  hoy: string;
  plazoExcusaDias: number;
  sinClases: EsDiaSinClases;
}

export interface Seguimiento {
  estado: EstadoSeguimiento;
  /** Hasta cuando corre el plazo de excusa (inclusive). */
  venceExcusa: string;
  /** Hasta cuando se puede reprogramar (inclusive): 5 dias habiles tras la entrega. */
  venceReprogramar: string;
  /** Motivo de la remision, si se remitio sola. */
  motivoRemision: string | null;
}

export function seguimientoDe(c: CitaAlerta, x: ContextoSeguimiento): Seguimiento {
  const venceExcusa = sumarDiasHabiles(x.fechaEntrega, x.plazoExcusaDias, x.sinClases);
  const venceReprogramar = sumarDiasHabiles(x.fechaEntrega, PLAZO_REPROGRAMAR_DIAS, x.sinClases);
  const r = (estado: EstadoSeguimiento, motivoRemision: string | null = null): Seguimiento =>
    ({ estado, venceExcusa, venceReprogramar, motivoRemision });

  if (c.remision) return r('remitida', c.remision.motivo);
  if (c.asistio === true) return r('asistio');
  if (c.asistio !== false && !x.entregaCerrada) return r('pendiente_marcar');

  // No vino.
  const rep = c.reprogramacion;
  if (rep) {
    if (rep.asistio === true) return r('asistio_reprogramada');
    if (rep.asistio === false) return r('remitida', 'Tampoco asistió a la segunda citación');
    return r('reprogramada');
  }
  if (x.hoy > venceReprogramar) return r('remitida', `Sin nueva citación en ${PLAZO_REPROGRAMAR_DIAS} días hábiles`);
  if (c.justificacion) return r('citar_simple');
  if (x.hoy > venceExcusa) return r('citar_con_norma');
  return r('esperando_excusa');
}

/** Lo que necesita la atencion del director (para el recordatorio). */
export function pendientesDelDirector(estados: EstadoSeguimiento[]): number {
  return estados.filter((e) => e === 'pendiente_marcar' || e === 'citar_simple' || e === 'citar_con_norma' || e === 'reprogramada').length;
}

// ── cuadro de coordinacion ────────────────────────────────────────────────────

export interface FilaAsistencia {
  grado: string;
  citados: number;
  asistieron: number;
  reprogramados: number;
  remitidos: number;
  /** Asistieron (a la entrega o a la segunda cita) / citados, 0..100. */
  porcentaje: number;
}

export function filaAsistencia(agenda: AgendaCitaciones, x: Omit<ContextoSeguimiento, 'entregaCerrada'>): FilaAsistencia {
  const estados = Object.values(agenda.citas).map((c) => seguimientoDe(c, { ...x, entregaCerrada: !!agenda.entregaCerradaEn }).estado);
  const citados = estados.length;
  const asistieron = estados.filter((e) => e === 'asistio' || e === 'asistio_reprogramada').length;
  return {
    grado: agenda.grado,
    citados,
    asistieron,
    reprogramados: estados.filter((e) => e === 'reprogramada' || e === 'asistio_reprogramada').length,
    remitidos: estados.filter((e) => e === 'remitida').length,
    porcentaje: citados ? Math.round((asistieron / citados) * 100) : 0,
  };
}

// ── horas libres del director ─────────────────────────────────────────────────

export interface HoraLibre {
  fecha: string;
  bloque: number;
  inicio: string;
  fin: string;
}

/**
 * Las horas libres de un dia: las franjas de su jornada en las que no tiene clase. La lista
 * de clases ya viene con los cambios del dia (`clasesEfectivas`); un dia sin clases para los
 * estudiantes no ofrece horas.
 */
export function horasLibresDelDia(
  fecha: string,
  ocupados: number[],
  franjas: { id: number; inicio: string; fin: string }[],
): HoraLibre[] {
  return franjas.filter((f) => !ocupados.includes(f.id)).map((f) => ({ fecha, bloque: f.id, inicio: f.inicio, fin: f.fin }));
}

// ── texto de la segunda citacion ──────────────────────────────────────────────

export function textoSmsSegundaCitacion(c: {
  estudiante: string;
  grado: string;
  fechaCorta: string;
  hora: string;
  conFundamento: boolean;
  director: string;
}): string {
  return (
    `I.E. Manuel J. Betancur. Acudiente de ${c.estudiante} (${c.grado}): no asistió a la entrega de la alerta académica. ` +
    `Le citamos el ${c.fechaCorta} a las ${c.hora} con el director de grupo.` +
    `${c.conFundamento ? ' Es deber de la familia asistir (Ley 115, art. 7; Manual de Convivencia).' : ''}` +
    ` Asistencia obligatoria: sirve de soporte para la licencia laboral de acudiente (Ley 2466 de 2025). Dir.: ${c.director}.`
  );
}
