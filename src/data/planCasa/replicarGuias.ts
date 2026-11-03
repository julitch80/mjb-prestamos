// «Replicar guías a otro estudiante» (coordinación): copia las guías de un caso a otro muy parecido
// del MISMO grado y las aprueba con las fechas del caso destino. No usa IA ni copia datos personales:
// solo lo pedagógico (criterios, entregables, pedido y guía). Nunca pisa lo que el destino ya tenga.
import { addDias, parseFecha } from '../tareas/calendario';
import type { AsignaturaPlan, FechaISO, Guia, GuiaPlan, PlanCasa } from './tipos';
import { gradoDeGrupo } from './completarPlan';
import { aprobarBorrador } from './completarConIA';
import { correoActual, guardarAsignatura, guardarGuia, publicarPlan } from './persistencia';

type NombreFn = (id: string) => string;
type PlanMin = Pick<PlanCasa, 'id' | 'grupo' | 'modalidad' | 'estado' | 'desde' | 'hasta'>;

/** Por qué no se puede replicar de `origen` a `destino`; null si se puede. */
export function errorReplicar(origen: PlanMin, destino: PlanMin): string | null {
  if (origen.id === destino.id) return 'Elija otro estudiante.';
  if (gradoDeGrupo(origen.grupo) !== gradoDeGrupo(destino.grupo)) return 'Solo se puede replicar entre estudiantes del mismo grado.';
  if (origen.modalidad !== destino.modalidad) return 'Los dos planes deben tener la misma modalidad (por asignatura o transversal).';
  if (destino.estado === 'cerrado') return 'El plan destino está cerrado.';
  return null;
}

/** Planes a los que se puede replicar desde `origen` (mismo grado, activos). */
export function destinosPosibles<T extends PlanMin>(origen: PlanMin, planes: T[]): T[] {
  return planes.filter(p => !errorReplicar(origen, p));
}

/**
 * Empareja cada guía del destino con la del origen que comparte MÁS asignaturas (los grupos de un
 * mismo grado pueden agrupar las áreas distinto, p. ej. Religiosa en otra guía). Empate: la de menos diferencias.
 * Solo se usan guías del origen que tengan contenido (aprobada o propuesta).
 */
export function emparejarGuias(origen: GuiaPlan[], destino: GuiaPlan[]): { o: GuiaPlan; d: GuiaPlan; exacta: boolean }[] {
  const conContenido = origen.filter(g => g.aprobada || g.propuesta);
  return destino.flatMap(d => {
    let mejor: { o: GuiaPlan; comunes: number; dif: number } | null = null;
    for (const o of conContenido) {
      const comunes = d.asignaturaIds.filter(id => o.asignaturaIds.includes(id)).length;
      if (!comunes) continue;
      const dif = d.asignaturaIds.length + o.asignaturaIds.length - 2 * comunes;
      if (!mejor || comunes > mejor.comunes || (comunes === mejor.comunes && dif < mejor.dif)) mejor = { o, comunes, dif };
    }
    return mejor ? [{ o: mejor.o, d, exacta: mejor.dif === 0 }] : [];
  });
}

/** Traslada una fecha del periodo del origen al del destino (mismo desfase desde el inicio, sin salirse). */
export function trasladarFecha(f: FechaISO, desdeO: FechaISO, desdeD: FechaISO, hastaD: FechaISO): FechaISO {
  const dias = Math.round((parseFecha(f).getTime() - parseFecha(desdeO).getTime()) / 86400000);
  const r = addDias(desdeD, Math.max(0, dias));
  return r > hastaD ? hastaD : r;
}

/** La guía del origen lista para el destino: sin fechas en los pasos (se reparten de nuevo). */
export function guiaParaDestino(g: Guia, destino: Pick<PlanCasa, 'desde' | 'hasta'>): Guia {
  const s = g.sustentacion;
  const fechaOk = s?.fecha && s.fecha >= destino.desde && s.fecha <= destino.hasta;
  return {
    ...g,
    pasos: g.pasos.map(p => ({ ...p, fecha: null })),
    ...(s ? { sustentacion: { ...s, fecha: fechaOk ? s.fecha : null } } : {}),
  };
}

export interface ResumenReplicar {
  replicadas: string[];
  /** Replicadas desde una guía que no cubre exactamente las mismas asignaturas (revisar). */
  aproximadas: string[];
  /** Guías del destino que ya estaban aprobadas: no se tocaron. */
  yaAprobadas: string[];
  /** Guías del destino sin pareja aprobada en el origen. */
  sinOrigen: string[];
  fallos: { texto: string; motivo: string }[];
  publicado: boolean;
}

