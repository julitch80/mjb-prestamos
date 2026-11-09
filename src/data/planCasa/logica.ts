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
/** Una entrega que el reparto movió de la fecha sugerida por el docente a otra con cupo. */
export interface Reacomodo { guiaId: string; pasoId: string; asignaturaId?: string; sugerida: FechaISO; final: FechaISO }
export interface ResultadoReparto {
  asignaturas: EntradaReparto[];
  /** Avisos legibles: pasos que no caben antes de `hasta`. */
  avisos: string[];
  /** Entregas cuya fecha final difiere de la sugerida (para avisar al docente). */
  reacomodos: Reacomodo[];
}

/** ¿Es un paso de entrega (parcial, integrada o entregable de una asignatura)? */
export const esPasoEntrega = (p: Pick<PasoGuia, 'id' | 'esEntregaParcial' | 'componentes'>): boolean =>
  !!p.esEntregaParcial || !!p.componentes?.length || p.id.startsWith('ent-');

/** Días cuya suma de momentos supera el tope. Medición pura: recibe pasos de todas las guías aprobadas. */
export function diasSobreTope(pasos: Pick<PasoGuia, 'fecha' | 'momentos'>[], topeDiario: number): { fecha: FechaISO; carga: number }[] {
  const carga = new Map<FechaISO, number>();
  for (const p of pasos) if (p.fecha) carga.set(p.fecha, (carga.get(p.fecha) ?? 0) + p.momentos);
  return [...carga.entries()].filter(([, c]) => c > topeDiario).map(([fecha, c]) => ({ fecha, carga: c })).sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
}

/** Día en que se pueden asignar pasos: lunes a viernes, sin festivo ni receso. */
export function esDiaDePlan(f: FechaISO): boolean {
  return esDiaLectivo(f, SEMILLA_2026);
}

