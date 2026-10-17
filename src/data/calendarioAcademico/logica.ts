// Lógica pura del calendario académico (sin Firebase ni React): fácil de probar.
import { esFestivo } from '../tareas/calendario';
import type { CategoriaCal, EventoCal } from './tipos';

const MS_DIA = 86400000;
const aUTC = (f: string) => { const [y, m, d] = f.split('-').map(Number); return Date.UTC(y, m - 1, d); };
const deUTC = (t: number) => new Date(t).toISOString().slice(0, 10);

export const diasEntre = (a: string, b: string) => Math.round((aUTC(b) - aUTC(a)) / MS_DIA);
export const sumarDias = (f: string, n: number) => deUTC(aUTC(f) + n * MS_DIA);
/** 0 = domingo ... 6 = sábado */
export const diaDeSemana = (f: string) => new Date(aUTC(f)).getUTCDay();
const esFinDeSemana = (f: string) => { const d = diaDeSemana(f); return d === 0 || d === 6; };
const lunesDe = (f: string) => sumarDias(f, -((diaDeSemana(f) + 6) % 7));
/** Último día del evento (sin `hasta`, es el mismo `desde`). */
export const finDe = (e: EventoCal) => e.hasta ?? e.desde;

/** Normaliza para buscar: sin tildes ni mayúsculas. */
export const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function ordenar(eventos: EventoCal[]): EventoCal[] {
  return [...eventos].sort((a, b) => a.desde.localeCompare(b.desde) || finDe(a).localeCompare(finDe(b)) || a.titulo.localeCompare(b.titulo));
}

// ── Estado actual (periodo, semana, días lectivos) ───────────────────────────

function enReceso(f: string, recesos: EventoCal[]): boolean {
  return recesos.some(r => f >= r.desde && (r.hasta ? f <= r.hasta : true));
}
/** Día lectivo de estudiantes: lunes a viernes, sin festivo ni receso. */
export function esDiaLectivo(f: string, eventos: EventoCal[]): boolean {
  return !esFinDeSemana(f) && !esFestivo(f) && !enReceso(f, eventos.filter(e => e.categoria === 'receso'));
}

export interface EstadoActual {
  periodo: EventoCal | null;
  nombrePeriodo: string;
  semanaN: number;
  totalSemanas: number;
  diasLectivosRestantes: number;
  /** true si hoy está en un receso o fuera de periodo. */
  enReceso: boolean;
}

export function estadoActual(eventos: EventoCal[], hoy: string): EstadoActual {
  const periodos = eventos.filter(e => e.categoria === 'periodo' && e.aplicaA !== 'grado11');
  const p = periodos.find(e => hoy >= e.desde && hoy <= finDe(e)) ?? null;
  const vacio: EstadoActual = { periodo: null, nombrePeriodo: '', semanaN: 0, totalSemanas: 0, diasLectivosRestantes: 0, enReceso: true };
  if (!p) return vacio;
  const recesos = eventos.filter(e => e.categoria === 'receso');
  // Semana lectiva = semana lunes-viernes del periodo con al menos un día lectivo.
  const semanas: string[] = [];
  for (let l = lunesDe(p.desde); l <= finDe(p); l = sumarDias(l, 7)) {
    let hay = false;
    for (let i = 0; i < 5 && !hay; i++) {
      const d = sumarDias(l, i);
      if (d >= p.desde && d <= finDe(p) && !enReceso(d, recesos)) hay = true;
    }
    if (hay) semanas.push(l);
  }
  const lunesHoy = lunesDe(hoy);
  let semanaN = semanas.filter(l => l <= lunesHoy).length;
  if (semanaN === 0) semanaN = 1;
  let restantes = 0;
  for (let d = hoy; d <= finDe(p); d = sumarDias(d, 1)) if (esDiaLectivo(d, eventos)) restantes++;
  return {
    periodo: p,
    nombrePeriodo: p.titulo.replace(' académico', '').replace(/^./, c => c.toLowerCase()),
    semanaN,
    totalSemanas: semanas.length,
    diasLectivosRestantes: restantes,
    enReceso: enReceso(hoy, recesos),
  };
}

// ── Listados ─────────────────────────────────────────────────────────────────

/** Eventos que se listan como «hechos puntuales» (los periodos y recesos largos van en el encabezado). */
const sinFecha = (e: EventoCal) => !!e.porDefinir || !!e.noSeRealiza;
const esVigente = (e: EventoCal, hoy: string) => sinFecha(e) || finDe(e) >= hoy;

export interface Proximo { evento: EventoCal; dias: number; enCurso: boolean; estaSemana: boolean }

export function proximos(eventos: EventoCal[], hoy: string, n = 6): Proximo[] {
  const lunes = lunesDe(hoy), domingo = sumarDias(lunes, 6);
  return ordenar(eventos.filter(e => esVigente(e, hoy) && !sinFecha(e) && e.categoria !== 'periodo'))
    .slice(0, n)
    .map(e => ({
      evento: e,
      dias: Math.max(0, diasEntre(hoy, e.desde)),
      enCurso: e.desde <= hoy,
      estaSemana: e.desde <= domingo && finDe(e) >= lunes,
    }));
}

