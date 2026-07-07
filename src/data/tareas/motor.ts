// Motor de agenda del módulo de Tareas.
//
// Contabilidad acordada (jul 2026, decisión de Julián):
//  - Los momentos de una tarea se REPARTEN a lo largo del lapso entre su
//    asignación y su entrega, distribuidos (no amontonados al inicio).
//  - El cupo por asignatura se cuenta por la SEMANA DE EJECUCIÓN: cada semana
//    (quincena en media técnica) limita cuántos momentos de la asignatura se
//    ejecutan en ella. Así una tarea larga cabe repartida en varias semanas.
//  - La agenda se recalcula por asignación (evento), sin tocar días pasados
//    ni el día en curso; se planifica desde mañana en adelante.

import type {
  AgendaGrupo, Alternativas, BloqueAgenda, ContextoValidacion,
  DiaSemana, FechaISO, ResultadoValidacion, Tarea,
} from './tipos';
import {
  addDias, claveQuincena, claveSemana, diaSemana, esDiaEjecutable, esDiaHabil,
} from './calendario';
import { CONFIG_NIVEL, cupoDeAsignatura, nivelDeGrupo } from './config';

export function clavePeriodo(grupo: string, fecha: FechaISO): string {
  const periodo = CONFIG_NIVEL[nivelDeGrupo(grupo)].periodoCupo;
  return periodo === 'quincena' ? claveQuincena(fecha) : claveSemana(fecha);
}

// ── Planificación de agenda ───────────────────────────────────────────────────

/**
 * Reparte los momentos de cada tarea de forma distribuida (uniforme) a lo largo
 * de sus días ejecutables, respetando el tope diario compartido del grupo.
 * Orden EDF (entrega más próxima primero). No toca días pasados ni el día en curso.
 */
export function planificarAgenda(tareas: Tarea[], grupo: string, hoy: FechaISO): AgendaGrupo {
  const tope = CONFIG_NIVEL[nivelDeGrupo(grupo)].topeDiario;
  const activas = tareas
    .filter(t => t.estado === 'activa' && t.grupo === grupo && t.fechaEntrega > hoy)
    .sort((a, b) =>
      a.fechaEntrega !== b.fechaEntrega
        ? a.fechaEntrega.localeCompare(b.fechaEntrega)
        : a.fechaAsignacion.localeCompare(b.fechaAsignacion)
    );

  const carga: Record<FechaISO, number> = {};
  const porDia: Record<FechaISO, BloqueAgenda[]> = {};
  const sinUbicar: BloqueAgenda[] = [];

  for (const t of activas) {
    // Días ejecutables en [max(hoy+1, asignación) .. entrega-1]
    let inicio = addDias(hoy, 1);
    if (t.fechaAsignacion > inicio) inicio = t.fechaAsignacion;
    const dias: FechaISO[] = [];
    for (let f = inicio; f < t.fechaEntrega; f = addDias(f, 1)) {
      if (esDiaEjecutable(grupo, f)) dias.push(f);
    }

    const D = dias.length;
    let colocados = 0;
    if (D > 0) {
      // Espaciado centrado: el momento k va al día ~((k+0.5)/M) del lapso, y si
      // ese día ya está al tope, se busca el siguiente con cupo diario libre.
      for (let k = 0; k < t.momentos; k++) {
        const ideal = Math.floor(((k + 0.5) * D) / t.momentos);
        for (let off = 0; off < D; off++) {
          const dia = dias[(ideal + off) % D];
          if ((carga[dia] ?? 0) < tope) {
            carga[dia] = (carga[dia] ?? 0) + 1;
            (porDia[dia] ??= []).push({ tareaId: t.id, momentos: 1 });
            colocados++;
            break;
          }
        }
      }
    }
    if (colocados < t.momentos) sinUbicar.push({ tareaId: t.id, momentos: t.momentos - colocados });
  }

  // Consolidar momentos de la misma tarea en el mismo día.
  for (const dia of Object.keys(porDia)) {
    const agrup = new Map<string, number>();
    for (const b of porDia[dia]) agrup.set(b.tareaId, (agrup.get(b.tareaId) ?? 0) + b.momentos);
    porDia[dia] = [...agrup.entries()].map(([tareaId, momentos]) => ({ tareaId, momentos }));
  }

  return { porDia, sinUbicar };
}

