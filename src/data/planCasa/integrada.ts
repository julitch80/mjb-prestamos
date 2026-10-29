// Guías integradas (Plan Académico Especial): lógica PURA compartida por la app y por la función
// `planCasaIntegrarGuia`. Una guía integrada tiene UNA entrega parcial por semana que fusiona los
// entregables de los docentes; cada asignatura aparece como «componente» de esa entrega.
import { addDias, esDiaHabil, parseFecha } from '../tareas/calendario';
import type {
  ComponenteEntrega, EstadoPaso, FechaISO, Guia, GuiaPlan, PasoGuia, PlanCasa, RitmoPlan, SeguimientoPaso,
} from './tipos';

/** ¿La guía integra varias asignaturas (o el plan es transversal)? Solo esas se pueden «integrar». */
export function esGuiaIntegrable(plan: Pick<PlanCasa, 'modalidad'>, g: Pick<GuiaPlan, 'asignaturaIds'>): boolean {
  return g.asignaturaIds.length > 1 || plan.modalidad === 'transversal';
}

const lunesDe = (f: FechaISO): FechaISO => addDias(f, -((parseFecha(f).getDay() + 6) % 7));

/** Semanas (lunes a domingo) que toca el periodo; igual que `semanasDelPeriodo` de logica.ts. */
export function nSemanas(desde: FechaISO, hasta: FechaISO): number {
  if (!desde || !hasta || hasta < desde) return 1;
  const dias = Math.round((parseFecha(hasta).getTime() - parseFecha(lunesDe(desde)).getTime()) / 86400000);
  return Math.floor(dias / 7) + 1;
}

/** Número de semana (1..n) de una fecha dentro del periodo; 0 si cae fuera de desde..hasta. */
export function semanaDeFecha(desde: FechaISO, hasta: FechaISO, f: FechaISO): number {
  if (!f || f < desde || f > hasta) return 0;
  return Math.floor(Math.round((parseFecha(f).getTime() - parseFecha(lunesDe(desde)).getTime()) / 86400000) / 7) + 1;
}

/** Días hábiles (lun-vie, no festivo) de cada semana del periodo, recortados a desde..hasta. */
export function diasHabilesPorSemana(desde: FechaISO, hasta: FechaISO): FechaISO[][] {
  const n = nSemanas(desde, hasta);
  const sem: FechaISO[][] = Array.from({ length: n }, () => []);
  for (let f = desde; f <= hasta; f = addDias(f, 1)) {
    if (!esDiaHabil(f)) continue;
    const k = semanaDeFecha(desde, hasta, f);
    if (k >= 1 && k <= n) sem[k - 1].push(f);
  }
  return sem;
}

const topeN = (t: number) => (Number.isFinite(t) && t >= 1 ? Math.min(Math.round(t), 8) : 4);

/** Momentos (25 min) que caben en cada semana: días hábiles × tope diario (la mitad, redondeada hacia arriba, si es día por medio). */
export function capacidadPorSemana(desde: FechaISO, hasta: FechaISO, topeDiario: number, ritmo: RitmoPlan = 'diario'): number[] {
  const t = topeN(topeDiario);
  return diasHabilesPorSemana(desde, hasta).map(d => (ritmo === 'dia_por_medio' ? Math.ceil(d.length / 2) : d.length) * t);
}

/** Suma de momentos por semana (índice 0 = semana 1). */
export function momentosPorSemana(pasos: PasoGuia[], n: number): number[] {
  const m = Array.from({ length: n }, () => 0);
  for (const p of pasos) {
    const k = Math.min(n, Math.max(1, Math.round(Number(p.semana)) || 1));
    m[k - 1] += Math.max(0, Number(p.momentos) || 0);
  }
  return m;
}

export interface AsigIntegracion {
  asignaturaId: string; nombre: string; criterios?: string; entregable?: string; fechaEntrega?: FechaISO;
}
export interface ContextoIntegracion {
  asignaturas: AsigIntegracion[]; desde: FechaISO; hasta: FechaISO; topeDiario: number; ritmo: RitmoPlan;
}

const RE_URL = /\bhttps?:\/\/\S+|\bwww\.\S+/gi;
const corto = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(RE_URL, '').replace(/\s+\n/g, '\n').trim().slice(0, max) : '');
const semanaValida = (s: unknown, n: number) => Math.min(n, Math.max(1, Math.round(Number(s)) || 1));

