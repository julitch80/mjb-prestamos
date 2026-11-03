// Seguimiento por estudiante del Plan Académico Especial (lógica pura, con pruebas).
// Avance = pasos que el ESTUDIANTE entregó (`seguimiento[paso].entregadoEn`, que escribe solo
// el servidor al recibir una entrega) sobre el total de pasos de las guías aprobadas.
// Las revisiones de los docentes NO cuentan como avance.
// Privacidad: solo primer nombre, inicial del apellido y grupo; jamás motivo ni diagnóstico.
import type { FechaISO, GuiaPlan, PlanCasa } from './tipos';

/** Días calendario sin entregar a partir de los cuales el estudiante pasa a rojo. */
export const DIAS_SIN_AVANCE = 7;

export type Semaforo = 'verde' | 'amarillo' | 'rojo';
export type Jornada = 'manana' | 'tarde';
export type FiltroSeguimiento = 'todos' | 'sin_avance' | 'atrasados';

/** «º» (6º1…) es tarde; «9.1», «10.2»… es mañana. */
export const jornadaDeGrupo = (grupo: string): Jornada => (grupo.includes('º') ? 'tarde' : 'manana');

const MS_DIA = 86400000;
const parse = (f: FechaISO) => { const [y, m, d] = f.split('-').map(Number); return Date.UTC(y, m - 1, d); };

/** Días calendario de `a` a `b` (negativo si b < a). */
export const diasCalendario = (a: FechaISO, b: FechaISO): number => Math.round((parse(b) - parse(a)) / MS_DIA);

/** Día calendario (YYYY-MM-DD) en Bogotá (UTC-5 fijo) de un instante en ms. */
export const diaBogota = (ms: number): FechaISO => new Date(ms - 5 * 3600000).toISOString().slice(0, 10);

type PlanMin = Pick<PlanCasa, 'id' | 'nombres' | 'apellidos' | 'grupo' | 'desde' | 'hasta' | 'estado'> & Partial<Pick<PlanCasa, 'enEspera' | 'alertaInactividad'>>;

export interface PasoVencido { guiaId: string; pasoId: string; titulo: string; fecha: FechaISO; area: string; diasAtraso: number }
export interface SemanaSeg { semana: number; entregados: number; total: number }
export interface AreaSeg { guiaId: string; area: string; entregados: number; total: number; revisados: number }
export interface SustentacionSeg { guiaId: string; area: string; fecha: FechaISO | null; estado: GuiaPlan['sustentacionEstado'] }

export interface SeguimientoEstudiante {
  planId: string;
  /** «Samuel P.» */
  nombre: string;
  grupo: string;
  jornada: Jornada;
  total: number;
  entregados: number;
  /** 0–100 */
  porcentaje: number;
  revisados: number;
  vencidos: PasoVencido[];
  /** Días desde la última ENTREGA (o desde el inicio del plan si no hay ninguna). null si el plan aún no empieza o no hay pasos. */
  diasSinAvance: number | null;
  /** Día de la última entrega, o null. */
  ultimaEntrega: FechaISO | null;
  semaforo: Semaforo;
  enEspera: boolean;
  semanas: SemanaSeg[];
  areas: AreaSeg[];
  sustentaciones: SustentacionSeg[];
  /** Alerta enviada por el servidor (solo se muestra en rojo). */
  alerta?: { en: number; dias: number };
}

/** «Samuel P.» — primer nombre e inicial del primer apellido. */
export function nombreCorto(nombres: string, apellidos: string): string {
  const n = String(nombres ?? '').trim().split(/\s+/)[0] ?? '';
  const a = String(apellidos ?? '').trim().charAt(0).toUpperCase();
  return a ? `${n} ${a}.` : n;
}

