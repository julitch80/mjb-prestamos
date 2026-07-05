// Motor de agenda del módulo de Tareas.
//
// Contabilidad acordada:
//  - El cupo por asignatura se descuenta en el PERÍODO de la FECHA DE ENTREGA
//    (semana para básica/media, quincena para media técnica).
//  - La agenda se recalcula por asignación (evento) y reparte los momentos de
//    ejecución entre los días hábiles, sin tocar días pasados ni el día en curso.
//  - Planificación EDF (earliest deadline first): con reparto voraz desde el
//    día más próximo, si la agenda es factible este orden siempre la encuentra.

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

// ── Planificación de agenda (filtro de capacidad) ─────────────────────────────

/**
 * Reparte los momentos de las tareas activas del grupo en los días ejecutables,
 * de HOY+1 en adelante, respetando el tope diario. Orden EDF.
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
    let restantes = t.momentos;
    // La agenda del día en curso no se reorganiza: se planifica desde mañana,
    // y nunca antes del día de asignación de la tarea.
    let fecha = addDias(hoy, 1);
    if (t.fechaAsignacion > fecha) fecha = t.fechaAsignacion;

    while (restantes > 0 && fecha < t.fechaEntrega) {
      if (esDiaEjecutable(grupo, fecha)) {
        const libre = tope - (carga[fecha] ?? 0);
        if (libre > 0) {
          const usar = Math.min(libre, restantes);
          carga[fecha] = (carga[fecha] ?? 0) + usar;
          (porDia[fecha] ??= []).push({ tareaId: t.id, momentos: usar });
          restantes -= usar;
        }
      }
      fecha = addDias(fecha, 1);
    }
    if (restantes > 0) sinUbicar.push({ tareaId: t.id, momentos: restantes });
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

// ── Filtro 2: cupo por asignatura ─────────────────────────────────────────────

/** Momentos ya comprometidos por la asignatura en el período de una entrega. */
export function momentosUsados(
  tareas: Tarea[], grupo: string, asignaturaId: string, periodo: string
): number {
  return tareas
    .filter(t =>
      t.estado === 'activa' && t.grupo === grupo && t.asignaturaId === asignaturaId &&
      clavePeriodo(grupo, t.fechaEntrega) === periodo
    )
    .reduce((s, t) => s + t.momentos, 0);
}

export function cupoDisponible(
  ctx: ContextoValidacion, grupo: string, asignaturaId: string, periodo: string
): number {
  const base = cupoDeAsignatura(grupo, asignaturaId, ctx.cuposOverride);
  const recibidos = ctx.cesiones
    .filter(c => c.grupo === grupo && c.periodo === periodo && c.asignaturaDestinoId === asignaturaId)
    .reduce((s, c) => s + c.momentos, 0);
  const cedidos = ctx.cesiones
    .filter(c => c.grupo === grupo && c.periodo === periodo && c.asignaturaOrigenId === asignaturaId)
    .reduce((s, c) => s + c.momentos, 0);
  const usados = momentosUsados(ctx.tareas, grupo, asignaturaId, periodo);
  return base + recibidos - cedidos - usados;
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

/** ¿Cabe la tarea (con esta fecha y momentos) sin romper la capacidad? */
function cabeEnAgenda(nueva: Tarea, ctx: ContextoValidacion): boolean {
  const plan = planificarAgenda([...ctx.tareas, nueva], nueva.grupo, ctx.hoy);
  return plan.sinUbicar.length === 0;
}

function buscarAlternativas(nueva: Tarea, ctx: ContextoValidacion): Alternativas {
  const alt: Alternativas = {};
  // Primera fecha de entrega viable (hasta 4 semanas adelante)
  for (let i = 1; i <= 28; i++) {
    const fecha = addDias(nueva.fechaEntrega, i);
    if (!esDiaHabil(fecha)) continue;
    if (cabeEnAgenda({ ...nueva, fechaEntrega: fecha }, ctx)) {
      alt.primeraEntregaViable = fecha;
      break;
    }
  }
  // Máximo de momentos que sí caben con la fecha pedida
  for (let m = nueva.momentos - 1; m >= 1; m--) {
    if (cabeEnAgenda({ ...nueva, momentos: m }, ctx)) {
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

  // 2. Cupo de la asignatura en el período de la entrega
  const periodo = clavePeriodo(nueva.grupo, nueva.fechaEntrega);
  const disponible = cupoDisponible(ctx, nueva.grupo, nueva.asignaturaId, periodo);
  if (nueva.momentos > disponible) {
    const etiqueta = config.periodoCupo === 'quincena' ? 'esta quincena' : 'esta semana';
    return {
      ok: false,
      filtro: 'cupo',
      mensaje: disponible <= 0
        ? `La asignatura ya usó su cupo de momentos para ${etiqueta}. Puede pedir una cesión a otra asignatura o programar la entrega para el siguiente período.`
        : `Solo quedan ${disponible} momento(s) de cupo para ${etiqueta}.`,
      alternativas: disponible > 0 ? { maxMomentosParaFecha: disponible } : undefined,
    };
  }

  // 3. Capacidad de la agenda del grupo (tope diario hasta la víspera de entrega)
  if (!cabeEnAgenda(nueva, ctx)) {
    const alt = buscarAlternativas(nueva, ctx);
    const partes: string[] = ['No hay capacidad en la agenda del grupo para esa fecha.'];
    if (alt.primeraEntregaViable) partes.push(`Primera entrega viable: ${fechaLegible(alt.primeraEntregaViable)}.`);
    if (alt.maxMomentosParaFecha) partes.push(`Con la fecha elegida caben máximo ${alt.maxMomentosParaFecha} momento(s).`);
    return { ok: false, filtro: 'capacidad', mensaje: partes.join(' '), alternativas: alt };
  }

  return { ok: true };
}
