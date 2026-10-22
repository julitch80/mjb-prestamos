// Sección «Planes en casa» para el docente (se coloca dentro de Tareas).
// Cada docente: criterios de promoción y aportes de SUS asignaturas; si es responsable de una
// guía, la pide con IA, la edita, la aprueba y le hace seguimiento; si solo participa, da su
// visto bueno.
import { useEffect, useMemo, useState } from 'react';
import { Check, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  AsignaturaPlan, EstadoPaso, EstadoSustentacion, Guia, GuiaPlan, PedidoGuia,
} from '../../data/planCasa/tipos';
import { MODALIDADES_SUSTENTACION } from '../../data/planCasa/tipos';
import { semanasDelPeriodo } from '../../data/planCasa/logica';
import {
  correoActual, darVistoBueno, escucharAsignaturas, escucharGuias, escucharPlanes, guardarAsignatura,
  guardarGuia, pedirGuiaIA, publicarPlan, type PlanConDocentes,
} from '../../data/planCasa/persistencia';
import { asignaturasConNombre, gradoDeGrupo } from './nombres';
import EditorGuia from './EditorGuia';
import {
  BotonFormatoUAI, CajaError, Cargando, CLASE_BOTON, CLASE_BOTON_SEC, CLASE_INPUT, Etiqueta, fechaCorta, Marca,
  repartirTodas, resumenGuia,
} from './comun';

const EST_PASO: Record<EstadoPaso, string> = { pendiente: 'Pendiente', entregado: 'Entregado', revisado: 'Revisado' };
const EST_SUST: Record<EstadoSustentacion, string> = { sin_citar: 'Sin citar', citada: 'Citada', sustentada: 'Sustentada' };
type Nombres = Record<string, { asignatura: string; docente: string }>;

// ── Seguimiento (de una guía) ─────────────────────────────────────────────

function Seguimiento({ plan, g }: { plan: PlanConDocentes; g: GuiaPlan }) {
  const [error, setError] = useState('');
  const [borrador, setBorrador] = useState<Record<string, string>>({});
  const guia = g.aprobada!;

  async function guardar(cambios: Partial<GuiaPlan>) {
    setError('');
    try { await guardarGuia(plan.id, g.id, cambios); }
    catch (e) { setError((e as Error).message || 'No se pudo guardar.'); }
  }
  async function cambiarPaso(id: string, c: Partial<GuiaPlan['seguimiento'][string]>) {
    const previo = g.seguimiento?.[id] ?? { estado: 'pendiente' as EstadoPaso };
    await guardar({ seguimiento: { ...g.seguimiento, [id]: { ...previo, ...c, actualizadoEn: Date.now() } } });
  }

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-strong">Seguimiento</h4>
      {error && <CajaError>{error}</CajaError>}
      {guia.pasos.map((p, i) => {
        const seg = g.seguimiento?.[p.id];
        const obs = borrador[p.id] ?? seg?.observacion ?? '';
        return (
          <div key={p.id} className="rounded-xl border border-line p-3 space-y-2">
            <p className="text-sm text-strong">{i + 1}. {p.titulo} <span className="text-xs text-muted">· {fechaCorta(p.fecha)} · {p.momentos} mom.</span></p>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(EST_PASO) as EstadoPaso[]).map(st => (
                <button key={st} onClick={() => cambiarPaso(p.id, { estado: st })} aria-pressed={(seg?.estado ?? 'pendiente') === st}
                  className={cn('text-xs px-3 py-1.5 rounded-full transition', (seg?.estado ?? 'pendiente') === st ? 'bg-accent text-strong' : 'bg-elevated text-soft hover:text-strong')}>
                  {EST_PASO[st]}
                </button>
              ))}
            </div>
            <input value={obs} onChange={e => setBorrador(b => ({ ...b, [p.id]: e.target.value }))}
              onBlur={() => { if (p.id in borrador && borrador[p.id] !== (seg?.observacion ?? '')) cambiarPaso(p.id, { observacion: borrador[p.id] }); }}
              placeholder="Observación corta" className={CLASE_INPUT} />
          </div>
        );
      })}
      <div className="rounded-xl border border-line p-3 space-y-2">
        <p className="text-sm text-strong">Sustentación
          <span className="text-xs text-muted"> · {fechaCorta(guia.sustentacion.fecha)}{guia.sustentacion.hora ? ` ${guia.sustentacion.hora}` : ''}</span></p>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(EST_SUST) as EstadoSustentacion[]).map(st => (
            <button key={st} onClick={() => guardar({ sustentacionEstado: st })} aria-pressed={g.sustentacionEstado === st}
              className={cn('text-xs px-3 py-1.5 rounded-full transition', g.sustentacionEstado === st ? 'bg-accent text-strong' : 'bg-elevated text-soft hover:text-strong')}>
              {EST_SUST[st]}
            </button>
          ))}
        </div>
        <input value={borrador.__sust ?? g.sustentacionObservacion ?? ''} onChange={e => setBorrador(b => ({ ...b, __sust: e.target.value }))}
          onBlur={() => { if ('__sust' in borrador && borrador.__sust !== (g.sustentacionObservacion ?? '')) guardar({ sustentacionObservacion: borrador.__sust }); }}
          placeholder="Observación de la sustentación" className={CLASE_INPUT} />
      </div>
    </div>
  );
}

