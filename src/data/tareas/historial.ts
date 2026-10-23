// Historial del docente: solo SUS tareas y recordatorios (activas, vencidas y canceladas).
// Funciones puras; la vista vive en VistaTareas.tsx.
import type { Tarea, FechaISO } from './tipos';

export type EstadoHistorial = 'vigente' | 'vencida' | 'cancelada';

export function estadoHistorial(t: Pick<Tarea, 'estado' | 'fechaEntrega'>, hoy: FechaISO): EstadoHistorial {
  if (t.estado === 'cancelada') return 'cancelada';
  return t.fechaEntrega >= hoy ? 'vigente' : 'vencida';
}

/** Solo lo que publicó este docente. Nunca las de otros. */
export function tareasPropias(tareas: Tarea[], docenteId: string): Tarea[] {
  return tareas.filter(t => t.docenteId === docenteId);
}

/** Grupos que enseña (en orden dado) más los que aparecen en su historial. */
export function gruposDelHistorial(propias: Tarea[], gruposQueEnsena: string[]): string[] {
  const set = new Set(gruposQueEnsena);
  const extra = [...new Set(propias.map(t => t.grupo))].filter(g => !set.has(g))
    .sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));
  return [...gruposQueEnsena, ...extra];
}

function sinTildes(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Más reciente primero: fechaEntrega, luego fechaAsignacion, luego id (estable). */
export function ordenarRecientes(tareas: Tarea[]): Tarea[] {
  return [...tareas].sort((a, b) =>
    b.fechaEntrega.localeCompare(a.fechaEntrega)
    || b.fechaAsignacion.localeCompare(a.fechaAsignacion)
    || b.id.localeCompare(a.id));
}

export function filtrarHistorial(propias: Tarea[], grupo: string, busqueda: string): Tarea[] {
  const q = sinTildes(busqueda.trim());
  return ordenarRecientes(propias.filter(t =>
    t.grupo === grupo && (!q || sinTildes(t.titulo).includes(q))));
}

export interface MesHistorial { mes: string; tareas: Tarea[] }

/** Agrupa por mes de entrega ('YYYY-MM'), manteniendo el orden recibido. */
export function agruparPorMes(tareas: Tarea[]): MesHistorial[] {
  const out: MesHistorial[] = [];
  for (const t of tareas) {
    const mes = t.fechaEntrega.slice(0, 7);
    const ult = out[out.length - 1];
    if (ult && ult.mes === mes) ult.tareas.push(t);
    else out.push({ mes, tareas: [t] });
  }
  return out;
}

/** Datos que se precargan en el formulario al volver a publicar (sin fechas). */
export interface Precarga {
  tipo: 'tarea' | 'recordatorio';
  tipoRecordatorio?: Tarea['tipoRecordatorio'];
  titulo: string;
  descripcion: string;
  momentos: number;
  adjuntoUrl?: string;
  adjuntoNombre?: string;
  enlaces: { url: string; nombre?: string }[];
  grupo: string;
  asignaturaId: string;
}

export function precargaDesde(t: Tarea, grupoDestino: string): Precarga {
  const rec = t.tipo === 'recordatorio';
  return {
    tipo: rec ? 'recordatorio' : 'tarea',
    tipoRecordatorio: rec ? (t.tipoRecordatorio ?? 'aviso') : undefined,
    titulo: t.titulo,
    descripcion: t.descripcion ?? '',
    momentos: rec ? 1 : Math.max(1, t.momentos),
    adjuntoUrl: t.adjuntoUrl,
    adjuntoNombre: t.adjuntoNombre,
    enlaces: (t.enlaces ?? []).map(e => ({ ...e })),
    grupo: grupoDestino,
    asignaturaId: t.asignaturaId,
  };
}
