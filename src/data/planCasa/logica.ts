// Lógica pura del plan de trabajo en casa (sin Firebase ni React).
import { ASIGNACION_2026 } from '../asignacionAcademica';
import { esDiaLectivo } from '../calendarioAcademico/logica';
import { SEMILLA_2026 } from '../calendarioAcademico/semilla2026';
import { addDias, esDiaHabil, parseFecha } from '../tareas/calendario';
import type {
  AsignaturaPlan, FechaISO, GuiaPlan, PasoGuia, PlanCasa, PlanPublico, RitmoPlan, Sustentacion,
} from './tipos';
import { AJUSTE_SIN_TECNOLOGIA } from './tipos';

/** Número de semanas (lunes a domingo) que toca el periodo: una entrega parcial por semana. */
export function semanasDelPeriodo(desde: FechaISO, hasta: FechaISO): number {
  if (!desde || !hasta || hasta < desde) return 1;
  const lunes = addDias(desde, -((parseFecha(desde).getDay() + 6) % 7));
  const dias = Math.round((parseFecha(hasta).getTime() - parseFecha(lunes).getTime()) / 86400000);
  return Math.floor(dias / 7) + 1;
}

export interface EntradaReparto { guiaId: string; pasos: PasoGuia[] }
export interface ResultadoReparto {
  asignaturas: EntradaReparto[];
  /** Avisos legibles: pasos que no caben antes de `hasta`. */
  avisos: string[];
}

/** Día en que se pueden asignar pasos: lunes a viernes, sin festivo ni receso. */
export function esDiaDePlan(f: FechaISO): boolean {
  return esDiaLectivo(f, SEMILLA_2026);
}

/**
 * Asigna `fecha` a cada paso. Respeta las fechas ya fijadas por el docente (las reserva),
 * no supera `topeDiario` momentos por día sumando materias, intercala materias por turnos
 * y mantiene el orden dentro de cada una. Nada antes de max(desde, día siguiente a hoy).
 * Con ritmo 'dia_por_medio' solo se usa un día hábil de cada dos. Un paso con `semana` k se
 * ubica dentro de la semana k del plan (la k-ésima semana lunes-domingo desde `desde`)
 * cuando cabe; si no, se coloca después y se avisa.
 */
export function repartirPasos(
  asignaturas: EntradaReparto[], desde: FechaISO, hasta: FechaISO, topeDiario: number, hoy: FechaISO,
  ritmo: RitmoPlan = 'diario',
): ResultadoReparto {
  const carga = new Map<FechaISO, number>();
  const sumar = (f: FechaISO, m: number) => carga.set(f, (carga.get(f) ?? 0) + m);
  for (const a of asignaturas) for (const p of a.pasos) if (p.fecha) sumar(p.fecha, p.momentos);

  let inicio = addDias(hoy, 1);
  if (desde > inicio) inicio = desde;
  const lunes0 = addDias(desde, -((parseFecha(desde).getDay() + 6) % 7));
  const semanaDe = (f: FechaISO) => Math.floor(Math.round((parseFecha(f).getTime() - parseFecha(lunes0).getTime()) / 86400000) / 7) + 1;
  const habiles: FechaISO[] = [];
  for (let f = inicio; f <= hasta; f = addDias(f, 1)) if (esDiaDePlan(f)) habiles.push(f);
  const dias = ritmo === 'dia_por_medio' ? habiles.filter((_, i) => i % 2 === 0) : habiles;
  const semanaIdx = dias.map(semanaDe);

  const salida: EntradaReparto[] = asignaturas.map(a => ({
    guiaId: a.guiaId, pasos: a.pasos.map(p => ({ ...p })),
  }));
  const colas = salida.map(a => a.pasos.filter(p => !p.fecha));
  const desdeDia = salida.map(() => 0); // índice mínimo de día por materia (conserva el orden)
  const noCabe: string[] = [];
  const fueraSemana: string[] = [];

  let turno = 0;
  while (colas.some(c => c.length > 0)) {
    const i = turno % colas.length;
    turno++;
    const cola = colas[i];
    if (cola.length === 0) continue;
    const paso = cola.shift()!;
    const libre = (j: number) => (carga.get(dias[j]) ?? 0) + paso.momentos <= topeDiario;
    let d = desdeDia[i];
    const k = Number(paso.semana);
    if (Number.isFinite(k) && k >= 1) {
      let j = d;
      while (j < dias.length && semanaIdx[j] < k) j++;
      while (j < dias.length && semanaIdx[j] === k && !libre(j)) j++;
      if (j < dias.length && semanaIdx[j] === k) d = j;
      else {
        while (d < dias.length && !libre(d)) d++;
        if (d < dias.length) fueraSemana.push(`${salida[i].guiaId}: «${paso.titulo}» (semana ${k})`);
      }
    } else {
      while (d < dias.length && !libre(d)) d++;
    }
    if (d >= dias.length) {
      noCabe.push(`${salida[i].guiaId}: «${paso.titulo}»`);
      desdeDia[i] = dias.length; // los siguientes de esa materia tampoco caben (orden)
      continue;
    }
    paso.fecha = dias[d];
    sumar(dias[d], paso.momentos);
    desdeDia[i] = d;
  }
  const avisos: string[] = [];
  if (noCabe.length) {
    avisos.push(`${noCabe.length} paso(s) no caben antes del ${hasta} con tope de ${topeDiario} momentos por día: ${noCabe.join('; ')}.`);
  }
  if (fueraSemana.length) {
    avisos.push(`${fueraSemana.length} paso(s) no caben en su semana y quedaron más tarde: ${fueraSemana.join('; ')}.`);
  }
  return { asignaturas: salida, avisos };
}

