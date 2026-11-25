/**
 * Grados 2026: invitaciones con QR y aforo (2026-11-24). PRD: `docs/grados/PRD.md`.
 *
 * Logica pura: la usan la pantalla, las funciones del servidor y las pruebas.
 *
 * - El QR de la INVITACION es un codigo propio (`GR-` + 128 bits aleatorios), NUNCA el
 *   `qrToken` del carne: el carne circula y una foto suya bastaria para entrar.
 * - La invitacion es para los 2 invitados. El graduando se registra APARTE (carne, lista
 *   del grupo o busqueda por apellido) en `graduandos/{studentId}`.
 * - Todo lo que registra pasa por las funciones (transaccion): el celular solo lee.
 */

export const PREFIJO_INVITACION = 'GR-';
export const CUPOS_POR_DEFECTO = 2;
export const CAPACIDAD_POR_DEFECTO = 310;
/** Recuadros por hoja carta: 4 columnas x 6 filas, QR de 2,5 cm (Julian, 2026-11-24). */
export const RECUADROS_POR_HOJA = 24;
export const COLUMNAS_HOJA = 4;
export const LADO_QR_CM = 2.5;

export type EstadoEvento = 'abierto' | 'cerrado';

export interface EventoGrados {
  eventoId: string;
  nombre: string;
  /** 'AAAA-MM-DD' */
  fecha: string;
  /** 'HH:MM' */
  hora: string;
  capacidad: number;
  /** Grados literales: '11.1', '11.2', '11.3'. */
  grados: string[];
  sede: string;
  /** Correos en minusculas de quienes estan en la puerta. */
  porteria: string[];
  estado: EstadoEvento;
  /** Evento de ensayo: invitaciones de prueba, sin estudiantes. */
  ensayo: boolean;
  creadoPor: string;
  creadoEn: number;
}

export interface RegistroInvitacion {
  ingresoId: string;
  cantidad: number;
  por: string;
  en: number;
  deshecho: { por: string; en: number } | null;
}

export interface CambioInvitacion {
  tipo: 'ampliar' | 'anular' | 'reactivar' | 'regenerar';
  motivo: string;
  por: string;
  en: number;
  detalle?: string;
}

export interface Invitacion {
  token: string;
  eventoId: string;
  /** `null` en las invitaciones de prueba del ensayo. */
  studentId: string | null;
  /** «APELLIDOS NOMBRES», para la hoja de recorte y la pantalla. */
  nombre: string;
  grado: string;
  cupos: number;
  usados: number;
  anulada: boolean;
  /** Token de la invitacion que la reemplazo, si se regenero. La vieja ya no sirve. */
  reemplazadaPor: string | null;
  prueba: boolean;
  registros: RegistroInvitacion[];
  cambios: CambioInvitacion[];
  creadaEn: number;
}

export interface Graduando {
  studentId: string;
  grado: string;
  nombre: string;
  /** false = su invitacion esta anulada: no se gradua en este evento. */
  elegible: boolean;
  llego: boolean;
  en: number | null;
  por: string | null;
  /** Llegadas deshechas por error: quedan, no se borran. */
  deshechos: { en: number; por: string; deshechoEn: number; deshechoPor: string }[];
}

export const CATEGORIAS_MANUAL = [
  { id: 'docentes', etiqueta: 'Docentes y personal' },
  { id: 'invitados_especiales', etiqueta: 'Invitados especiales' },
  { id: 'otros', etiqueta: 'Otros' },
] as const;
export type CategoriaManual = (typeof CATEGORIAS_MANUAL)[number]['id'];

export interface IngresoManualReciente {
  ingresoId: string;
  cantidad: number;
  categoria: CategoriaManual;
  por: string;
  en: number;
  deshecho: boolean;
}

export interface ResumenAforo {
  invitados: number;
  graduandos: number;
  manuales: number;
  /** Los ultimos ingresos manuales, para poder deshacer el ultimo sin leer el registro. */
  manualesRecientes: IngresoManualReciente[];
}

export const RESUMEN_VACIO: ResumenAforo = { invitados: 0, graduandos: 0, manuales: 0, manualesRecientes: [] };
export const MAX_MANUALES_RECIENTES = 15;

// ---------------------------------------------------------------------------

/** ¿El texto leido es una invitacion? Si no, se trata como carne. */
export function esCodigoInvitacion(texto: string): boolean {
  return texto.trim().startsWith(PREFIJO_INVITACION);
}

