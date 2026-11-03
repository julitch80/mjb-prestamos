// Planes en casa — acciones con IA y aprobación COMPARTIDAS entre el botón de cada guía
// (PlanCasaDocente) y «Completar todo con IA» de coordinación. La lógica pura está en ./completarPlan.ts.
// NUNCA se envía a la IA el nombre, el motivo ni datos de salud del estudiante: solo grado, ajustes
// razonables en lenguaje pedagógico y las asignaturas (igual que ya hacían los botones existentes).
import type { AsignaturaPlan, CompletadoPorCoordinacion, Guia, GuiaPlan, PasoGuia, PedidoGuia, PlanCasa } from './tipos';
import { semanasDelPeriodo } from './logica';
import { armarAprobacion, completarBloqueado, esTransversal, construirPasos, errorDeBorrador, conEntregables, fechaEntregaSugerida, gradoDeGrupo, hoyLocal, type PasoCompletar } from './completarPlan';
import { correoActual, guardarAsignatura, guardarGuia, integrarGuiaIA, pedirGuiaIA, publicarPlan, sugerirCampos } from './persistencia';

type NombreFn = (id: string) => string;

// ── Pedir la guía a la IA ─────────────────────────────────────────────────

export interface EntradaPropuesta {
  plan: PlanCasa; g: GuiaPlan; propias: AsignaturaPlan[]; nombre: NombreFn; pedido: PedidoGuia; indicacion?: string;
}

/** Pide la guía a la IA con las asignaturas dadas, le añade los entregables y la guarda como propuesta. */
export async function pedirYGuardarPropuesta(e: EntradaPropuesta): Promise<Guia> {
  const { plan, g, propias: pr, nombre, pedido: limpio, indicacion } = e;
  const transversal = g.asignaturaIds.length > 1 || plan.modalidad === 'transversal';
  const guia = await pedirGuiaIA({
    asignatura: pr.map(a => nombre(a.asignaturaId)).join(', '),
    ...(transversal ? { transversal: { eje: g.eje, asignaturas: pr.map(a => ({
      nombre: nombre(a.asignaturaId), criteriosPromocion: a.criteriosPromocion, ...(a.aportes?.trim() ? { aportes: a.aportes.trim() } : {}),
      ...(a.ebcDba?.trim() ? { ebcDba: a.ebcDba.trim() } : {}),
      ...(a.evidenciaAprendizaje?.trim() ? { evidenciaAprendizaje: a.evidenciaAprendizaje.trim() } : {}),
    })) } } : {}),
    grado: gradoDeGrupo(plan.grupo), desde: plan.desde, hasta: plan.hasta,
    ajustes: plan.ajustes, topeDiario: plan.topeDiario, ...(plan.sinTecnologia ? { sinTecnologia: true } : {}),
    semanas: semanasDelPeriodo(plan.desde, plan.hasta), ritmo: plan.ritmo ?? 'diario',
    criteriosPromocion: pr.map(a => `${transversal ? nombre(a.asignaturaId) + ': ' : ''}${a.criteriosPromocion}${!transversal && a.ebcDba?.trim() ? ` | EBC/DBA priorizado: ${a.ebcDba.trim()}` : ''}${!transversal && a.evidenciaAprendizaje?.trim() ? ` | Evidencia de aprendizaje esperada: ${a.evidenciaAprendizaje.trim()}` : ''}`).join('\n'),
    pedido: limpio, ...(indicacion?.trim() ? { indicacion: indicacion.trim() } : {}),
  });
  const conEnt = conEntregables(guia, pr, nombre, plan.desde);
  await guardarGuia(plan.id, g.id, { pedido: limpio, propuesta: conEnt, propuestaEn: Date.now() });
  return conEnt;
}

export interface EntradaIntegrar {
  plan: PlanCasa; g: GuiaPlan; base: Guia; propias: AsignaturaPlan[]; nombre: NombreFn;
}

