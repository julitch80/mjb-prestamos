// Lógica pura de «Simulacros» (docs/simulacros/PLAN.md). Sin imports de firebase.

export type Jornada = 'manana' | 'tarde';
export type Editores = Record<Jornada, string[]>;

export const EDITORES_DEFAULT: Editores = {
  manana: ['julian', 'coord_manana'],
  tarde: ['coord_tarde', 'hugo'],
};

export interface PerfilEditor {
  role?: string;
  slotId?: string | null;
  active?: boolean;
  soloLectura?: boolean;
}

export const esJornada = (j: unknown): j is Jornada => j === 'manana' || j === 'tarde';

/** El superusuario edita todo; los demás solo si su slotId está en los editores de esa jornada. */
export function puedeEditar(perfil: PerfilEditor | null | undefined, editores: Partial<Editores> | null | undefined, jornada: Jornada): boolean {
  if (!perfil || perfil.active !== true || perfil.soloLectura === true) return false;
  if (perfil.role === 'superusuario') return true;
  const lista = editores?.[jornada];
  return !!perfil.slotId && Array.isArray(lista) && lista.includes(perfil.slotId);
}

/** Puede cambiar el estado: superusuario o editor de cualquiera de las dos jornadas. */
export function puedeCambiarEstado(perfil: PerfilEditor | null | undefined, editores: Partial<Editores> | null | undefined): boolean {
  return puedeEditar(perfil, editores, 'manana') || puedeEditar(perfil, editores, 'tarde');
}