export interface EntradaReplicar {
  origen: PlanCasa; destino: PlanCasa;
  asigsO: AsignaturaPlan[]; guiasO: GuiaPlan[];
  asigsD: AsignaturaPlan[]; guiasD: GuiaPlan[];
  nombre: NombreFn; etiquetaGuia: (g: GuiaPlan) => string;
}

const vacio = (s?: string) => !s?.trim();

export async function replicarGuias(e: EntradaReplicar): Promise<ResumenReplicar> {
  const { origen, destino, nombre, etiquetaGuia } = e;
  const err = errorReplicar(origen, destino);
  if (err) throw new Error(err);
  const correo = correoActual();
  const traza = { completadoPorCoordinacion: { correo, fecha: Date.now() } };
  const res: ResumenReplicar = { replicadas: [], aproximadas: [], yaAprobadas: [], sinOrigen: [], fallos: [], publicado: false };

  // 1 — Campos de cada asignatura: solo lo que el destino tenga vacío.
  const asigsO = new Map(e.asigsO.map(a => [a.asignaturaId, a]));
  const asigsD = new Map(e.asigsD.map(a => [a.asignaturaId, { ...a }]));
  for (const d of asigsD.values()) {
    const o = asigsO.get(d.asignaturaId);
    if (!o) continue;
    const c: Partial<AsignaturaPlan> = {};
    for (const k of ['criteriosPromocion', 'ebcDba', 'evidenciaAprendizaje', 'aportes', 'entregable'] as const)
      if (vacio(d[k]) && !vacio(o[k])) c[k] = o[k];
    if (!d.fechaEntrega && o.fechaEntrega) c.fechaEntrega = trasladarFecha(o.fechaEntrega, origen.desde, destino.desde, destino.hasta);
    if (!Object.keys(c).length) continue;
    try { await guardarAsignatura(destino.id, d.asignaturaId, { ...c, ...traza }); asigsD.set(d.asignaturaId, { ...d, ...c }); }
    catch (er) { res.fallos.push({ texto: `${nombre(d.asignaturaId)}: criterios y entregable`, motivo: (er as Error).message }); }
  }

  // 2 — Guías: copiar pedido y guía, y aprobar una por una (cada reparto depende de las anteriores).
  const pares = emparejarGuias(e.guiasO, e.guiasD);
  const conPareja = new Set(pares.map(p => p.d.id));
  for (const d of e.guiasD) if (!conPareja.has(d.id) && !d.aprobada) res.sinOrigen.push(etiquetaGuia(d));
  const todas = new Map(e.guiasD.map(g => [g.id, g]));
  for (const { o, d, exacta } of pares) {
    const texto = etiquetaGuia(d);
    if (d.aprobada) { res.yaAprobadas.push(texto); continue; }
    const fuente = o.aprobada ?? o.propuesta;
    if (!fuente) { res.sinOrigen.push(texto); continue; }
    try {
      const borrador = guiaParaDestino(fuente, destino);
      await guardarGuia(destino.id, d.id, { ...(o.pedido ? { pedido: o.pedido } : {}), ...(d.asignaturaIds.length > 1 ? { eje: o.eje } : {}) });
      const propias = d.asignaturaIds.map(id => asigsD.get(id)).filter((a): a is AsignaturaPlan => !!a);
      const r = await aprobarBorrador({ plan: destino, g: todas.get(d.id)!, borrador, todas: [...todas.values()], propias, nombre, publicar: false, completadoPor: correo });
      todas.set(d.id, { ...todas.get(d.id)!, aprobada: r.aprobada });
      for (const [id, ps] of Object.entries(r.reprogramadas)) { const x = todas.get(id); if (x?.aprobada) todas.set(id, { ...x, aprobada: { ...x.aprobada, pasos: ps } }); }
      res.replicadas.push(texto);
      if (!exacta) res.aproximadas.push(texto);
    } catch (er) { res.fallos.push({ texto, motivo: (er as Error).message }); }
  }

  if (res.replicadas.length) {
    try { await publicarPlan(destino.id); res.publicado = true; }
    catch (er) { res.fallos.push({ texto: 'Publicar la agenda del estudiante', motivo: (er as Error).message }); }
  }
  return res;
}
