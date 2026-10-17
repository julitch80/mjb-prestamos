// Recordatorios y enlaces del módulo de Tareas (docs/tareas-enlaces-recordatorios/PRD.md).
//
// Un recordatorio es un mensaje para una fecha («examen el jueves», «traer materiales»):
// no ocupa cupo de momentos, no tiene plazo mínimo y no se entrega. Aquí vive solo la
// lógica pura (límites, avisos, cuenta regresiva, enlaces) para probarla sin interfaz.
// OJO: el Apps Script repite los límites de MAX_RECORDATORIOS_POR_DIA y de los enlaces
// (docs/backend-Code.gs, función crearTarea); si se cambian aquí, cambiarlos allá.

import type { EnlaceTarea, FechaISO, Tarea, TipoRecordatorio, ContextoValidacion, ResultadoValidacion } from './tipos';
import { diaSemana, esDiaHabil } from './calendario';
import { esUrlSegura } from './textoEnlaces';

export const MAX_RECORDATORIOS_POR_DIA = 3;
export const MAX_EVALUACIONES_SIN_AVISO = 2;
export const MAX_ENLACES = 3;

export const TIPOS_RECORDATORIO: Record<TipoRecordatorio, { icono: string; etiqueta: string; plural: string }> = {
  evaluacion: { icono: '📝', etiqueta: 'Evaluación o examen', plural: 'evaluaciones' },
  materiales: { icono: '🎒', etiqueta: 'Traer materiales', plural: 'materiales' },
  documentos: { icono: '📄', etiqueta: 'Traer documentos', plural: 'documentos' },
  aviso: { icono: '📢', etiqueta: 'Aviso general', plural: 'avisos' },
};

export const ORDEN_TIPOS_RECORDATORIO: TipoRecordatorio[] = ['evaluacion', 'materiales', 'documentos', 'aviso'];

export function esRecordatorio(t: Pick<Tarea, 'tipo'>): boolean {
  return t.tipo === 'recordatorio';
}

export function iconoRecordatorio(t: Pick<Tarea, 'tipoRecordatorio'>): string {
  return TIPOS_RECORDATORIO[t.tipoRecordatorio ?? 'aviso']?.icono ?? '📢';
}

// ── Enlaces ───────────────────────────────────────────────────────────────────

export const MENSAJE_ENLACE_INVALIDO = 'Ese enlace no es válido';

/** Nombre a mostrar en el botón: el que escribió el docente o, si no, el dominio. */
export function nombreDeEnlace(e: EnlaceTarea): string {
  const nombre = (e.nombre ?? '').trim();
  if (nombre) return nombre;
  try {
    return new URL(e.url).hostname.replace(/^www\./, '');
  } catch {
    return e.url;
  }
}

/** Limpia, valida (http/https) y limita a 3. Las filas vacías se descartan. */
export function validarEnlaces(
  enlaces: EnlaceTarea[] | undefined,
): { ok: true; enlaces: EnlaceTarea[] } | { ok: false; error: string } {
  const limpios: EnlaceTarea[] = [];
  for (const e of enlaces ?? []) {
    const url = (e.url ?? '').trim();
    const nombre = (e.nombre ?? '').trim();
    if (!url && !nombre) continue;
    if (!url || !esUrlSegura(url)) return { ok: false, error: MENSAJE_ENLACE_INVALIDO };
    limpios.push(nombre ? { url, nombre: nombre.slice(0, 60) } : { url });
  }
  if (limpios.length > MAX_ENLACES) return { ok: false, error: `Máximo ${MAX_ENLACES} enlaces por publicación` };
  return { ok: true, enlaces: limpios };
}

/** Enlaces seguros listos para pintar (descarta cualquier cosa que no sea http/https). */
export function enlacesVisibles(t: Pick<Tarea, 'enlaces'>): EnlaceTarea[] {
  return (t.enlaces ?? []).filter(e => e && typeof e.url === 'string' && esUrlSegura(e.url)).slice(0, MAX_ENLACES);
}

// ── Límites y avisos por día ──────────────────────────────────────────────────