export const RE_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
export function fechaValida(f: unknown): f is string {
  if (typeof f !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(f)) return false;
  const d = new Date(`${f}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === f;
}
export const horaValida = (h: unknown): h is string => typeof h === 'string' && RE_HORA.test(h);
export const puestoIdValido = (p: unknown): p is string => typeof p === 'string' && /^[a-z0-9_]{1,60}$/.test(p);
export const ESTADOS = ['borrador', 'publicado', 'ejecutado', 'archivado'] as const;
export type Estado = (typeof ESTADOS)[number];
export const estadoValido = (e: unknown): e is Estado => typeof e === 'string' && (ESTADOS as readonly string[]).includes(e);
export const idSimulacroValido = (s: unknown): s is string => typeof s === 'string' && /^[a-z0-9_-]{1,60}$/.test(s);

/** Texto de las notificaciones de reasignación. */
export function textoAsignacion(puesto: string, jornada: Jornada, asignado: boolean): { titulo: string; cuerpo: string } {
  const j = jornada === 'manana' ? 'mañana' : 'tarde';
  return asignado
    ? { titulo: 'Simulacro: nuevo rol', cuerpo: `Te asignaron ${puesto} (${j})` }
    : { titulo: 'Simulacro: cambio de rol', cuerpo: `Ya no tienes el rol ${puesto} (${j})` };
}

// ---------- Avisos del simulacro ----------

export type JornadaAviso = Jornada | 'ambas';
export type TipoAviso = 'info' | 'importante';

export interface Aviso {
  texto: string;
  jornada: JornadaAviso;
  tipo: TipoAviso;
  automatico?: boolean;
  por: string;
  porSlot: string | null;
  cuando: string; // ISO
  editado?: boolean;
}

export const MAX_TEXTO_AVISO = 500;
export const jornadaAvisoValida = (j: unknown): j is JornadaAviso => j === 'ambas' || esJornada(j);
export const tipoAvisoValido = (t: unknown): t is TipoAviso => t === 'info' || t === 'importante';
export const avisoIdValido = (a: unknown): a is string => typeof a === 'string' && /^[a-z0-9_]{1,40}$/.test(a);
/** Texto ya recortado: 1 a 500 caracteres. */
export const textoAvisoValido = (t: unknown): t is string =>
  typeof t === 'string' && t.trim().length >= 1 && t.trim().length <= MAX_TEXTO_AVISO;

/** Jornadas que cubre un aviso. */
export const jornadasDeAviso = (j: JornadaAviso): Jornada[] => (j === 'ambas' ? ['manana', 'tarde'] : [j]);

/** Crear un aviso nuevo: superusuario, o editor de alguna de las jornadas que cubre. */
export function puedeCrearAviso(perfil: PerfilEditor | null | undefined, editores: Partial<Editores> | null | undefined, jornada: JornadaAviso): boolean {
  return jornadasDeAviso(jornada).some(j => puedeEditar(perfil, editores, j));
}

/**
 * Editar o borrar uno existente: superusuario; o editor de la jornada del aviso. Si el aviso es de
 * «ambas», solo su autor (para que un editor de una jornada no borre lo del otro).
 */
export function puedeModificarAviso(
  perfil: PerfilEditor | null | undefined,
  editores: Partial<Editores> | null | undefined,
  aviso: Pick<Aviso, 'jornada' | 'porSlot'>,
): boolean {
  if (!puedeCrearAviso(perfil, editores, aviso.jornada)) return false;
  if (perfil?.role === 'superusuario') return true;
  if (aviso.jornada !== 'ambas') return true;
  return !!perfil?.slotId && aviso.porSlot === perfil.slotId;
}

const DIAS_ES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** '2026-10-21' → 'miércoles 21 de octubre' (sin depender de la zona horaria del servidor). */
export function fechaTexto(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dia = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${DIAS_ES[dia]} ${d} de ${MESES_ES[m - 1]}`;
}

/** '10:00' → '10:00 a. m.'; '16:05' → '4:05 p. m.'; '00:30' → '12:30 a. m.' */
export function horaTexto(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'a. m.' : 'p. m.'}`;
}

/** Texto del aviso automático al reprogramar una jornada. */
export function textoCambioHorario(jornada: Jornada, fecha: string, hora: string, motivo?: string): string {
  const j = jornada === 'manana' ? 'mañana' : 'tarde';
  const base = `⚠️ Cambio: el simulacro de la ${j} pasa al ${fechaTexto(fecha)} a las ${horaTexto(hora)}`;
  const m = (motivo ?? '').trim();
  const t = m ? `${base} — motivo: ${m}` : base;
  return t.length > MAX_TEXTO_AVISO ? `${t.slice(0, MAX_TEXTO_AVISO - 1)}…` : t;
}

export function truncar(texto: string, max: number): string {
  const t = texto.trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

/** ¿Le llega el aviso push? Usuario activo de la sede del simulacro que trabaja en alguna de las jornadas del aviso. */
export function esDestinatarioAviso(
  usuario: { active?: boolean; jornada?: string; sede?: string } | null | undefined,
  jornadaAviso: JornadaAviso,
  sedeSimulacro: string,
): boolean {
  if (!usuario || usuario.active !== true) return false;
  const sedeUsuario = usuario.sede || 'central';
  const enSede = sedeSimulacro === 'principal' ? sedeUsuario === 'central' : sedeUsuario === sedeSimulacro;
  if (!enSede) return false;
  if (jornadaAviso === 'ambas') return true;
  return usuario.jornada === jornadaAviso || usuario.jornada === 'ambas';
}

/** Valida y normaliza `avisos` de un simulacro nuevo. Devuelve el mapa o el texto del error. */
export function normalizarAvisos(
  entrada: unknown,
  autor: { por: string; porSlot: string | null; ahoraISO: string },
): { ok: true; avisos: Record<string, Aviso> } | { ok: false; error: string } {
  if (entrada === undefined || entrada === null) return { ok: true, avisos: {} };
  if (typeof entrada !== 'object' || Array.isArray(entrada)) return { ok: false, error: 'avisos inválidos.' };
  const out: Record<string, Aviso> = {};
  for (const [id, v] of Object.entries(entrada as Record<string, unknown>)) {
    if (!avisoIdValido(id)) return { ok: false, error: `Id de aviso inválido: ${id}.` };
    const a = (v ?? {}) as Record<string, unknown>;
    if (!textoAvisoValido(a.texto)) return { ok: false, error: `Texto inválido en el aviso ${id}.` };
    if (!jornadaAvisoValida(a.jornada)) return { ok: false, error: `Jornada inválida en el aviso ${id}.` };
    if (!tipoAvisoValido(a.tipo)) return { ok: false, error: `Tipo inválido en el aviso ${id}.` };
    out[id] = {
      texto: a.texto.trim(), jornada: a.jornada, tipo: a.tipo,
      ...(a.automatico === true ? { automatico: true } : {}),
      por: autor.por, porSlot: autor.porSlot, cuando: autor.ahoraISO,
    };
  }
  return { ok: true, avisos: out };
}