export function cuposRestantes(inv: Pick<Invitacion, 'cupos' | 'usados'>): number {
  return Math.max(0, inv.cupos - inv.usados);
}

/** Botones de la puerta: «Entra 1», «Entran 2»… solo los que alcancen. */
export function cantidadesDisponibles(inv: Pick<Invitacion, 'cupos' | 'usados'>): number[] {
  const n = Math.min(cuposRestantes(inv), 4);
  return Array.from({ length: n }, (_, i) => i + 1);
}

export function etiquetaCantidad(n: number): string {
  return n === 1 ? 'Entra 1' : `Entran ${n}`;
}

export type LecturaInvitacion =
  | { tipo: 'valida'; restantes: number }
  | { tipo: 'agotada' }
  | { tipo: 'invalida' }
  | { tipo: 'cerrado' };

/**
 * Que ve el portero al leer una invitacion. `null` = el codigo no existe.
 * Una regenerada o anulada es «no valida» y NO muestra cara: el PRD lo pide asi.
 */
export function lecturaDeInvitacion(
  inv: Pick<Invitacion, 'cupos' | 'usados' | 'anulada' | 'reemplazadaPor'> | null,
  evento: Pick<EventoGrados, 'estado'> | null,
): LecturaInvitacion {
  if (evento?.estado === 'cerrado') return { tipo: 'cerrado' };
  if (!inv || inv.anulada || inv.reemplazadaPor) return { tipo: 'invalida' };
  const restantes = cuposRestantes(inv);
  return restantes > 0 ? { tipo: 'valida', restantes } : { tipo: 'agotada' };
}

export type LecturaGraduando =
  | { tipo: 'puede_llegar' }
  | { tipo: 'ya_llego'; en: number | null; por: string | null }
  | { tipo: 'no_es_graduando' }
  | { tipo: 'cerrado' };

export function lecturaDeGraduando(
  g: Pick<Graduando, 'elegible' | 'llego' | 'en' | 'por'> | null,
  evento: Pick<EventoGrados, 'estado'> | null,
): LecturaGraduando {
  if (evento?.estado === 'cerrado') return { tipo: 'cerrado' };
  if (!g || !g.elegible) return { tipo: 'no_es_graduando' };
  if (g.llego) return { tipo: 'ya_llego', en: g.en, por: g.por };
  return { tipo: 'puede_llegar' };
}

export function totalAforo(r: Pick<ResumenAforo, 'invitados' | 'graduandos' | 'manuales'>): number {
  return (r.invitados || 0) + (r.graduandos || 0) + (r.manuales || 0);
}

/** Verde; amarillo desde el 80 %; rojo desde el 100 %. NO bloquea (Julian, 2026-11-24). */
export function nivelAforo(total: number, capacidad: number): 'verde' | 'amarillo' | 'rojo' {
  if (capacidad <= 0) return 'verde';
  if (total >= capacidad) return 'rojo';
  if (total >= Math.ceil(capacidad * 0.8)) return 'amarillo';
  return 'verde';
}

/** El ultimo registro vigente (no deshecho) de una invitacion, o null. */
export function ultimoRegistroVigente(registros: RegistroInvitacion[]): RegistroInvitacion | null {
  for (let i = registros.length - 1; i >= 0; i--) if (!registros[i].deshecho) return registros[i];
  return null;
}

/** Hojas de recorte: grupos de 24, en el orden recibido (alfabetico por grado y nombre). */
export function enHojas<T>(items: T[], porHoja = RECUADROS_POR_HOJA): T[][] {
  const hojas: T[][] = [];
  for (let i = 0; i < items.length; i += porHoja) hojas.push(items.slice(i, i + porHoja));
  return hojas;
}

/** Orden de la hoja de recorte: por grado y luego por nombre, sin tildes de por medio. */
export function compararParaHoja(a: Pick<Invitacion, 'grado' | 'nombre'>, b: Pick<Invitacion, 'grado' | 'nombre'>): number {
  return a.grado.localeCompare(b.grado, 'es') || a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' });
}

/** Correos de porteria: minusculas, sin repetidos, solo los que parecen correo. */
export function limpiarPorteria(texto: string | string[]): string[] {
  const partes = Array.isArray(texto) ? texto : texto.split(/[\s,;]+/);
  const out = new Set<string>();
  for (const p of partes) {
    const c = p.trim().toLowerCase();
    if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c)) out.add(c);
  }
  return [...out].sort();
}

export function horaCorta(ms: number | null | undefined): string {
  if (!ms) return '—';
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