function recordatoriosActivos(tareas: Tarea[], grupo: string, fecha: FechaISO): Tarea[] {
  return tareas.filter(t => esRecordatorio(t) && t.estado === 'activa' && t.grupo === grupo && t.fechaEntrega === fecha);
}

/** «jueves 22» (día de la semana y número). */
export function diaYNumero(f: FechaISO): string {
  return `${diaSemana(f)} ${Number(f.slice(8))}`.replace('miercoles', 'miércoles').replace('sabado', 'sábado');
}

function unirNombres(nombres: string[]): string {
  if (nombres.length <= 1) return nombres.join('');
  return `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;
}

/**
 * Aviso (NO bloquea) si el grupo ya tiene 2 o más evaluaciones ese día y se va a
 * agregar otra evaluación. Devuelve el texto de la pregunta o null.
 */
export function avisoEvaluaciones(
  nueva: Pick<Tarea, 'tipo' | 'tipoRecordatorio' | 'grupo' | 'fechaEntrega'>,
  tareas: Tarea[],
  nombreAsignatura: (id: string) => string,
): string | null {
  if (nueva.tipo !== 'recordatorio' || nueva.tipoRecordatorio !== 'evaluacion') return null;
  const evals = recordatoriosActivos(tareas, nueva.grupo, nueva.fechaEntrega).filter(t => t.tipoRecordatorio === 'evaluacion');
  if (evals.length < MAX_EVALUACIONES_SIN_AVISO) return null;
  const asignaturas = [...new Set(evals.map(t => nombreAsignatura(t.asignaturaId)))];
  return `${nueva.grupo} ya tiene ${evals.length} evaluaciones el ${diaYNumero(nueva.fechaEntrega)}: ${unirNombres(asignaturas)}. ¿Publicar de todos modos?`;
}

export function validarRecordatorio(nueva: Tarea, ctx: ContextoValidacion): ResultadoValidacion {
  if (nueva.fechaEntrega <= ctx.hoy) {
    return { ok: false, filtro: 'entrega', mensaje: 'La fecha del recordatorio debe ser posterior a hoy.' };
  }
  if (!esDiaHabil(nueva.fechaEntrega)) {
    return { ok: false, filtro: 'entrega', mensaje: 'La fecha debe caer en un día hábil (sin fines de semana ni festivos).' };
  }
  if (!nueva.tipoRecordatorio || !(nueva.tipoRecordatorio in TIPOS_RECORDATORIO)) {
    return { ok: false, filtro: 'entrega', mensaje: 'Elige el tipo de recordatorio.' };
  }
  const e = validarEnlaces(nueva.enlaces);
  if (!e.ok) return { ok: false, filtro: 'entrega', mensaje: e.error };
  if (recordatoriosActivos(ctx.tareas, nueva.grupo, nueva.fechaEntrega).length >= MAX_RECORDATORIOS_POR_DIA) {
    return { ok: false, filtro: 'capacidad', mensaje: `Este grupo ya tiene ${MAX_RECORDATORIOS_POR_DIA} recordatorios ese día` };
  }
  return { ok: true };
}

// ── Cuenta regresiva ──────────────────────────────────────────────────────────

/** Días calendario entre dos fechas ISO (fecha - hoy). */
export function diasHasta(fecha: FechaISO, hoy: FechaISO): number {
  const [y1, m1, d1] = hoy.split('-').map(Number);
  const [y2, m2, d2] = fecha.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

export function cuentaRegresiva(fecha: FechaISO, hoy: FechaISO): string {
  const n = diasHasta(fecha, hoy);
  if (n <= 0) return 'hoy';
  if (n === 1) return 'mañana';
  return `en ${n} días`;
}

/** Recordatorios activos del grupo que aún no pasan, del más próximo al más lejano. */
export function recordatoriosProximos(tareas: Tarea[], grupo: string, hoy: FechaISO): Tarea[] {
  return tareas
    .filter(t => esRecordatorio(t) && t.estado === 'activa' && t.grupo === grupo && t.fechaEntrega >= hoy)
    .sort((a, b) => a.fechaEntrega.localeCompare(b.fechaEntrega));
}

export function recordatoriosDelDia(tareas: Tarea[], grupo: string, fecha: FechaISO): Tarea[] {
  return recordatoriosActivos(tareas, grupo, fecha);
}

