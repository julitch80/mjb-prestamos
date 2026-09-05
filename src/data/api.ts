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

// Variante POST — para payloads que no caben en una URL de GET (p. ej. el
// JSON completo de un HorarioModificado con varios docentes/grupos movidos).
// Apps Script popula `e.parameter` igual desde form-urlencoded en el body,
// así que el backend no necesita ningún cambio. Sin respaldo JSONP posible
// (es solo GET): si falla, se propaga el error en vez de tragarlo, para que
// quien llame pueda avisar en vez de creer que se publicó.
async function callApiPost<T>(params: Record<string, string>): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      signal: ctrl.signal,
      body: new URLSearchParams(params),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(t);
  }
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
  const res = await callApi<{ reservas: Reserva[] }>(await conIdToken({ action: 'getReservas' }));
  return res.reservas ?? [];
}

export async function crearReserva(
  data: Omit<Reserva, 'id' | 'estado' | 'timestamp'> & {
    // Opcional: solo la rectora lo envía para que el backend cree la reserva
    // ya 'aprobada' (asignación jerárquica) en vez de 'pendiente'. Sin este
    // parámetro el comportamiento de docentes/coordinadores queda intacto.
    estado?: 'aprobada';
  }
): Promise<{ ok: boolean; id?: string; error?: string }> {
  return callApi(await conIdToken({
    action: 'crearReserva',
    recurso: data.recurso,
    fecha: data.fecha,
    bloque: String(data.bloque),
    solicitante: data.solicitante,
    proposito: data.proposito,
    equipos: data.equipos ?? '',
    ...(data.motivo ? { motivo: data.motivo } : {}),
    ...(data.estado ? { estado: data.estado } : {}),
  }));
}

export async function actualizarReserva(
  id: string,
  estado: 'aprobada' | 'rechazada' | 'cancelada',
  motivo?: string
): Promise<{ ok: boolean; error?: string }> {
  return callApi(await conIdToken({ action: 'actualizarReserva', id, estado, motivo: motivo ?? '' }));
}

// ── Notificaciones ─────────────────────────────────────────────────────────────

export interface Notificacion {
  id: string;
  tipo: 'rectoria' | 'coordinador' | 'intercambio' | 'aprobada' | 'rechazada' | 'cancelada' | 'horario_modificado';
  mensaje: string;
  leida: boolean;
  timestamp: string;
}

export async function crearNotificacionesLote(
  items: Array<{ destinatario: string; tipo: string; mensaje: string }>,
): Promise<{ ok: boolean; creadas?: number; error?: string }> {
  return callApi(await conIdToken({ action: 'crearNotificacionesLote', items: JSON.stringify(items) }));
}

export async function getNotificaciones(userId: string): Promise<Notificacion[]> {
  const res = await callApi<{ notificaciones: Notificacion[] }>(
    await conIdToken({ action: 'getNotificaciones', userId }),
  );
  return res.notificaciones ?? [];
}

export async function marcarLeida(
  userId: string,
  notifId: string
): Promise<{ ok: boolean }> {
  return callApi(await conIdToken({ action: 'marcarLeida', userId, notifId }));
}

export async function marcarTodasLeidas(userId: string): Promise<{ ok: boolean }> {
  return callApi(await conIdToken({ action: 'marcarTodasLeidas', userId }));
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
  return callApi<ResultadoCorreoMasivo>(await conIdToken({
    action: 'enviarCorreoMasivo',
    destinatarios: destinatarios.join(','),
    asunto,
    html,
    cc: cc ? cc.join(',') : '',
  }));
}

// ── Tareas (módulo de momentos) ────────────────────────────────────────────────

import type { Tarea, Cesion, SolicitudCesion } from './tareas/tipos';
import type { Ancla } from './tareas/habitos';

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
  // Anclas de "¿cuándo la vas a hacer?" que cada director definió con su
  // grupo (docs/anclas-por-grupo-contrato.md). Solo trae los grupos que
  // tengan algo guardado; el resto sigue usando las de por defecto de su
  // jornada (ver anclasDeGrupo en data/tareas/habitos.ts). Un backend que
  // todavía no manda esta clave llega aquí como {} y nada se rompe.
  anclas: Record<string, Ancla[]>;
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
    anclas: res.anclas ?? {},
    error: res.error,
  };
}

