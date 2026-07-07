const APPS_SCRIPT_URL = import.meta.env.VITE_APPS_SCRIPT_URL as string;

// JSONP fallback — necesario para evitar error CORS desde GitHub Pages.
// El nombre de callback es único (contador + timestamp) para evitar colisiones
// cuando dos peticiones salen en el mismo milisegundo, y hay timeout para que
// una petición que nunca responde (redes móviles flojas) no quede colgada.
let _jsonpSeq = 0;

function fetchJsonp<T>(params: Record<string, string>): Promise<T> {
  return new Promise((resolve, reject) => {
    const cbName = `_mjb_${Date.now()}_${++_jsonpSeq}`;
    const qs = new URLSearchParams({ ...params, callback: cbName }).toString();
    const script = document.createElement('script');
    script.src = `${APPS_SCRIPT_URL}?${qs}`;

    let terminado = false;
    const limpiar = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any)[cbName];
      if (script.parentNode) script.parentNode.removeChild(script);
      clearTimeout(temporizador);
    };

    const temporizador = setTimeout(() => {
      if (terminado) return;
      terminado = true;
      limpiar();
      reject(new Error('El servidor tardó demasiado en responder. Revisa tu conexión.'));
    }, 20000);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any)[cbName] = (data: T) => {
      if (terminado) return;
      terminado = true;
      limpiar();
      resolve(data);
    };

    script.onerror = () => {
      if (terminado) return;
      terminado = true;
      limpiar();
      reject(new Error('Error de red al conectar con el servidor'));
    };

    document.body.appendChild(script);
  });
}

// ── Auth ───────────────────────────────────────────────────────────────────────

export interface LoginResult {
  ok: boolean;
  userId?: string;
  nombre?: string;
  rol?: string;
  jornada?: string;
  error?: string;
}

export async function login(userId: string, pin: string): Promise<LoginResult> {
  return fetchJsonp<LoginResult>({ action: 'login', userId, pin });
}

export async function recuperarPin(correo: string): Promise<{ ok: boolean; error?: string }> {
  return fetchJsonp({ action: 'recuperarPin', correo });
}

export async function cambiarPin(
  userId: string,
  pinActual: string,
  pinNuevo: string,
): Promise<{ ok: boolean; error?: string }> {
  return fetchJsonp({ action: 'cambiarPin', userId, pinActual, pinNuevo });
}

// ── Reservas ───────────────────────────────────────────────────────────────────

export interface Reserva {
  id: string;
  recurso: string;
  fecha: string;
  bloque: number;
  solicitante: string;
  proposito: string;
  equipos?: string;
  estado: 'pendiente' | 'aprobada' | 'rechazada' | 'cancelada';
  motivo?: string;
  timestamp: string;
}

export async function getReservas(): Promise<Reserva[]> {
  const res = await fetchJsonp<{ reservas: Reserva[] }>({ action: 'getReservas' });
  return res.reservas ?? [];
}

export async function crearReserva(
  data: Omit<Reserva, 'id' | 'estado' | 'timestamp'>
): Promise<{ ok: boolean; id?: string; error?: string }> {
  return fetchJsonp({
    action: 'crearReserva',
    recurso: data.recurso,
    fecha: data.fecha,
    bloque: String(data.bloque),
    solicitante: data.solicitante,
    proposito: data.proposito,
    equipos: data.equipos ?? '',
  });
}

export async function actualizarReserva(
  id: string,
  estado: 'aprobada' | 'rechazada' | 'cancelada',
  motivo?: string
): Promise<{ ok: boolean; error?: string }> {
  return fetchJsonp({ action: 'actualizarReserva', id, estado, motivo: motivo ?? '' });
}

// ── Notificaciones ─────────────────────────────────────────────────────────────

export interface Notificacion {
  id: string;
  tipo: 'rectoria' | 'coordinador' | 'intercambio' | 'aprobada' | 'rechazada' | 'cancelada';
  mensaje: string;
  leida: boolean;
  timestamp: string;
}

