// Actualización «Fechas de finalización de año 2026» (Coordinación, 11-nov-2026).
// Fuente prioritaria sobre la v2. Contiene SOLO los eventos tocados (nuevos o con otro dato).
// Se aplica en dos sitios: la semilla (si no hay doc en Firestore) y el botón de la UI (si el doc existe).
import type { EventoCal } from './tipos';

export const FUENTE_FIN_ANIO = 'Fuente: Coordinación, 11-nov-2026.';
export const FECHA_FIN_ANIO = '2026-11-11T12:00:00.000Z';
export const MOTIVO_FIN_ANIO = 'Actualización de fin de año (Coordinación, 11-nov-2026)';

const DIAS_PLAN = 'Días: mar 17, mié 18, vie 20, lun 23, mar 24 (con horario de jueves).';

export const ACTUALIZACION_FIN_ANIO: EventoCal[] = [
  // ── Cambiados ──
  { id: 'p3_autoeval', titulo: 'Autoevaluación y coevaluación de estudiantes (3.er periodo)', desde: '2026-11-09', hasta: '2026-11-19',
    categoria: 'institucional', alertaDocente: true,
    nota: `Estudiantes de 1.° a 10.° en las aulas; producto: autoevaluación montada en el Máster. ${FUENTE_FIN_ANIO}` },
  { id: 'p3_planes_apoyo_1', titulo: 'Planes de apoyo (3.er periodo) · 1.° a 10.°', desde: '2026-11-17', hasta: '2026-11-24',
    categoria: 'entrega_docente', alertaDocente: true, nota: `${DIAS_PLAN} ${FUENTE_FIN_ANIO}` },
  { id: 'p3_planes_apoyo_2', titulo: 'Plan de apoyo especial (3.er periodo) · 1.° a 10.° · acta de recuperación final', desde: '2026-11-25', hasta: '2026-12-01',
    categoria: 'entrega_docente', alertaDocente: true, nota: FUENTE_FIN_ANIO },
  { id: 'p3_consolidados', titulo: 'Impresión de consolidados 1.° a 10.° (3.er periodo)', desde: '2026-12-01',
    categoria: 'entrega_docente', alertaDocente: false, nota: `Auxiliares administrativos, secretaría. ${FUENTE_FIN_ANIO}` },
  { id: 'p3_comisiones', titulo: 'Comisión final por ciclos · 1.° a 10.° (3.er periodo)', desde: '2026-12-02', hasta: '2026-12-03',
    categoria: 'reunion', alertaDocente: true, nota: `Lugar por definir. Días: 2 y 3 de diciembre. ${FUENTE_FIN_ANIO}` },
  { id: 'g11_planes_apoyo_1', titulo: 'Grado 11 · Plan de apoyo (3.er periodo)', desde: '2026-11-17', hasta: '2026-11-23',
    categoria: 'entrega_docente', aplicaA: 'grado11', alertaDocente: true,
    nota: `Días: mar 17, mié 18, vie 20, lun 23. ${FUENTE_FIN_ANIO}` },
  { id: 'g11_planes_apoyo_2', titulo: 'Grado 11 · Plan de apoyo especial (3.er periodo) · acta de recuperación final', desde: '2026-11-24', hasta: '2026-11-26',
    categoria: 'entrega_docente', aplicaA: 'grado11', alertaDocente: true, nota: FUENTE_FIN_ANIO },
  { id: 'g11_consolidados', titulo: 'Grado 11 · Impresión de consolidados (3.er periodo)', desde: '2026-11-26',
    categoria: 'entrega_docente', aplicaA: 'grado11', alertaDocente: false,
    nota: `Auxiliares administrativos, secretaría. ${FUENTE_FIN_ANIO}` },
  { id: 'g11_comisiones', titulo: 'Grado 11 · Comisión de evaluación y promoción (3.er periodo)', desde: '2026-11-27',
    categoria: 'reunion', aplicaA: 'grado11', alertaDocente: true, nota: `Aula de innovación. ${FUENTE_FIN_ANIO}` },
  { id: 'g11_reunion_padres', titulo: 'Grado 11 · Reunión de padres de familia (entrega de informes)', desde: '2026-12-01',
    categoria: 'reunion', aplicaA: 'grado11', alertaDocente: true, nota: `Directores de grupo de 11.°. ${FUENTE_FIN_ANIO}` },
  { id: 'acto_excelencia', titulo: 'Acto de la excelencia', desde: '2026-12-09', categoria: 'institucional', alertaDocente: false,
    nota: `Macroproyecto «Leer bien para vivir mejor», auditorio sede principal. ${FUENTE_FIN_ANIO}` },
  { id: 'entrega_productos', titulo: 'Entrega de productos a coordinación y paz y salvo', desde: '2026-12-03', categoria: 'entrega_docente',
    alertaDocente: true, nota: `Docentes. ${FUENTE_FIN_ANIO}` },
  { id: 'graduacion', titulo: 'Graduación de 11.°', desde: '2026-12-04', categoria: 'institucional', alertaDocente: false,
    nota: `Teatro Parque Biblioteca; directores de grupo y docentes seleccionados. ${FUENTE_FIN_ANIO}` },
  // ── Nuevos ──
  { id: 'actas_recuperacion_p1p2', titulo: 'Entrega de actas de recuperación de 1.er y 2.º periodo', desde: '2026-11-17',
    categoria: 'entrega_docente', alertaDocente: true,
    nota: `Impresas, diligenciadas y firmadas; de docentes a coordinación. ${FUENTE_FIN_ANIO}` },
  { id: 'precomisiones', titulo: 'Precomisiones · 1.° a 10.°', desde: '2026-11-25', hasta: '2026-11-30',
    categoria: 'reunion', alertaDocente: true, nota: `Días exactos: 25, 26, 27 y 30 de noviembre. Lugar por definir. ${FUENTE_FIN_ANIO}` },
  { id: 'g11_boletines', titulo: 'Grado 11 · Impresión de boletines', desde: '2026-11-30', categoria: 'entrega_docente', aplicaA: 'grado11',
    alertaDocente: false, nota: FUENTE_FIN_ANIO },
  { id: 'reunion_docentes_areas', titulo: 'Reunión general de docentes: evaluación de áreas y macroproyectos', desde: '2026-12-02',
    categoria: 'reunion', alertaDocente: true, nota: `Llevar informe de área y de macroproyecto. ${FUENTE_FIN_ANIO}` },
  { id: 'boletines_transicion', titulo: 'Impresión de boletines de transición a 10.°', desde: '2026-12-04', categoria: 'entrega_docente',
    alertaDocente: false, nota: FUENTE_FIN_ANIO },
  { id: 'jornada_pedagogica_uai', titulo: 'Jornada pedagógica: formación a cargo de la UAI', desde: '2026-12-04',
    categoria: 'desarrollo_institucional', alertaDocente: true,
    nota: `Para los docentes que no asisten a los grados. ${FUENTE_FIN_ANIO}` },
  { id: 'dia_familia', titulo: 'Día de la familia (SED)', desde: '2026-12-07', categoria: 'institucional', alertaDocente: false, nota: FUENTE_FIN_ANIO },
  { id: 'consejo_academico_dic', titulo: 'Consejo académico: plan de estudios, plataforma Máster y plataforma institucional', desde: '2026-12-09',
    categoria: 'reunion', alertaDocente: false, nota: `Aula de innovación. ${FUENTE_FIN_ANIO}` },
  // La reunión de padres de transición a 10.° es el mismo evento p3_reunion_padres (10-dic): se actualiza, no se duplica.
  { id: 'p3_reunion_padres', titulo: 'Reunión de padres de transición a 10.° y renovación de matrícula 2027', desde: '2026-12-10',
    categoria: 'reunion', alertaDocente: true, nota: `Directores de grupo; entrega de boletines y renovación de matrícula 2027. ${FUENTE_FIN_ANIO}` },
  { id: 'jornada_pedagogica_asignacion', titulo: 'Jornada pedagógica: asignación académica 2027 y despedida', desde: '2026-12-11',
    categoria: 'desarrollo_institucional', alertaDocente: true, nota: `Equipo directivo, auditorio. ${FUENTE_FIN_ANIO}` },
];

