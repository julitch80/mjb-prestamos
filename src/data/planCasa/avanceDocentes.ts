// Avance por docente en los planes activos: qué ha hecho y qué le falta a cada uno.
// Lógica pura (sin Firebase). Nunca incluye motivo ni datos de salud: solo nombre de pila y grupo.
import type { AsignaturaPlan, GuiaPlan, PlanCasa } from './tipos';

export type EstadoGuiaAvance = 'aprobada' | 'propuesta' | 'sin_generar';

export interface FilaAsignaturaAvance {
  asignaturaId: string;
  asignatura: string;
  criteriosListos: boolean;
  criteriosPorIA: boolean;
  entregableListo: boolean;
  fechaEntrega: string;
  estadoGuia: EstadoGuiaAvance;
  /** El docente dio visto bueno (o la guía ya está aprobada, que lo implica). */
  vistoBueno: boolean;
  esLider: boolean;
  /** Solo si es líder: la pregunta orientadora (eje) ya está escrita. */
  ejeListo: boolean;
  /** Tareas listas / total de esta fila (criterios, entregable, visto bueno si hay guía, eje si es líder). */
  listas: number;
  total: number;
}

export interface PlanAvance {
  planId: string;
  nombre: string;
  grupo: string;
  filas: FilaAsignaturaAvance[];
}

export interface DocenteAvance {
  docenteId: string;
  docente: string;
  planes: PlanAvance[];
  listas: number;
  total: number;
}

export interface DatosPlanAvance {
  plan: Pick<PlanCasa, 'id' | 'nombres' | 'grupo' | 'estado'>;
  asigs: AsignaturaPlan[];
  guias: GuiaPlan[];
  /** asignaturaId → nombres legibles. */
  nombres: Record<string, { asignatura: string; docente: string }>;
}

/** Mismo criterio que `CriteriosListos` en PlanCasaDocente: escritos y no generados por la IA. */
export function criteriosListos(a: AsignaturaPlan): boolean {
  return !!a.criteriosPromocion?.trim() && !a.porIA;
}

export function filaAsignatura(a: AsignaturaPlan, guias: GuiaPlan[], asignatura: string): FilaAsignaturaAvance {
  const g = guias.find(x => x.asignaturaIds.includes(a.asignaturaId));
  const correo = (a.docenteCorreo ?? '').trim().toLowerCase();
  const estadoGuia: EstadoGuiaAvance = g?.aprobada ? 'aprobada' : g?.propuesta ? 'propuesta' : 'sin_generar';
  const vistoBueno = !!g && (!!g.vistosBuenos?.[correo] || estadoGuia === 'aprobada');
  const esLider = !!g && !!correo && g.responsableCorreo?.trim().toLowerCase() === correo;
  const ejeListo = esLider && !!g?.eje?.trim();
  const criterios = criteriosListos(a);
  const entregable = !!a.entregable?.trim() && !!a.fechaEntrega;
  // El visto bueno solo cuenta cuando ya hay algo que revisar.
  const cuentaVisto = estadoGuia !== 'sin_generar';
  const hechas = [criterios, entregable, ...(cuentaVisto ? [vistoBueno] : []), ...(esLider ? [ejeListo] : [])];
  return {
    asignaturaId: a.asignaturaId, asignatura, criteriosListos: criterios,
    criteriosPorIA: !!a.porIA && !!a.criteriosPromocion?.trim(),
    entregableListo: entregable, fechaEntrega: a.fechaEntrega ?? '',
    estadoGuia, vistoBueno, esLider, ejeListo,
    listas: hechas.filter(Boolean).length, total: hechas.length,
  };
}

/** Un registro por docente, ordenado con más pendientes primero. Solo planes activos. */
export function construirAvanceDocentes(planes: DatosPlanAvance[]): DocenteAvance[] {
  const mapa = new Map<string, DocenteAvance>();
  for (const { plan, asigs, guias, nombres } of planes) {
    if (plan.estado !== 'activo') continue;
    const porDocente = new Map<string, FilaAsignaturaAvance[]>();
    for (const a of asigs) {
      const fila = filaAsignatura(a, guias, nombres[a.asignaturaId]?.asignatura ?? a.asignaturaId);
      porDocente.set(a.docenteId, [...(porDocente.get(a.docenteId) ?? []), fila]);
      if (!mapa.has(a.docenteId)) {
        mapa.set(a.docenteId, { docenteId: a.docenteId, docente: nombres[a.asignaturaId]?.docente ?? a.docenteId, planes: [], listas: 0, total: 0 });
      }
    }
    for (const [docenteId, filas] of porDocente) {
      const d = mapa.get(docenteId)!;
      d.planes.push({ planId: plan.id, nombre: plan.nombres.split(' ')[0] ?? plan.nombres, grupo: plan.grupo, filas });
      for (const f of filas) { d.listas += f.listas; d.total += f.total; }
    }
  }
  return [...mapa.values()].sort((a, b) =>
    (b.total - b.listas) - (a.total - a.listas) || a.docente.localeCompare(b.docente, 'es'));
}

export type Jornada = 'manana' | 'tarde';
export type FiltroJornada = Jornada | 'todas';

/** Jornada de un plan según su grupo: «º» (6º1…) es tarde; «9.1», «10.2»… es mañana. */
export function jornadaDePlan(grupo: string): Jornada {
  return grupo.includes('º') ? 'tarde' : 'manana';
}

/**
 * Deja solo los planes de la jornada y recalcula los totales de cada docente
 * (un docente mixto conserva solo lo de esa jornada). Quien queda sin planes sale.
 */
export function filtrarPorJornada(docentes: DocenteAvance[], jornada: FiltroJornada): DocenteAvance[] {
  if (jornada === 'todas') return docentes;
  return docentes
    .map(d => {
      const planes = d.planes.filter(p => jornadaDePlan(p.grupo) === jornada);
      const filas = planes.flatMap(p => p.filas);
      return { ...d, planes, listas: filas.reduce((s, f) => s + f.listas, 0), total: filas.reduce((s, f) => s + f.total, 0) };
    })
    .filter(d => d.planes.length > 0)
    .sort((a, b) => (b.total - b.listas) - (a.total - a.listas) || a.docente.localeCompare(b.docente, 'es'));
}
