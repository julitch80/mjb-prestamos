// «Por revisar»: entregas que el estudiante ya envió desde la agenda y que este usuario aún debe
// revisar. Lógica pura (sin Firebase), la misma regla que la lista de chequeo (entregasPorRevisar)
// más dos condiciones: la entrega debe tener fecha (entregadoEn) y el resultado va de la más
// antigua a la más reciente.
//
// Criterio exacto: un paso cuenta como «por revisar» cuando su seguimiento está en estado
// 'entregado' (no 'pendiente' ni 'revisado'), tiene `entregadoEn`, y
//  - guía integrada: al menos una de las partes (componentes) es de una asignatura mía y aún no la marqué;
//  - paso «ent-<asignatura>»: la asignatura es mía;
//  - otro paso: soy el responsable de la guía.
// El equipo y coordinación (gestor) ven todas las entregas en ese estado.
import type { AsignaturaPlan, GuiaPlan, PlanCasa } from './tipos';
import { entregasPorRevisar } from './checklist';

export interface DatosPlanRevisar {
  plan: Pick<PlanCasa, 'desde' | 'modalidad' | 'nombres' | 'apellidos' | 'grupo'> & { id: string };
  asigs: AsignaturaPlan[];
  guias: GuiaPlan[];
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
}

const minus = (s: string | undefined) => (s ?? '').trim().toLowerCase();

export function entregasRecibidasPorRevisar(
  planes: DatosPlanRevisar[], o: { correo: string; gestor: boolean; hoy: string; nombre: (planId: string, asignaturaId: string) => string },
): EntregaRecibida[] {
  const yo = minus(o.correo);
  const salida: EntregaRecibida[] = [];
  for (const d of planes) {
    const pendientes = entregasPorRevisar({ plan: d.plan, asigs: d.asigs, guias: d.guias, correo: o.correo, gestor: o.gestor, hoy: o.hoy, nombre: id => o.nombre(d.plan.id, id) });
    for (const e of pendientes) {
      const g = d.guias.find(x => x.id === e.guiaId);
      const seg = g?.seguimiento?.[e.pasoId];
      const pasos = g?.aprobada?.pasos ?? [];
      const paso = pasos.find(p => p.id === e.pasoId);
      if (!g || !paso || typeof seg?.entregadoEn !== 'number') continue;
      const partes = (paso.componentes ?? [])
        .filter(c => !seg.porAsignatura?.[c.asignaturaId]?.revisado
          && (o.gestor || minus(d.asigs.find(a => a.asignaturaId === c.asignaturaId)?.docenteCorreo) === yo))
        .map(c => o.nombre(d.plan.id, c.asignaturaId));
      salida.push({
        planId: d.plan.id, estudiante: (d.plan.nombres ?? '').trim().split(/\s+/)[0] ?? '', grupo: d.plan.grupo,
        guiaId: e.guiaId, pasoId: e.pasoId, titulo: e.titulo, pasoNum: pasos.indexOf(paso) + 1, entregadoEn: seg.entregadoEn, partes,
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