/** Mayor `entregadoEn` (ms) entre todas las guías, o null. */
export function ultimaEntregaMs(guias: Pick<GuiaPlan, 'seguimiento'>[]): number | null {
  let max = 0;
  for (const g of guias) for (const s of Object.values(g.seguimiento ?? {})) if ((s.entregadoEn ?? 0) > max) max = s.entregadoEn!;
  return max > 0 ? max : null;
}

/**
 * Calcula el seguimiento de UN plan. `guias` ya debe venir recortado al alcance del visitante
 * (ver `guiasVisibles`). `etiquetaGuia` da el nombre legible del área de una guía.
 */
export function seguimientoDePlan(
  plan: PlanMin, guias: GuiaPlan[], hoy: FechaISO, etiquetaGuia: (g: GuiaPlan) => string = g => g.eje || g.id,
): SeguimientoEstudiante {
  const aprobadas = guias.filter(g => g.aprobada);
  let total = 0, entregados = 0, revisados = 0;
  const vencidos: PasoVencido[] = [];
  const porSemana = new Map<number, SemanaSeg>();
  const areas: AreaSeg[] = [];

  for (const g of aprobadas) {
    const area = etiquetaGuia(g);
    const fila: AreaSeg = { guiaId: g.id, area, entregados: 0, total: 0, revisados: 0 };
    for (const p of g.aprobada!.pasos ?? []) {
      const seg = g.seguimiento?.[p.id];
      const entregado = !!seg?.entregadoEn;
      const revisado = seg?.estado === 'revisado';
      total++; fila.total++;
      if (entregado) { entregados++; fila.entregados++; }
      if (revisado) { revisados++; fila.revisados++; }
      const sem = porSemana.get(p.semana) ?? { semana: p.semana, entregados: 0, total: 0 };
      sem.total++; if (entregado) sem.entregados++;
      porSemana.set(p.semana, sem);
      if (!entregado && p.fecha && p.fecha < hoy) {
        vencidos.push({ guiaId: g.id, pasoId: p.id, titulo: p.titulo, fecha: p.fecha, area, diasAtraso: diasCalendario(p.fecha, hoy) });
      }
    }
    areas.push(fila);
  }
  vencidos.sort((a, b) => a.fecha.localeCompare(b.fecha));

  const ms = ultimaEntregaMs(aprobadas);
  const ultima = ms ? diaBogota(ms) : null;
  const empezo = hoy >= plan.desde;
  const base = ultima ?? plan.desde;
  const diasSinAvance = empezo && total > 0 ? Math.max(0, diasCalendario(base, hoy)) : null;
  const enEspera = !!plan.enEspera;

  let semaforo: Semaforo = 'verde';
  if (!enEspera && plan.estado === 'activo') {
    if (diasSinAvance !== null && diasSinAvance >= DIAS_SIN_AVANCE) semaforo = 'rojo';
    else if (vencidos.length > 0) semaforo = 'amarillo';
  }

  return {
    planId: plan.id, nombre: nombreCorto(plan.nombres, plan.apellidos), grupo: plan.grupo, jornada: jornadaDeGrupo(plan.grupo),
    total, entregados, porcentaje: total === 0 ? 0 : Math.round((entregados / total) * 100), revisados,
    vencidos, diasSinAvance, ultimaEntrega: ultima, semaforo, enEspera,
    semanas: [...porSemana.values()].sort((a, b) => a.semana - b.semana), areas,
    sustentaciones: aprobadas.map(g => ({ guiaId: g.id, area: etiquetaGuia(g), fecha: g.aprobada!.sustentacion?.fecha ?? null, estado: g.sustentacionEstado })),
    alerta: semaforo === 'rojo' ? plan.alertaInactividad : undefined,
  };
}

// ── Alcance por rol ───────────────────────────────────────────────────────

export interface QuienVe {
  rol: string;
  /** Jornada del usuario ('manana' | 'tarde' | 'ambas' | otro). */
  jornada: string | null;
  /** Está en planCasaConfig/equipo. */
  enEquipo: boolean;
  correo: string;
}