/** Lo que falta, agrupado por mes ('2026-11' → eventos). Los «por definir» van al final aparte. */
export function pendientesPorMes(eventos: EventoCal[], hoy: string): { mes: string; eventos: EventoCal[] }[] {
  const mapa = new Map<string, EventoCal[]>();
  for (const e of ordenar(eventos.filter(x => esVigente(x, hoy)))) {
    const mes = sinFecha(e) ? 'sin_fecha' : (e.desde < hoy ? hoy : e.desde).slice(0, 7);
    mapa.set(mes, [...(mapa.get(mes) ?? []), e]);
  }
  return [...mapa.entries()].sort(([a], [b]) => (a === 'sin_fecha' ? 1 : b === 'sin_fecha' ? -1 : a.localeCompare(b))).map(([mes, ev]) => ({ mes, eventos: ev }));
}

export function pasados(eventos: EventoCal[], hoy: string): EventoCal[] {
  return ordenar(eventos.filter(e => !sinFecha(e) && finDe(e) < hoy)).reverse();
}

export function buscar(eventos: EventoCal[], texto: string): EventoCal[] {
  const q = normalizar(texto.trim());
  if (!q) return eventos;
  return eventos.filter(e => normalizar(`${e.titulo} ${e.nota ?? ''} ${e.aplicaA === 'grado11' ? 'grado 11 once' : ''}`).includes(q));
}

export function filtrarPorCategoria(eventos: EventoCal[], cats: CategoriaCal[]): EventoCal[] {
  return cats.length === 0 ? eventos : eventos.filter(e => cats.includes(e.categoria));
}

/** Los eventos de Grado 11 solo los ve quien enseña en 11 (o un directivo). */
export function eventosParaGrado11(eventos: EventoCal[], ensenaOnce: boolean): EventoCal[] {
  return ensenaOnce ? eventos : eventos.filter(e => e.aplicaA !== 'grado11');
}

export function eventosDelDia(eventos: EventoCal[], f: string): EventoCal[] {
  return ordenar(eventos.filter(e => f >= e.desde && f <= finDe(e)));
}

// ── Alertas a docentes (7, 2 y 0 días) ───────────────────────────────────────

export type Escalon = 7 | 2 | 0;
export interface AlertaDocente { evento: EventoCal; dias: number; escalon: Escalon; clave: string }

/** Escalón según los días que faltan: 0 → hoy; 1–2 → 2; 3–7 → 7. */
export function escalonDe(dias: number): Escalon | null {
  if (dias < 0 || dias > 7) return null;
  return dias === 0 ? 0 : dias <= 2 ? 2 : 7;
}

export function alertasDocente(eventos: EventoCal[], hoy: string): AlertaDocente[] {
  const out: AlertaDocente[] = [];
  for (const e of eventos) {
    if (!e.alertaDocente || e.porDefinir || e.noSeRealiza) continue;
    // Para un rango se avisa del inicio; si ya empezó y sigue vigente se avisa «hoy» solo el día de inicio.
    const dias = diasEntre(hoy, e.desde);
    const escalon = escalonDe(dias);
    if (escalon === null) continue;
    out.push({ evento: e, dias, escalon, clave: `${e.id}:${e.desde}:${escalon}` });
  }
  return out.sort((a, b) => a.dias - b.dias || a.evento.titulo.localeCompare(b.evento.titulo));
}

// ── Cambios recientes ────────────────────────────────────────────────────────

/** ¿El evento cambió en los últimos `dias` días? */
export function cambioReciente(e: EventoCal, hoy: string, dias = 10): boolean {
  if (!e.cambio) return false;
  const d = diasEntre(e.cambio.cuando.slice(0, 10), hoy);
  return d >= 0 && d <= dias;
}

// ── Texto ────────────────────────────────────────────────────────────────────

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const nombreMes = (ym: string) => ym === 'sin_fecha' ? 'Sin fecha' : `${MESES[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;
const corta = (f: string) => `${Number(f.slice(8, 10))} ${MESES[Number(f.slice(5, 7)) - 1].slice(0, 3)}`;

export function textoFecha(e: Pick<EventoCal, 'desde' | 'hasta' | 'porDefinir'>): string {
  if (e.porDefinir) return 'Por definir';
  if (e.hasta && e.hasta !== e.desde) return `${corta(e.desde)} – ${corta(e.hasta)}`;
  return corta(e.desde);
}

export function textoCuentaRegresiva(dias: number, enCurso = false): string {
  if (enCurso) return 'en curso';
  if (dias === 0) return 'hoy';
  if (dias === 1) return 'mañana';
  return `en ${dias} días`;
}

/** Fecha local de hoy como 'YYYY-MM-DD'. */
export function hoyISO(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