/** «Integrar la guía»: una entrega por semana que funde los entregables de los docentes; guarda la propuesta. */
export async function integrarYGuardarPropuesta(e: EntradaIntegrar): Promise<{ guia: Guia; avisos: string[] }> {
  const { plan, g, base, propias, nombre } = e;
  const r = await integrarGuiaIA({
    guia: base, eje: g.eje, grado: gradoDeGrupo(plan.grupo), desde: plan.desde, hasta: plan.hasta,
    ajustes: plan.ajustes, topeDiario: plan.topeDiario, ritmo: plan.ritmo ?? 'diario', ...(plan.sinTecnologia ? { sinTecnologia: true } : {}),
    asignaturas: propias.map(a => ({
      asignaturaId: a.asignaturaId, nombre: nombre(a.asignaturaId), criterios: a.criteriosPromocion,
      ...(a.aportes?.trim() ? { tematicas: a.aportes.trim() } : {}), ...(a.ebcDba?.trim() ? { competencia: a.ebcDba.trim() } : {}),
      ...(a.evidenciaAprendizaje?.trim() ? { evidencia: a.evidenciaAprendizaje.trim() } : {}),
      ...(a.entregable?.trim() ? { entregable: a.entregable.trim() } : {}), ...(a.fechaEntrega ? { fechaEntrega: a.fechaEntrega } : {}),
    })),
  });
  await guardarGuia(plan.id, g.id, { propuesta: r.guia, propuestaEn: Date.now() });
  return r;
}

// ── Aprobar y publicar ────────────────────────────────────────────────────

export interface EntradaAprobar {
  plan: PlanCasa; g: GuiaPlan; borrador: Guia; todas: GuiaPlan[]; propias: AsignaturaPlan[]; nombre: NombreFn;
  /** Publicar la agenda al terminar (el botón de una guía sí; «Completar todo» publica una sola vez al final). */
  publicar?: boolean;
  /** Si se pasa, deja la traza «completado por coordinación» en la guía. */
  completadoPor?: string;
}

export interface ResultadoAprobar {
  aprobada: Guia;
  avisos: string[];
  protegidos: number;
  /** Guías de otros docentes que no se pudieron reprogramar por falta de permiso. */
  sinPermiso: number;
  /** Pasos nuevos de otras guías ya aprobadas que SÍ se reprogramaron (guiaId → pasos). */
  reprogramadas: Record<string, PasoGuia[]>;
  /** Texto de error si se pidió publicar y falló; null si salió bien o no se pidió. */
  errorPublicar: string | null;
}

/** Misma lógica que el botón «Aprobar y publicar»: reparte fechas, protege lo pasado, guarda y publica. */
export async function aprobarBorrador(e: EntradaAprobar): Promise<ResultadoAprobar> {
  const { plan, g, borrador, todas, propias, nombre } = e;
  const err = errorDeBorrador(borrador);
  if (err) throw new Error(err);
  const r = armarAprobacion({ plan, guia: g, borrador, todas, propias, nombre, hoy: hoyLocal() });
  const { aprobada } = r;
  const ahora = Date.now();
  const traza: CompletadoPorCoordinacion | undefined = e.completadoPor ? { correo: e.completadoPor, fecha: ahora } : undefined;
  await guardarGuia(plan.id, g.id, {
    aprobada, aprobadaEn: ahora, propuesta: aprobada, propuestaEn: ahora,
    // Una guía integrada conserva los vistos buenos: solo reorganiza lo que los docentes ya dieron.
    ...(r.cambio && !aprobada.integrada && Object.keys(g.vistosBuenos ?? {}).length ? { vistosBuenos: {} } : {}),
    ...(traza ? { completadoPorCoordinacion: traza } : {}),
  });
  let sinPermiso = 0;
  const reprogramadas: Record<string, PasoGuia[]> = {};
  for (const x of todas) {
    if (x.id === g.id || !x.aprobada || !r.repartidas[x.id]) continue;
    // Las fechas ya puestas se respetan al repartir: solo se escribe si algo cambió.
    if (JSON.stringify(r.repartidas[x.id].map(p => p.fecha)) === JSON.stringify(x.aprobada.pasos.map(p => p.fecha))) continue;
    try { await guardarGuia(plan.id, x.id, { aprobada: { ...x.aprobada, pasos: r.repartidas[x.id] } }); reprogramadas[x.id] = r.repartidas[x.id]; }
    catch { sinPermiso++; }
  }
  let errorPublicar: string | null = null;
  if (e.publicar) { try { await publicarPlan(plan.id); } catch (er) { errorPublicar = (er as Error).message; } }
  return { aprobada, avisos: r.avisos, protegidos: r.protegidos, sinPermiso, reprogramadas, errorPublicar };
}