export interface CambioPlan { id: string; tipo: 'nuevo' | 'cambiado'; antes: EventoCal | null; despues: EventoCal }

const CAMPOS: (keyof EventoCal)[] = ['titulo', 'desde', 'hasta', 'porDefinir', 'noSeRealiza', 'categoria', 'aplicaA', 'alertaDocente', 'nota'];
const igual = (a: EventoCal, b: EventoCal) => CAMPOS.every(k => (a[k] ?? false) === (b[k] ?? false));
const fechasIguales = (a: EventoCal, b: EventoCal) => a.desde === b.desde && a.hasta === b.hasta
  && !!a.porDefinir === !!b.porDefinir && !!a.noSeRealiza === !!b.noSeRealiza;

/** Evento resultante: toma el dato nuevo y, si cambiaron las fechas, guarda las anteriores en `cambio`. */
export function eventoActualizado(antes: EventoCal | null, nuevo: EventoCal, cuando = FECHA_FIN_ANIO): EventoCal {
  if (antes && !fechasIguales(antes, nuevo)) {
    return { ...nuevo, cambio: { antes: { desde: antes.desde, hasta: antes.hasta, porDefinir: antes.porDefinir, noSeRealiza: antes.noSeRealiza }, cuando } };
  }
  return antes?.cambio ? { ...nuevo, cambio: antes.cambio } : nuevo;
}

/** Qué cambiaría sobre el calendario actual. Vacío si ya está aplicada (idempotente). */
export function planActualizacion(actuales: EventoCal[], upd: EventoCal[] = ACTUALIZACION_FIN_ANIO): CambioPlan[] {
  const mapa = new Map(actuales.map(e => [e.id, e]));
  const out: CambioPlan[] = [];
  for (const n of upd) {
    const a = mapa.get(n.id) ?? null;
    if (!a) out.push({ id: n.id, tipo: 'nuevo', antes: null, despues: n });
    else if (!igual(a, n)) out.push({ id: n.id, tipo: 'cambiado', antes: a, despues: eventoActualizado(a, n) });
  }
  return out;
}

/** Aplica la actualización a una lista (usado por la semilla). No borra nada. */
export function aplicarActualizacion(base: EventoCal[], upd: EventoCal[] = ACTUALIZACION_FIN_ANIO): EventoCal[] {
  const cambios = new Map(planActualizacion(base, upd).map(c => [c.id, c.despues]));
  const usados = new Set<string>();
  const out = base.map(e => { const c = cambios.get(e.id); if (c) usados.add(e.id); return c ?? e; });
  for (const [id, e] of cambios) if (!usados.has(id)) out.push(e);
  return out;
}