export interface PasoPublicoItem extends PasoGuia { asignatura: string; docente: string }

export function agendaDelDia(publico: PlanPublico, fecha: FechaISO): PasoPublicoItem[] {
  return publico.pasos.filter(p => p.fecha === fecha);
}

/** Próximas `n` entregas desde `hoy` (incluido), ordenadas por fecha. */
export function proximasEntregas(publico: PlanPublico, hoy: FechaISO, n: number): PasoPublicoItem[] {
  return publico.pasos
    .filter(p => p.fecha && p.fecha >= hoy)
    .sort((a, b) => (a.fecha! < b.fecha! ? -1 : a.fecha! > b.fecha! ? 1 : 0))
    .slice(0, n);
}

/** Porcentaje (0–100) de pasos de la guía aprobada entregados o revisados. */
export function progresoGuia(g: GuiaPlan): number {
  const pasos = g.aprobada?.pasos ?? [];
  if (pasos.length === 0) return 0;
  const hechos = pasos.filter(p => {
    const e = g.seguimiento?.[p.id]?.estado;
    return e === 'entregado' || e === 'revisado';
  }).length;
  return Math.round((hechos / pasos.length) * 100);
}

/** El avance de una asignatura es el de la guía que la cubre. */
export function guiaDeAsignatura(asignaturaId: string, guias: GuiaPlan[]): GuiaPlan | undefined {
  return guias.find(g => g.asignaturaIds.includes(asignaturaId));
}
export function progresoAsignatura(asignaturaId: string, guias: GuiaPlan[]): number {
  const g = guiaDeAsignatura(asignaturaId, guias);
  return g ? progresoGuia(g) : 0;
}

export interface FilaTablero {
  asignaturaId: string;
  nombre: string;
  docenteId: string;
  criteriosPuestos: boolean;
  guiaId: string | null;
  guiaAprobada: boolean;
  progreso: number;
  sustentacion: GuiaPlan['sustentacionEstado'] | null;
}
export interface FilaTableroGuia {
  guiaId: string;
  eje: string;
  asignaturas: string[];
  vistosBuenos: number;
  docentes: number;
  guiaAprobada: boolean;
  progreso: number;
  sustentacion: GuiaPlan['sustentacionEstado'];
}

