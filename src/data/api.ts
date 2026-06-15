const APPS_SCRIPT_URL = import.meta.env.VITE_APPS_SCRIPT_URL as string;

// JSONP fallback — necesario para evitar error CORS desde GitHub Pages
function fetchJsonp<T>(params: Record<string, string>): Promise<T> {
  return new Promise((resolve, reject) => {
    const cbName = `_mjb_${Date.now()}`;
    const qs = new URLSearchParams({ ...params, callback: cbName }).toString();
    const script = document.createElement('script');
    script.src = `${APPS_SCRIPT_URL}?${qs}`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any)[cbName] = (data: T) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any)[cbName];
      document.body.removeChild(script);
      resolve(data);
    };

    script.onerror = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any)[cbName];
      document.body.removeChild(script);
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

export async function enviarCorreo(
  destinatarios: string[],
  asunto: string,
  htmlBody: string
): Promise<{ ok: boolean; error?: string }> {
  return fetchJsonp({
    action: 'enviarCorreo',
    destinatarios: destinatarios.join(','),
    asunto,
    htmlBody,
  });
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
