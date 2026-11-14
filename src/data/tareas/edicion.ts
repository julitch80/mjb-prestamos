// Validación al EDITAR una tarea o recordatorio ya publicado.
// Reutiliza validarTarea (cupo por semana de ejecución, plazo, capacidad, reglas de
// recordatorio) excluyendo la propia tarea del cálculo. El servidor (editarTarea en
// docs/backend-Code.gs) repite las reglas que también aplica crearTarea.
import type { ContextoValidacion, ResultadoValidacion, Tarea } from './tipos';
import { validarTarea } from './motor';
import { validarEnlaces } from './recordatorios';

/** Fecha de asignación con la que se valida la edición: la original (el plazo y la ventana se contaron desde ahí). */
export function fechaAsignacionEdicion(original: Tarea, hoy: string): string {
  return original.fechaAsignacion || hoy;
}

/**
 * @param original tarea tal como está publicada
 * @param editada  tarea con los cambios propuestos (mismo id, grupo, asignatura, docente y tipo)
 * @param ctx      contexto del grupo; se excluye `original` de ctx.tareas aquí mismo
 */
export function validarEdicion(original: Tarea, editada: Tarea, ctx: ContextoValidacion): ResultadoValidacion {
  if (original.estado === 'cancelada') {
    return { ok: false, filtro: 'entrega', mensaje: 'Una tarea cancelada no se puede editar.' };
  }
  if (!editada.titulo.trim()) {
    return { ok: false, filtro: 'entrega', mensaje: 'El título no puede quedar vacío.' };
  }
  const enlaces = validarEnlaces(editada.enlaces);
  if (!enlaces.ok) return { ok: false, filtro: 'entrega', mensaje: enlaces.error };

  const cambioFecha = editada.fechaEntrega !== original.fechaEntrega;
  const cambioMomentos = editada.tipo !== 'recordatorio' && editada.momentos !== original.momentos;
  const ctxSin: ContextoValidacion = { ...ctx, tareas: ctx.tareas.filter(t => t.id !== original.id) };

  // Solo cambian texto, adjunto o enlaces: no hay nada de fecha ni cupo que revisar
  // (una tarea que vence hoy o con la ventana ya cerrada igual se puede corregir).
  if (!cambioFecha && !cambioMomentos) {
    if (editada.tipo === 'recordatorio' && !editada.tipoRecordatorio) {
      return { ok: false, filtro: 'entrega', mensaje: 'Elige el tipo de recordatorio.' };
    }
    return { ok: true };
  }
  return validarTarea(
    { ...editada, id: '_previa', fechaAsignacion: fechaAsignacionEdicion(original, ctx.hoy) },
    ctxSin,
  );
}
