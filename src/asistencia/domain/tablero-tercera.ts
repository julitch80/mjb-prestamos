/**
 * Tablero «¿Quién llamó lista?» de la tercera hora, para coordinación (2026-09-25).
 *
 * ── Para qué ─────────────────────────────────────────────────────────────────
 * La coordinadora necesita saber, grupo por grupo, si ya se llamó lista en la tercera
 * hora, y si no, qué asignatura era y en qué aula están, para ir o mandar a alguien. Antes
 * no habia donde verlo: la pestaña Planillas mostraba una tarjeta por cada asignatura de
 * cada grupo (9.1 doce veces) y la tercera hora solo detectaba grupos «sin datos» si
 * alguien escribia a mano la lista de grupos esperados, cosa que nadie hacia.
 *
 * ── De dónde sale cada dato ──────────────────────────────────────────────────
 *  - QUE CLASE HAY: el horario efectivo del dia. Lo calcula MJB
 *    (`aplicarModificacionesAlDia`) con el horario base y los cambios del dia escolar:
 *    horas movidas, canceladas, talleres, aulas reasignadas. Trae docente y aula; la
 *    asignatura se deduce aparte de la asignacion academica.
 *  - REEMPLAZOS Y AUSENCIAS: de los cambios del dia escolar, que la funcion de MJB no
 *    aplica al docente (solo mueve horas y aulas). Se leen aqui.
 *  - SI SE LLAMO LISTA: la sesion del bloque 3 de ese grupo ese dia. Hay UNA por grupo
 *    y dia (el id no lleva asignatura).
 *
 * Puro: sin Firebase ni datos de MJB. La pantalla le pasa todo ya leido.
 */

import { findMark } from './marks';
import { gradoSortKey } from './ids';
import type { Session } from './types';

export const BLOQUE_TERCERA = 3;

/**
 * Minutos de gracia desde que empieza el bloque antes de marcar un grupo «sin lista»
 * (decision de Julián). Sin esto, a las 8:10 todos los grupos saldrian en rojo.
 */
export const GRACIA_MINUTOS = 15;

/** Lo que el tablero usa de una entrada del horario efectivo (`EntradaEfectiva` de MJB). */
export interface ClaseDelDia {
  bloque: number;
  docente: string;
  grado: string;
  aula: string;
  esTaller: boolean;
  esModificada: boolean;
  bloqueOriginal?: number;
  supervisorId?: string;
}

/** Lo que el tablero usa de un cambio del dia escolar (`HorarioModificado` de MJB). */
export interface CambioDelDia {
  fecha: string;
  jornada: string;
  estado: string;
  timestamp: string;
  ausencias: { docenteId: string; bloques: number[] }[];
  apoyos?: { id: string; nombre: string }[];
  modificaciones: {
    bloqueOriginal: number;
    docenteOriginal: string;
    grupo: string;
    docenteNuevo?: string;
    apoyoId?: string;
  }[];
}

/**
 * El cambio del dia que vale: el GUARDADO mas reciente de esa fecha y jornada. La misma
 * regla que usa MJB (`horarioModificadoVigente`): si se reabre y se vuelve a guardar el
 * mismo dia, pueden quedar varios, y el que manda es el ultimo.
 */
export function cambioVigente<C extends CambioDelDia>(cambios: C[], fecha: string, jornada: string): C | undefined {
  const candidatos = cambios.filter((c) => c.fecha === fecha && c.jornada === jornada && c.estado === 'guardado');
  if (candidatos.length === 0) return undefined;
  return candidatos.reduce((a, b) => (b.timestamp > a.timestamp ? b : a));
}

export type Cubrimiento =
  | { tipo: 'reemplazo'; docente: string }
  | { tipo: 'apoyo'; nombre: string }
  | { tipo: 'taller'; supervisor: string | null };

/** Quien cubre esa clase hoy, si no es el titular. */
export function cubrimientoDe(clase: ClaseDelDia, cambio: CambioDelDia | undefined): Cubrimiento | null {
  const original = clase.bloqueOriginal ?? clase.bloque;
  const mod = cambio?.modificaciones.find(
    (m) => m.docenteOriginal === clase.docente && m.grupo === clase.grado && m.bloqueOriginal === original,
  );
  if (mod?.docenteNuevo) return { tipo: 'reemplazo', docente: mod.docenteNuevo };
  if (mod?.apoyoId) {
    const apoyo = cambio?.apoyos?.find((a) => a.id === mod.apoyoId);
    return { tipo: 'apoyo', nombre: apoyo?.nombre ?? 'apoyo' };
  }
  if (clase.esTaller) return { tipo: 'taller', supervisor: clase.supervisorId ?? null };
  return null;
}

/** Si el día escolar registra al titular como ausente en esa hora (y nadie lo cubre). */
export function titularAusente(clase: ClaseDelDia, cambio: CambioDelDia | undefined): boolean {
  const original = clase.bloqueOriginal ?? clase.bloque;
  return (cambio?.ausencias ?? []).some((a) => a.docenteId === clase.docente && a.bloques.includes(original));
}

export type EstadoLista =
  | 'llamo' //       verde: la sesion tiene marcas y se cerro
  | 'en_curso' //    ambar: tiene marcas pero no se ha cerrado
  | 'sin_lista' //   rojo: tenia clase, paso la gracia y no hay marcas
  | 'en_hora' //     gris: tenia clase pero todavia esta dentro de la gracia
  | 'sin_clase' //   gris: el horario no le pone clase a esa hora
  | 'sin_horario'; // gris: el horario no cubre ese grupo (primaria, otras sedes)