// ── Criterios y aportes de una asignatura mía ─────────────────────────────

function CriteriosAsignatura({ plan, a, nombre }: { plan: PlanConDocentes; a: AsignaturaPlan; nombre: string }) {
  const [criterios, setCriterios] = useState(a.criteriosPromocion);
  const [aportes, setAportes] = useState(a.aportes ?? '');
  const [ebcDba, setEbcDba] = useState(a.ebcDba ?? '');
  const [evidencia, setEvidencia] = useState(a.evidenciaAprendizaje ?? '');
  const [error, setError] = useState('');
  const [ok, setOk] = useState(false);
  const sucio = criterios.trim() !== a.criteriosPromocion.trim() || aportes.trim() !== (a.aportes ?? '').trim()
    || ebcDba.trim() !== (a.ebcDba ?? '').trim() || evidencia.trim() !== (a.evidenciaAprendizaje ?? '').trim();

  async function guardar() {
    setError(''); setOk(false);
    try { await guardarAsignatura(plan.id, a.asignaturaId, {
      criteriosPromocion: criterios.trim(), aportes: aportes.trim(), ebcDba: ebcDba.trim(), evidenciaAprendizaje: evidencia.trim(),
    }); setOk(true); }
    catch (e) { setError((e as Error).message); }
  }

  return (
    <div className="rounded-2xl border border-line bg-card p-4 space-y-3">
      <h3 className="text-sm font-semibold text-strong">{nombre}</h3>
      {plan.ajustes.length > 0 && (
        <div className="rounded-xl bg-info-soft text-info-soft-fg text-xs p-3">
          <p className="font-medium mb-1">Ajustes razonables del estudiante</p>
          <ul className="list-disc pl-4 space-y-0.5">{plan.ajustes.map(x => <li key={x}>{x}</li>)}</ul>
        </div>
      )}
      <div><Etiqueta>Criterios de promoción (qué debe demostrar para aprobar)</Etiqueta>
        <textarea rows={3} value={criterios} onChange={e => setCriterios(e.target.value)} className={CLASE_INPUT} /></div>
      <div><Etiqueta>EBC/DBA priorizado (una competencia esencial para esta área)</Etiqueta>
        <textarea rows={2} value={ebcDba} onChange={e => setEbcDba(e.target.value)} className={CLASE_INPUT} /></div>
      <div><Etiqueta>Evidencia de aprendizaje esperada en esta área</Etiqueta>
        <textarea rows={2} value={evidencia} onChange={e => setEvidencia(e.target.value)} className={CLASE_INPUT} /></div>
      <div><Etiqueta>Aportes: temáticas que la guía debe cubrir (opcional)</Etiqueta>
        <textarea rows={2} value={aportes} onChange={e => setAportes(e.target.value)} className={CLASE_INPUT} /></div>
      <div className="flex items-center gap-2">
        <button onClick={guardar} disabled={!sucio} className={CLASE_BOTON_SEC}>Guardar</button>
        {ok && !sucio && <span className="text-xs text-success">Guardado.</span>}
      </div>
      {error && <CajaError>{error}</CajaError>}
    </div>
  );
}

// ── Vista de solo lectura de una guía ─────────────────────────────────────