export function resumenTablero(
  _plan: PlanCasa, asignaturas: AsignaturaPlan[], guias: GuiaPlan[], nombresAsignatura: Record<string, string> = {},
): { porAsignatura: FilaTablero[]; porGuia: FilaTableroGuia[] } {
  const nom = (id: string) => nombresAsignatura[id] ?? id;
  return {
    porAsignatura: asignaturas.map(a => {
      const g = guiaDeAsignatura(a.asignaturaId, guias);
      return {
        asignaturaId: a.asignaturaId, nombre: nom(a.asignaturaId), docenteId: a.docenteId,
        criteriosPuestos: a.criteriosPromocion.trim().length > 0,
        guiaId: g?.id ?? null, guiaAprobada: !!g?.aprobada,
        progreso: g ? progresoGuia(g) : 0, sustentacion: g?.sustentacionEstado ?? null,
      };
    }),
    porGuia: guias.map(g => ({
      guiaId: g.id, eje: g.eje, asignaturas: g.asignaturaIds.map(nom),
      vistosBuenos: g.docentesCorreos.filter(c => g.vistosBuenos?.[c]).length,
      docentes: g.docentesCorreos.length, guiaAprobada: !!g.aprobada,
      progreso: progresoGuia(g), sustentacion: g.sustentacionEstado,
    })),
  };
}

/** Etiqueta pública: nombre de la asignatura, o eje (asignaturas) si es transversal. */
export function etiquetaGuia(g: GuiaPlan, plan: PlanCasa, nombresAsignatura: Record<string, string>): string {
  const nombres = g.asignaturaIds.map(id => nombresAsignatura[id] ?? id);
  if (plan.modalidad === 'transversal') return g.eje.trim() ? `${g.eje} (${nombres.join(' · ')})` : nombres.join(' · ');
  return nombres[0] ?? g.eje;
}

/** Copia pública: solo primer nombre; sin apellidos, motivo ni ajustes. `nombresDocente` va por correo. */
export function aPublico(
  plan: PlanCasa, guias: GuiaPlan[],
  nombresAsignatura: Record<string, string>, nombresDocente: Record<string, string>,
  ahora: number = Date.now(),
): PlanPublico {
  const pasos: PlanPublico['pasos'] = [];
  const sustentaciones: PlanPublico['sustentaciones'] = [];
  for (const g of guias) {
    if (!g.aprobada) continue;
    const asignatura = etiquetaGuia(g, plan, nombresAsignatura);
    const docente = nombresDocente[g.responsableCorreo] ?? g.responsableCorreo;
    for (const p of g.aprobada.pasos) pasos.push({ ...p, asignatura, docente });
    const s: Sustentacion = g.aprobada.sustentacion;
    if (s) sustentaciones.push({ ...s, asignatura, docente });
  }
  return {
    primerNombre: plan.nombres.trim().split(/\s+/)[0] || '',
    grupo: plan.grupo, desde: plan.desde, hasta: plan.hasta,
    pasos, sustentaciones, actualizadoEn: ahora,
  };
}

/** Una guía por asignatura (modalidad por_asignatura); id de guía = asignaturaId. */
export function guiasIniciales(plan: PlanCasa, asignaturas: AsignaturaPlan[], ahora: number = Date.now()): GuiaPlan[] {
  if (plan.modalidad !== 'por_asignatura') return [];
  return asignaturas.map(a => ({
    id: a.asignaturaId, asignaturaIds: [a.asignaturaId], eje: a.asignaturaId,
    responsableCorreo: a.docenteCorreo, docentesCorreos: [a.docenteCorreo],
    vistosBuenos: {}, seguimiento: {}, sustentacionEstado: 'sin_citar' as const, actualizadoEn: ahora,
  }));
}

/** Docente por asignatura del grupo según la asignación 2026 (sin Centro de Interés). */
export function docentesDelGrupo(grupo: string): { asignaturaId: string; docenteId: string }[] {
  const vistos = new Set<string>();
  const out: { asignaturaId: string; docenteId: string }[] = [];
  for (const e of ASIGNACION_2026) {
    if (e.grupo !== grupo || e.asignaturaId === 'ci') continue;
    const k = `${e.asignaturaId}|${e.docenteId}`;
    if (vistos.has(k)) continue;
    vistos.add(k);
    out.push({ asignaturaId: e.asignaturaId, docenteId: e.docenteId });
  }
  return out;
}

