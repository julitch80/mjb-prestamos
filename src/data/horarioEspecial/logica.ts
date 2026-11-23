// Lógica pura del horario especial (plan de apoyo): vigencia y filtros.
import {
  PLAN_APOYO_DESDE, PLAN_APOYO_HASTA,
  type EntradaEspecial, type JornadaEspecial,
} from './planApoyo2026';

export type GradoFiltro = '6' | '7' | '8' | '9' | '10' | '11';
export const GRADOS_FILTRO: GradoFiltro[] = ['6', '7', '8', '9', '10', '11'];

/** Fecha de hoy en Bogotá como YYYY-MM-DD. */
export function hoyBogota(ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).format(ahora);
}

/** ¿La fecha ISO cae dentro de la semana de plan de apoyo (ambos extremos incluidos)? */
export function estaVigente(fecha: string): boolean {
  return fecha >= PLAN_APOYO_DESDE && fecha <= PLAN_APOYO_HASTA;
}

/**
 * ¿Se muestra la entrada de menú? Vigente por fecha, o activada con `?horarioEspecial=1`
 * (prueba antes del 24-nov).
 */
/** Desde cuándo se anuncia (antes de que rija): así se puede consultar la víspera. */
export const PLAN_APOYO_AVISO_DESDE = '2026-11-21';

export function entradaMenuVisible(fecha: string, busqueda: string): boolean {
  if (estaVigente(fecha) || (fecha >= PLAN_APOYO_AVISO_DESDE && fecha <= PLAN_APOYO_HASTA)) return true;
  try { return new URLSearchParams(busqueda).get('horarioEspecial') === '1'; } catch { return false; }
}

/** Mayúsculas sin tildes ni signos, espacios colapsados. */
export function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9° º]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Grado (6..11) al que alude el texto de grados: «10°3 y 10°4», «7°1-7°3», «6º, 7º y 8º». */
export function gradosMencionados(texto: string | null): Set<GradoFiltro> {
  const out = new Set<GradoFiltro>();
  if (!texto) return out;
  // Un número de grado va seguido de ° / º, o es el primero de «1°3 – 10°4» (no se toma: es errata).
  for (const m of texto.matchAll(/(\d{1,2})\s*[°º]/g)) {
    const g = m[1];
    if ((GRADOS_FILTRO as string[]).includes(g)) out.add(g as GradoFiltro);
  }
  return out;
}

/** ¿La entrada corresponde al grado? Las entradas sin grado (Optativa) no se filtran. */
export function entradaEsDeGrado(en: EntradaEspecial, grado: GradoFiltro): boolean {
  return gradosMencionados(en.grados).has(grado);
}

/**
 * Alias con los que aparece cada docente en el PDF. Si el usuario no está aquí,
 * se usa su nombre corto normalizado (un «Johana R.» no coincide con «Johana»).
 */
const ALIAS: Record<string, string[]> = {
  yoguis: ['JUAN CARLOS', 'YOGUIS', 'BLANDON'],
  monica_c: ['MONICA CORDOBA', 'MONICA'], // «MONICA» suelto = Córdoba (la Rave siempre va con apellido)
  monica_rave: ['MONICA RAVE'],
  fredy_garcia: ['FREDY'],
  luis_javier: ['LUIS JAVIER', 'JAVIER'],
  juan_pablo: ['JUAN PABLO'],
  juan_diego: [],
};

function aliasesDe(userId: string, nombreCorto: string): string[] {
  if (userId in ALIAS) return ALIAS[userId];
  const base = normalizar(nombreCorto);
  return base ? [base] : [];
}

/** ¿El texto de docentes de la entrada nombra a este usuario? */
export function entradaEsDeDocente(en: EntradaEspecial, userId: string, nombreCorto: string): boolean {
  if (!en.docentes) return false;
  let texto = ' ' + normalizar(en.docentes) + ' ';
  if (userId === 'monica_c') texto = texto.replace(/MONICA RAVE/g, ' ');
  return aliasesDe(userId, nombreCorto).some(a => texto.includes(' ' + a + ' '));
}

export interface FiltrosEspecial {
  grado: GradoFiltro | null;
  soloMias: boolean;
  userId: string;
  nombreCorto: string;
}

export function pasaFiltros(en: EntradaEspecial, f: FiltrosEspecial): boolean {
  if (f.grado && !entradaEsDeGrado(en, f.grado)) return false;
  if (f.soloMias && !entradaEsDeDocente(en, f.userId, f.nombreCorto)) return false;
  return true;
}

/** Cuántas entradas de la jornada pasan los filtros (para avisar si no hay coincidencias). */
export function contarCoincidencias(j: JornadaEspecial, f: FiltrosEspecial): number {
  let n = 0;
  for (const d of j.dias) for (const fr of d.entradas) for (const en of fr) if (pasaFiltros(en, f)) n++;
  return n;
}

/** Día que se abre por defecto: hoy si está en la semana; si no, el primero. */
export function diaInicial(j: JornadaEspecial, hoy: string): number {
  const i = j.dias.findIndex(d => d.fecha === hoy);
  return i >= 0 ? i : 0;
}