export function minutosDe(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function marcasDe(sesion: Pick<Session, 'estudiantes'> | null | undefined): number {
  return Object.keys(sesion?.estudiantes ?? {}).length;
}

export function ausentesDe(sesion: Pick<Session, 'estudiantes'> | null | undefined): string[] {
  return Object.entries(sesion?.estudiantes ?? {})
    .filter(([, m]) => findMark(m.estado)?.isAbsence)
    .map(([id]) => id);
}

/**
 * El estado de un grupo en un bloque.
 *
 * Una sesion con marcas manda sobre el horario: si alguien llamo lista, se llamo lista,
 * diga lo que diga el horario (clase movida, reemplazo improvisado). Sin marcas, decide
 * el horario y el reloj. Una sesion abierta sin ninguna marca cuenta como sin lista:
 * abrir la planilla no es llamar lista.
 */
export function estadoDeLista(input: {
  sesion: Pick<Session, 'closed' | 'estudiantes'> | null;
  tieneClase: boolean;
  grupoConHorario: boolean;
  fecha: string;
  hoy: string;
  minutoActual: number;
  inicioBloque: number;
}): EstadoLista {
  const marcas = marcasDe(input.sesion);
  if (marcas > 0) return input.sesion?.closed ? 'llamo' : 'en_curso';
  if (!input.grupoConHorario) return 'sin_horario';
  if (!input.tieneClase) return 'sin_clase';
  if (input.fecha < input.hoy) return 'sin_lista';
  if (input.fecha > input.hoy) return 'en_hora';
  return input.minutoActual < input.inicioBloque + GRACIA_MINUTOS ? 'en_hora' : 'sin_lista';
}

export interface EstadoBloque {
  bloque: number;
  clase: ClaseDelDia | null;
  sesion: Session | null;
  estado: EstadoLista;
}

export interface FilaTablero {
  grado: string;
  /** El nivel para agrupar las tarjetas: '9' de '9.1', '6' de '6º1'. */
  nivel: string;
  tercera: EstadoBloque;
  cubrimiento: Cubrimiento | null;
  titularAusente: boolean;
  /** Las seis horas del dia, para consulta en el desplegable. */
  dia: EstadoBloque[];
}

export function nivelDe(grado: string): string {
  return grado.match(/^(\d+)/)?.[1] ?? grado;
}

/**
 * El tablero entero: una fila por grupo de la jornada, en el orden del colegio.
 *
 * `grados` son TODOS los grupos de la jornada (salgan o no en el horario o en las
 * sesiones): un grupo que nadie ha tocado es justo el que hay que ver.
 */
export function construirTablero(input: {
  grados: string[];
  clases: ClaseDelDia[];
  sesiones: Session[];
  cambio: CambioDelDia | undefined;
  gruposConHorario: Set<string>;
  inicioDeBloque: (bloque: number) => number;
  fecha: string;
  hoy: string;
  minutoActual: number;
}): FilaTablero[] {
  const claseEn = new Map<string, ClaseDelDia>();
  for (const c of input.clases) {
    const k = `${c.grado}|${c.bloque}`;
    if (!claseEn.has(k)) claseEn.set(k, c);
  }
  const sesionEn = new Map<string, Session>();
  for (const s of input.sesiones) if (s.fecha === input.fecha) sesionEn.set(`${s.grado}|${s.bloque}`, s);

  const estadoEn = (grado: string, bloque: number): EstadoBloque => {
    const clase = claseEn.get(`${grado}|${bloque}`) ?? null;
    const sesion = sesionEn.get(`${grado}|${bloque}`) ?? null;
    return {
      bloque,
      clase,
      sesion,
      estado: estadoDeLista({
        sesion,
        tieneClase: clase !== null,
        grupoConHorario: input.gruposConHorario.has(grado),
        fecha: input.fecha,
        hoy: input.hoy,
        minutoActual: input.minutoActual,
        inicioBloque: input.inicioDeBloque(bloque),
      }),
    };
  };

  return [...new Set(input.grados)]
    .sort((a, b) => gradoSortKey(a).localeCompare(gradoSortKey(b)))
    .map((grado) => {
      const tercera = estadoEn(grado, BLOQUE_TERCERA);
      return {
        grado,
        nivel: nivelDe(grado),
        tercera,
        cubrimiento: tercera.clase ? cubrimientoDe(tercera.clase, input.cambio) : null,
        titularAusente: tercera.clase ? titularAusente(tercera.clase, input.cambio) : false,
        dia: [1, 2, 3, 4, 5, 6].map((b) => estadoEn(grado, b)),
      };
    });
}

export interface ResumenTablero {
  llamo: number;
  enCurso: number;
  sinLista: number;
  enHora: number;
  /** Los que tienen clase a tercera hora, o sesion: el denominador honesto. */
  conClase: number;
}

export function resumirTablero(filas: FilaTablero[]): ResumenTablero {
  const r: ResumenTablero = { llamo: 0, enCurso: 0, sinLista: 0, enHora: 0, conClase: 0 };
  for (const f of filas) {
    const e = f.tercera.estado;
    if (e === 'llamo') r.llamo++;
    if (e === 'en_curso') r.enCurso++;
    if (e === 'sin_lista') r.sinLista++;
    if (e === 'en_hora') r.enHora++;
    if (e !== 'sin_clase' && e !== 'sin_horario') r.conClase++;
  }
  return r;
}