/** Ocupación por día (para mapas de calor y calendario-semáforo). */
export function ocupacionPorDia(agenda: AgendaGrupo): Record<FechaISO, number> {
  const res: Record<FechaISO, number> = {};
  for (const [fecha, bloques] of Object.entries(agenda.porDia)) {
    res[fecha] = bloques.reduce((s, b) => s + b.momentos, 0);
  }
  return res;
}

// ── Filtro 1: ventana de asignación ───────────────────────────────────────────

/**
 * La tarea debe asignarse el día de la clase o, a más tardar, los dos días
 * calendario siguientes a una clase del docente con ese grupo.
 */
export function ventanaValida(fechaAsignacion: FechaISO, diasClase: DiaSemana[]): boolean {
  for (let offset = 0; offset <= 2; offset++) {
    const f = addDias(fechaAsignacion, -offset);
    const d = diaSemana(f);
    if (d !== 'sabado' && d !== 'domingo' && diasClase.includes(d) && esDiaHabil(f)) {
      return true;
    }
  }
  return false;
}

// ── Filtro 2: cupo por semana de ejecución ────────────────────────────────────

/** Cupo base de la asignatura en un período (con cesiones, sin restar usados). */
function cupoBase(ctx: ContextoValidacion, grupo: string, asignaturaId: string, periodo: string): number {
  const base = cupoDeAsignatura(grupo, asignaturaId, ctx.cuposOverride);
  const recibidos = ctx.cesiones
    .filter(c => c.grupo === grupo && c.periodo === periodo && c.asignaturaDestinoId === asignaturaId)
    .reduce((s, c) => s + c.momentos, 0);
  const cedidos = ctx.cesiones
    .filter(c => c.grupo === grupo && c.periodo === periodo && c.asignaturaOrigenId === asignaturaId)
    .reduce((s, c) => s + c.momentos, 0);
  return base + recibidos - cedidos;
}

/** Momentos de la asignatura ejecutados por período, según la agenda planificada. */
function momentosPorPeriodo(
  tareas: Tarea[], grupo: string, asignaturaId: string, hoy: FechaISO
): Record<string, number> {
  const plan = planificarAgenda(tareas, grupo, hoy);
  const asigDe = new Map(tareas.map(t => [t.id, t.asignaturaId]));
  const res: Record<string, number> = {};
  for (const [fecha, bloques] of Object.entries(plan.porDia)) {
    const periodo = clavePeriodo(grupo, fecha);
    for (const b of bloques) {
      if (asigDe.get(b.tareaId) === asignaturaId) res[periodo] = (res[periodo] ?? 0) + b.momentos;
    }
  }
  return res;
}

/** Momentos que aún puede ejecutar la asignatura en un período dado. */
export function cupoDisponible(
  ctx: ContextoValidacion, grupo: string, asignaturaId: string, periodo: string
): number {
  const usados = momentosPorPeriodo(ctx.tareas, grupo, asignaturaId, ctx.hoy)[periodo] ?? 0;
  return cupoBase(ctx, grupo, asignaturaId, periodo) - usados;
}

/** Primer período de ejecución que excede el cupo de la asignatura, o null. */
function periodoExcedido(
  tareas: Tarea[], ctx: ContextoValidacion, grupo: string, asignaturaId: string
): string | null {
  const usados = momentosPorPeriodo(tareas, grupo, asignaturaId, ctx.hoy);
  for (const [periodo, m] of Object.entries(usados)) {
    if (m > cupoBase(ctx, grupo, asignaturaId, periodo)) return periodo;
  }
  return null;
}

// ── Validación completa de una tarea nueva ────────────────────────────────────

