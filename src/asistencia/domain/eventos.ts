/**
 * Eventos — grupos temporales (feria, centro de interes, salida) con asistencia
 * TOTALMENTE independiente de la asistencia por asignatura. docs/modelo-datos-asistencia.md.
 *
 * REGLA DE ORO heredada de stats.ts: el universo son las SESIONES REGISTRADAS del
 * evento, jamas el calendario ni el rango `desde`/`hasta`. Un dia dentro del rango sin
 * sesion de evento no existe para el calculo.
 */

import { findMark, type MarkCode } from './marks';
import { jornadaDeGrado } from './ids';
import type { Event, EventMemberSource, EventSession, Student } from './types';

/**
 * Resuelve las tres formas de seleccion (grados completos, jornadas enteras,
 * individuales sueltos) a una lista unica de studentIds.
 *
 * Solo estudiantes activos: uno dado de baja no debe reaparecer en un evento nuevo
 * solo porque su grado sigue existiendo. Deduplica porque las tres formas se pueden
 * solapar (un estudiante de 11.2 elegido tambien a mano, y cubierto ademas por "toda la
 * jornada de la manana"): debe aparecer UNA sola vez.
 *
 * Orden por apellidos y luego nombres, igual que `leerGrupo` en datos.ts, para que la
 * lista de integrantes sea estable y predecible en la pantalla del docente.
 */
export function resolverIntegrantes(
  candidatos: Student[],
  origen: EventMemberSource,
): string[] {
  const gradosSet = new Set(origen.grados);
  const jornadasSet = new Set(origen.jornadas);
  const individualesSet = new Set(origen.individuales);

  const elegidos = candidatos.filter((e) => {
    if (!e.activo) return false;
    if (gradosSet.has(e.gradoActual)) return true;
    if (jornadasSet.has(jornadaDeGrado(e.gradoActual))) return true;
    if (individualesSet.has(e.studentId)) return true;
    return false;
  });

  return elegidos
    .sort((a, b) =>
      `${a.apellidos} ${a.nombres}`.localeCompare(`${b.apellidos} ${b.nombres}`),
    )
    .map((e) => e.studentId);
}

/** El evento cubre esa fecha. `desde` y `hasta` son ambos INCLUSIVOS. */
export function eventoVigente(
  evento: Pick<Event, 'desde' | 'hasta' | 'activo'>,
  fecha: string,
): boolean {
  return evento.activo && evento.desde <= fecha && fecha <= evento.hasta;
}

/**
 * Valida el rango antes de crear. El mensaje lo lee un docente, no un log: va en
 * espanol claro y con acentos, no un codigo de error.
 */
export function validarRangoEvento(desde: string, hasta: string): string | null {
  if (!desde || !hasta) return 'Las fechas de inicio y fin son obligatorias.';
  if (hasta < desde) return 'La fecha de fin no puede ser anterior a la de inicio.';
  return null;
}

export interface EventStats {
  sesionesCount: number;                 // denominador, se muestra SIEMPRE
  porMarca: Record<MarkCode, number>;
  ausenciasTotales: number;
  sinRegistrar: number;
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
 * Estadistica de UN estudiante en UN evento.
 *
 * A diferencia de `computeStats` (stats.ts), esta funcion NO recibe matriculas ni
 * `subjectId`: en un evento la pertenencia la define la lista `miembros` del propio
 * evento, resuelta una vez al crearlo, no la matricula vigente en un grado. Preguntar
 * "¿estaba matriculado ese dia?" no tiene sentido aqui — lo que importa es "¿estaba en
 * la lista de integrantes del evento?", y esa lista ya es la respuesta.
 */
export function estadisticaEvento(studentId: string, sesiones: EventSession[]): EventStats {
  const porMarca = marcaVacia();
  let ausenciasTotales = 0;
  let conRegistro = 0;

  for (const s of sesiones) {
    const m = s.estudiantes?.[studentId];
    if (!m) continue;
    const def = findMark(m.estado);
    // Una marca desconocida (retirada del catalogo) no se cuenta ni a favor ni en
    // contra, igual que en stats.ts: contarla seria inventar un dato que nadie registro.
    if (!def) continue;
    conRegistro++;
    porMarca[def.code] += 1;
    if (def.isAbsence) ausenciasTotales++;
  }

  const sesionesCount = sesiones.length;
  return {
    sesionesCount,
    porMarca,
    ausenciasTotales,
    sinRegistrar: Math.max(0, sesionesCount - conRegistro),
  };
}

/** Avance de UNA sesion: cuantos integrantes llevan marca y cuantos faltan. */
export function resumenSesionEvento(
  sesion: EventSession | null,
  miembros: string[],
): { marcados: number; pendientes: number; total: number } {
  const total = miembros.length;
  if (!sesion) return { marcados: 0, pendientes: total, total };
  const marcados = miembros.filter((id) => sesion.estudiantes?.[id]).length;
  return { marcados, pendientes: total - marcados, total };
}