/** Fecha de la entrega de la semana k: la última fecha de entrega de los docentes en esa semana; si no hay, el último día hábil. */
export function fechaEntregaSemana(desde: FechaISO, hasta: FechaISO, k: number, fechasDocentes: (FechaISO | undefined)[]): FechaISO | null {
  const enSemana = fechasDocentes.filter((f): f is FechaISO => !!f && semanaDeFecha(desde, hasta, f) === k).sort();
  if (enSemana.length) return enSemana[enSemana.length - 1];
  const hab = diasHabilesPorSemana(desde, hasta)[k - 1] ?? [];
  return hab.length ? hab[hab.length - 1] : null;
}

/**
 * Valida y repara el resultado de la IA: quita los pasos sueltos `ent-*`, deja exactamente UNA
 * entrega parcial por semana (el último paso, con sus componentes), asegura que cada asignatura
 * aparezca al menos una vez, ajusta los momentos a la capacidad semanal y fija las fechas de las
 * entregas. Devuelve avisos legibles para el líder.
 */
export function validarIntegrada(guia: Guia, ctx: ContextoIntegracion): { guia: Guia; avisos: string[] } {
  const avisos: string[] = [];
  const n = nSemanas(ctx.desde, ctx.hasta);
  const asigs = new Map(ctx.asignaturas.map(a => [a.asignaturaId, a]));

  // 1. Sin pasos sueltos «Entregable de X»; semanas dentro del periodo (orden estable); componentes válidos.
  const indexados = guia.pasos.filter(p => !/^ent-/.test(p.id)).map((p, i) => ({ p, i }));
  indexados.sort((a, b) => semanaValida(a.p.semana, n) - semanaValida(b.p.semana, n) || a.i - b.i);
  const pasos: PasoGuia[] = indexados.map(({ p }) => {
    const vistos = new Set<string>();
    const comps: ComponenteEntrega[] = [];
    for (const c of p.componentes ?? []) {
      const a = asigs.get(c?.asignaturaId);
      if (!a || vistos.has(a.asignaturaId)) continue;
      vistos.add(a.asignaturaId);
      comps.push({
        asignaturaId: a.asignaturaId,
        parte: corto(c.parte, 500) || corto(a.entregable, 500) || `Aporte de ${a.nombre}`,
        queRevisar: corto(c.queRevisar, 500) || corto(a.criterios, 500) || 'Que la parte corresponda a lo pedido en la guía.',
      });
    }
    const limpio: PasoGuia = {
      ...p, semana: semanaValida(p.semana, n),
      instrucciones: corto(p.instrucciones, 3000), evidenciaDetalle: corto(p.evidenciaDetalle, 1200),
    };
    delete limpio.componentes;
    if (comps.length) limpio.componentes = comps;
    return limpio;
  });

  // 2. Una entrega por semana: el último paso con componentes o, si no hay, el último de la semana.
  const porSemana: PasoGuia[][] = Array.from({ length: n }, () => []);
  for (const p of pasos) porSemana[p.semana - 1].push(p);
  const entregas: (PasoGuia | null)[] = [];
  const ordenados: PasoGuia[] = [];
  porSemana.forEach((lista, k) => {
    if (!lista.length) { avisos.push(`La semana ${k + 1} quedó sin pasos.`); entregas.push(null); return; }
    const conComp = [...lista].reverse().find(p => p.componentes?.length);
    const e = conComp ?? lista[lista.length - 1];
    const previos = lista.filter(p => p !== e).map(p => { const q = { ...p, esEntregaParcial: false }; delete q.componentes; return q; });
    e.esEntregaParcial = true;
    if (!e.componentes?.length) avisos.push(`La entrega de la semana ${k + 1} no trae partes por asignatura.`);
    ordenados.push(...previos, e);
    entregas.push(e);
  });

  // 3. Cada asignatura en al menos un componente.
  const presentes = new Set(ordenados.flatMap(p => (p.componentes ?? []).map(c => c.asignaturaId)));
  for (const a of ctx.asignaturas) {
    if (presentes.has(a.asignaturaId)) continue;
    const k = semanaDeFecha(ctx.desde, ctx.hasta, a.fechaEntrega ?? '');
    const destino = (k >= 1 ? entregas[k - 1] : null) ?? [...entregas].reverse().find((e): e is PasoGuia => !!e);
    if (!destino) continue;
    destino.componentes = [...(destino.componentes ?? []), {
      asignaturaId: a.asignaturaId,
      parte: corto(a.entregable, 500) || `Aporte de ${a.nombre}`,
      queRevisar: corto(a.criterios, 500) || 'Que la parte corresponda a lo pedido en la guía.',
    }];
    avisos.push(`La IA no incluyó ${a.nombre}: se agregó su entregable a la entrega de la semana ${destino.semana}.`);
  }

  // 4. Capacidad semanal: bajar momentos de los pasos previos; si aún sobra, fundir pasos previos.
  const cap = capacidadPorSemana(ctx.desde, ctx.hasta, ctx.topeDiario, ctx.ritmo);
  let final = ordenados;
  for (let k = 1; k <= n; k++) {
    const total = () => final.filter(p => p.semana === k).reduce((s, p) => s + p.momentos, 0);
    const c = cap[k - 1] ?? 0;
    if (total() <= c) continue;
    const previos = () => final.filter(p => p.semana === k && !p.esEntregaParcial);
    let ajustado = false;
    while (total() > c) {
      const mayor = [...previos()].sort((a, b) => b.momentos - a.momentos)[0];
      if (!mayor || mayor.momentos <= 1) break;
      mayor.momentos -= 1; ajustado = true;
    }
    while (total() > c && previos().length > 1) {
      const [a, b] = previos();
      b.titulo = `${a.titulo} + ${b.titulo}`.slice(0, 300);
      b.instrucciones = `${a.instrucciones}\n${b.instrucciones}`.slice(0, 3000);
      if (a.lectura || b.lectura) b.lectura = [a.lectura, b.lectura].filter(Boolean).join('\n\n').slice(0, 4000);
      b.momentos = Math.max(1, Math.min(4, Math.max(a.momentos, b.momentos)));
      final = final.filter(p => p !== a); ajustado = true;
    }
    const e = final.find(p => p.semana === k && p.esEntregaParcial);
    if (total() > c && e && e.momentos > 1) { e.momentos = 1; ajustado = true; }
    if (ajustado) avisos.push(`La semana ${k} excedía el tiempo diario de la UAI (${c} momentos disponibles); se redujo y fundió el trabajo previo.`);
    if (total() > c) avisos.push(`La semana ${k} sigue pasándose del tiempo disponible (${total()} de ${c} momentos). Revise esa semana.`);
  }

  // 5. Fechas: solo las entregas llevan fecha; el reparto asigna las demás al aprobar.
  const fechas = ctx.asignaturas.map(a => a.fechaEntrega);
  final = final.map(p => (p.esEntregaParcial
    ? { ...p, fecha: fechaEntregaSemana(ctx.desde, ctx.hasta, p.semana, fechas) }
    : { ...p, fecha: null }));
  final = final.map((p, i) => ({ ...p, id: `p${i + 1}` }));

  return { guia: { ...guia, pasos: final, integrada: true }, avisos };
}

// ── Revisión por asignatura (seguimiento) ─────────────────────────────────

/** Componentes cuya asignatura aún no marcó «Revisé mi parte». */
export function faltanPorRevisar(p: PasoGuia, seg: SeguimientoPaso | undefined): ComponenteEntrega[] {
  return (p.componentes ?? []).filter(c => !seg?.porAsignatura?.[c.asignaturaId]?.revisado);
}

export function revisionCompleta(p: PasoGuia, seg: SeguimientoPaso | undefined): boolean {
  return (p.componentes?.length ?? 0) > 0 && faltanPorRevisar(p, seg).length === 0;
}

/** Estado del paso tras una revisión: «revisado» cuando todas las asignaturas revisaron; si deja de estarlo, vuelve a entregado/pendiente. */
export function estadoTrasRevision(previo: SeguimientoPaso | undefined, completo: boolean): EstadoPaso {
  if (completo) return 'revisado';
  if (previo?.estado === 'revisado') return previo.entregadoEn ? 'entregado' : 'pendiente';
  return previo?.estado ?? 'pendiente';
}