export function fechaLegible(f: FechaISO): string {
  const DIAS: Record<string, string> = {
    lunes: 'lunes', martes: 'martes', miercoles: 'miércoles',
    jueves: 'jueves', viernes: 'viernes', sabado: 'sábado', domingo: 'domingo',
  };
  const [, m, d] = f.split('-').map(Number);
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${DIAS[diaSemana(f)]} ${d} de ${MESES[m - 1]}`;
}

/** ¿La tarea cabe (capacidad diaria) y respeta el cupo por semana de ejecución? */
function esFactible(nueva: Tarea, ctx: ContextoValidacion): boolean {
  const conNueva = [...ctx.tareas, nueva];
  const plan = planificarAgenda(conNueva, nueva.grupo, ctx.hoy);
  if (plan.sinUbicar.some(b => b.tareaId === nueva.id)) return false;
  return periodoExcedido(conNueva, ctx, nueva.grupo, nueva.asignaturaId) === null;
}

function buscarAlternativas(nueva: Tarea, ctx: ContextoValidacion): Alternativas {
  const alt: Alternativas = {};
  // Primera fecha de entrega viable (hasta 8 semanas adelante): al alejar la
  // entrega, los momentos se reparten en más semanas y caben dentro del cupo.
  for (let i = 1; i <= 56; i++) {
    const fecha = addDias(nueva.fechaEntrega, i);
    if (!esDiaHabil(fecha)) continue;
    if (esFactible({ ...nueva, fechaEntrega: fecha }, ctx)) {
      alt.primeraEntregaViable = fecha;
      break;
    }
  }
  // Máximo de momentos que sí caben con la fecha pedida
  for (let m = nueva.momentos - 1; m >= 1; m--) {
    if (esFactible({ ...nueva, momentos: m }, ctx)) {
      alt.maxMomentosParaFecha = m;
      break;
    }
  }
  return alt;
}

export function validarTarea(nueva: Tarea, ctx: ContextoValidacion): ResultadoValidacion {
  const nivel = nivelDeGrupo(nueva.grupo);
  const config = CONFIG_NIVEL[nivel];

  // 0. Fecha de entrega elemental: futura y en día hábil
  if (nueva.fechaEntrega <= ctx.hoy) {
    return { ok: false, filtro: 'entrega', mensaje: 'La fecha de entrega debe ser posterior a hoy.' };
  }
  if (!esDiaHabil(nueva.fechaEntrega)) {
    return { ok: false, filtro: 'entrega', mensaje: 'La entrega debe caer en un día hábil (sin fines de semana ni festivos).' };
  }
  if (nueva.momentos < 1) {
    return { ok: false, filtro: 'entrega', mensaje: 'La tarea debe tener al menos 1 momento.' };
  }

  // 1. Ventana de asignación: día de la clase + 2 días
  if (!ventanaValida(nueva.fechaAsignacion, ctx.diasClase)) {
    return {
      ok: false,
      filtro: 'ventana',
      mensaje: 'Fuera de plazo: la tarea debe asignarse el día de la clase o a más tardar dos días después.',
    };
  }

  const etiqueta = config.periodoCupo === 'quincena' ? 'quincena' : 'semana';
  const conNueva = [...ctx.tareas, nueva];
  const plan = planificarAgenda(conNueva, nueva.grupo, ctx.hoy);

  // 2. Cupo de la asignatura por semana de ejecución
  if (periodoExcedido(conNueva, ctx, nueva.grupo, nueva.asignaturaId) !== null) {
    const alt = buscarAlternativas(nueva, ctx);
    const partes = [`Se excede el cupo de momentos de la asignatura en alguna ${etiqueta}.`];
    if (alt.primeraEntregaViable) {
      partes.push(`Entregando el ${fechaLegible(alt.primeraEntregaViable)} se reparte en más ${etiqueta}s y sí cabe.`);
    } else {
      partes.push(`Puede pedir una cesión de momentos a otra asignatura.`);
    }
    if (alt.maxMomentosParaFecha) partes.push(`Con esta fecha caben ${alt.maxMomentosParaFecha} momento(s).`);
    return { ok: false, filtro: 'cupo', mensaje: partes.join(' '), alternativas: alt };
  }

  // 3. Capacidad de la agenda del grupo (tope diario hasta la víspera de entrega)
  if (plan.sinUbicar.some(b => b.tareaId === nueva.id)) {
    const alt = buscarAlternativas(nueva, ctx);
    const partes: string[] = ['No hay capacidad en la agenda del grupo para esa fecha.'];
    if (alt.primeraEntregaViable) partes.push(`Primera entrega viable: ${fechaLegible(alt.primeraEntregaViable)}.`);
    if (alt.maxMomentosParaFecha) partes.push(`Con la fecha elegida caben máximo ${alt.maxMomentosParaFecha} momento(s).`);
    return { ok: false, filtro: 'capacidad', mensaje: partes.join(' '), alternativas: alt };
  }

  return { ok: true };
}