/**
 * Asigna `fecha` a cada paso. Respeta las fechas ya fijadas de los pasos que NO son entrega (las
 * reserva); la fecha de un paso de entrega es solo una SUGERENCIA: se coloca en el día hábil más
 * cercano con cupo (preferiblemente sin otra entrega ese día y no antes de los pasos que la preparan)
 * y, si difiere, se reporta en `reacomodos`. No supera `topeDiario` momentos por día sumando materias, intercala materias por turnos
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
  // Las entregas con fecha FUTURA son sugerencias: no reservan día de antemano (se colocan al final). Lo ya ocurrido (hasta hoy) no se mueve.
  for (const a of asignaturas) for (const p of a.pasos) if (p.fecha && (!esPasoEntrega(p) || p.fecha <= hoy)) sumar(p.fecha, p.momentos);

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
  // Si la guía se pensó para más semanas de las que tiene el periodo (p. ej. 4 semanas en 3),
  // se comprimen sus semanas en proporción para que nada quede por fuera.
  const W = semanaIdx.length ? semanaIdx[semanaIdx.length - 1] : 0;
  for (const cola of colas) {
    const maxK = Math.max(0, ...cola.map(p => Number(p.semana)).filter(k => Number.isFinite(k)));
    if (W >= 1 && maxK > W) for (const p of cola) {
      const k = Number(p.semana);
      if (Number.isFinite(k) && k >= 1) p.semana = Math.max(1, Math.ceil((k * W) / maxK));
    }
  }
  const sugeridas = salida.flatMap((a, gi) => a.pasos.map((p, pi) => ({ gi, pi, p })).filter(x => x.p.fecha && x.p.fecha > hoy && esPasoEntrega(x.p)))
    .map(x => ({ ...x, sugerida: x.p.fecha! }));
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
    // Sin cupo después del último paso de su guía: se busca cualquier día con cupo antes que dejarlo sin fecha.
    if (d >= dias.length) { const j = dias.findIndex((_, x) => libre(x)); if (j >= 0) d = j; }
    if (d >= dias.length) {
      noCabe.push(`${salida[i].guiaId}: «${paso.titulo}»`);
      desdeDia[i] = dias.length; // los siguientes de esa materia tampoco caben (orden)
      continue;
    }
    paso.fecha = dias[d];
    sumar(dias[d], paso.momentos);
    desdeDia[i] = d;
  }

  // Entregas con fecha sugerida: día hábil más cercano con cupo, una entrega por día si se puede.
  const reacomodos: Reacomodo[] = [];
  const diaEntrega = new Set<FechaISO>();
  const sinCupo: string[] = [];
  sugeridas.sort((x, y) => (x.sugerida < y.sugerida ? -1 : x.sugerida > y.sugerida ? 1 : x.gi - y.gi || x.pi - y.pi));
  for (const { gi, pi, p, sugerida } of sugeridas) {
    const pasos = salida[gi].pasos;
    // Piso blando: no antes de los pasos previos de su guía que la preparan (misma semana o anterior).
    let piso = '';
    for (let k = 0; k < pi; k++) {
      const q = pasos[k];
      if (q.fecha && (!esPasoEntrega(q) ? q.semana <= p.semana : true) && q.fecha > piso) piso = q.fecha;
    }
    let objetivo = dias.findIndex(f => f >= sugerida);
    if (objetivo < 0) objetivo = dias.length - 1;
    const elegir = (exigirSolo: boolean, conPiso: boolean): number => {
      let mejor = -1, dist = Infinity;
      for (let j = 0; j < dias.length; j++) {
        if ((carga.get(dias[j]) ?? 0) + p.momentos > topeDiario) continue;
        if (exigirSolo && diaEntrega.has(dias[j])) continue;
        if (conPiso && dias[j] < piso) continue;
        const dj = Math.abs(j - objetivo);
        if (dj < dist) { dist = dj; mejor = j; }
      }
      return mejor;
    };
    let j = elegir(true, true);
    if (j < 0) j = elegir(true, false);
    if (j < 0) j = elegir(false, true);
    if (j < 0) j = elegir(false, false);
    if (j < 0) { // sin cupo en todo el periodo: se deja la fecha sugerida y se avisa
      sumar(sugerida, p.momentos); diaEntrega.add(sugerida);
      sinCupo.push(`${salida[gi].guiaId}: «${p.titulo}»`);
      continue;
    }
    p.fecha = dias[j]; sumar(dias[j], p.momentos); diaEntrega.add(dias[j]);
    if (p.fecha !== sugerida) {
      const asignaturaId = p.id.startsWith('ent-') ? p.id.slice(4) : undefined;
      reacomodos.push({ guiaId: salida[gi].guiaId, pasoId: p.id, ...(asignaturaId ? { asignaturaId } : {}), sugerida, final: p.fecha });
    }
  }
  const avisos: string[] = [];
  if (sinCupo.length) avisos.push(`${sinCupo.length} entrega(s) no encontraron un día con cupo y conservan su fecha sugerida: ${sinCupo.join('; ')}.`);
  if (noCabe.length) {
    avisos.push(`${noCabe.length} paso(s) no caben antes del ${hasta} con tope de ${topeDiario} momentos por día: ${noCabe.join('; ')}.`);
  }
  if (fueraSemana.length) {
    avisos.push(`${fueraSemana.length} paso(s) no caben en su semana y quedaron más tarde: ${fueraSemana.join('; ')}.`);
  }
  return { asignaturas: salida, avisos, reacomodos };
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

/**
 * Token de 43 caracteres solo con letras y números (sin «-» ni «_»): WhatsApp usa «_» para la
 * cursiva y dañaba los enlaces al reenviarlos.
 */