// Guarda las anclas de un grupo (solo el director de ese grupo, coordinación,
// rectoría o superusuario — el servidor valida quién es y aplica los topes de
// 6 anclas / 30 caracteres; el cliente los valida también, pero no basta).
export async function guardarAnclasGrupo(
  grupo: string,
  anclas: Ancla[],
): Promise<{ ok: boolean; error?: string }> {
  return callApi(await conIdToken({
    action: 'guardarAnclasGrupo',
    grupo,
    anclas: JSON.stringify(anclas),
  }));
}

export async function guardarCupos(
  cupos: CupoNivel[],
): Promise<{ ok: boolean; error?: string }> {
  return callApi(await conIdToken({ action: 'guardarCupos', cupos: JSON.stringify(cupos) }));
}

export async function crearTarea(
  t: Omit<Tarea, 'id' | 'estado'>
): Promise<{ ok: boolean; id?: string; error?: string }> {
  return callApi(await conIdToken({
    action: 'crearTarea',
    grupo: t.grupo,
    asignaturaId: t.asignaturaId,
    docenteId: t.docenteId,
    titulo: t.titulo,
    momentos: String(t.momentos),
    fechaAsignacion: t.fechaAsignacion,
    fechaEntrega: t.fechaEntrega,
    descripcion: t.descripcion ?? '',
    adjuntoUrl: t.adjuntoUrl ?? '',
    adjuntoNombre: t.adjuntoNombre ?? '',
  }));
}

export async function cancelarTarea(
  id: string,
  docenteId: string,
  esDirectivo = false,
): Promise<{ ok: boolean; error?: string }> {
  return callApi(await conIdToken({ action: 'cancelarTarea', id, docenteId, esDirectivo: esDirectivo ? '1' : '0' }));
}

export async function crearCesion(
  c: Omit<Cesion, 'id'>
): Promise<{ ok: boolean; id?: string; error?: string }> {
  return callApi(await conIdToken({
    action: 'crearCesion',
    grupo: c.grupo,
    periodo: c.periodo,
    asignaturaOrigenId: c.asignaturaOrigenId,
    asignaturaDestinoId: c.asignaturaDestinoId,
    docenteOrigenId: c.docenteOrigenId,
    momentos: String(c.momentos),
  }));
}

export async function crearSolicitudCesion(
  s: Omit<SolicitudCesion, 'id' | 'estado'>,
  mensaje: string,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  return callApi(await conIdToken({
    action: 'crearSolicitudCesion',
    grupo: s.grupo,
    periodo: s.periodo,
    asignaturaCedenteId: s.asignaturaCedenteId,
    asignaturaDestinoId: s.asignaturaDestinoId,
    docenteCedenteId: s.docenteCedenteId,
    docenteSolicitanteId: s.docenteSolicitanteId,
    momentos: String(s.momentos),
    mensaje,
  }));
}

export async function responderSolicitudCesion(
  id: string,
  respuesta: 'aceptar' | 'rechazar',
  mensaje: string,
): Promise<{ ok: boolean; error?: string }> {
  return callApi(await conIdToken({ action: 'responderSolicitudCesion', id, respuesta, mensaje }));
}

// ── Sugerencias ───────────────────────────────────────────────────────────────

export async function crearSugerencia(
  autor: string,
  texto: string,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  return callApi(await conIdToken({ action: 'crearSugerencia', autor, texto }));
}

// Fase 1 del módulo de sugerencias (docs/modulo-sugerencias.md): leer y
// clasificar. El aviso al autor (fase 2) y la vinculación entre sugerencias
// (fase 3) quedan fuera de alcance aquí; 'relacionadas' se guarda en el
// modelo pero la interfaz aún no lo edita.
export type EstadoSugerencia = 'nueva' | 'clasificada' | 'en_curso' | 'resuelta' | 'descartada';
export type ClasificacionSugerencia = 'fallo' | 'forma' | 'capacidad' | '';

export interface Sugerencia {
  id: string;
  autor: string;
  texto: string;
  timestamp: string;
  estado: EstadoSugerencia;
  clasificacion: ClasificacionSugerencia;
  nota: string;
  vinculo: string;
  relacionadas: string;
  resueltoPor: string;
  resueltoEn: string;
  avisadoEn: string;
}