// ── «Completar todo con IA» ───────────────────────────────────────────────

export type EstadoProg = 'espera' | 'curso' | 'ok' | 'fallo';
export interface ItemProgreso { id: string; texto: string; estado: EstadoProg }

export interface ResumenCompletar {
  hechos: number;
  fallos: { texto: string; motivo: string }[];
  publicado: boolean;
  /** Guías que quedaron sin aprobar (el cuadernillo no las incluye). */
  sinAprobar: string[];
}

/** Ejecuta `tareas` con a lo sumo `n` a la vez. Nunca rechaza: cada tarea maneja su propio error. */
async function enLotes<T>(items: T[], n: number, fn: (x: T) => Promise<void>): Promise<void> {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const x = items[i++]; await fn(x); }
  }));
}

export interface EntradaCompletar {
  plan: PlanCasa; asigs: AsignaturaPlan[]; guias: GuiaPlan[]; nombre: NombreFn; etiquetaGuia: (g: GuiaPlan) => string;
  onProgreso: (items: ItemProgreso[]) => void;
}

/** Los pasos que se ejecutarían (para pintar la lista antes de empezar). */
export function pasosParaCompletar(e: Pick<EntradaCompletar, 'plan' | 'asigs' | 'guias' | 'nombre' | 'etiquetaGuia'>): PasoCompletar[] {
  return construirPasos(e.plan, e.asigs, e.guias, e.nombre, e.etiquetaGuia);
}

/**
 * Coordinación completa lo que falte SIN esperar a ningún docente: criterios y entregables con IA
 * (misma vía que «Sugerir con IA», marcados porIA), guía con IA, integración y aprobación.
 * Un error no detiene lo demás: se anota y se sigue. Nunca pisa lo que ya está escrito.
 */
