// «Revisión de guías» (coordinación, rectora, superusuario): qué entregas mandaron los estudiantes,
// cuáles ya revisaron los docentes, quién debe cada pendiente y quién va atrasado.
// Lógica pura. A quién le toca cada entrega usa la MISMA regla que «Por revisar» del docente:
//  - entrega integrada (componentes): el docente de cada asignatura que aún no marcó su parte;
//  - entregable de una asignatura («ent-<asig>»): su docente;
//  - paso general: en guía de una asignatura, su docente; en guía de varias, el responsable.
import type { AsignaturaPlan, GuiaPlan, PlanCasa } from './tipos';

const minus = (s: string | undefined) => (s ?? '').trim().toLowerCase();
const DIA = 86_400_000;
/** Días desde la entrega a partir de los cuales una revisión pendiente cuenta como atrasada. */
export const DIAS_ATRASO = 3;

export interface PendienteRevision {
  planId: string; estudiante: string; grupo: string; guiaId: string; pasoId: string;
  titulo: string; entregadoEn: number; dias: number; asignaturas: string[];
}

export interface FilaDocenteRevision {
  correo: string; pendientes: PendienteRevision[]; revisadas: number; atrasadas: number; masAntigua: number;
}

export interface FilaEstudianteRevision {
  planId: string; estudiante: string; grupo: string; entregas: number; revisadas: number; pendientes: number; masAntigua: number;
}

export interface ResumenRevision {
  entregas: number; revisadas: number; pendientes: number; atrasadas: number;
  docentes: FilaDocenteRevision[]; estudiantes: FilaEstudianteRevision[]; sinResponsable: PendienteRevision[];
}

export interface DatosPlanRevision {
  plan: Pick<PlanCasa, 'id' | 'nombres' | 'apellidos' | 'grupo'>;
  asigs: AsignaturaPlan[];
  guias: GuiaPlan[];
}

/** Correos a los que les toca revisar el paso (vacío si nadie quedó asignado). */
export function aQuienLeToca(paso: { id: string; componentes?: { asignaturaId: string }[] }, g: GuiaPlan, asigs: AsignaturaPlan[]): string[] {
  const doc = (id: string) => minus(asigs.find(a => a.asignaturaId === id)?.docenteCorreo);
  const responsable = minus(g.responsableCorreo);
  if (paso.componentes?.length) return [...new Set(paso.componentes.map(c => doc(c.asignaturaId)).filter(Boolean))];
  if (paso.id.startsWith('ent-')) { const d = doc(paso.id.slice(4)); return d ? [d] : responsable ? [responsable] : []; }
  const ids = g.asignaturaIds ?? [];
  if (ids.length <= 1) { const d = ids[0] ? doc(ids[0]) : ''; return d ? [d] : responsable ? [responsable] : []; }
  return responsable ? [responsable] : [...new Set(ids.map(doc).filter(Boolean))];
}

export function resumenRevision(planes: DatosPlanRevision[], ahora: number, nombre: (planId: string, asigId: string) => string): ResumenRevision {
  const porDocente = new Map<string, FilaDocenteRevision>();
  const fila = (c: string) => {
    let f = porDocente.get(c);
    if (!f) { f = { correo: c, pendientes: [], revisadas: 0, atrasadas: 0, masAntigua: 0 }; porDocente.set(c, f); }
    return f;
  };
  const estudiantes: FilaEstudianteRevision[] = [];
  const sinResponsable: PendienteRevision[] = [];
  let entregas = 0, revisadas = 0, pendientes = 0, atrasadas = 0;

  for (const d of planes) {
    const est = (d.plan.nombres ?? '').trim().split(/\s+/)[0] + ' ' + ((d.plan.apellidos ?? '').trim().split(/\s+/)[0] ?? '');
    const fe: FilaEstudianteRevision = { planId: d.plan.id, estudiante: est.trim(), grupo: d.plan.grupo, entregas: 0, revisadas: 0, pendientes: 0, masAntigua: 0 };
    for (const g of d.guias) {
      for (const p of g.aprobada?.pasos ?? []) {
        const seg = g.seguimiento?.[p.id];
        const estado = seg?.estado ?? 'pendiente';
        if (estado !== 'entregado' && estado !== 'revisado') continue;
        entregas++; fe.entregas++;
        const toca = aQuienLeToca(p, g, d.asigs);
        const doc = (id: string) => minus(d.asigs.find(a => a.asignaturaId === id)?.docenteCorreo);
        // Quién ya revisó (para el conteo de cada docente).
        if (p.componentes?.length) {
          for (const c of p.componentes) if (seg?.porAsignatura?.[c.asignaturaId]?.revisado && doc(c.asignaturaId)) fila(doc(c.asignaturaId)).revisadas++;
        } else if (estado === 'revisado') for (const c of toca) fila(c).revisadas++;
        if (estado === 'revisado') { revisadas++; fe.revisadas++; continue; }
        pendientes++; fe.pendientes++;
        const cuando = seg?.entregadoEn ?? seg?.actualizadoEn ?? ahora;
        const dias = Math.max(0, Math.floor((ahora - cuando) / DIA));
        fe.masAntigua = Math.max(fe.masAntigua, dias);
        if (dias >= DIAS_ATRASO) atrasadas++;
        // En integradas, la pendiente es de los que aún no marcaron su parte.
        const deuda = p.componentes?.length
          ? p.componentes.filter(c => !seg?.porAsignatura?.[c.asignaturaId]?.revisado)
          : null;
        const base: Omit<PendienteRevision, 'asignaturas'> = { planId: d.plan.id, estudiante: fe.estudiante, grupo: d.plan.grupo, guiaId: g.id, pasoId: p.id, titulo: p.titulo, entregadoEn: cuando, dias };
        if (deuda) {
          const porCorreo = new Map<string, string[]>();
          for (const c of deuda) { const k = doc(c.asignaturaId); if (k) porCorreo.set(k, [...(porCorreo.get(k) ?? []), nombre(d.plan.id, c.asignaturaId)]); }
          if (!porCorreo.size) sinResponsable.push({ ...base, asignaturas: deuda.map(c => nombre(d.plan.id, c.asignaturaId)) });
          for (const [c, asig] of porCorreo) { const f = fila(c); f.pendientes.push({ ...base, asignaturas: asig }); if (dias >= DIAS_ATRASO) f.atrasadas++; f.masAntigua = Math.max(f.masAntigua, dias); }
        } else {
          const asig = p.id.startsWith('ent-') ? [nombre(d.plan.id, p.id.slice(4))] : (g.asignaturaIds ?? []).map(id => nombre(d.plan.id, id));
          if (!toca.length) sinResponsable.push({ ...base, asignaturas: asig });
          for (const c of toca) { const f = fila(c); f.pendientes.push({ ...base, asignaturas: asig }); if (dias >= DIAS_ATRASO) f.atrasadas++; f.masAntigua = Math.max(f.masAntigua, dias); }
        }
      }
    }
    if (fe.entregas) estudiantes.push(fe);
  }
  const docentes = [...porDocente.values()].sort((a, b) => b.atrasadas - a.atrasadas || b.pendientes.length - a.pendientes.length || b.masAntigua - a.masAntigua);
  for (const f of docentes) f.pendientes.sort((a, b) => b.dias - a.dias);
  estudiantes.sort((a, b) => b.pendientes - a.pendientes || b.masAntigua - a.masAntigua || a.grupo.localeCompare(b.grupo, 'es', { numeric: true }));
  return { entregas, revisadas, pendientes, atrasadas, docentes, estudiantes, sinResponsable };
}