/** Equipo, rectora y superusuario ven todo. */
export const veTodoElPlan = (q: QuienVe) => q.enEquipo || q.rol === 'rectora' || q.rol === 'superusuario';

/** ¿Ve esta persona AMBAS jornadas? (para mostrar el filtro Mañana/Tarde). */
export const veAmbasJornadas = (q: QuienVe) =>
  veTodoElPlan(q) || (q.rol === 'coordinador' && q.jornada !== 'manana' && q.jornada !== 'tarde');

/** Solo equipo, coordinación y superusuario registran la llamada a la familia. */
export const puedeRegistrarLlamada = (q: QuienVe) => q.enEquipo || q.rol === 'coordinador' || q.rol === 'superusuario';

/** El historial de llamadas lo ve todo el que no sea docente (equipo incluido). */
export const veHistorialLlamadas = (q: QuienVe) => q.enEquipo || q.rol !== 'docente';

/**
 * Guías que el visitante puede ver de un plan, o null si el plan no le corresponde.
 * Coordinador: solo planes de su jornada. Docente (que no es del equipo): solo las guías
 * donde figura entre `docentesCorreos`.
 */
export function guiasVisibles(q: QuienVe, plan: Pick<PlanCasa, 'grupo'>, guias: GuiaPlan[]): GuiaPlan[] | null {
  if (veTodoElPlan(q)) return guias;
  if (q.rol === 'coordinador') {
    const j = q.jornada;
    return (j === 'manana' || j === 'tarde') && jornadaDeGrupo(plan.grupo) !== j ? null : guias;
  }
  const yo = q.correo.trim().toLowerCase();
  if (!yo) return null;
  const mias = guias.filter(g => (g.docentesCorreos ?? []).some(c => c.toLowerCase() === yo));
  return mias.length > 0 ? mias : null;
}

// ── Agregados y filtros ───────────────────────────────────────────────────

export interface ResumenSeguimiento { alDia: number; atrasados: number; sinAvance: number; sustProgramadas: number; sustTotal: number }

export function resumenSeguimientos(lista: SeguimientoEstudiante[]): ResumenSeguimiento {
  const r: ResumenSeguimiento = { alDia: 0, atrasados: 0, sinAvance: 0, sustProgramadas: 0, sustTotal: 0 };
  for (const s of lista) {
    if (s.semaforo === 'verde') r.alDia++; else if (s.semaforo === 'amarillo') r.atrasados++; else r.sinAvance++;
    r.sustTotal += s.sustentaciones.length;
    r.sustProgramadas += s.sustentaciones.filter(x => x.fecha).length;
  }
  return r;
}

/** Filtra por tarjeta y jornada; ordena rojos primero, luego amarillos, luego por menos avance. */
export function filtrarSeguimientos(lista: SeguimientoEstudiante[], filtro: FiltroSeguimiento, jornada: Jornada | 'todas' = 'todas'): SeguimientoEstudiante[] {
  const orden: Record<Semaforo, number> = { rojo: 0, amarillo: 1, verde: 2 };
  return lista
    .filter(s => (jornada === 'todas' || s.jornada === jornada)
      && (filtro === 'todos' || (filtro === 'sin_avance' ? s.semaforo === 'rojo' : s.semaforo === 'amarillo')))
    .sort((a, b) => orden[a.semaforo] - orden[b.semaforo] || a.porcentaje - b.porcentaje || a.nombre.localeCompare(b.nombre, 'es'));
}

/** «Última entrega: hace 3 días», «… hoy», «Sin entregas aún». */
export function textoUltimaEntrega(s: Pick<SeguimientoEstudiante, 'ultimaEntrega'>, hoy: FechaISO): string {
  if (!s.ultimaEntrega) return 'Sin entregas aún';
  const d = diasCalendario(s.ultimaEntrega, hoy);
  return d <= 0 ? 'Última entrega: hoy' : d === 1 ? 'Última entrega: hace 1 día' : `Última entrega: hace ${d} días`;
}