export async function completarPlanConIA(e: EntradaCompletar): Promise<ResumenCompletar> {
  const { plan, nombre, etiquetaGuia } = e;
  if (completarBloqueado(plan)) throw new Error('Este caso está en espera (ingresó tarde): no se completa con IA hasta que venza el plazo de los docentes o se quite la marca.');
  const correo = correoActual();
  const pasos = pasosParaCompletar(e);
  const items: ItemProgreso[] = pasos.map(p => ({ id: p.id, texto: p.texto, estado: 'espera' }));
  const fallos: ResumenCompletar['fallos'] = [];
  let hechos = 0;
  const marcar = (id: string, estado: EstadoProg, texto?: string) => {
    const it = items.find(x => x.id === id);
    if (!it) return;
    it.estado = estado; if (texto) it.texto = texto;
    e.onProgreso(items.map(x => ({ ...x })));
  };
  const fallar = (p: PasoCompletar, er: unknown) => {
    const motivo = (er as Error)?.message ?? String(er);
    fallos.push({ texto: p.texto, motivo }); marcar(p.id, 'fallo', `${p.texto} — ${motivo}`);
  };
  e.onProgreso(items.map(x => ({ ...x })));

  // Estado local que se va actualizando (los listeners de Firestore llegan después).
  const asigs = new Map(e.asigs.map(a => [a.asignaturaId, { ...a }]));
  const traza = { completadoPorCoordinacion: { correo, fecha: Date.now() } };
  const grado = gradoDeGrupo(plan.grupo);
  // Pregunta orientadora: solo en guías transversales (en las demás el «eje» es el nombre de la asignatura).
  const ejeDe = (aid: string) => {
    const g = e.guias.find(x => x.asignaturaIds.includes(aid));
    return g && esTransversal(plan, g) ? g.eje?.trim() : undefined;
  };
  const base = { ajustes: plan.ajustes, ...(plan.sinTecnologia ? { sinTecnologia: true } : {}) };

  // Fase 1a — campos de cada asignatura (en paralelo; solo rellena lo vacío).
  await enLotes(pasos.filter(p => p.tipo === 'asignatura'), 4, async p => {
    marcar(p.id, 'curso');
    const a = asigs.get(p.ref)!;
    try {
      const existentes = Object.fromEntries(Object.entries({ criteriosPromocion: a.criteriosPromocion, ebcDba: a.ebcDba ?? '', evidenciaAprendizaje: a.evidenciaAprendizaje ?? '', aportes: a.aportes ?? '' })
        .filter(([, v]) => v.trim()));
      const eje = ejeDe(p.ref);
      const c = await sugerirCampos({ modo: 'asignatura', asignaturas: [nombre(p.ref)], grado, existentes, ...base, ...(eje ? { preguntaOrientadora: eje } : {}) });
      const nuevo: AsignaturaPlan = {
        ...a,
        criteriosPromocion: a.criteriosPromocion.trim() ? a.criteriosPromocion : (c.criteriosPromocion ?? ''),
        ebcDba: a.ebcDba?.trim() ? a.ebcDba : (c.ebcDba ?? ''),
        evidenciaAprendizaje: a.evidenciaAprendizaje?.trim() ? a.evidenciaAprendizaje : (c.evidenciaAprendizaje ?? ''),
        aportes: a.aportes?.trim() ? a.aportes : (c.aportes ?? ''),
      };
      if (!nuevo.criteriosPromocion.trim()) throw new Error('la IA no devolvió criterios');
      await guardarAsignatura(plan.id, p.ref, {
        criteriosPromocion: nuevo.criteriosPromocion, ebcDba: nuevo.ebcDba, evidenciaAprendizaje: nuevo.evidenciaAprendizaje, aportes: nuevo.aportes,
        porIA: true, ...traza,
      });
      asigs.set(p.ref, nuevo); hechos++; marcar(p.id, 'ok');
    } catch (er) { fallar(p, er); }
  });

  // Fase 1b — entregable y fecha de las asignaturas que no los tienen.
  const conEnt = pasos.filter(p => p.tipo === 'entregable');
  await enLotes(conEnt, 4, async p => {
    marcar(p.id, 'curso');
    const a = asigs.get(p.ref)!;
    try {
      let entregable = a.entregable?.trim() ?? '';
      if (!entregable) {
        const existentes = Object.fromEntries(Object.entries({ aportes: a.aportes ?? '', ebcDba: a.ebcDba ?? '', criteriosPromocion: a.criteriosPromocion, evidenciaAprendizaje: a.evidenciaAprendizaje ?? '' }).filter(([, v]) => v.trim()));
        const eje = ejeDe(p.ref);
        const c = await sugerirCampos({ modo: 'entregable', asignaturas: [nombre(p.ref)], grado, existentes, ...base, ...(eje ? { preguntaOrientadora: eje } : {}) });
        entregable = [c.opcion1, c.opcion2, c.opcion3].find(x => x?.trim())?.trim() ?? '';
        if (!entregable) throw new Error('la IA no devolvió entregables');
      }
      const fechaEntrega = a.fechaEntrega || fechaEntregaSugerida(plan.desde, plan.hasta, conEnt.indexOf(p), conEnt.length);
      await guardarAsignatura(plan.id, p.ref, { entregable, fechaEntrega, porIA: true, ...traza });
      asigs.set(p.ref, { ...a, entregable, fechaEntrega }); hechos++; marcar(p.id, 'ok');
    } catch (er) { fallar(p, er); }
  });

  // Fase 2 — por guía: pedido, propuesta e integración (guías en paralelo, pasos en orden).
  const pend = e.guias.filter(g => !g.aprobada);
  const propias = (g: GuiaPlan) => g.asignaturaIds.map(id => asigs.get(id)).filter((a): a is AsignaturaPlan => !!a);
  const borradores = new Map<string, Guia>();
  for (const g of pend) if (g.propuesta) borradores.set(g.id, g.propuesta);
  const pedidos = new Map<string, PedidoGuia>(pend.map(g => [g.id, g.pedido ?? { tematicas: '', competencias: '' }]));
  await enLotes(pend, 3, async g => {
    const mios = pasos.filter(p => p.ref === g.id);
    const pPedido = mios.find(p => p.tipo === 'pedido');
    const pProp = mios.find(p => p.tipo === 'propuesta');
    const pInt = mios.find(p => p.tipo === 'integrar');
    const pr = propias(g);
    if (pPedido) {
      marcar(pPedido.id, 'curso');
      try {
        const ped = pedidos.get(g.id)!;
        const existentes: Record<string, string> = {};
        if (ped.tematicas.trim()) existentes.tematicas = ped.tematicas.trim();
        if (ped.competencias.trim()) existentes.competencias = ped.competencias.trim();
        for (const a of pr) {
          const n = nombre(a.asignaturaId);
          if (a.criteriosPromocion.trim()) existentes[`criterios de ${n}`] = a.criteriosPromocion.trim();
          if (a.ebcDba?.trim()) existentes[`EBC/DBA de ${n}`] = a.ebcDba.trim();
          if (a.aportes?.trim()) existentes[`aportes de ${n}`] = a.aportes.trim();
        }
        const c = await sugerirCampos({ modo: 'pedido', preguntaOrientadora: g.eje, asignaturas: g.asignaturaIds.map(nombre), grado, existentes, ...base });
        const ref = ped.textoReferencia?.trim() || (c.textoReferencia ?? '').trim();
        const nuevo: PedidoGuia = {
          tematicas: ped.tematicas.trim() || (c.tematicas ?? '').trim(),
          competencias: ped.competencias.trim() || (c.competencias ?? '').trim(),
          ...(ref ? { textoReferencia: ref } : {}),
        };
        if (!nuevo.tematicas || !nuevo.competencias) throw new Error('la IA no devolvió temáticas y competencias');
        pedidos.set(g.id, nuevo); hechos++; marcar(pPedido.id, 'ok');
      } catch (er) { fallar(pPedido, er); if (pProp) fallar(pProp, new Error('faltan temáticas y competencias')); return; }
    }
    if (pProp) {
      marcar(pProp.id, 'curso');
      try {
        if (!pr.length || pr.some(a => !a.criteriosPromocion.trim())) throw new Error('faltan los criterios de promoción');
        borradores.set(g.id, await pedirYGuardarPropuesta({ plan, g, propias: pr, nombre, pedido: pedidos.get(g.id)! }));
        hechos++; marcar(pProp.id, 'ok');
      } catch (er) { fallar(pProp, er); return; }
    }
    if (pInt) {
      marcar(pInt.id, 'curso');
      try {
        const b = borradores.get(g.id);
        if (!b) throw new Error('no hay guía que integrar');
        const r = await integrarYGuardarPropuesta({ plan, g, base: b, propias: pr, nombre });
        borradores.set(g.id, r.guia); hechos++; marcar(pInt.id, 'ok');
      } catch (er) {
        // Se aprueba la propuesta tal cual (con los entregables como pasos sueltos) para no dejar sin cuadernillo.
        fallar(pInt, er);
      }
    }
  });

  // Fase 3 — aprobar una por una (cada reparto de fechas depende de las anteriores).
  const todas = new Map(e.guias.map(g => [g.id, g]));
  const sinAprobar: string[] = [];
  let algunaAprobada = false;
  for (const g of pend) {
    const p = pasos.find(x => x.tipo === 'aprobar' && x.ref === g.id)!;
    const b = borradores.get(g.id);
    if (!b) { fallar(p, new Error('no tiene propuesta de guía')); sinAprobar.push(etiquetaGuia(g)); continue; }
    marcar(p.id, 'curso');
    try {
      const r = await aprobarBorrador({
        plan, g: todas.get(g.id)!, borrador: b, todas: [...todas.values()], propias: propias(g), nombre, publicar: false, completadoPor: correo,
      });
      todas.set(g.id, { ...todas.get(g.id)!, aprobada: r.aprobada });
      for (const [id, ps] of Object.entries(r.reprogramadas)) { const x = todas.get(id); if (x?.aprobada) todas.set(id, { ...x, aprobada: { ...x.aprobada, pasos: ps } }); }
      algunaAprobada = true; hechos++;
      marcar(p.id, 'ok', r.protegidos ? `${p.texto} (se conservaron ${r.protegidos} paso(s) cuya fecha ya pasó)` : undefined);
    } catch (er) { fallar(p, er); sinAprobar.push(etiquetaGuia(g)); }
  }

  // Publicación única de la agenda.
  let publicado = false;
  if (algunaAprobada) {
    try { await publicarPlan(plan.id); publicado = true; }
    catch (er) { fallos.push({ texto: 'Publicar la agenda del estudiante', motivo: (er as Error).message }); }
  }
  return { hechos, fallos, publicado, sinAprobar };
}