export function nuevoToken(): string {
  const abc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const b = new Uint8Array(43);
  globalThis.crypto.getRandomValues(b);
  let s = '';
  for (const x of b) s += abc[x % abc.length];
  return s;
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
export function fechaCierre(plan: Pick<PlanCasa, 'desde' | 'cierreEdicion' | 'enEspera'> & Partial<Pick<PlanCasa, 'cierreHora'>>): FechaISO {
  let cierre: FechaISO;
  if (plan.cierreEdicion) cierre = plan.cierreEdicion;
  else {
    let f = addDias(plan.desde, -1);
    for (let i = 0; i < 20 && !esDiaHabil(f); i++) f = addDias(f, -1);
    cierre = f;
  }
  // Caso «en espera» (ingresó tarde): el cierre efectivo es el mayor entre el cierre y el plazo.
  return plan.enEspera?.hasta && plan.enEspera.hasta > cierre ? plan.enEspera.hasta : cierre;
}

/** Hora límite del último día, si coordinación la fijó y ese día es el cierre efectivo. */
export function horaCierre(plan: Pick<PlanCasa, 'desde' | 'cierreEdicion' | 'cierreHora' | 'enEspera'>): string | null {
  return plan.cierreEdicion && plan.cierreHora && fechaCierre(plan) === plan.cierreEdicion ? plan.cierreHora : null;
}

/** Hora local 'HH:MM'. */
export function horaLocal(d = new Date()): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * Tope diario que hace caber el trabajo: momentos totales de las guías aprobadas repartidos en
 * los días de trabajo que quedan del periodo (desde mañana o desde el inicio, según ritmo).
 */
export function topeNecesario(plan: Pick<PlanCasa, 'desde' | 'hasta' | 'ritmo'>, momentosTotales: number, hoy: FechaISO): { tope: number; dias: number } {
  let inicio = addDias(hoy, 1);
  if (plan.desde > inicio) inicio = plan.desde;
  const habiles: FechaISO[] = [];
  for (let f = inicio; f <= plan.hasta && habiles.length < 400; f = addDias(f, 1)) if (esDiaDePlan(f)) habiles.push(f);
  const dias = plan.ritmo === 'dia_por_medio' ? Math.ceil(habiles.length / 2) : habiles.length;
  return { tope: dias ? Math.ceil(momentosTotales / dias) : momentosTotales, dias };
}

/** Próximo viernes estrictamente posterior a `hoy` (plazo por defecto de la marca «en espera»). */
export function proximoViernes(hoy: FechaISO): FechaISO {
  let f = addDias(hoy, 1);
  for (let i = 0; i < 7 && parseFecha(f).getDay() !== 5; i++) f = addDias(f, 1);
  return f;
}

export interface EstadoEdicion {
  abierta: boolean;
  motivo: 'antes_cierre' | 'autorizada' | 'cerrada';
  /** Último día editable (cierre o fin de la autorización). En 'cerrada' es el último que estuvo abierto. */
  hasta: FechaISO;
  /** Hora límite de `hasta` ('HH:MM'), si coordinación la fijó. */
  hora?: string;
}

/** ¿Se puede corregir la guía hoy? `hoy` en 'YYYY-MM-DD'. El último día cuenta completo, salvo que haya hora límite y `hora` ya la pasó. */
export function estadoEdicion(
  plan: Pick<PlanCasa, 'desde' | 'cierreEdicion' | 'cierreHora' | 'enEspera'>, guia: Pick<GuiaPlan, 'autorizacion'> | undefined, hoy: FechaISO, hora?: string,
): EstadoEdicion {
  const cierre = fechaCierre(plan);
  const hc = horaCierre(plan);
  const pasoLaHora = hoy === cierre && !!hc && !!hora && hora >= hc;
  const h = hc ? { hora: hc } : {};
  if (hoy <= cierre && !pasoLaHora) return { abierta: true, motivo: 'antes_cierre', hasta: cierre, ...h };
  const aut = guia?.autorizacion;
  if (aut?.hasta && hoy <= aut.hasta) return { abierta: true, motivo: 'autorizada', hasta: aut.hasta };
  return aut?.hasta && aut.hasta > cierre ? { abierta: false, motivo: 'cerrada', hasta: aut.hasta } : { abierta: false, motivo: 'cerrada', hasta: cierre, ...h };
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
