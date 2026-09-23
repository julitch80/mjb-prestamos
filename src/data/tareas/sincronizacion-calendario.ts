// Sincronización de la agenda de tareas con el Google Calendar del estudiante
// (docs/calendario-tareas/PRD.md). Aquí vive SOLO la lógica pura: qué eventos
// debería tener el calendario «Tareas MJB» de un estudiante y qué hay que crear,
// cambiar o borrar para llegar ahí. La Cloud Function (functions-calendario) hace
// las llamadas a Google; esta parte se prueba sin red.
//
// Sin imports de navegador: la compila también el tsconfig de la función.

/** Lo que devuelve getDatosTareas del Apps Script, solo los campos que se usan. */
export interface TareaRemota {
  id: string;
  grupo: string;
  asignaturaId: string;
  titulo: string;
  fechaEntrega: string; // AAAA-MM-DD
  estado: string;       // 'activa' | 'cancelada'
  momentos: number;
}

/** Un evento tal como debería quedar en el calendario del estudiante. */
export interface EventoDeseado {
  tareaId: string;
  grupo: string;
  resumen: string;
  descripcion: string;
  fecha: string;             // AAAA-MM-DD, evento de todo el día
  avisoMinutosAntes: number; // desde la medianoche del día de entrega
  huella: string;            // cambia si cambia cualquier cosa visible del evento
}

/** Un evento que ya está en el calendario, leído de Google. */
export interface EventoExistente {
  eventId: string;
  tareaId: string | null; // null: evento que no puso la aplicación (no se toca)
  grupo: string | null;
  huella: string | null;
}

export interface PlanDeCambios {
  crear: EventoDeseado[];
  actualizar: { eventId: string; evento: EventoDeseado }[];
  borrar: string[]; // eventIds
}

export const NOMBRE_CALENDARIO = 'Tareas MJB';

/**
 * Aviso del día anterior (decisión D2 de Julián, 22-sep-2026): 3:00 p. m. para la
 * mañana (ya salieron de clase) y 9:00 a. m. para la tarde (antes de entrar).
 * En un evento de todo el día Google cuenta los minutos desde la medianoche del
 * día del evento: 3 p. m. del día anterior = 9 h antes = 540 min.
 */
export function avisoMinutosAntes(grupo: string): number {
  const esTarde = grupo.includes('º');
  return esTarde ? 15 * 60 : 9 * 60;
}

/** Hash corto y estable (FNV-1a) — no es seguridad, solo detectar cambios. */
function huellaDe(texto: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

export function eventoDeseado(
  tarea: TareaRemota,
  nombreAsignatura: string,
  urlAgenda: string,
): EventoDeseado {
  const resumen = `${nombreAsignatura} — ${tarea.titulo}`;
  const minutos = Math.max(1, tarea.momentos) * 25;
  const descripcion = [
    `Entrega de la tarea de ${nombreAsignatura}.`,
    `Tiempo estimado: ${minutos} minutos.`,
    '',
    `Agenda de tu grupo: ${urlAgenda}`,
  ].join('\n');
  const avisoMin = avisoMinutosAntes(tarea.grupo);
  return {
    tareaId: tarea.id,
    grupo: tarea.grupo,
    resumen,
    descripcion,
    fecha: tarea.fechaEntrega,
    avisoMinutosAntes: avisoMin,
    huella: huellaDe([resumen, descripcion, tarea.fechaEntrega, avisoMin].join('|')),
  };
}

/** Las tareas vigentes de un grupo convertidas en eventos. Las canceladas no van. */
export function eventosDeseadosDelGrupo(
  tareas: TareaRemota[],
  grupo: string,
  nombreAsignatura: (id: string) => string,
  urlAgenda: string,
): EventoDeseado[] {
  return tareas
    .filter((t) => t.grupo === grupo && t.estado === 'activa' && /^\d{4}-\d{2}-\d{2}$/.test(t.fechaEntrega))
    .map((t) => eventoDeseado(t, nombreAsignatura(t.asignaturaId), urlAgenda));
}

/**
 * Qué hay que hacer para que el calendario quede igual a `deseados`.
 * - Solo se tocan eventos que puso la aplicación (tareaId no nulo).
 * - Un evento de la aplicación repetido para la misma tarea se deja uno y se
 *   borran los demás (se arregla solo si alguna vez una revisión se cortó a medias).
 */
export function planDeCambios(deseados: EventoDeseado[], existentes: EventoExistente[]): PlanDeCambios {
  const plan: PlanDeCambios = { crear: [], actualizar: [], borrar: [] };
  const porTarea = new Map<string, EventoExistente>();
  for (const e of existentes) {
    if (!e.tareaId) continue;
    if (porTarea.has(e.tareaId)) plan.borrar.push(e.eventId);
    else porTarea.set(e.tareaId, e);
  }
  const vigentes = new Set<string>();
  for (const d of deseados) {
    vigentes.add(d.tareaId);
    const ya = porTarea.get(d.tareaId);
    if (!ya) plan.crear.push(d);
    else if (ya.huella !== d.huella) plan.actualizar.push({ eventId: ya.eventId, evento: d });
  }
  for (const [tareaId, e] of porTarea) {
    if (!vigentes.has(tareaId)) plan.borrar.push(e.eventId);
  }
  return plan;
}

/** Cuerpo del evento para la API de Google Calendar (events.insert / events.update). */
export function cuerpoEventoGoogle(e: EventoDeseado): Record<string, unknown> {
  const [y, m, d] = e.fecha.split('-').map(Number);
  const siguiente = new Date(Date.UTC(y, m - 1, d + 1));
  const fin = siguiente.toISOString().slice(0, 10);
  return {
    summary: e.resumen,
    description: e.descripcion,
    start: { date: e.fecha },
    end: { date: fin },
    transparency: 'transparent', // no marca al estudiante como «ocupado»
    reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: e.avisoMinutosAntes }] },
    extendedProperties: { private: { tareaId: e.tareaId, grupo: e.grupo, huella: e.huella } },
  };
}

/** Quién recibe el calendario: correo institucional y cuenta no marcada como inactiva. */
export interface EstudianteParaCalendario {
  correoInstitucional?: string | null;
  correoCuentaActiva?: boolean | null;
  activo?: boolean;
}

export function correoParaCalendario(e: EstudianteParaCalendario, dominio: string): string | null {
  if (e.activo === false) return null;
  if (e.correoCuentaActiva === false) return null;
  const c = (e.correoInstitucional ?? '').trim().toLowerCase();
  if (!c || !c.endsWith('@' + dominio)) return null;
  return c;
}
