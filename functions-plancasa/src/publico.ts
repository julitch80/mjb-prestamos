// Construcción pura de la copia pública (QR): sin apellidos, motivo ni ajustes.
import type { GuiaPlan, PlanCasa, PlanPublico } from '../../src/data/planCasa/tipos';

export function primerNombre(nombres: string): string {
  return String(nombres ?? '').trim().split(/\s+/)[0] ?? '';
}

/** Etiqueta de la guía: asignatura, o en transversal «eje (A · B)». */
export function etiquetaGuia(g: GuiaPlan, nombreAsignatura: (id: string) => string): string {
  const ids = g.asignaturaIds ?? [];
  if (ids.length <= 1) return ids.length ? nombreAsignatura(ids[0]) : g.eje;
  return `${g.eje} (${ids.map(nombreAsignatura).join(' · ')})`;
}

/** Solo entran las guías con `aprobada`. Los resolutores se inyectan para probar sin catálogos. */
export function construirPublico(
  plan: PlanCasa,
  guias: GuiaPlan[],
  nombreAsignatura: (id: string) => string,
  nombreDocentePorCorreo: (correo: string) => string,
  ahora: number,
): PlanPublico {
  const pasos: PlanPublico['pasos'] = [];
  const sustentaciones: PlanPublico['sustentaciones'] = [];
  for (const g of guias) {
    if (!g.aprobada) continue;
    const asignatura = etiquetaGuia(g, nombreAsignatura);
    const docente = nombreDocentePorCorreo(String(g.responsableCorreo ?? '').toLowerCase());
    for (const p of g.aprobada.pasos ?? []) {
      // guiaId y entregadoEn: para el botón «Entregar» y el «✓ Entregado» de la agenda.
      const seg = g.seguimiento?.[p.id];
      const entregadoEn = seg?.entregadoEn;
      // Revisado y comentario del docente: el estudiante los ve en su agenda.
      const comentario = seg?.estado === 'revisado' && typeof seg.observacion === 'string' ? seg.observacion.trim().slice(0, 500) : '';
      pasos.push({ ...p, asignatura, docente, guiaId: g.id, ...(typeof entregadoEn === 'number' ? { entregadoEn } : {}),
        ...(seg?.estado === 'revisado' ? { revisado: true } : {}), ...(comentario ? { comentario } : {}) });
    }
    if (g.aprobada.sustentacion) sustentaciones.push({ ...g.aprobada.sustentacion, asignatura, docente });
  }
  return {
    primerNombre: primerNombre(plan.nombres),
    grupo: plan.grupo,
    desde: plan.desde,
    hasta: plan.hasta,
    pasos,
    sustentaciones,
    actualizadoEn: ahora,
  };
}
