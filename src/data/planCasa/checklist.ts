// Lista de chequeo automática del docente en un Plan Académico Especial.
// Lógica pura (sin Firebase): se calcula con lo que ya está cargado (asignaturas y guías).
// Solo presentación: no escribe nada ni cambia el modelo de datos.
import type { AsignaturaPlan, GuiaPlan, PlanCasa } from './tipos';
import { criteriosListos } from './avanceDocentes';
import { esGuiaIntegrable } from './integrada';

export interface ItemChequeo {
  id: string;
  /** Sección de la pantalla a la que lleva: 'mis' (mis asignaturas) o `g-<guiaId>`. */
  seccion: string;
  texto: string;
  hecho: boolean;
}

export interface EntregaPorRevisar { guiaId: string; pasoId: string; titulo: string }

export interface DatosChequeo {
  plan: Pick<PlanCasa, 'desde' | 'modalidad'>;
  asigs: AsignaturaPlan[];
  guias: GuiaPlan[];
  /** Correo del usuario actual. */
  correo: string;
  gestor: boolean;
  /** asignaturaId → nombre legible. */
  nombre: (asignaturaId: string) => string;
  /** Hoy en 'YYYY-MM-DD'. */
  hoy: string;
}

const minus = (s: string | undefined) => (s ?? '').trim().toLowerCase();

/** Entregas ya enviadas por el estudiante que este usuario debe revisar (solo desde que empieza el plan). */
export function entregasPorRevisar(d: DatosChequeo): EntregaPorRevisar[] {
  if (d.hoy < d.plan.desde) return [];
  const yo = minus(d.correo);
  const salida: EntregaPorRevisar[] = [];
  for (const g of d.guias) {
    const guia = g.aprobada;
    if (!guia) continue;
    const lider = minus(g.responsableCorreo) === yo;
    for (const p of guia.pasos) {
      const seg = g.seguimiento?.[p.id];
      if (seg?.estado !== 'entregado') continue;
      let mio = false;
      if (p.componentes?.length) {
        // Guía integrada: me toca si alguna parte es de mi asignatura y aún no la revisé.
        mio = p.componentes.some(c => minus(d.asigs.find(a => a.asignaturaId === c.asignaturaId)?.docenteCorreo) === yo
          && !seg.porAsignatura?.[c.asignaturaId]?.revisado);
      } else if (p.id.startsWith('ent-')) {
        mio = minus(d.asigs.find(a => a.asignaturaId === p.id.slice(4))?.docenteCorreo) === yo;
      } else {
        mio = lider;
      }
      if (mio || d.gestor) salida.push({ guiaId: g.id, pasoId: p.id, titulo: p.titulo });
    }
  }
  return salida;
}

/** Lista de chequeo según el papel del usuario en el plan. */
export function construirChequeo(d: DatosChequeo): ItemChequeo[] {
  const yo = minus(d.correo);
  const items: ItemChequeo[] = [];
  const guiaDe = (id: string) => d.guias.find(g => g.asignaturaIds.includes(id));

  // 1) Como docente de asignatura: cada una de las mías.
  for (const a of d.asigs.filter(x => minus(x.docenteCorreo) === yo)) {
    const n = d.nombre(a.asignaturaId);
    items.push({ id: `crit-${a.asignaturaId}`, seccion: 'mis', texto: `${n}: criterios de promoción`, hecho: criteriosListos(a) });
    items.push({ id: `ent-${a.asignaturaId}`, seccion: 'mis', texto: `${n}: entregable y fecha`, hecho: !!a.entregable?.trim() && !!a.fechaEntrega });
    const g = guiaDe(a.asignaturaId);
    const lider = !!g && minus(g.responsableCorreo) === yo;
    if (g && (g.propuesta || g.aprobada) && !lider) {
      items.push({ id: `vb-${a.asignaturaId}`, seccion: `g-${g.id}`, texto: `${n}: visto bueno a la guía`, hecho: !!g.vistosBuenos?.[yo] || !!g.aprobada });
    }
  }

  // 2) Como líder (o gestor: todas las guías).
  for (const g of d.guias.filter(x => d.gestor || minus(x.responsableCorreo) === yo)) {
    const sec = `g-${g.id}`;
    const propias = g.asignaturaIds.map(id => d.asigs.find(a => a.asignaturaId === id)).filter((a): a is AsignaturaPlan => !!a);
    const listos = propias.filter(criteriosListos).length;
    items.push({ id: `eje-${g.id}`, seccion: sec, texto: 'Pregunta orientadora', hecho: !!g.eje?.trim() });
    items.push({ id: `critt-${g.id}`, seccion: sec, texto: `Criterios de los docentes (${listos} de ${propias.length})`, hecho: propias.length > 0 && listos === propias.length });
    items.push({ id: `gen-${g.id}`, seccion: sec, texto: 'Guía generada', hecho: !!(g.propuesta || g.aprobada) });
    if (esGuiaIntegrable(d.plan, g)) {
      items.push({ id: `int-${g.id}`, seccion: sec, texto: 'Guía integrada', hecho: !!((g.aprobada ?? g.propuesta)?.integrada) });
    }
    items.push({ id: `apr-${g.id}`, seccion: sec, texto: 'Aprobada y publicada', hecho: !!g.aprobada });
  }

  // 3) Entregas por revisar (solo con el plan en marcha); una línea por guía.
  if (d.hoy >= d.plan.desde) {
    const porRev = entregasPorRevisar(d);
    for (const g of d.guias.filter(x => x.aprobada)) {
      const n = porRev.filter(e => e.guiaId === g.id).length;
      if (n > 0) items.push({ id: `rev-${g.id}`, seccion: `g-${g.id}`, texto: `${n} entrega${n > 1 ? 's' : ''} por revisar`, hecho: false });
    }
  }
  return items;
}

export interface ResumenChequeo { hechas: number; total: number; pendientes: number; siguiente?: ItemChequeo }

export function resumenChequeo(items: ItemChequeo[]): ResumenChequeo {
  const hechas = items.filter(i => i.hecho).length;
  return { hechas, total: items.length, pendientes: items.length - hechas, siguiente: items.find(i => !i.hecho) };
}

/** Índice estable 0..n-1 a partir del id del plan (para el tinte de color del estudiante). */
export function indiceColor(planId: string, n: number): number {
  let h = 0;
  for (let i = 0; i < planId.length; i++) h = (h * 31 + planId.charCodeAt(i)) >>> 0;
  return h % n;
}