function GuiaLectura({ guia }: { guia: Guia }) {
  const semanas = [...new Set(guia.pasos.map(p => p.semana || 1))].sort((a, b) => a - b);
  const modalidad = MODALIDADES_SUSTENTACION.find(m => m.id === guia.sustentacion.modalidad)?.texto ?? guia.sustentacion.modalidad;
  return (
    <div className="text-sm text-soft space-y-2">
      <p><span className="font-medium text-strong">Producto integrado:</span> {guia.productoFinal}</p>
      {guia.evidenciasAprendizaje && guia.evidenciasAprendizaje.length > 0 && (
        <div><p className="font-medium text-strong">Evidencias de aprendizaje</p>
          <ul className="list-disc pl-4">{guia.evidenciasAprendizaje.map((e, i) => <li key={i}><b>{e.asignatura}:</b> {e.evidencia}</li>)}</ul></div>
      )}
      <div><p className="font-medium text-strong">Criterios</p><ul className="list-disc pl-4">{guia.criteriosEvaluacion.map((c, i) => <li key={i}>{c}</li>)}</ul></div>
      <div><p className="font-medium text-strong">Pasos por semana</p>
        {semanas.map(sem => (
          <div key={sem} className="mt-1">
            <p className="text-xs font-semibold text-strong">Semana {sem}</p>
            <ul className="list-disc pl-4 space-y-1">{guia.pasos.filter(p => (p.semana || 1) === sem).map(p => (
              <li key={p.id} className={p.esEntregaParcial ? 'font-medium text-strong' : undefined}>{p.titulo}
                {p.esEntregaParcial && <span className="ml-1 text-[11px] px-1.5 py-0.5 rounded-full bg-warning-soft text-warning-soft-fg">Entrega parcial</span>}
                <span className="text-xs text-muted font-normal"> · {p.momentos} mom. · {p.canalEntrega || p.evidencia}{p.fecha ? ` · ${fechaCorta(p.fecha)}` : ''}</span></li>))}</ul>
          </div>))}</div>
      <p><span className="font-medium text-strong">Sustentación:</span> {modalidad}{guia.sustentacion.fecha ? `, ${fechaCorta(guia.sustentacion.fecha)}` : ''}{guia.sustentacion.hora ? ` ${guia.sustentacion.hora}` : ''}</p>
    </div>
  );
}

function VistosBuenos({ g }: { g: GuiaPlan }) {
  if (g.docentesCorreos.length <= 1) return null;
  return (
    <div className="flex flex-wrap gap-1.5 items-center">
      <span className="text-xs text-soft">Vistos buenos:</span>
      {g.docentesCorreos.map(c => <Marca key={c} ok={!!g.vistosBuenos?.[c]} etiqueta={c.split('@')[0]} />)}
    </div>
  );
}

// ── Guía donde soy responsable ────────────────────────────────────────────

