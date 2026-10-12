// Lógica pura del módulo Simulacros (sin React ni Firebase): fácil de probar.
import { USUARIOS } from '../maestros';
import {
  PUESTOS, ROL_PRIORIDAD, ROLES_DOCENTE,
} from './plantillaSismo2026';
import type {
  Asignaciones, AsignacionJornada, JornadaId, Paso, Puesto, RolClave,
} from './plantillaSismo2026';

export type EstadoSimulacro = 'borrador' | 'publicado' | 'ejecutado' | 'archivado';

export interface JornadaSimulacro {
  fecha: string;   // 'YYYY-MM-DD'
  hora: string;    // 'HH:MM' (24 h): hora del timbre prolongado
  motivo?: string;
  llamada123?: { hecho?: boolean; por?: string; cuando?: unknown };
}

export type JornadaAviso = JornadaId | 'ambas';
export type TipoAviso = 'info' | 'importante';

export interface AvisoSimulacro {
  texto: string;
  jornada: JornadaAviso;
  tipo: TipoAviso;
  automatico?: boolean;
  por?: string;
  porSlot?: string | null;
  cuando?: string; // ISO
  editado?: boolean;
}

export interface SimulacroDoc {
  titulo: string;
  sede: string;
  evento: string;
  plantilla: string;
  estado: EstadoSimulacro;
  nacional: { fecha: string; hora: string };
  editores: Partial<Record<JornadaId, string[]>>;
  jornadas: Partial<Record<JornadaId, JornadaSimulacro>>;
  asignaciones: Asignaciones;
  avisos?: Record<string, AvisoSimulacro>;
}

export interface CambioSimulacro {
  id: string;
  por?: string;
  porSlot?: string | null;
  cuando?: { toDate?: () => Date } | null;
  tipo?: string;
  jornada?: string;
  antes?: unknown;
  despues?: unknown;
  motivo?: string;
}

export const JORNADA_NOMBRE: Record<JornadaId, string> = { manana: 'Mañana', tarde: 'Tarde' };

// ── Horas ─────────────────────────────────────────────────────────────────────