export async function getSugerencias(): Promise<{ ok: boolean; items: Sugerencia[]; error?: string }> {
  const res = await callApi<{ ok: boolean; items?: Sugerencia[]; error?: string }>(
    await conIdToken({ action: 'getSugerencias' }),
  );
  return { ok: res.ok, items: res.items ?? [], error: res.error };
}

export async function actualizarSugerencia(
  id: string,
  cambios: Partial<Pick<Sugerencia, 'estado' | 'clasificacion' | 'nota' | 'vinculo' | 'relacionadas' | 'resueltoPor' | 'avisadoEn'>>,
): Promise<{ ok: boolean; error?: string }> {
  return callApi(await conIdToken({ action: 'actualizarSugerencia', id, ...cambios }));
}

// ── Publicación en Google Site del colegio ─────────────────────────────────────

export interface PublicacionResultado {
  ok: boolean;
  id?: string;
  url?: string;     // URL pública donde quedó publicada
  error?: string;
}

// ── Sincronización del editor de horario ────────────────────────────────────
// CORREGIDO: json puede ser largo (una jornada con varios docentes y grupos
// movidos). Se asumía que un GET con URLSearchParams cabía con margen
// (~8KB "seguros"), pero un día con varias reubicaciones en cadena (ej.
// Beatriz ausente → se mueve a Adolfo → para eso se mueve 11-2 también)
// superó ese margen y la petición fallaba en silencio: el coordinador veía
// todo guardado (mensaje y resumen se calculan en memoria, no dependen de
// esto) pero el registro nunca llegaba a la hoja EditorSync, así que ningún
// docente lo veía después. Reportado por Julián el 9 de agosto de 2026, tras
// una publicación real con varios grupos movidos. Ahora va por POST — sin
// límite práctico de tamaño y sin cambios en el backend (doPost ya usa el
// mismo manejador que doGet, `e.parameter` se llena igual desde el body).

export interface ItemSyncEditor {
  id: string;
  tipo: 'modificacion' | 'jornada';
  fecha: string;
  jornada: string;
  estado: string;
  json: string;
  timestamp: string;
}

export async function guardarSyncEditor(item: {
  id: string;
  tipo: 'modificacion' | 'jornada';
  fecha: string;
  jornada: string;
  estado: string;
  json: string;
}): Promise<{ ok: boolean; error?: string }> {
  // CORREGIDO: Apps Script responde con un 302 hacia
  // script.googleusercontent.com para servir el contenido real, y leer esa
  // respuesta tras el redirect resultó poco confiable para un POST (a
  // diferencia de un GET, que ya se usaba en toda la app sin problemas).
  // El guardado en sí SÍ llega al backend en cuanto se envía el POST — se
  // confirmó escribiendo directo — el problema era solo de lectura de la
  // confirmación. Por eso ya no se confía en la respuesta del propio POST:
  // se dispara y luego se verifica con un GET (getSyncEditor), que es el
  // mismo mecanismo con el que después se leerá el dato de verdad.
  try {
    await callApiPost(await conIdToken({
      action: 'guardarSyncEditor',
      id: item.id,
      tipo: item.tipo,
      fecha: item.fecha,
      jornada: item.jornada,
      estado: item.estado,
      json: item.json,
    }));
  } catch {
    // Puede fallar solo al leer la respuesta del redirect; no descarta que
    // el guardado haya llegado. La verificación de abajo decide de verdad.
  }
  const items = await getSyncEditor();
  const ok = items.some(i => i.id === item.id && i.estado === item.estado);
  return ok ? { ok: true } : { ok: false, error: 'No se pudo confirmar el guardado en el servidor.' };
}

export async function borrarSyncEditor(id: string): Promise<{ ok: boolean; error?: string }> {
  return callApi(await conIdToken({ action: 'borrarSyncEditor', id }));
}

export async function getSyncEditor(): Promise<ItemSyncEditor[]> {
  try {
    const res = await callApi<{ ok: boolean; items?: ItemSyncEditor[] }>(
      await conIdToken({ action: 'getSyncEditor' }),
    );
    return res.items ?? [];
  } catch {
    return [];
  }
}

export async function publicarAviso(
  fecha: string,
  jornada: string,
  tipo: string,
  titulo: string,
  html: string,
  autor: string,
): Promise<PublicacionResultado> {
  return callApi<PublicacionResultado>(await conIdToken({
    action: 'publicarAviso',
    fecha,
    jornada,
    tipo,
    titulo,
    html,
    autor,
  }));
}

