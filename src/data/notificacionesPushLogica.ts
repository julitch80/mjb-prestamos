// Lógica pura de notificaciones push (Etapa 1 — docs/notificaciones-push/PRD.md).
// SIN imports de navegador ni de firebase-admin: la usan tanto el cliente
// (src/data/notificacionesPush.ts) como la función `enviarAUsuarios`
// (functions-notificaciones/src/enviar.ts), igual que functions-calendario
// importa src/data/tareas/sincronizacion-calendario.ts.

/** Tipos de notificación que hoy dispara el sistema (Apps Script + chat). */
export type TipoNotificacion =
  | 'chat'
  | 'rectoria'
  | 'coordinador'
  | 'intercambio'
  | 'aprobada'
  | 'rechazada'
  | 'cancelada'
  | 'horario_modificado'
  | 'sugerencia';

/** Categorías que la persona controla en «Mis notificaciones» (PRD D1). */
export type CategoriaNotificacion =
  | 'chat'
  | 'avisos'
  | 'horario'
  | 'reservas'
  | 'sugerencias'
  | 'casos'
  | 'evasion';

export interface PreferenciasNotif {
  chat: boolean;
  avisos: boolean;
  horario: boolean;
  reservas: boolean;
  sugerencias: boolean;
  casos: boolean;
  evasion: boolean;
}

/** Ausencia de preferencias guardadas = todo encendido (PRD: "por defecto,
 * todo encendido"). */
export const PREFERENCIAS_DEFAULT: PreferenciasNotif = {
  chat: true,
  avisos: true,
  horario: true,
  reservas: true,
  sugerencias: true,
  casos: true,
  evasion: true,
};

/** A qué categoría de «Mis notificaciones» pertenece cada tipo disparado por
 * el chat o por el Apps Script (docs/backend-Code.gs `crearNotificacion`). */
export function categoriaDeTipo(tipo: TipoNotificacion): CategoriaNotificacion {
  switch (tipo) {
    case 'chat':
      return 'chat';
    case 'rectoria':
    case 'coordinador':
    case 'intercambio':
      return 'avisos';
    case 'horario_modificado':
      return 'horario';
    case 'aprobada':
    case 'rechazada':
    case 'cancelada':
      return 'reservas';
    case 'sugerencia':
      return 'sugerencias';
  }
}

/** Aplica preferencias (o el default si la persona nunca las guardó) a un
 * tipo, y dice si debe recibir el push. */
export function debeEnviarse(
  tipo: TipoNotificacion,
  prefs: Partial<PreferenciasNotif> | null | undefined,
): boolean {
  const categoria = categoriaDeTipo(tipo);
  const valor = prefs && categoria in prefs ? prefs[categoria] : undefined;
  return valor === undefined ? PREFERENCIAS_DEFAULT[categoria] : Boolean(valor);
}

// ── Silencio nocturno (PRD D2): 21:00–05:30 hora de Bogotá, todos los días ──
//
// América/Bogotá no tiene horario de verano (UTC-5 fijo todo el año), así que
// restar 5 horas a un instante UTC basta para obtener la hora local — sin
// Intl ni tablas de zona horaria, que en Cloud Functions (Node) sí están
// disponibles pero así es trivialmente testeable y no depende del entorno.
export function esHorarioSilencioBogota(fechaUtc: Date): boolean {
  const bogota = new Date(fechaUtc.getTime() - 5 * 60 * 60 * 1000);
  const minutosDelDia = bogota.getUTCHours() * 60 + bogota.getUTCMinutes();
  const INICIO = 21 * 60; // 21:00
  const FIN = 5 * 60 + 30; // 05:30
  // El silencio cruza la medianoche: es silencio si son las 21:00 o después,
  // O si son antes de las 05:30.
  return minutosDelDia >= INICIO || minutosDelDia < FIN;
}

// ── Destinatarios de un canal de chat, a partir de datos en memoria ──────────
// Misma lógica que `canAccessChannel` en firestore.rules (y que segmentosDe()
// en src/data/chat.ts), pero del lado servidor: recibe los usuarios activos
// ya leídos de Firestore en vez de hacer `get()` dentro de la regla.

export interface UsuarioParaDestinatarios {
  correo: string;
  role: string;
  active: boolean;
  sede?: string | null;
  jornada?: string | null;
}

export interface CanalParaDestinatarios {
  type: 'general' | 'rol' | 'directo' | 'segmento' | 'grupo';
  allowedRoles?: string[];
  members?: string[];
  sede?: string | null;
  jornada?: string | null;
}

/** Correos (en minúsculas) de quienes pueden ver `canal`, excluyendo `autor`. */
export function destinatariosDeCanal(
  canal: CanalParaDestinatarios,
  usuariosActivos: UsuarioParaDestinatarios[],
  autor: string,
): string[] {
  const autorLower = autor.toLowerCase();
  const puedeVer = (u: UsuarioParaDestinatarios): boolean => {
    switch (canal.type) {
      case 'general':
        return true;
      case 'rol':
        return Boolean(canal.allowedRoles?.includes(u.role) || u.role === 'superusuario');
      case 'directo':
      case 'grupo':
        return Boolean(canal.members?.map(m => m.toLowerCase()).includes(u.correo.toLowerCase()));
      case 'segmento':
        if (['coordinador', 'rectora', 'superusuario'].includes(u.role)) return true;
        return (canal.sede == null || u.sede === canal.sede)
          && (canal.jornada == null || u.jornada === canal.jornada || u.jornada === 'ambas');
    }
  };
  return usuariosActivos
    .filter(u => u.active && puedeVer(u) && u.correo.toLowerCase() !== autorLower)
    .map(u => u.correo.toLowerCase());
}