/** Token de 43 caracteres url-safe (32 bytes aleatorios). */
export function nuevoToken(): string {
  const b = new Uint8Array(32);
  globalThis.crypto.getRandomValues(b);
  let s = '';
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Mantiene sincronizados la bandera «sin tecnología» y el ajuste del mismo nombre. */
export function conSinTecnologia(ajustes: string[], valor: boolean): { sinTecnologia: boolean; ajustes: string[] } {
  const sin = ajustes.filter(a => a !== AJUSTE_SIN_TECNOLOGIA);
  return { sinTecnologia: valor, ajustes: valor ? [AJUSTE_SIN_TECNOLOGIA, ...sin] : sin };
}

// ── Corrección hasta la fecha de cierre ──────────────────────────────────

/**
 * Último día (inclusive) para corregir las guías: `plan.cierreEdicion` si coordinación la fijó;
 * si no, el último día hábil (lunes a viernes, sin festivo colombiano) ANTES de `plan.desde`.
 */
export function fechaCierre(plan: Pick<PlanCasa, 'desde' | 'cierreEdicion'>): FechaISO {
  if (plan.cierreEdicion) return plan.cierreEdicion;
  let f = addDias(plan.desde, -1);
  for (let i = 0; i < 20 && !esDiaHabil(f); i++) f = addDias(f, -1);
  return f;
}

export interface EstadoEdicion {
  abierta: boolean;
  motivo: 'antes_cierre' | 'autorizada' | 'cerrada';
  /** Último día editable (cierre o fin de la autorización). En 'cerrada' es el último que estuvo abierto. */
  hasta: FechaISO;
}

/** ¿Se puede corregir la guía hoy? `hoy` en 'YYYY-MM-DD'. El último día cuenta completo. */
export function estadoEdicion(
  plan: Pick<PlanCasa, 'desde' | 'cierreEdicion'>, guia: Pick<GuiaPlan, 'autorizacion'> | undefined, hoy: FechaISO,
): EstadoEdicion {
  const cierre = fechaCierre(plan);
  if (hoy <= cierre) return { abierta: true, motivo: 'antes_cierre', hasta: cierre };
  const aut = guia?.autorizacion;
  if (aut?.hasta && hoy <= aut.hasta) return { abierta: true, motivo: 'autorizada', hasta: aut.hasta };
  return { abierta: false, motivo: 'cerrada', hasta: aut?.hasta && aut.hasta > cierre ? aut.hasta : cierre };
}

/** Días completos entre dos fechas ISO (b - a). */
export function diasEntre(a: FechaISO, b: FechaISO): number {
  return Math.round((parseFecha(b).getTime() - parseFecha(a).getTime()) / 86400000);
}

/** Ids de asignaturas cuyos datos cambiaron DESPUÉS de que el líder guardó la propuesta. */
export function asignaturasCambiadas(
  guia: Pick<GuiaPlan, 'propuestaEn' | 'propuesta' | 'asignaturaIds'> & { aprobadaEn?: number; actualizadoEn?: number }, asigs: Pick<AsignaturaPlan, 'asignaturaId' | 'actualizadoEn'>[],
): string[] {
  // Guías generadas antes del 28-oct no traen propuestaEn: se usa la última escritura conocida.
  const t = guia.propuestaEn ?? guia.aprobadaEn ?? guia.actualizadoEn;
  if (!guia.propuesta || !t) return [];
  return guia.asignaturaIds.filter(id => (asigs.find(a => a.asignaturaId === id)?.actualizadoEn ?? 0) > t);
}

/**
 * Tras el cierre, los pasos con fecha anterior a `manana` ya ocurrieron: se conservan tal como
 * estaban en la versión aprobada previa. Devuelve los pasos resultantes y cuántos se restauraron.
 */
export function protegerPasosPasados(nuevos: PasoGuia[], previos: PasoGuia[] | undefined, manana: FechaISO): { pasos: PasoGuia[]; restaurados: number } {
  const pasados = (previos ?? []).filter(p => p.fecha && p.fecha < manana);
  if (!pasados.length) return { pasos: nuevos, restaurados: 0 };
  const porId = new Map(pasados.map(p => [p.id, p]));
  let restaurados = 0;
  const vistos = new Set<string>();
  const pasos = nuevos.map(p => {
    const q = porId.get(p.id);
    if (!q) return p;
    vistos.add(p.id);
    if (JSON.stringify(q) !== JSON.stringify(p)) restaurados++;
    return q;
  });
  const faltan = pasados.filter(p => !vistos.has(p.id));
  restaurados += faltan.length;
  return { pasos: [...faltan, ...pasos], restaurados };
}
