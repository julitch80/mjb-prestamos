const APPS_SCRIPT_URL = import.meta.env.VITE_APPS_SCRIPT_URL as string;

// Etapa 2 (Firebase): en modo 'google' adjunta el idToken de Firebase Auth a
// los parámetros de la petición, para que el backend (docs/backend-Code.gs)
// pueda validarlo con verifyFirebaseIdToken_. En modo 'pin' (default) es un
// no-op y los parámetros se devuelven sin cambios — no rompe nada existente.
// Se aplicó como ejemplo en crearReserva; el resto de llamadas se migrará
// cuando se active el modo google en producción.
export async function conIdToken(params: Record<string, string>): Promise<Record<string, string>> {
  if ((import.meta.env.VITE_AUTH_MODE as string) !== 'google') return params;
  try {
    const { getIdTokenActual } = await import('../lib/auth');
    const idToken = await getIdTokenActual();
    return idToken ? { ...params, idToken } : params;
  } catch {
    return params;
  }
}

// Llamada al backend. Método principal: fetch() con CORS — el Apps Script
// devuelve Access-Control-Allow-Origin: * en su respuesta, así que un GET
// simple funciona sin preflight y de forma robusta en móviles. Si el fetch
// falla (navegador viejo, red que bloquea CORS), cae al respaldo JSONP.
//
// Antes se usaba solo JSONP (inyección de <script>), que en algunos Chrome de
// Android fallaba al seguir la redirección de Google y dejaba la app sin datos.
async function callApi<T>(params: Record<string, string>): Promise<T> {
  const url = `${APPS_SCRIPT_URL}?${new URLSearchParams(params).toString()}`;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 20000);
    const res = await fetch(url, { method: 'GET', signal: ctrl.signal });
    clearTimeout(t);
    if (res.ok) return (await res.json()) as T;
  } catch {
    // Cae al respaldo JSONP
  }
  return jsonpFallback<T>(params);
}

// Respaldo JSONP — para navegadores donde el fetch con CORS no esté disponible.
// Callback único (contador + timestamp) y timeout para no quedar colgado.
let _jsonpSeq = 0;

function jsonpFallback<T>(params: Record<string, string>): Promise<T> {
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
  return callApi<LoginResult>({ action: 'login', userId, pin });
}

export async function recuperarPin(correo: string): Promise<{ ok: boolean; error?: string }> {
  return callApi({ action: 'recuperarPin', correo });
}

export async function cambiarPin(
  userId: string,
  pinActual: string,
  pinNuevo: string,
): Promise<{ ok: boolean; error?: string }> {
  return callApi({ action: 'cambiarPin', userId, pinActual, pinNuevo });
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
  const res = await callApi<{ reservas: Reserva[] }>({ action: 'getReservas' });
  return res.reservas ?? [];
}

export async function crearReserva(
  data: Omit<Reserva, 'id' | 'estado' | 'timestamp'>
): Promise<{ ok: boolean; id?: string; error?: string }> {
  return callApi(await conIdToken({
    action: 'crearReserva',
    recurso: data.recurso,
    fecha: data.fecha,
    bloque: String(data.bloque),
    solicitante: data.solicitante,
    proposito: data.proposito,
    equipos: data.equipos ?? '',
  }));
}

export async function actualizarReserva(
  id: string,
  estado: 'aprobada' | 'rechazada' | 'cancelada',
  motivo?: string
): Promise<{ ok: boolean; error?: string }> {
  return callApi({ action: 'actualizarReserva', id, estado, motivo: motivo ?? '' });
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
  const res = await callApi<{ notificaciones: Notificacion[] }>({ action: 'getNotificaciones', userId });
  return res.notificaciones ?? [];
}

export async function marcarLeida(
  userId: string,
  notifId: string
): Promise<{ ok: boolean }> {
  return callApi({ action: 'marcarLeida', userId, notifId });
}

export async function marcarTodasLeidas(userId: string): Promise<{ ok: boolean }> {
  return callApi({ action: 'marcarTodasLeidas', userId });
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
  return callApi<ResultadoCorreoMasivo>({
    action: 'enviarCorreoMasivo',
    destinatarios: destinatarios.join(','),
    asunto,
    html,
    cc: cc ? cc.join(',') : '',
  });
}

// ── Tareas (módulo de momentos) ────────────────────────────────────────────────

import type { Tarea, Cesion, SolicitudCesion } from './tareas/tipos';

export interface CupoNivel {
  nivel: string;
  asignaturaId: string;
  momentos: number;
}

export interface DatosTareas {
  ok: boolean;
  tareas: Tarea[];
  cesiones: Cesion[];
  solicitudes: SolicitudCesion[];
  cupos: CupoNivel[];
  error?: string;
}

export async function getDatosTareas(grupo?: string): Promise<DatosTareas> {
  const res = await callApi<DatosTareas>({
    action: 'getDatosTareas',
    ...(grupo ? { grupo } : {}),
  });
  return {
    ok: res.ok,
    tareas: res.tareas ?? [],
    cesiones: res.cesiones ?? [],
    solicitudes: res.solicitudes ?? [],
    cupos: res.cupos ?? [],
    error: res.error,
  };
}

export async function guardarCupos(
  cupos: CupoNivel[],
): Promise<{ ok: boolean; error?: string }> {
  return callApi({ action: 'guardarCupos', cupos: JSON.stringify(cupos) });
}

export async function crearTarea(
  t: Omit<Tarea, 'id' | 'estado'>
): Promise<{ ok: boolean; id?: string; error?: string }> {
  return callApi({
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
  return callApi({ action: 'cancelarTarea', id, docenteId, esDirectivo: esDirectivo ? '1' : '0' });
}

export async function crearCesion(
  c: Omit<Cesion, 'id'>
): Promise<{ ok: boolean; id?: string; error?: string }> {
  return callApi({
    action: 'crearCesion',
    grupo: c.grupo,
    periodo: c.periodo,
    asignaturaOrigenId: c.asignaturaOrigenId,
    asignaturaDestinoId: c.asignaturaDestinoId,
    docenteOrigenId: c.docenteOrigenId,
    momentos: String(c.momentos),
  });
}

export async function crearSolicitudCesion(
  s: Omit<SolicitudCesion, 'id' | 'estado'>,
  mensaje: string,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  return callApi({
    action: 'crearSolicitudCesion',
    grupo: s.grupo,
    periodo: s.periodo,
    asignaturaCedenteId: s.asignaturaCedenteId,
    asignaturaDestinoId: s.asignaturaDestinoId,
    docenteCedenteId: s.docenteCedenteId,
    docenteSolicitanteId: s.docenteSolicitanteId,
    momentos: String(s.momentos),
    mensaje,
  });
}

export async function responderSolicitudCesion(
  id: string,
  respuesta: 'aceptar' | 'rechazar',
  mensaje: string,
): Promise<{ ok: boolean; error?: string }> {
  return callApi({ action: 'responderSolicitudCesion', id, respuesta, mensaje });
}

// ── Sugerencias ───────────────────────────────────────────────────────────────

export async function crearSugerencia(
  autor: string,
  texto: string,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  return callApi({ action: 'crearSugerencia', autor, texto });
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
  return callApi<PublicacionResultado>({
    action: 'publicarAviso',
    fecha,
    jornada,
    tipo,
    titulo,
    html,
    autor,
  });
}