export function horaAMinutos(hhmm: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return NaN;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function formatoMinutos(min: number): string {
  const total = ((Math.round(min) % 1440) + 1440) % 1440;
  const h = Math.floor(total / 60);
  const mm = total % 60;
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${mm < 10 ? '0' : ''}${mm} ${h < 12 ? 'a. m.' : 'p. m.'}`;
}

/** Hora de un paso: alarma 'HH:MM' (timbre prolongado) + minutos relativos. Ej.: ('10:00', -60) → '9:00 a. m.' */
export function horaDePaso(alarmaHHMM: string, minutos: number): string {
  return formatoMinutos(horaAMinutos(alarmaHHMM) + minutos);
}

/** Partes para mostrar «9:00» y «a. m.» por separado. */
export function partesDeHora(alarmaHHMM: string, minutos: number): { t: string; ap: string } {
  const s = horaDePaso(alarmaHHMM, minutos);
  const i = s.indexOf(' ');
  return { t: s.slice(0, i), ap: s.slice(i + 1) };
}

export interface FilaCronograma {
  indice: number;
  paso: Paso;
  hora: string;
  partes: { t: string; ap: string };
  duracion: string;
}

export function cronograma(pasos: Paso[], jornada: { hora: string }): FilaCronograma[] {
  return pasos.map((paso, indice) => ({
    indice,
    paso,
    hora: horaDePaso(jornada.hora, paso.a),
    partes: partesDeHora(jornada.hora, paso.a),
    duracion: paso.dur ?? `${paso.b - paso.a} min`,
  }));
}

// ── Fechas ────────────────────────────────────────────────────────────────────

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function fechaLocal(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** '2026-10-21' → 'Miércoles 21 de octubre'. */
export function fechaLarga(iso: string): string {
  const d = fechaLocal(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const dia = DIAS[d.getDay()];
  return `${dia.charAt(0).toUpperCase()}${dia.slice(1)} ${d.getDate()} de ${MESES[d.getMonth()]}`;
}

export function diasRestantes(fechaISO: string, hoy: Date = new Date()): number {
  const h = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  return Math.round((fechaLocal(fechaISO).getTime() - h.getTime()) / 86400000);
}

/** Índices de los pasos que están ocurriendo ahora (solo el día del simulacro). */
export function pasosAhora(pasos: Paso[], jornada: { fecha: string; hora: string }, ahora: Date = new Date()): number[] {
  if (diasRestantes(jornada.fecha, ahora) !== 0) return [];
  const m = ahora.getHours() * 60 + ahora.getMinutes();
  const H = horaAMinutos(jornada.hora);
  const out: number[] = [];
  pasos.forEach((p, i) => { if (m >= H + p.a && m < H + p.b) out.push(i); });
  return out;
}

// ── Aviso al 123 ──────────────────────────────────────────────────────────────

/** Hay que avisar si fecha u hora difieren del simulacro nacional y la llamada no se ha hecho. */
export function requiereAviso123(
  jornada: JornadaSimulacro | undefined | null,
  nacional: { fecha: string; hora: string } | undefined | null,
): boolean {
  if (!jornada || !nacional) return false;
  const difiere = jornada.fecha !== nacional.fecha || jornada.hora !== nacional.hora;
  return difiere && jornada.llamada123?.hecho !== true;
}

// ── Personas y puestos ────────────────────────────────────────────────────────

function esCentral(u: { sede?: string }): boolean {
  return !u.sede || u.sede === 'central';
}

/** Docentes de la sede principal que trabajan en la jornada (los mixtos, 'ambas', salen en las dos). */
export function docentesDeJornada(jornada: JornadaId) {
  return USUARIOS.filter(u => u.rol === 'docente' && esCentral(u) && (u.jornada === jornada || u.jornada === 'ambas'));
}

/** Docentes + directivos de la jornada: lo que se ofrece en los desplegables de encargados. */
export function personasDeJornada(jornada: JornadaId) {
  const directivos = USUARIOS.filter(u => (u.rol === 'rectora' || u.rol === 'coordinador') && (u.jornada === jornada || u.jornada === 'ambas'));
  return [...directivos, ...docentesDeJornada(jornada)];
}

export function nombreDeSlot(slot: string | null | undefined): string {
  if (!slot) return '';
  return USUARIOS.find(u => u.id === slot)?.nombre ?? slot;
}

export function puestoEnJornada(p: Puesto, jornada: JornadaId): boolean {
  return p.jornadas === 'both' || (p.jornadas === 'm' ? jornada === 'manana' : jornada === 'tarde');
}

export function puestosDeJornada(jornada: JornadaId, puestos: Puesto[] = PUESTOS): Puesto[] {
  return puestos.filter(p => puestoEnJornada(p, jornada));
}

export function asignacionDe(asig: Asignaciones, puestoId: string, jornada: JornadaId): AsignacionJornada | undefined {
  return asig[puestoId]?.[jornada];
}

export interface ResumenPendientes { porAsignar: number; porConfirmar: number }

export function resumenPendientes(asig: Asignaciones, jornada: JornadaId, puestos: Puesto[] = PUESTOS): ResumenPendientes {
  let porAsignar = 0;
  let porConfirmar = 0;
  for (const p of puestosDeJornada(jornada, puestos)) {
    if (p.opcional) continue;
    const a = asignacionDe(asig, p.id, jornada);
    if (!a || (!a.slot && !a.textoLibre)) porAsignar++;
    else if (a.porConfirmar) porConfirmar++;
  }
  return { porAsignar, porConfirmar };
}

export interface MiRol { puestos: Puesto[]; roles: RolClave[] }

/** Puestos que tiene `slot` en la jornada y los roles que de ahí se derivan (ordenados por prioridad). */
export function miRol(asig: Asignaciones, slot: string | null | undefined, jornada: JornadaId, puestos: Puesto[] = PUESTOS): MiRol {
  if (!slot) return { puestos: [], roles: [] };
  const mios = puestosDeJornada(jornada, puestos).filter(p => asignacionDe(asig, p.id, jornada)?.slot === slot);
  const set = new Set(mios.map(p => p.rol));
  return { puestos: mios, roles: ROL_PRIORIDAD.filter(r => set.has(r)) };
}

// ── Acciones por rol ──────────────────────────────────────────────────────────

/** Acciones propias del rol y las de «docente de aula» que también le tocan (evac, pa, inc, tra). */
export function accionesDelPaso(paso: Paso, rol: RolClave): { own: string[]; base: string[] } {
  if (rol === 'docente') return { own: [], base: paso.doc ?? [] };
  if (ROLES_DOCENTE.includes(rol)) return { own: [...(paso.br ?? []), ...(paso[rol] ?? [])], base: paso.doc ?? [] };
  return { own: paso[rol] ?? [], base: [] };
}

export function normalizar(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Cargo agrupador: «Cronometradores 2» → «Cronometradores» (los puestos numerados salen de una misma fila de la guía). */
export function cargoDe(p: Puesto): string {
  return /_\d+$/.test(p.id) ? p.nombre.replace(/ \d+$/, '') : p.nombre;
}

// ── Avisos ────────────────────────────────────────────────────────────────────

export const MAX_TEXTO_AVISO = 500;

/** Avisos que ve quien mira `jornada` (los de esa jornada y los de «ambas»): importantes primero, luego info; los más nuevos arriba. */
export function avisosDeJornada(
  avisos: Record<string, AvisoSimulacro> | undefined | null,
  jornada: JornadaId,
): (AvisoSimulacro & { id: string })[] {
  return Object.entries(avisos ?? {})
    .map(([id, a]) => ({ ...a, id }))
    .filter(a => a.jornada === jornada || a.jornada === 'ambas')
    .sort((a, b) => {
      if (a.tipo !== b.tipo) return a.tipo === 'importante' ? -1 : 1;
      return (b.cuando ?? '').localeCompare(a.cuando ?? '');
    });
}

/** Todos los avisos (para el panel de edición), los más nuevos primero. */
export function avisosOrdenados(avisos: Record<string, AvisoSimulacro> | undefined | null): (AvisoSimulacro & { id: string })[] {
  return Object.entries(avisos ?? {})
    .map(([id, a]) => ({ ...a, id }))
    .sort((a, b) => (b.cuando ?? '').localeCompare(a.cuando ?? ''));
}

/** Jornadas de aviso que puede elegir quien edita las `editables` (para «ambas» basta editar alguna). */
export function jornadasDeAvisoPermitidas(editables: JornadaId[], esSuper: boolean): JornadaAviso[] {
  if (esSuper) return ['manana', 'tarde', 'ambas'];
  return editables.length ? [...editables, 'ambas'] : [];
}

/** Puede editar/borrar el aviso: superusuario; editor de su jornada; los de «ambas» solo su autor. */
export function puedeTocarAviso(
  a: Pick<AvisoSimulacro, 'jornada' | 'porSlot'>,
  editables: JornadaId[],
  esSuper: boolean,
  miSlot: string | null | undefined,
): boolean {
  if (esSuper) return true;
  if (a.jornada === 'ambas') return editables.length > 0 && !!miSlot && a.porSlot === miSlot;
  return editables.includes(a.jornada);
}

/** '2026-10-12T15:04:00.000Z' → '12/10/2026, 10:04 a. m.' (hora de Bogotá). */
export function fechaAviso(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Bogota' });
}
