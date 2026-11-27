// «Por revisar»: entregas que el estudiante ya envió desde la agenda y que este usuario aún debe
// revisar. Lógica pura (sin Firebase), la misma regla que la lista de chequeo (entregasPorRevisar)
// más dos condiciones: la entrega debe tener fecha (entregadoEn) y el resultado va de la más
// antigua a la más reciente.
//
// Criterio exacto: un paso cuenta como «por revisar» cuando no está 'revisado' y su seguimiento
// está en 'entregado' (o hay entregas reales aunque siga 'pendiente'), y puedoRevisarPaso: soy
// CUALQUIER docente de la guía (responsable, en docentesCorreos o docente de una asignatura de
// la guía). En guía integrada, con parte propia, deja de contar cuando marco mi parte.
// El equipo y coordinación (gestor) ven todas las entregas en ese estado.
// Fecha mostrada: entregadoEn, o la entrega real más reciente, o la última actualización.
import type { AsignaturaPlan, GuiaPlan, PlanCasa } from './tipos';
import { entregasPorRevisar, llavePaso } from './checklist';

export interface DatosPlanRevisar {
  plan: Pick<PlanCasa, 'desde' | 'modalidad' | 'nombres' | 'apellidos' | 'grupo'> & { id: string };
  asigs: AsignaturaPlan[];
  guias: GuiaPlan[];
  /** Pasos con entregas reales (llavePaso(guiaId, pasoId) → ms de la más reciente), si se conocen. */
  conEntregas?: Record<string, number>;
}

export interface EntregaRecibida {
  planId: string;
  /** Primer nombre del estudiante. */
  estudiante: string;
  grupo: string;
  guiaId: string;
  pasoId: string;
  titulo: string;
  /** Posición del paso dentro de la guía (1, 2, …). */
  pasoNum: number;
  /** Momento de la entrega (ms). */
  entregadoEn: number;
  /** Nombres de las asignaturas mías por revisar en una guía integrada (vacío en los demás casos). */
  partes: string[];
  /** Por qué le aparece a este usuario (para que el docente lo entienda). */
  motivo: string;
}

const minus = (s: string | undefined) => (s ?? '').trim().toLowerCase();

export function entregasRecibidasPorRevisar(
  planes: DatosPlanRevisar[], o: { correo: string; gestor: boolean; hoy: string; nombre: (planId: string, asignaturaId: string) => string },
): EntregaRecibida[] {
  const yo = minus(o.correo);
  const salida: EntregaRecibida[] = [];
  for (const d of planes) {
    const pendientes = entregasPorRevisar({ plan: d.plan, asigs: d.asigs, guias: d.guias, correo: o.correo, gestor: o.gestor, hoy: o.hoy, conEntregas: d.conEntregas, nombre: id => o.nombre(d.plan.id, id) });
    for (const e of pendientes) {
      const g = d.guias.find(x => x.id === e.guiaId);
      const seg = g?.seguimiento?.[e.pasoId];
      const pasos = g?.aprobada?.pasos ?? [];
      const paso = pasos.find(p => p.id === e.pasoId);
      const cuando = seg?.entregadoEn ?? d.conEntregas?.[llavePaso(e.guiaId, e.pasoId)] ?? seg?.actualizadoEn ?? 0;
      if (!g || !paso) continue;
      const partes = (paso.componentes ?? [])
        .filter(c => !seg?.porAsignatura?.[c.asignaturaId]?.revisado
          && (o.gestor || minus(d.asigs.find(a => a.asignaturaId === c.asignaturaId)?.docenteCorreo) === yo))
        .map(c => o.nombre(d.plan.id, c.asignaturaId));
      const nombreAsig = (id: string) => o.nombre(d.plan.id, id);
      const motivo = o.gestor ? 'coordinación / equipo'
        : partes.length ? `su parte: ${partes.join(', ')}`
        : paso.id.startsWith('ent-') ? `entregable de ${nombreAsig(paso.id.slice(4))}`
        : minus(g.responsableCorreo) === yo ? 'usted es responsable de la guía'
        : `guía de ${(g.asignaturaIds ?? []).map(nombreAsig).join(', ')}`;
      salida.push({
        planId: d.plan.id, estudiante: (d.plan.nombres ?? '').trim().split(/\s+/)[0] ?? '', grupo: d.plan.grupo,
        guiaId: e.guiaId, pasoId: e.pasoId, titulo: e.titulo, pasoNum: pasos.indexOf(paso) + 1, entregadoEn: cuando, partes, motivo,
      });
    }
  }
  return salida.sort((a, b) => a.entregadoEn - b.entregadoEn);
}

/** Cantidad de entregas por revisar de cada guía (para el indicador de las pastillas). */
export function contarPorGuia(e: Pick<EntregaRecibida, 'guiaId'>[]): Record<string, number> {
  const r: Record<string, number> = {};
  for (const x of e) r[x.guiaId] = (r[x.guiaId] ?? 0) + 1;
  return r;
}