export async function getNotificaciones(userId: string): Promise<Notificacion[]> {
  const res = await fetchJsonp<{ notificaciones: Notificacion[] }>({ action: 'getNotificaciones', userId });
  return res.notificaciones ?? [];
}

export async function marcarLeida(
  userId: string,
  notifId: string
): Promise<{ ok: boolean }> {
  return fetchJsonp({ action: 'marcarLeida', userId, notifId });
}

export async function marcarTodasLeidas(userId: string): Promise<{ ok: boolean }> {
  return fetchJsonp({ action: 'marcarTodasLeidas', userId });
}

// ── Envío de correo ────────────────────────────────────────────────────────────

export interface ResultadoCorreoMasivo {
  ok: boolean;
  enviados?: number;
  total?: number;
  fallidos?: Array<{ correo: string; error: string }>;
  error?: string;
}

export async function enviarCorreoMasivo(
  destinatarios: string[],
  asunto: string,
  html: string,
  cc?: string[],
): Promise<ResultadoCorreoMasivo> {
  return fetchJsonp<ResultadoCorreoMasivo>({
    action: 'enviarCorreoMasivo',
    destinatarios: destinatarios.join(','),
    asunto,
    html,
    cc: cc ? cc.join(',') : '',
  });
}

// ── Tareas (módulo de momentos) ────────────────────────────────────────────────

import type { Tarea, Cesion } from './tareas/tipos';

export interface DatosTareas {
  ok: boolean;
  tareas: Tarea[];
  cesiones: Cesion[];
  error?: string;
}

export async function getDatosTareas(grupo?: string): Promise<DatosTareas> {
  const res = await fetchJsonp<DatosTareas>({
    action: 'getDatosTareas',
    ...(grupo ? { grupo } : {}),
  });
  return { ok: res.ok, tareas: res.tareas ?? [], cesiones: res.cesiones ?? [], error: res.error };
}

export async function crearTarea(
  t: Omit<Tarea, 'id' | 'estado'>
): Promise<{ ok: boolean; id?: string; error?: string }> {
  return fetchJsonp({
    action: 'crearTarea',
    grupo: t.grupo,
    asignaturaId: t.asignaturaId,
    docenteId: t.docenteId,
    titulo: t.titulo,
    momentos: String(t.momentos),
    fechaAsignacion: t.fechaAsignacion,
    fechaEntrega: t.fechaEntrega,
  });
}

export async function cancelarTarea(
  id: string,
  docenteId: string,
  esDirectivo = false,
): Promise<{ ok: boolean; error?: string }> {
  return fetchJsonp({ action: 'cancelarTarea', id, docenteId, esDirectivo: esDirectivo ? '1' : '0' });
}

export async function crearCesion(
  c: Omit<Cesion, 'id'>
): Promise<{ ok: boolean; id?: string; error?: string }> {
  return fetchJsonp({
    action: 'crearCesion',
    grupo: c.grupo,
    periodo: c.periodo,
    asignaturaOrigenId: c.asignaturaOrigenId,
    asignaturaDestinoId: c.asignaturaDestinoId,
    docenteOrigenId: c.docenteOrigenId,
    momentos: String(c.momentos),
  });
}

// ── Sugerencias ───────────────────────────────────────────────────────────────

export async function crearSugerencia(
  autor: string,
  texto: string,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  return fetchJsonp({ action: 'crearSugerencia', autor, texto });
}

// ── Publicación en Google Site del colegio ─────────────────────────────────────

export interface PublicacionResultado {
  ok: boolean;
  id?: string;
  url?: string;     // URL pública donde quedó publicada
  error?: string;
}

export async function publicarAviso(
  fecha: string,
  jornada: string,
  tipo: string,
  titulo: string,
  html: string,
  autor: string,
): Promise<PublicacionResultado> {
  return fetchJsonp<PublicacionResultado>({
    action: 'publicarAviso',
    fecha,
    jornada,
    tipo,
    titulo,
    html,
    autor,
  });
}