export async function retirarAviso(id: string): Promise<{ ok: boolean; error?: string }> {
  return callApi(await conIdToken({ action: 'retirarAviso', id }));
}

// ── Informe de contención emocional ───────────────────────────
export interface InformeContencion {
  id: string;
  fecha: string;
  docenteId: string;
  docenteNombre: string;
  sede: string;
  jornada: string;
  grado: string;
  estudianteNombre: string;
  estudianteDocumento: string;
  estudianteTelefonos: string;
  acudienteNombre: string;
  acudienteParentesco: string;
  director: string;
  directorCorreo: string;
  descripcion: string;
  rutaTipo: string;
  rutaDetalle: string;
  timestamp: string;
  // Máquina de estados del gestor de casos (docs/plan-gestor-casos.md sección 2).
  // Opcionales: filas viejas (guardadas antes del Lote 1) no las traen.
  estado?: 'abierto' | 'en_seguimiento' | 'cerrado';
  proximaRevision?: string;
  cerradoPor?: string;
  cerradoEn?: string;
}

export async function guardarInformeContencion(
  informe: Omit<InformeContencion, 'id' | 'timestamp'>,
): Promise<{ ok: boolean; id?: string; correoEnviado?: boolean; error?: string }> {
  return callApi(await conIdToken({ action: 'guardarInformeContencion', ...informe }));
}

export async function listarInformesContencion(): Promise<InformeContencion[]> {
  const res = await callApi<{ ok: boolean; informes: InformeContencion[] }>(
    await conIdToken({ action: 'listarInformesContencion' }),
  );
  return res.informes ?? [];
}

// ── Remisión al seguro estudiantil (banco de fotos) ───────────
// Va por POST: la foto en base64 no cabe en una URL de GET/JSONP.
export interface RemisionSeguro {
  id: string;
  fecha: string;
  docenteId: string;
  docenteNombre: string;
  sede: string;
  jornada: string;
  grado: string;
  estudianteNombre: string;
  estudianteDocumento: string;
  fotoUrl: string;
  timestamp: string;
  // Máquina de estados del gestor de casos (docs/plan-gestor-casos.md sección 2).
  estado?: 'abierto' | 'en_seguimiento' | 'cerrado';
  proximaRevision?: string;
  cerradoPor?: string;
  cerradoEn?: string;
}

export async function guardarRemisionSeguro(
  remision: Omit<RemisionSeguro, 'id' | 'fotoUrl' | 'timestamp'> & { fotoBase64: string },
): Promise<{ ok: boolean; id?: string; fotoUrl?: string; error?: string }> {
  // Sigue siendo POST (la foto en base64 no cabe en una URL), pero ahora
  // también lleva idToken cuando VITE_AUTH_MODE=google.
  return callApiPost(await conIdToken({ action: 'guardarRemisionSeguro', ...remision }));
}

export async function listarRemisionesSeguro(): Promise<RemisionSeguro[]> {
  const res = await callApi<{ ok: boolean; remisiones: RemisionSeguro[] }>(
    await conIdToken({ action: 'listarRemisionesSeguro' }),
  );
  return res.remisiones ?? [];
}

// ── Seguimientos de casos (contención + remisión al seguro) ───────────────
// docs/plan-gestor-casos.md secciones 1 y 2. Un mismo mecanismo de
// seguimiento para los dos tipos de caso; casoTipo distingue a cuál pertenece.
export interface SeguimientoCaso {
  id: string;
  casoId: string;
  casoTipo: 'contencion' | 'seguro';
  fecha: string;
  autorId: string;
  autorNombre: string;
  texto: string;
  decision: 'programar' | 'cerrar';
  proximaFecha: string;
  timestamp: string;
}

export async function guardarSeguimiento(
  seguimiento: Omit<SeguimientoCaso, 'id' | 'autorId' | 'timestamp'>,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  // autorId lo resuelve el backend a partir del idToken, no del cliente.
  return callApi(await conIdToken({ action: 'guardarSeguimiento', ...seguimiento }));
}

export async function listarSeguimientos(casoId?: string): Promise<SeguimientoCaso[]> {
  const res = await callApi<{ ok: boolean; seguimientos: SeguimientoCaso[] }>(
    await conIdToken({ action: 'listarSeguimientos', ...(casoId ? { casoId } : {}) }),
  );
  return res.seguimientos ?? [];
}
