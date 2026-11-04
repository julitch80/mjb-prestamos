// «Completar todo con IA» (coordinación) — parte PURA: qué le falta a un plan, en qué orden se
// hace y cómo se arma la guía aprobada. Sin Firebase ni React, para poder probarla.
// La parte con efectos (llamar a la IA, guardar, publicar) vive en ./completarConIA.ts.
import { addDias, parseFecha } from '../tareas/calendario';
import type { AsignaturaPlan, FechaISO, Guia, GuiaPlan, PasoGuia, PlanCasa, RitmoPlan } from './tipos';
import { esGuiaIntegrable } from './integrada';
import { fechaCierre, protegerPasosPasados, repartirPasos } from './logica';

export function hoyLocal(): FechaISO {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Reparte los pasos de TODAS las guías aprobadas del plan en días hábiles sin pasar el
 * tope diario (suma de momentos entre asignaturas). Respeta las fechas ya puestas.
 * Devuelve guiaId → pasos con fecha, y los avisos de lo que no cupo.
 */
export function repartirTodas(
  plan: { desde: FechaISO; hasta: FechaISO; topeDiario: number; ritmo?: RitmoPlan },
  guias: { guiaId: string; pasos: PasoGuia[] }[],
): { pasos: Record<string, PasoGuia[]>; avisos: string[] } {
  const r = repartirPasos(guias, plan.desde, plan.hasta, plan.topeDiario, hoyLocal(), plan.ritmo ?? 'diario');
  return { pasos: Object.fromEntries(r.asignaturas.map(g => [g.guiaId, g.pasos])), avisos: r.avisos };
}

/** Agrega (o actualiza) un paso «Entregable de <asignatura>» por cada asignatura que tenga entregable. */
export function conEntregables(guia: Guia, asigs: AsignaturaPlan[], nombre: (id: string) => string, desde: string): Guia {
  // Guía integrada: los entregables de los docentes ya están fundidos en la entrega semanal; no se añaden pasos sueltos.
  if (guia.integrada) return guia;
  const pasos = [...guia.pasos];
  for (const a of asigs) {
    const id = `ent-${a.asignaturaId}`;
    const i = pasos.findIndex(p => p.id === id);
    if (!a.entregable?.trim()) { if (i >= 0) pasos.splice(i, 1); continue; }
    const fecha = a.fechaEntrega || null;
    const semana = fecha ? Math.max(1, Math.floor((new Date(`${fecha}T12:00:00`).getTime() - new Date(`${desde}T12:00:00`).getTime()) / (7 * 86400000)) + 1) : (pasos[pasos.length - 1]?.semana ?? 1);
    const paso = {
      id, titulo: `Entregable de ${nombre(a.asignaturaId)}`, instrucciones: a.entregable.trim(), momentos: 1,
      evidencia: 'foto' as const, evidenciaDetalle: a.entregable.trim(), semana, fecha,
    };
    if (i >= 0) pasos[i] = { ...pasos[i], ...paso }; else pasos.push(paso);
  }
  return { ...guia, pasos };
}

/** '8º1' → '8º', '10.2' → '10°' (para el aviso a la IA). */
export function gradoDeGrupo(grupo: string): string {
  if (grupo.includes('º')) return `${grupo.split('º')[0]}º`;
  return `${grupo.split('.')[0]}°`;
}

/** ¿La guía integra varias asignaturas (o el plan es transversal)? */
export const esTransversal = (plan: Pick<PlanCasa, 'modalidad'>, g: Pick<GuiaPlan, 'asignaturaIds'>): boolean =>
  g.asignaturaIds.length > 1 || plan.modalidad === 'transversal';

// ── Qué falta ─────────────────────────────────────────────────────────────

type PlanMin = Pick<PlanCasa, 'modalidad' | 'desde' | 'hasta' | 'estado'> & Partial<Pick<PlanCasa, 'enEspera'>>;

/** Mientras el caso esté «en espera — ingresó tarde», no se completa con IA. */
export const completarBloqueado = (plan: Pick<PlanCasa, 'enEspera'>): boolean => !!plan.enEspera;
type GuiaMin = Pick<GuiaPlan, 'id' | 'asignaturaIds' | 'aprobada' | 'propuesta' | 'pedido'> & Partial<Pick<GuiaPlan, 'eje'>>;
type AsigMin = Pick<AsignaturaPlan, 'asignaturaId' | 'criteriosPromocion' | 'ebcDba' | 'evidenciaAprendizaje' | 'aportes' | 'entregable' | 'fechaEntrega'>;

export interface Faltantes {
  /** Asignaturas a las que la IA debe completar criterios/EBC/evidencia/aportes (solo lo vacío). */
  asignaturas: string[];
  /** Asignaturas de guías sin aprobar que no tienen entregable o fecha de entrega. */
  entregables: string[];
  /** Guías sin aprobar. */
  guias: string[];
  /** Guías (aprobadas o no) sin pregunta orientadora / eje. */
  ejes: string[];
  /** Asignaturas de guías YA aprobadas que tienen entregable pero no fecha. */
  fechas: string[];
  /** ¿Hay algo que hacer? (el botón solo aparece si es true y el plan no está cerrado). */
  hayQueHacer: boolean;
}

const vacio = (s?: string) => !s?.trim();

/** Qué le falta a un plan para que todas las guías puedan aprobarse y el cuadernillo salga completo. */
export function faltantesPlan(plan: PlanMin, asigs: AsigMin[], guias: GuiaMin[]): Faltantes {
  if (plan.estado === 'cerrado' || completarBloqueado(plan)) return { asignaturas: [], entregables: [], guias: [], ejes: [], fechas: [], hayQueHacer: false };
  const enPendiente = new Set(guias.filter(g => !g.aprobada).flatMap(g => g.asignaturaIds));
  const asignaturas = asigs.filter(a =>
    vacio(a.criteriosPromocion) || (enPendiente.has(a.asignaturaId) && (vacio(a.ebcDba) || vacio(a.evidenciaAprendizaje) || vacio(a.aportes)))).map(a => a.asignaturaId);
  // Toda asignatura sin entregable o sin fecha (también las de guías ya aprobadas: cuentan en el avance).
  const entregables = asigs.filter(a => vacio(a.entregable) || !a.fechaEntrega).map(a => a.asignaturaId);
  const gs = guias.filter(g => !g.aprobada).map(g => g.id);
  const ejes = guias.filter(g => vacio(g.eje)).map(g => g.id);
  const fechas: string[] = [];
  return { asignaturas, entregables, guias: gs, ejes, fechas, hayQueHacer: asignaturas.length > 0 || entregables.length > 0 || gs.length > 0 || ejes.length > 0 };
}

/** Fecha de entrega sugerida: reparte las k asignaturas en días hábiles del periodo (posición i de k). */
export function fechaEntregaSugerida(desde: FechaISO, hasta: FechaISO, i: number, k: number): FechaISO {
  const habiles: FechaISO[] = [];
  for (let f = desde; f <= hasta && habiles.length < 400; f = addDias(f, 1)) {
    const d = parseFecha(f).getDay();
    if (d !== 0 && d !== 6) habiles.push(f);
  }
  if (!habiles.length) return desde;
  const pos = Math.min(habiles.length - 1, Math.floor(((i + 1) * habiles.length) / (k + 1)));
  return habiles[pos];
}

// ── Orden de los pasos ────────────────────────────────────────────────────

export type TipoPaso = 'asignatura' | 'entregable' | 'fecha' | 'eje' | 'pedido' | 'propuesta' | 'integrar' | 'aprobar';
export interface PasoCompletar { id: string; tipo: TipoPaso; ref: string; texto: string }

/**
 * Orden de ejecución. Fase 1: por asignatura (campos y entregable); fase 2: por guía (pedido,
 * propuesta, integración); fase 3: aprobaciones, una tras otra (cada reparto depende de las anteriores).
 */
export function construirPasos(
  plan: PlanMin, asigs: AsigMin[], guias: GuiaPlan[], nombre: (id: string) => string, etiquetaGuia: (g: GuiaPlan) => string,
): PasoCompletar[] {
  const f = faltantesPlan(plan, asigs, guias);
  if (completarBloqueado(plan)) return [];
  const pasos: PasoCompletar[] = [];
  for (const id of f.asignaturas) pasos.push({ id: `asig-${id}`, tipo: 'asignatura', ref: id, texto: `${nombre(id)}: criterios y campos` });
  for (const id of f.entregables) pasos.push({ id: `ent-${id}`, tipo: 'entregable', ref: id, texto: `${nombre(id)}: entregable y fecha` });
  for (const id of f.fechas) pasos.push({ id: `fec-${id}`, tipo: 'fecha', ref: id, texto: `${nombre(id)}: fecha del entregable` });
  for (const id of f.ejes) { const g = guias.find(x => x.id === id)!; pasos.push({ id: `eje-${id}`, tipo: 'eje', ref: id, texto: `${etiquetaGuia(g)}: pregunta orientadora` }); }
  const pend = guias.filter(g => !g.aprobada);
  for (const g of pend) {
    const e = etiquetaGuia(g);
    if (!g.propuesta) {
      if (vacio(g.pedido?.tematicas) || vacio(g.pedido?.competencias)) pasos.push({ id: `ped-${g.id}`, tipo: 'pedido', ref: g.id, texto: `${e}: temáticas y competencias` });
      pasos.push({ id: `prop-${g.id}`, tipo: 'propuesta', ref: g.id, texto: `${e}: guía con IA` });
    }
    if (esGuiaIntegrable(plan, g) && !g.propuesta?.integrada) pasos.push({ id: `int-${g.id}`, tipo: 'integrar', ref: g.id, texto: `${e}: integrar entregas` });
  }
  for (const g of pend) pasos.push({ id: `apr-${g.id}`, tipo: 'aprobar', ref: g.id, texto: `${etiquetaGuia(g)}: aprobar y publicar` });
  return pasos;
}

// ── Armar la guía aprobada (lógica de aprobar(), compartida) ──────────────

export interface EntradaAprobacion {
  plan: Pick<PlanCasa, 'desde' | 'hasta' | 'topeDiario' | 'ritmo' | 'cierreEdicion'>;
  guia: Pick<GuiaPlan, 'id' | 'aprobada'>;
  borrador: Guia;
  /** Todas las guías del plan (con su `aprobada` vigente). */
  todas: Pick<GuiaPlan, 'id' | 'aprobada'>[];
  propias: AsignaturaPlan[];
  nombre: (id: string) => string;
  hoy: FechaISO;
}

export interface ResultadoAprobacion {
  aprobada: Guia;
  /** Pasos reprogramados (guiaId → pasos), incluye otras guías ya aprobadas. */
  repartidas: Record<string, PasoGuia[]>;
  avisos: string[];
  protegidos: number;
  cambio: boolean;
}

/** Calcula la guía aprobada y el reparto de fechas (misma lógica que «Aprobar y publicar»). No escribe nada. */
export function armarAprobacion(e: EntradaAprobacion): ResultadoAprobacion {
  const { plan, guia, borrador, todas, propias, nombre, hoy } = e;
  const otras = todas.filter(x => x.id !== guia.id && x.aprobada).map(x => ({ guiaId: x.id, pasos: x.aprobada!.pasos }));
  // Los entregables que cada docente puso en su asignatura (pueden haber llegado después de generar).
  const base = conEntregables(borrador, propias, nombre, plan.desde);
  const { pasos: rep, avisos } = repartirTodas({ ...plan, ritmo: plan.ritmo ?? 'diario' }, [...otras, { guiaId: guia.id, pasos: base.pasos }]);
  let aprobada: Guia = { ...base, pasos: rep[guia.id] ?? base.pasos };
  let protegidos = 0;
  // Pasada la fecha de cierre, lo que ya ocurrió (fecha anterior a mañana) no se toca.
  if (hoy > fechaCierre(plan)) {
    const pr = protegerPasosPasados(aprobada.pasos, guia.aprobada?.pasos, addDias(hoy, 1));
    aprobada = { ...aprobada, pasos: pr.pasos }; protegidos = pr.restaurados;
  }
  const cambio = !guia.aprobada || JSON.stringify(guia.aprobada) !== JSON.stringify(aprobada);
  return { aprobada, repartidas: rep, avisos, protegidos, cambio };
}

/** Error legible si el borrador no se puede aprobar; null si está bien. */
export function errorDeBorrador(b: Guia | null | undefined): string | null {
  if (!b) return 'Primero genere la guía.';
  if (!b.pasos.length || b.pasos.some(p => !p.titulo.trim())) return 'Cada paso necesita un título.';
  return null;
}
