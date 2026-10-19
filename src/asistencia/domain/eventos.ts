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
import { ordenarEstudiantes } from './nombres';
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

  // Nace ordenado, aunque la planilla del evento vuelva a ordenar al pintar: asi el
  // arreglo guardado es legible tal cual si algun dia se exporta o se lee a mano.
  return ordenarEstudiantes(elegidos).map((e) => e.studentId);
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

// ---------------------------------------------------------------------------
//  Planilla del evento en columnas (Julian, 2026-10-19)
// ---------------------------------------------------------------------------

/**
 * Los dias del rango del evento, inclusivos, en orden. Son las columnas que se pueden
 * abrir: antes el selector de fecha dejaba escoger cualquier dia, aun fuera del evento.
 * Se calcula en UTC para que un cambio de horario no repita ni salte un dia.
 */
export function diasDelEvento(desde: string, hasta: string): string[] {
  const dias: string[] = [];
  const d = new Date(`${desde}T00:00:00Z`);
  const fin = new Date(`${hasta}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || Number.isNaN(fin.getTime())) return dias;
  while (d <= fin && dias.length < 400) {
    dias.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return dias;
}

/**
 * Orden de grados natural: 6.º2 antes que 6.º10, y por numero de grado antes que por
 * texto. No sanea la notacion (`9.1` es de la mañana y `6º1` de la tarde, la «º» distingue
 * la jornada): solo extrae los numeros para comparar, y desempata por el texto original.
 */
export function compararGrados(a: string, b: string): number {
  const na = (a.match(/\d+/g) ?? []).map(Number);
  const nb = (b.match(/\d+/g) ?? []).map(Number);
  for (let i = 0; i < Math.max(na.length, nb.length); i++) {
    const x = na[i] ?? -1;
    const y = nb[i] ?? -1;
    if (x !== y) return x - y;
  }
  return a.localeCompare(b, 'es');
}

/** Los integrantes agrupados por grado, en orden natural; dentro de cada grado, el orden que traian. */
export function agruparPorGrado<T extends { gradoActual: string }>(
  lista: T[],
): { grado: string; estudiantes: T[] }[] {
  const porGrado = new Map<string, T[]>();
  for (const e of lista) {
    const g = e.gradoActual || 'Sin grado';
    const l = porGrado.get(g) ?? [];
    l.push(e);
    porGrado.set(g, l);
  }
  return [...porGrado.entries()]
    .sort(([a], [b]) => compararGrados(a, b))
    .map(([grado, estudiantes]) => ({ grado, estudiantes }));
}

/**
 * El nombre corto de un docente para mostrar quien llamo lista: el primer nombre de
 * `displayName` («Julián David Medina» → «Julián»). Sin nombre, la parte del correo antes
 * de la arroba: nunca el correo completo con dominio.
 */
export function nombreCortoDocente(displayName: string | undefined, correo: string): string {
  const primera = (displayName ?? '').trim().split(/\s+/)[0];
  if (primera) return primera.charAt(0).toLocaleUpperCase('es') + primera.slice(1).toLocaleLowerCase('es');
  return correo.split('@')[0] ?? correo;
}

/** Quienes marcaron en una sesion, sin repetir, en el orden en que aparecen. */
export function quienesLlamaronLista(sesion: EventSession): string[] {
  const vistos = new Set<string>();
  for (const m of Object.values(sesion.estudiantes ?? {})) {
    if (m?.registradoPor) vistos.add(m.registradoPor);
  }
  return [...vistos];
}