function GuiaResponsable({ plan, g, todas, asigs, nombres }: {
  plan: PlanConDocentes; g: GuiaPlan; todas: GuiaPlan[]; asigs: AsignaturaPlan[]; nombres: Nombres;
}) {
  const [pedido, setPedido] = useState<PedidoGuia>(g.pedido ?? { tematicas: '', competencias: '', textoReferencia: '' });
  const [borrador, setBorrador] = useState<Guia | null>(g.propuesta ?? null);
  const [indicacion, setIndicacion] = useState('');
  const [generando, setGenerando] = useState(false);
  const [aprobando, setAprobando] = useState(false);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [editando, setEditando] = useState(false);
  const r = resumenGuia(g);
  const transversal = g.asignaturaIds.length > 1 || plan.modalidad === 'transversal';
  const nombre = (id: string) => nombres[id]?.asignatura ?? id;

  useEffect(() => { if (!borrador && g.propuesta) setBorrador(g.propuesta); }, [g.propuesta, borrador]);

  const propias = g.asignaturaIds.map(id => asigs.find(a => a.asignaturaId === id)).filter((a): a is AsignaturaPlan => !!a);
  const faltanCriterios = propias.filter(a => !a.criteriosPromocion.trim());

  async function generar() {
    if (!pedido.tematicas.trim() || !pedido.competencias.trim()) return setError('Escriba las temáticas y las competencias.');
    if (faltanCriterios.length) return setError(`Faltan criterios de promoción en: ${faltanCriterios.map(a => nombre(a.asignaturaId)).join(', ')}.`);
    setError(''); setAviso(''); setGenerando(true);
    const limpio: PedidoGuia = { tematicas: pedido.tematicas.trim(), competencias: pedido.competencias.trim(), ...(pedido.textoReferencia?.trim() ? { textoReferencia: pedido.textoReferencia.trim() } : {}) };
    try {
      const guia = await pedirGuiaIA({
        asignatura: propias.map(a => nombre(a.asignaturaId)).join(', '),
        ...(transversal ? { transversal: { eje: g.eje, asignaturas: propias.map(a => ({
          nombre: nombre(a.asignaturaId), criteriosPromocion: a.criteriosPromocion, ...(a.aportes?.trim() ? { aportes: a.aportes.trim() } : {}),
          ...(a.ebcDba?.trim() ? { ebcDba: a.ebcDba.trim() } : {}),
          ...(a.evidenciaAprendizaje?.trim() ? { evidenciaAprendizaje: a.evidenciaAprendizaje.trim() } : {}),
        })) } } : {}),
        grado: gradoDeGrupo(plan.grupo), desde: plan.desde, hasta: plan.hasta,
        ajustes: plan.ajustes, topeDiario: plan.topeDiario,
        semanas: semanasDelPeriodo(plan.desde, plan.hasta), ritmo: plan.ritmo ?? 'diario',
        criteriosPromocion: propias.map(a => `${transversal ? nombre(a.asignaturaId) + ': ' : ''}${a.criteriosPromocion}${!transversal && a.ebcDba?.trim() ? ` | EBC/DBA priorizado: ${a.ebcDba.trim()}` : ''}${!transversal && a.evidenciaAprendizaje?.trim() ? ` | Evidencia de aprendizaje esperada: ${a.evidenciaAprendizaje.trim()}` : ''}`).join('\n'),
        pedido: limpio, ...(indicacion.trim() ? { indicacion: indicacion.trim() } : {}),
      });
      setBorrador(guia); setIndicacion('');
      await guardarGuia(plan.id, g.id, { pedido: limpio, propuesta: guia });
    } catch (e) { setError((e as Error).message); }
    finally { setGenerando(false); }
  }

  async function aprobar() {
    if (!borrador) return;
    if (!borrador.pasos.length || borrador.pasos.some(p => !p.titulo.trim())) return setError('Cada paso necesita un título.');
    setError(''); setAviso(''); setAprobando(true);
    try {
      const otras = todas.filter(x => x.id !== g.id && x.aprobada).map(x => ({ guiaId: x.id, pasos: x.aprobada!.pasos }));
      const { pasos: rep, avisos } = repartirTodas(plan, [...otras, { guiaId: g.id, pasos: borrador.pasos }]);
      const aprobada: Guia = { ...borrador, pasos: rep[g.id] ?? borrador.pasos };
      await guardarGuia(plan.id, g.id, { aprobada, aprobadaEn: Date.now(), propuesta: aprobada });
      setBorrador(aprobada);
      let sinPermiso = 0;
      for (const x of todas) {
        if (x.id === g.id || !x.aprobada || !rep[x.id]) continue;
        // Las fechas ya puestas se respetan al repartir: solo se escribe si algo cambió.
        if (JSON.stringify(rep[x.id].map(p => p.fecha)) === JSON.stringify(x.aprobada.pasos.map(p => p.fecha))) continue;
        try { await guardarGuia(plan.id, x.id, { aprobada: { ...x.aprobada, pasos: rep[x.id] } }); } catch { sinPermiso++; }
      }
      let msg = 'Guía aprobada.';
      try { await publicarPlan(plan.id); msg += ' Ya está en la agenda del estudiante.'; }
      catch (e) { msg += ` No se pudo publicar la agenda: ${(e as Error).message}`; }
      if (avisos.length) msg += ` ${avisos.join(' ')}`;
      if (sinPermiso) msg += ` (${sinPermiso} guía(s) de otros docentes no se reprogramaron.)`;
      setAviso(msg); setEditando(false);
    } catch (e) { setError((e as Error).message); }
    finally { setAprobando(false); }
  }

  return (
    <div className="rounded-2xl border border-line bg-card p-4 space-y-4">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-strong">{transversal ? 'Pregunta orientadora' : 'Guía'}: {g.eje}</h3>
          {transversal && <p className="text-xs text-muted">Integra: {g.asignaturaIds.map(nombre).join(', ')}</p>}
        </div>
        {r.guia && <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-success-soft text-success-soft-fg flex-shrink-0">✓ Aprobada</span>}
      </div>
      <VistosBuenos g={g} />

      {(!r.guia || editando) && (
        <div className="space-y-3">
          <div><Etiqueta>Temáticas</Etiqueta>
            <textarea rows={2} value={pedido.tematicas} onChange={e => setPedido({ ...pedido, tematicas: e.target.value })} className={CLASE_INPUT} /></div>
          <div><Etiqueta>Competencias o habilidades a desarrollar</Etiqueta>
            <textarea rows={2} value={pedido.competencias} onChange={e => setPedido({ ...pedido, competencias: e.target.value })} className={CLASE_INPUT} /></div>
          <div><Etiqueta>Texto, lectura o enlace de referencia (opcional)</Etiqueta>
            <textarea rows={2} value={pedido.textoReferencia ?? ''} onChange={e => setPedido({ ...pedido, textoReferencia: e.target.value })} className={CLASE_INPUT} /></div>
          {borrador && <input value={indicacion} onChange={e => setIndicacion(e.target.value)} placeholder="Indicación para otra versión: «más corta», «más práctica»…" className={CLASE_INPUT} />}
          <button onClick={generar} disabled={generando} className={CLASE_BOTON}><Sparkles size={15} />{borrador ? 'Otra versión' : 'Generar guía con IA'}</button>
          {generando && <Cargando texto="La IA está preparando la guía (puede tardar hasta un minuto)…" />}
          <p className="text-[11px] text-muted">A la IA no se le envía el nombre del estudiante ni su motivo: solo los ajustes y los datos de la asignatura.</p>
        </div>
      )}

      {borrador && (!r.guia || editando) && !generando && (
        <div className="space-y-3 border-t border-line pt-4">
          <h4 className="text-sm font-semibold text-strong">Propuesta (edítela a su gusto)</h4>
          <EditorGuia guia={borrador} onChange={setBorrador} />
          <div className="flex flex-wrap gap-2">
            <button onClick={aprobar} disabled={aprobando} className={CLASE_BOTON}><Check size={15} />{aprobando ? 'Aprobando…' : 'Aprobar y publicar'}</button>
            <BotonFormatoUAI plan={plan} guias={[{ ...g, propuesta: borrador }]} asigs={asigs} nombres={nombres} />
          </div>
          <p className="text-[11px] text-muted">Nada llega al estudiante hasta que usted apruebe.{g.docentesCorreos.length > 1 ? ' Los vistos buenos de los demás docentes se muestran pero no bloquean.' : ''}</p>
        </div>
      )}

      {r.guia && !editando && (
        <div className="space-y-4 border-t border-line pt-4">
          <GuiaLectura guia={g.aprobada!} />
          <div className="flex flex-wrap gap-2">
            <button onClick={() => { setBorrador(g.aprobada!); setEditando(true); }} className={CLASE_BOTON_SEC}>Editar o pedir otra versión</button>
            <BotonFormatoUAI plan={plan} guias={[g]} asigs={asigs} nombres={nombres} />
          </div>
          <Seguimiento plan={plan} g={g} />
        </div>
      )}

      {error && <CajaError>{error}</CajaError>}
      {aviso && !error && <p className="rounded-xl bg-success-soft text-success-soft-fg text-sm p-3">{aviso}</p>}
    </div>
  );
}

// ── Guía donde participo ──────────────────────────────────────────────────

function GuiaParticipante({ plan, g, asigs, nombres }: { plan: PlanConDocentes; g: GuiaPlan; asigs: AsignaturaPlan[]; nombres: Nombres }) {
  const yo = correoActual();
  const [error, setError] = useState('');
  const dado = !!g.vistosBuenos?.[yo];
  const guia = g.aprobada ?? g.propuesta;

  async function alternar() {
    setError('');
    try { await darVistoBueno(plan.id, g.id, yo, !dado); } catch (e) { setError((e as Error).message); }
  }

  return (
    <div className="rounded-2xl border border-line bg-card p-4 space-y-3">
      <div className="flex items-start gap-2">
        <h3 className="text-sm font-semibold text-strong min-w-0 flex-1">Guía de {g.responsableCorreo.split('@')[0]}: {g.eje}</h3>
        {g.aprobada && <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-success-soft text-success-soft-fg flex-shrink-0">✓ Aprobada</span>}
      </div>
      <VistosBuenos g={g} />
      {guia ? (
        <>
          {!g.aprobada && <p className="text-xs text-soft">Propuesta aún sin aprobar.</p>}
          <GuiaLectura guia={guia} />
          <div className="flex flex-wrap gap-2">
            <button onClick={alternar} className={dado ? CLASE_BOTON_SEC : CLASE_BOTON}><Check size={15} />{dado ? 'Quitar mi visto bueno' : 'Dar mi visto bueno'}</button>
            <BotonFormatoUAI plan={plan} guias={[g]} asigs={asigs} nombres={nombres} />
          </div>
        </>
      ) : <p className="text-sm text-soft">El responsable aún no ha preparado la guía.</p>}
      {error && <CajaError>{error}</CajaError>}
    </div>
  );
}

// ── Un plan ───────────────────────────────────────────────────────────────

function PlanDocente({ plan }: { plan: PlanConDocentes }) {
  const [asigs, setAsigs] = useState<AsignaturaPlan[] | null>(null);
  const [guias, setGuias] = useState<GuiaPlan[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => escucharAsignaturas(plan.id, setAsigs, e => { setError(e.message); setAsigs([]); }), [plan.id]);
  useEffect(() => escucharGuias(plan.id, setGuias, e => { setError(e.message); setGuias([]); }), [plan.id]);
  const nombres = useMemo(() => asignaturasConNombre(plan.grupo), [plan.grupo]);
  const yo = correoActual();
  const mias = (asigs ?? []).filter(a => a.docenteCorreo.toLowerCase() === yo);
  const responsable = (guias ?? []).filter(g => g.responsableCorreo.toLowerCase() === yo);
  const participo = (guias ?? []).filter(g => g.responsableCorreo.toLowerCase() !== yo && g.docentesCorreos.map(c => c.toLowerCase()).includes(yo));

  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-base font-semibold text-strong">{plan.nombres.split(' ')[0]} {plan.apellidos.split(' ')[0]} · {plan.grupo}</h3>
        <p className="text-xs text-soft">Del {fechaCorta(plan.desde)} al {fechaCorta(plan.hasta)} · máximo {plan.topeDiario} momentos por día{plan.ritmo === 'dia_por_medio' ? ' (día por medio)' : ''} · guías {plan.modalidad === 'transversal' ? 'transversales' : 'por asignatura'}</p>
      </div>
      {error && <CajaError>{error}</CajaError>}
      {(!asigs || !guias) && !error && <Cargando texto="Cargando…" />}
      {asigs && guias && mias.length === 0 && !error && <p className="text-sm text-soft">No tiene asignaturas en este plan.</p>}
      {mias.map(a => <CriteriosAsignatura key={a.asignaturaId} plan={plan} a={a} nombre={nombres[a.asignaturaId]?.asignatura ?? a.asignaturaId} />)}
      {responsable.map(g => <GuiaResponsable key={g.id} plan={plan} g={g} todas={guias ?? []} asigs={asigs ?? []} nombres={nombres} />)}
      {participo.map(g => <GuiaParticipante key={g.id} plan={plan} g={g} asigs={asigs ?? []} nombres={nombres} />)}
    </section>
  );
}

export default function PlanCasaDocente() {
  const [planes, setPlanes] = useState<PlanConDocentes[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => escucharPlanes(false, setPlanes, e => { setError(e.message || 'No se pudieron leer los planes.'); setPlanes([]); }), []);

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      <h2 className="text-lg font-semibold text-strong">Planes en casa</h2>
      {error && <CajaError>{error}</CajaError>}
      {!planes && <Cargando texto="Cargando planes…" />}
      {planes && planes.length === 0 && !error && <p className="text-sm text-soft">No tiene estudiantes con plan en casa.</p>}
      {planes?.filter(p => p.estado === 'activo').map(p => <PlanDocente key={p.id} plan={p} />)}
    </div>
  );
}
