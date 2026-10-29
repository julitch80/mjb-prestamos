// Sección «Planes en casa» para el docente (se coloca dentro de Tareas).
// Cada docente: criterios de promoción y aportes de SUS asignaturas; si es responsable de una
// guía, la pide con IA, la edita, la aprueba y le hace seguimiento; si solo participa, da su
// visto bueno.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '../../data/store';
import type {
  AsignaturaPlan, EstadoPaso, EstadoSustentacion, Guia, GuiaPlan, PedidoGuia, SolicitudAutorizacion,
} from '../../data/planCasa/tipos';
import { MODALIDADES_SUSTENTACION, MOTIVOS_SOLICITUD } from '../../data/planCasa/tipos';
import { asignaturasCambiadas, fechaCierre, protegerPasosPasados, semanasDelPeriodo } from '../../data/planCasa/logica';
import { addDias } from '../../data/tareas/calendario';
import {
  correoActual, darVistoBueno, leerEquipo, escucharAsignaturas, escucharGuias, escucharPlanes, guardarAsignatura,
  escucharSolicitudes, guardarGuia, pedirAutorizacion, pedirGuiaIA, publicarPlan, sugerirCampos, type PlanConDocentes,
} from '../../data/planCasa/persistencia';
import { USUARIOS } from '../../data/maestros';
import { asignaturasConNombre, gradoDeGrupo } from './nombres';
import EditorGuia from './EditorGuia';
import { ListaEntregas, useEntregas } from './EntregasPaso';
import {
  BarraEstadoGuia, BotonFormatoUAI, BotonCuadernillo, CajaError, Cargando, CLASE_BOTON, CLASE_BOTON_SEC, CLASE_INPUT, edicionDe, Etiqueta, fechaCorta, fechaLarga, hoyLocal, Marca,
  repartirTodas, resumenGuia, SugerirPreguntas,
} from './comun';

const EST_PASO: Record<EstadoPaso, string> = { pendiente: 'Pendiente', entregado: 'Entregado', revisado: 'Revisado' };
const EST_SUST: Record<EstadoSustentacion, string> = { sin_citar: 'Sin citar', citada: 'Citada', sustentada: 'Sustentada' };
type Nombres = Record<string, { asignatura: string; docente: string }>;
type EstadoProg = 'espera' | 'curso' | 'ok' | 'fallo';
interface Progreso { texto: string; estado: EstadoProg }

// ── Seguimiento (de una guía) ─────────────────────────────────────────────

function Seguimiento({ plan, g }: { plan: PlanConDocentes; g: GuiaPlan }) {
  const [error, setError] = useState('');
  const [borrador, setBorrador] = useState<Record<string, string>>({});
  const guia = g.aprobada!;
  const { entregas, error: errorEntregas } = useEntregas(plan.id, g.id);

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
      {errorEntregas && <CajaError>Entregas: {errorEntregas}</CajaError>}
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
            <ListaEntregas planId={plan.id} entregas={entregas.filter(e => e.pasoId === p.id)} />
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

// ── Guía cerrada: pedir autorización ──────────────────────────────────────

/** Aviso de cierre + formulario en línea para pedir a coordinación que reabra la guía. */
function PedirAutorizacion({ plan, g }: { plan: PlanConDocentes; g: GuiaPlan }) {
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState<string>(MOTIVOS_SOLICITUD[0]);
  const [detalle, setDetalle] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [solicitudes, setSolicitudes] = useState<SolicitudAutorizacion[]>([]);
  const yo = correoActual();
  useEffect(() => escucharSolicitudes(plan.id, setSolicitudes), [plan.id]);
  const ultima = solicitudes.filter(s => s.guiaId === g.id && s.correo === yo)[0];

  async function enviar() {
    setError(''); setEnviando(true);
    try { await pedirAutorizacion(plan.id, { guiaId: g.id, motivo, detalle }); setAbierto(false); setDetalle(''); }
    catch (e) { setError((e as Error).message || 'No se pudo enviar la solicitud.'); }
    finally { setEnviando(false); }
  }

  return (
    <div className="rounded-xl bg-warning-soft text-warning-soft-fg p-3 space-y-2 text-sm">
      <p>🔒 Cerrada desde el {fechaLarga(addDias(fechaCierre(plan), 1))}. Para cambiarla, pida autorización a coordinación.</p>
      {ultima?.estado === 'pendiente' && <p className="text-xs">Su solicitud está pendiente de respuesta.</p>}
      {ultima?.estado === 'negada' && <p className="text-xs">Su última solicitud no fue autorizada.</p>}
      {!abierto && ultima?.estado !== 'pendiente' && (
        <button onClick={() => setAbierto(true)} className={CLASE_BOTON_SEC}>Pedir autorización</button>
      )}
      {abierto && (
        <div className="space-y-2">
          <div><Etiqueta>Motivo</Etiqueta>
            <select value={motivo} onChange={e => setMotivo(e.target.value)} className={CLASE_INPUT}>
              {MOTIVOS_SOLICITUD.map(m => <option key={m} value={m}>{m}</option>)}
            </select></div>
          <div><Etiqueta>Qué necesita cambiar (corto)</Etiqueta>
            <input value={detalle} maxLength={300} onChange={e => setDetalle(e.target.value)} className={CLASE_INPUT} /></div>
          <div className="flex flex-wrap gap-2">
            <button onClick={enviar} disabled={enviando || (motivo === 'Otro' && !detalle.trim())} className={CLASE_BOTON}>{enviando ? 'Enviando…' : 'Enviar solicitud'}</button>
            <button onClick={() => setAbierto(false)} className={CLASE_BOTON_SEC}>Cancelar</button>
          </div>
        </div>
      )}
      {error && <CajaError>{error}</CajaError>}
    </div>
  );
}

// ── Criterios y aportes de una asignatura mía ─────────────────────────────

function NotaGestor() {
  return <p className="text-[11px] text-muted">Editando como superusuario/equipo</p>;
}

function CriteriosAsignatura({ plan, a, nombre, gestor, eje, guia }: { plan: PlanConDocentes; a: AsignaturaPlan; nombre: string; gestor: boolean; eje?: string; guia?: GuiaPlan }) {
  const bloqueada = !edicionDe(plan, guia, gestor).abierta;
  const [criterios, setCriterios] = useState(a.criteriosPromocion);
  const [aportes, setAportes] = useState(a.aportes ?? '');
  const [ebcDba, setEbcDba] = useState(a.ebcDba ?? '');
  const [evidencia, setEvidencia] = useState(a.evidenciaAprendizaje ?? '');
  const [entregable, setEntregable] = useState(a.entregable ?? '');
  const [fechaEntrega, setFechaEntrega] = useState(a.fechaEntrega ?? '');
  const [error, setError] = useState('');
  const [ok, setOk] = useState(false);
  const [sugiriendo, setSugiriendo] = useState(false);
  const [aviso, setAviso] = useState('');
  const [opcionesEnt, setOpcionesEnt] = useState<string[]>([]);
  const [pensandoEnt, setPensandoEnt] = useState(false);
  const sucio = criterios.trim() !== a.criteriosPromocion.trim() || aportes.trim() !== (a.aportes ?? '').trim()
    || ebcDba.trim() !== (a.ebcDba ?? '').trim() || evidencia.trim() !== (a.evidenciaAprendizaje ?? '').trim()
    || entregable.trim() !== (a.entregable ?? '').trim() || fechaEntrega !== (a.fechaEntrega ?? '');

  async function guardar() {
    setError(''); setOk(false);
    try { await guardarAsignatura(plan.id, a.asignaturaId, {
      criteriosPromocion: criterios.trim(), aportes: aportes.trim(), ebcDba: ebcDba.trim(), evidenciaAprendizaje: evidencia.trim(),
      entregable: entregable.trim(), fechaEntrega, porIA: false,
    }); setOk(true); }
    catch (e) { setError((e as Error).message); }
  }

  /** Rellena SOLO los campos vacíos; nunca pisa lo que el docente escribió. */
  async function sugerir() {
    setError(''); setAviso(''); setSugiriendo(true);
    try {
      const existentes = Object.fromEntries(Object.entries({ criteriosPromocion: criterios, ebcDba, evidenciaAprendizaje: evidencia, aportes })
        .filter(([, v]) => v.trim()));
      const c = await sugerirCampos({ modo: 'asignatura', asignaturas: [nombre], grado: gradoDeGrupo(plan.grupo), ajustes: plan.ajustes, existentes, ...(eje?.trim() ? { preguntaOrientadora: eje.trim() } : {}), ...(plan.sinTecnologia ? { sinTecnologia: true } : {}) });
      if (!criterios.trim() && c.criteriosPromocion) setCriterios(c.criteriosPromocion);
      if (!ebcDba.trim() && c.ebcDba) setEbcDba(c.ebcDba);
      if (!evidencia.trim() && c.evidenciaAprendizaje) setEvidencia(c.evidenciaAprendizaje);
      if (!aportes.trim() && c.aportes) setAportes(c.aportes);
      setAviso('Revise y ajuste antes de guardar.');
    } catch (e) { setError((e as Error).message); }
    finally { setSugiriendo(false); }
  }

  /** Tres entregables posibles, ligados a la pregunta orientadora; el docente elige uno o escribe el suyo. */
  async function sugerirEntregable() {
    setError(''); setPensandoEnt(true);
    try {
      const existentes = Object.fromEntries(Object.entries({ aportes, ebcDba, criteriosPromocion: criterios, evidenciaAprendizaje: evidencia }).filter(([, v]) => v.trim()));
      const c = await sugerirCampos({ modo: 'entregable', asignaturas: [nombre], grado: gradoDeGrupo(plan.grupo), ajustes: plan.ajustes, existentes,
        ...(eje?.trim() ? { preguntaOrientadora: eje.trim() } : {}), ...(plan.sinTecnologia ? { sinTecnologia: true } : {}) });
      setOpcionesEnt([c.opcion1, c.opcion2, c.opcion3].filter((x): x is string => !!x?.trim()));
    } catch (e) { setError((e as Error).message); }
    finally { setPensandoEnt(false); }
  }

  return (
    <div className="rounded-2xl border border-line bg-card p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-strong">{nombre}</h3>
        {a.porIA && <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-warning-soft text-warning-soft-fg">✨ Escrito por la IA · revíselo y toque Guardar</span>}
      </div>
      {gestor && <NotaGestor />}
      {bloqueada && <p className="rounded-xl bg-warning-soft text-warning-soft-fg text-xs p-3">🔒 Cerrada desde el {fechaLarga(addDias(fechaCierre(plan), 1))}: ya no se pueden cambiar los criterios. Para cambiarlos, pida autorización en la guía (más abajo).</p>}
      {plan.contextoDocentes?.trim() && (
        <div className="rounded-xl bg-elevated text-xs p-3">
          <p className="font-medium text-strong mb-1">Contexto del estudiante</p>
          <p className="text-soft whitespace-pre-wrap">{plan.contextoDocentes}</p>
        </div>
      )}
      {plan.ajustes.length > 0 && (
        <div className="rounded-xl bg-info-soft text-info-soft-fg text-xs p-3">
          <p className="font-medium mb-1">Ajustes razonables del estudiante</p>
          <ul className="list-disc pl-4 space-y-0.5">{plan.ajustes.map(x => <li key={x}>{x}</li>)}</ul>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={sugerir} disabled={sugiriendo || bloqueada} className={CLASE_BOTON_SEC}>{sugiriendo ? 'Pensando…' : '✨ Sugerir con IA'}</button>
        {aviso && !sugiriendo && <span className="text-xs text-soft">{aviso}</span>}
      </div>
      <div><Etiqueta>Temáticas de mi asignatura que la guía debe cubrir</Etiqueta>
        <textarea rows={2} value={aportes} onChange={e => setAportes(e.target.value)} className={CLASE_INPUT} /></div>
      <div><Etiqueta>Competencia (EBC/DBA esencial para esta área)</Etiqueta>
        <textarea rows={2} value={ebcDba} onChange={e => setEbcDba(e.target.value)} className={CLASE_INPUT} /></div>
      <div><Etiqueta>Criterios de promoción (qué debe demostrar para aprobar)</Etiqueta>
        <textarea rows={3} value={criterios} onChange={e => setCriterios(e.target.value)} className={CLASE_INPUT} /></div>
      <div><Etiqueta>Evidencia de aprendizaje esperada en esta área</Etiqueta>
        <textarea rows={2} value={evidencia} onChange={e => setEvidencia(e.target.value)} className={CLASE_INPUT} /></div>
      <div className="rounded-xl border border-accent/40 p-3 space-y-2">
        <div><Etiqueta>Entregable de mi asignatura (qué debe entregar el estudiante)</Etiqueta>
          <input value={entregable} onChange={e => setEntregable(e.target.value)} placeholder="Ej.: mapa conceptual en foto, audio explicando…" className={CLASE_INPUT} /></div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={sugerirEntregable} disabled={pensandoEnt || bloqueada} className={CLASE_BOTON_SEC}>{pensandoEnt ? 'Pensando…' : '✨ Proponer entregables con IA'}</button>
          {!eje?.trim() && <span className="text-[11px] text-muted">Aún no hay pregunta orientadora: la propuesta será general.</span>}
        </div>
        {opcionesEnt.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[11px] text-muted">Toque una para usarla (luego puede editarla):</p>
            {opcionesEnt.map((o, i) => (
              <button key={i} type="button" onClick={() => { setEntregable(o); setOpcionesEnt([]); }}
                className="w-full text-left text-sm rounded-xl border border-line bg-elevated hover:border-accent p-2.5 text-strong">{o}</button>
            ))}
          </div>
        )}
        <div><Etiqueta>Fecha de entrega</Etiqueta>
          <input type="date" value={fechaEntrega} min={plan.desde} max={plan.hasta} onChange={e => setFechaEntrega(e.target.value)} className={CLASE_INPUT} /></div>
        <p className="text-[11px] text-muted">Al aprobar la guía, este entregable entra a la agenda del estudiante en esa fecha.</p>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={guardar} disabled={!sucio || bloqueada} className={CLASE_BOTON_SEC}>Guardar</button>
        {ok && !sucio && <span className="text-xs text-success">Guardado.</span>}
        {ok && !sucio && guia?.propuesta && <span className="text-xs text-soft">La guía ya se generó; el líder verá su cambio.</span>}
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

/** correo → nombreCorto vía las asignaturas del plan (docenteId → USUARIOS); si no, el prefijo del correo. */
function nombreDocente(correo: string, asigs: AsignaturaPlan[]): string {
  const c = correo.toLowerCase();
  const id = asigs.find(a => a.docenteCorreo.toLowerCase() === c)?.docenteId;
  return USUARIOS.find(u => u.id === id)?.nombreCorto ?? USUARIOS.find(u => u.correo && u.correo.toLowerCase() === c)?.nombreCorto ?? c.split('@')[0];
}

/** Para el líder: qué docentes ya guardaron criterios (lo que la IA necesita) y su entregable con fecha. */
function CriteriosListos({ propias, nombre }: { propias: AsignaturaPlan[]; nombre: (id: string) => string }) {
  if (!propias.length) return null;
  const listos = propias.filter(a => a.criteriosPromocion.trim() && !a.porIA).length;
  return (
    <div className="rounded-xl border border-line p-3 space-y-2">
      <p className="text-xs text-soft"><b className="text-strong">Criterios de los docentes:</b> {listos} de {propias.length} listos{listos < propias.length ? ' · conviene esperarlos antes de generar la guía' : ''}</p>
      <div className="flex flex-wrap gap-1.5">
        {propias.map(a => <Marca key={a.asignaturaId} ok={!!a.criteriosPromocion.trim() && !a.porIA} etiqueta={`${nombre(a.asignaturaId)} (${nombreDocente(a.docenteCorreo, propias)})${a.porIA ? ' · por IA, sin revisar' : ''}`} />)}
      </div>
      <p className="text-xs text-soft"><b className="text-strong">Entregables con fecha:</b></p>
      <div className="flex flex-wrap gap-1.5">
        {propias.map(a => <Marca key={a.asignaturaId} ok={!!(a.entregable?.trim() && a.fechaEntrega)} etiqueta={nombre(a.asignaturaId) + (a.fechaEntrega ? ` · ${fechaCorta(a.fechaEntrega)}` : '')} />)}
      </div>
    </div>
  );
}

function VistosBuenos({ g, asigs }: { g: GuiaPlan; asigs: AsignaturaPlan[] }) {
  if (g.docentesCorreos.length <= 1) return null;
  return (
    <div className="flex flex-wrap gap-1.5 items-center">
      <span className="text-xs text-soft">Vistos buenos:</span>
      {g.docentesCorreos.map(c => <Marca key={c} ok={!!g.vistosBuenos?.[c]} etiqueta={nombreDocente(c, asigs)} />)}
    </div>
  );
}

// ── Guía donde soy responsable ────────────────────────────────────────────

/** Agrega (o actualiza) un paso «Entregable de <asignatura>» por cada asignatura que tenga entregable. */
function conEntregables(guia: Guia, asigs: AsignaturaPlan[], nombre: (id: string) => string, desde: string): Guia {
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

function GuiaResponsable({ plan, g, todas, asigs, nombres, gestor }: {
  gestor: boolean; plan: PlanConDocentes; g: GuiaPlan; todas: GuiaPlan[]; asigs: AsignaturaPlan[]; nombres: Nombres;
}) {
  const [pedido, setPedido] = useState<PedidoGuia>(g.pedido ?? { tematicas: '', competencias: '', textoReferencia: '' });
  const [borrador, setBorrador] = useState<Guia | null>(g.propuesta ?? null);
  const [indicacion, setIndicacion] = useState('');
  const [generando, setGenerando] = useState(false);
  const [aprobando, setAprobando] = useState(false);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [editando, setEditando] = useState(false);
  const [sugiriendo, setSugiriendo] = useState(false);
  const [avisoSug, setAvisoSug] = useState('');
  const [generandoTodo, setGenerandoTodo] = useState(false);
  const [confirmarIA, setConfirmarIA] = useState(false);
  const [progreso, setProgreso] = useState<Progreso[]>([]);
  const refPropuesta = useRef<HTMLDivElement>(null);
  const [eje, setEje] = useState(g.eje);
  const [guardandoEje, setGuardandoEje] = useState(false);
  useEffect(() => { setEje(g.eje); }, [g.eje]);
  const r = resumenGuia(g);
  const edicion = edicionDe(plan, g, gestor);
  const cerrada = !edicion.abierta;
  const despuesDelCierre = hoyLocal() > fechaCierre(plan);
  const transversal = g.asignaturaIds.length > 1 || plan.modalidad === 'transversal';
  const nombre = (id: string) => nombres[id]?.asignatura ?? id;

  useEffect(() => { if (!borrador && g.propuesta) setBorrador(g.propuesta); }, [g.propuesta, borrador]);

  const propias = g.asignaturaIds.map(id => asigs.find(a => a.asignaturaId === id)).filter((a): a is AsignaturaPlan => !!a);
  const faltanCriterios = propias.filter(a => !a.criteriosPromocion.trim());
  const cambiadas = cerrada ? [] : asignaturasCambiadas(g, asigs);

  /** Rellena SOLO los campos vacíos del pedido. */
  async function sugerirPedido() {
    setError(''); setAvisoSug(''); setSugiriendo(true);
    try {
      const existentes: Record<string, string> = {};
      if (pedido.tematicas.trim()) existentes.tematicas = pedido.tematicas.trim();
      if (pedido.competencias.trim()) existentes.competencias = pedido.competencias.trim();
      if (pedido.textoReferencia?.trim()) existentes.textoReferencia = pedido.textoReferencia.trim();
      for (const a of propias) {
        const n = nombre(a.asignaturaId);
        if (a.criteriosPromocion.trim()) existentes[`criterios de ${n}`] = a.criteriosPromocion.trim();
        if (a.ebcDba?.trim()) existentes[`EBC/DBA de ${n}`] = a.ebcDba.trim();
        if (a.aportes?.trim()) existentes[`aportes de ${n}`] = a.aportes.trim();
      }
      const c = await sugerirCampos({
        modo: 'pedido', preguntaOrientadora: g.eje, asignaturas: g.asignaturaIds.map(nombre),
        grado: gradoDeGrupo(plan.grupo), ajustes: plan.ajustes, existentes, ...(plan.sinTecnologia ? { sinTecnologia: true } : {}),
      });
      setPedido(p => ({
        tematicas: p.tematicas.trim() ? p.tematicas : (c.tematicas ?? ''),
        competencias: p.competencias.trim() ? p.competencias : (c.competencias ?? ''),
        textoReferencia: p.textoReferencia?.trim() ? p.textoReferencia : (c.textoReferencia ?? ''),
      }));
      setAvisoSug('Revise y ajuste antes de generar.');
    } catch (e) { setError((e as Error).message); }
    finally { setSugiriendo(false); }
  }

  /** Pide la guía a la IA con las asignaturas dadas y la guarda como propuesta. */
  async function pedirYGuardar(limpio: PedidoGuia, pr: AsignaturaPlan[]) {
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
      pedido: limpio, ...(indicacion.trim() ? { indicacion: indicacion.trim() } : {}),
    });
    const conEnt = conEntregables(guia, pr, nombre, plan.desde);
    setBorrador(conEnt); setIndicacion('');
    await guardarGuia(plan.id, g.id, { pedido: limpio, propuesta: conEnt, propuestaEn: Date.now() });
  }

  async function generar() {
    if (!pedido.tematicas.trim() || !pedido.competencias.trim()) return setError('Escriba las temáticas y las competencias.');
    setError(''); setAviso(''); setGenerando(true);
    const limpio: PedidoGuia = { tematicas: pedido.tematicas.trim(), competencias: pedido.competencias.trim(), ...(pedido.textoReferencia?.trim() ? { textoReferencia: pedido.textoReferencia.trim() } : {}) };
    try { await pedirYGuardar(limpio, propias); }
    catch (e) { setError((e as Error).message); }
    finally { setGenerando(false); }
  }

  function marcar(i: number, estado: EstadoProg, texto?: string) {
    setProgreso(p => p.map((x, k) => k === i ? { texto: texto ?? x.texto, estado } : x));
  }

  /** Un toque: completa lo vacío de cada asignatura y del pedido, y pide la guía. Nunca pisa lo escrito. */
  async function generarTodo() {
    setError(''); setAviso(''); setGenerandoTodo(true);
    const vacia = (a: AsignaturaPlan) => !a.criteriosPromocion.trim() || !a.ebcDba?.trim() || !a.evidenciaAprendizaje?.trim() || !a.aportes?.trim();
    const aCompletar = propias.filter(vacia);
    const pasos: Progreso[] = aCompletar.map(a => ({ texto: `Preparando ${nombre(a.asignaturaId)}…`, estado: 'curso' as EstadoProg }));
    const iPedido = pasos.length; pasos.push({ texto: 'Preparando temáticas y competencias…', estado: 'espera' });
    const iGuia = pasos.length; pasos.push({ texto: 'Pidiendo la guía…', estado: 'espera' });
    setProgreso(pasos);
    const grado = gradoDeGrupo(plan.grupo);
    const fallos: string[] = [];
    const actuales = new Map<string, AsignaturaPlan>(propias.map(a => [a.asignaturaId, a]));
    try {
      await Promise.all(aCompletar.map(async (a, i) => {
        const n = nombre(a.asignaturaId);
        try {
          const existentes = Object.fromEntries(Object.entries({ criteriosPromocion: a.criteriosPromocion, ebcDba: a.ebcDba ?? '', evidenciaAprendizaje: a.evidenciaAprendizaje ?? '', aportes: a.aportes ?? '' })
            .filter(([, v]) => v.trim()));
          const c = await sugerirCampos({ modo: 'asignatura', asignaturas: [n], grado, ajustes: plan.ajustes, existentes, ...(plan.sinTecnologia ? { sinTecnologia: true } : {}) });
          const nuevo: AsignaturaPlan = {
            ...a,
            criteriosPromocion: a.criteriosPromocion.trim() ? a.criteriosPromocion : (c.criteriosPromocion ?? ''),
            ebcDba: a.ebcDba?.trim() ? a.ebcDba : (c.ebcDba ?? ''),
            evidenciaAprendizaje: a.evidenciaAprendizaje?.trim() ? a.evidenciaAprendizaje : (c.evidenciaAprendizaje ?? ''),
            aportes: a.aportes?.trim() ? a.aportes : (c.aportes ?? ''),
          };
          actuales.set(a.asignaturaId, nuevo);
          try {
            await guardarAsignatura(plan.id, a.asignaturaId, {
              criteriosPromocion: nuevo.criteriosPromocion, ebcDba: nuevo.ebcDba, evidenciaAprendizaje: nuevo.evidenciaAprendizaje, aportes: nuevo.aportes, porIA: true,
            });
          } catch { /* sin permiso para guardar: se usa igual en esta generación */ }
          marcar(i, 'ok', `${n} lista`);
        } catch (e) { fallos.push(n); marcar(i, 'fallo', `${n}: ${(e as Error).message}`); }
      }));

      // Pedido: solo si falta algo
      let ped: PedidoGuia = { tematicas: pedido.tematicas.trim(), competencias: pedido.competencias.trim(), ...(pedido.textoReferencia?.trim() ? { textoReferencia: pedido.textoReferencia.trim() } : {}) };
      if (!ped.tematicas || !ped.competencias) {
        marcar(iPedido, 'curso');
        try {
          const existentes: Record<string, string> = {};
          if (ped.tematicas) existentes.tematicas = ped.tematicas;
          if (ped.competencias) existentes.competencias = ped.competencias;
          if (ped.textoReferencia) existentes.textoReferencia = ped.textoReferencia;
          for (const a of actuales.values()) {
            const n = nombre(a.asignaturaId);
            if (a.criteriosPromocion.trim()) existentes[`criterios de ${n}`] = a.criteriosPromocion.trim();
            if (a.ebcDba?.trim()) existentes[`EBC/DBA de ${n}`] = a.ebcDba.trim();
            if (a.aportes?.trim()) existentes[`aportes de ${n}`] = a.aportes.trim();
          }
          const c = await sugerirCampos({ modo: 'pedido', preguntaOrientadora: g.eje, asignaturas: g.asignaturaIds.map(nombre), grado, ajustes: plan.ajustes, existentes, ...(plan.sinTecnologia ? { sinTecnologia: true } : {}) });
          const ref = ped.textoReferencia || (c.textoReferencia ?? '').trim();
          ped = {
            tematicas: ped.tematicas || (c.tematicas ?? '').trim(),
            competencias: ped.competencias || (c.competencias ?? '').trim(),
            ...(ref ? { textoReferencia: ref } : {}),
          };
          setPedido(ped);
          marcar(iPedido, 'ok', 'Temáticas y competencias listas');
        } catch (e) { marcar(iPedido, 'fallo', `Temáticas y competencias: ${(e as Error).message}`); }
      } else marcar(iPedido, 'ok', 'Temáticas y competencias ya estaban');

      if (!ped.tematicas || !ped.competencias) {
        marcar(iGuia, 'fallo', 'No se pudo pedir la guía: faltan temáticas y competencias.');
        setError('No se pudo completar el pedido. Escriba las temáticas y competencias en «Ver y ajustar detalles» y use «Generar guía con IA».');
        return;
      }
      marcar(iGuia, 'curso');
      try {
        await pedirYGuardar(ped, propias.map(a => actuales.get(a.asignaturaId) ?? a));
        marcar(iGuia, 'ok', 'Guía lista');
        setAviso(fallos.length ? `Guía lista, pero no se pudo completar: ${fallos.join(', ')}. Revise esa asignatura en «Ver y ajustar detalles».` : 'Guía lista. Revísela y apruébela.');
        setTimeout(() => refPropuesta.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
      } catch (e) { marcar(iGuia, 'fallo', `Guía: ${(e as Error).message}`); setError((e as Error).message); }
    } finally { setGenerandoTodo(false); }
  }

  /** Vuelve a generar la guía con los criterios actuales de los docentes. */
  async function actualizarConCambios() {
    setEditando(true);
    await generar();
  }

  async function guardarEje() {
    setError(''); setGuardandoEje(true);
    try { await guardarGuia(plan.id, g.id, { eje: eje.trim() }); setAviso('Pregunta orientadora guardada.'); }
    catch (e) { setError((e as Error).message); }
    finally { setGuardandoEje(false); }
  }

  async function aprobar() {
    if (!borrador) return;
    if (!borrador.pasos.length || borrador.pasos.some(p => !p.titulo.trim())) return setError('Cada paso necesita un título.');
    setError(''); setAviso(''); setAprobando(true);
    try {
      const otras = todas.filter(x => x.id !== g.id && x.aprobada).map(x => ({ guiaId: x.id, pasos: x.aprobada!.pasos }));
      // Los entregables que cada docente puso en su asignatura (pueden haber llegado después de generar).
      const base = conEntregables(borrador, propias, nombre, plan.desde);
      const { pasos: rep, avisos } = repartirTodas(plan, [...otras, { guiaId: g.id, pasos: base.pasos }]);
      let aprobada: Guia = { ...base, pasos: rep[g.id] ?? base.pasos };
      // Pasada la fecha de cierre, lo que ya ocurrió (fecha anterior a mañana) no se toca.
      let protegidos = 0;
      if (despuesDelCierre) {
        const pr = protegerPasosPasados(aprobada.pasos, g.aprobada?.pasos, addDias(hoyLocal(), 1));
        aprobada = { ...aprobada, pasos: pr.pasos }; protegidos = pr.restaurados;
      }
      const cambio = !g.aprobada || JSON.stringify(g.aprobada) !== JSON.stringify(aprobada);
      const ahora = Date.now();
      await guardarGuia(plan.id, g.id, {
        aprobada, aprobadaEn: ahora, propuesta: aprobada, propuestaEn: ahora,
        ...(cambio && Object.keys(g.vistosBuenos ?? {}).length ? { vistosBuenos: {} } : {}),
      });
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
      if (protegidos) msg += ` Se conservaron sin cambios ${protegidos} paso(s) cuya fecha ya pasó.`;
      if (sinPermiso) msg += ` (${sinPermiso} guía(s) de otros docentes no se reprogramaron.)`;
      setAviso(msg); setEditando(false);
    } catch (e) { setError((e as Error).message); }
    finally { setAprobando(false); }
  }

  return (
    <div className="rounded-2xl border border-line bg-card p-4 space-y-4">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-strong">{transversal ? `Guía · ${g.asignaturaIds.map(nombre).join(' · ')}` : `Guía: ${g.eje}`}</h3>
          {transversal && <p className="text-xs text-muted">{g.eje ? `Pregunta orientadora: ${g.eje}` : 'Pregunta orientadora pendiente.'}</p>}
        </div>
        {r.guia && <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-success-soft text-success-soft-fg flex-shrink-0">✓ Aprobada</span>}
      </div>
      <BarraEstadoGuia g={g} edicion={edicion} />
      {gestor && <NotaGestor />}
      {cerrada && <PedirAutorizacion plan={plan} g={g} />}
      {cambiadas.length > 0 && (
        <div className="rounded-xl bg-warning-soft text-warning-soft-fg p-3 space-y-2 text-sm">
          <p>⚠ {cambiadas.map(nombre).join(', ')} cambió sus criterios después de generar la guía.</p>
          <div className="flex flex-wrap gap-2">
            <button onClick={actualizarConCambios} disabled={generando || generandoTodo} className={CLASE_BOTON}>{generando ? 'Actualizando…' : 'Actualizar con los cambios'}</button>
            <button onClick={() => { setBorrador(g.propuesta ?? g.aprobada ?? null); setEditando(true); }} className={CLASE_BOTON_SEC}>Lo ajusto yo</button>
          </div>
        </div>
      )}
      {transversal && !cerrada && (
        <div className="rounded-xl border border-line p-3 space-y-2">
          <Etiqueta>Pregunta orientadora</Etiqueta>
          <div className="flex gap-2">
            <input value={eje} onChange={e => setEje(e.target.value)} placeholder="Pregunta orientadora / problema del contexto" className={CLASE_INPUT} />
            <button onClick={guardarEje} disabled={guardandoEje || eje.trim() === (g.eje ?? '').trim()} className={cn(CLASE_BOTON_SEC, 'flex-shrink-0')}>
              {guardandoEje ? 'Guardando…' : 'Guardar pregunta'}
            </button>
          </div>
          <SugerirPreguntas asignaturas={g.asignaturaIds.map(nombre)} grado={gradoDeGrupo(plan.grupo)} ajustes={plan.ajustes} onUsar={setEje} />
        </div>
      )}
      <CriteriosListos propias={propias} nombre={nombre} />
      <VistosBuenos g={g} asigs={asigs} />

      {!cerrada && (!r.guia || editando) && (
        <div className="space-y-3">
          {plan.contextoDocentes?.trim() && (
            <div className="rounded-xl bg-elevated text-xs p-3">
              <p className="font-medium text-strong mb-1">Contexto del estudiante</p>
              <p className="text-soft whitespace-pre-wrap">{plan.contextoDocentes}</p>
            </div>
          )}
          {plan.ajustes.length > 0 && (
            <div className="rounded-xl bg-info-soft text-info-soft-fg text-xs p-3">
              <p className="font-medium mb-1">Ajustes razonables del estudiante</p>
              <ul className="list-disc pl-4 space-y-0.5">{plan.ajustes.map(x => <li key={x}>{x}</li>)}</ul>
            </div>
          )}
          {confirmarIA && (
            <div className="rounded-xl border border-warning bg-warning-soft text-warning-soft-fg p-3 space-y-2 text-sm">
              <p>Faltan los criterios de: <b>{faltanCriterios.map(a => nombre(a.asignaturaId)).join(', ')}</b>. Si sigue, la IA los inventará y la guía no tendrá lo que pide cada docente.</p>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setConfirmarIA(false)} className={CLASE_BOTON}>Esperar a los docentes</button>
                <button onClick={() => { setConfirmarIA(false); generarTodo(); }} className={CLASE_BOTON_SEC}>Seguir, que la IA los complete</button>
              </div>
            </div>
          )}
          <button onClick={() => (faltanCriterios.length ? setConfirmarIA(true) : generarTodo())} disabled={generandoTodo || generando || (transversal && !g.eje.trim())}
            className={cn(CLASE_BOTON, 'w-full justify-center py-3 text-base')}>
            <Sparkles size={18} />{generandoTodo ? 'Trabajando…' : borrador ? '✨ Generar todo de nuevo con IA' : '✨ Generar todo con IA'}
          </button>
          {transversal && !g.eje.trim() && <p className="text-xs text-warning">Primero escoja la pregunta orientadora (y guárdela).</p>}
          <p className="text-[11px] text-muted">Completa lo que esté vacío (nunca pisa lo que usted escribió) y prepara la guía para que la revise.</p>
          {progreso.length > 0 && (
            <ul className="space-y-1 text-sm">
              {progreso.map((p, i) => (
                <li key={i} className={cn(p.estado === 'fallo' ? 'text-danger' : p.estado === 'ok' ? 'text-success' : 'text-soft')}>
                  {p.estado === 'ok' ? '✓ ' : p.estado === 'fallo' ? '✗ ' : p.estado === 'curso' ? '… ' : '· '}{p.texto}
                </li>))}
            </ul>
          )}
          <details className="rounded-xl border border-line p-3">
            <summary className="cursor-pointer text-sm font-medium text-strong">Ver y ajustar detalles (opcional)</summary>
            <div className="space-y-3 mt-3">
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={sugerirPedido} disabled={sugiriendo || generando || generandoTodo} className={CLASE_BOTON_SEC}>{sugiriendo ? 'Pensando…' : '✨ Sugerir con IA'}</button>
                {avisoSug && !sugiriendo && <span className="text-xs text-soft">{avisoSug}</span>}
              </div>
              <div><Etiqueta>Temáticas</Etiqueta>
                <textarea rows={2} value={pedido.tematicas} onChange={e => setPedido({ ...pedido, tematicas: e.target.value })} className={CLASE_INPUT} /></div>
              <div><Etiqueta>Competencias o habilidades a desarrollar</Etiqueta>
                <textarea rows={2} value={pedido.competencias} onChange={e => setPedido({ ...pedido, competencias: e.target.value })} className={CLASE_INPUT} /></div>
              <div><Etiqueta>Texto, lectura o enlace de referencia (opcional)</Etiqueta>
                <textarea rows={2} value={pedido.textoReferencia ?? ''} onChange={e => setPedido({ ...pedido, textoReferencia: e.target.value })} className={CLASE_INPUT} /></div>
              {borrador && <input value={indicacion} onChange={e => setIndicacion(e.target.value)} placeholder="Indicación para otra versión: «más corta», «más práctica»…" className={CLASE_INPUT} />}
              {faltanCriterios.length > 0 && <p className="text-[11px] text-muted">Aún faltan criterios de promoción en: {faltanCriterios.map(a => nombre(a.asignaturaId)).join(', ')}. «Generar todo con IA» los completa.</p>}
              <button onClick={generar} disabled={generando || generandoTodo} className={CLASE_BOTON_SEC}><Sparkles size={15} />{borrador ? 'Otra versión' : 'Generar guía con IA'}</button>
            </div>
          </details>
          {(generando || generandoTodo) && <Cargando texto="La IA está trabajando (puede tardar hasta un minuto)…" />}
          <p className="text-[11px] text-muted">A la IA no se le envía el nombre del estudiante ni su motivo: solo los ajustes y los datos de la asignatura.</p>
        </div>
      )}

      {!cerrada && borrador && (!r.guia || editando) && !generando && !generandoTodo && (
        <div ref={refPropuesta} className="space-y-3 border-t border-line pt-4">
          <h4 className="text-sm font-semibold text-strong">Propuesta (edítela a su gusto)</h4>
          <EditorGuia guia={borrador} onChange={setBorrador} />
          <div className="flex flex-wrap gap-2">
            <button onClick={aprobar} disabled={aprobando} className={CLASE_BOTON}><Check size={15} />{aprobando ? 'Aprobando…' : 'Aprobar y publicar'}</button>
            <BotonFormatoUAI plan={plan} guias={[{ ...g, propuesta: borrador }]} asigs={asigs} nombres={nombres} />
          </div>
          <p className="text-[11px] text-muted">Nada llega al estudiante hasta que usted apruebe.{g.docentesCorreos.length > 1 ? ' Los vistos buenos de los demás docentes se muestran pero no bloquean.' : ''}</p>
        </div>
      )}

      {cerrada && !r.guia && g.propuesta && (
        <div className="border-t border-line pt-4 space-y-2"><p className="text-xs text-soft">Propuesta sin aprobar.</p><GuiaLectura guia={g.propuesta} /></div>
      )}
      {r.guia && (!editando || cerrada) && (
        <div className="space-y-4 border-t border-line pt-4">
          <GuiaLectura guia={g.aprobada!} />
          <div className="flex flex-wrap gap-2">
            {!cerrada && <button onClick={() => { setBorrador(g.aprobada!); setEditando(true); }} className={CLASE_BOTON_SEC}>Reabrir para corregir</button>}
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

function GuiaParticipante({ plan, g, asigs, nombres, gestor }: { plan: PlanConDocentes; g: GuiaPlan; asigs: AsignaturaPlan[]; nombres: Nombres; gestor: boolean }) {
  const yo = correoActual();
  const edicion = edicionDe(plan, g, gestor);
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
        <h3 className="text-sm font-semibold text-strong min-w-0 flex-1">Guía de {nombreDocente(g.responsableCorreo, asigs)}: {g.eje || 'Pendiente: la define el responsable'}</h3>
        {g.aprobada && <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-success-soft text-success-soft-fg flex-shrink-0">✓ Aprobada</span>}
      </div>
      <BarraEstadoGuia g={g} edicion={edicion} />
      {!edicion.abierta && <PedirAutorizacion plan={plan} g={g} />}
      <VistosBuenos g={g} asigs={asigs} />
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

function PlanDocente({ plan, gestor }: { plan: PlanConDocentes; gestor: boolean }) {
  const [asigs, setAsigs] = useState<AsignaturaPlan[] | null>(null);
  const [guias, setGuias] = useState<GuiaPlan[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => escucharAsignaturas(plan.id, setAsigs, e => { setError(e.message); setAsigs([]); }), [plan.id]);
  useEffect(() => escucharGuias(plan.id, setGuias, e => { setError(e.message); setGuias([]); }), [plan.id]);
  const nombres = useMemo(() => asignaturasConNombre(plan.grupo), [plan.grupo]);
  const yo = correoActual();
  const mias = (asigs ?? []).filter(a => gestor || a.docenteCorreo.toLowerCase() === yo);
  const responsable = (guias ?? []).filter(g => gestor || g.responsableCorreo.toLowerCase() === yo);
  const propiasMias = mias.filter(a => a.docenteCorreo.toLowerCase() === yo);
  const otrasMias = mias.filter(a => a.docenteCorreo.toLowerCase() !== yo);
  const guiaDe = (id: string) => (guias ?? []).find(g => g.asignaturaIds.includes(id));
  const ejeDe = (id: string) => guiaDe(id)?.eje;
  const participo = gestor ? [] : (guias ?? []).filter(g => g.responsableCorreo.toLowerCase() !== yo && g.docentesCorreos.map(c => c.toLowerCase()).includes(yo));

  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-base font-semibold text-strong">{plan.nombres.split(' ')[0]} {plan.apellidos.split(' ')[0]} · {plan.grupo}</h3>
        <p className="text-xs text-soft">Del {fechaCorta(plan.desde)} al {fechaCorta(plan.hasta)} · máximo {plan.topeDiario} momentos por día{plan.ritmo === 'dia_por_medio' ? ' (día por medio)' : ''} · guías {plan.modalidad === 'transversal' ? 'transversales' : 'por asignatura'}</p>
      </div>
      {guias && <BotonCuadernillo plan={plan} guias={guias} nombres={nombres} />}
      {error && <CajaError>{error}</CajaError>}
      {(!asigs || !guias) && !error && <Cargando texto="Cargando…" />}
      {asigs && guias && mias.length === 0 && !error && <p className="text-sm text-soft">No tiene asignaturas en este plan.</p>}
      {propiasMias.length > 0 && (
        <details open className="rounded-2xl border border-line bg-card p-4">
          <summary className="cursor-pointer text-sm font-medium text-strong">Paso 1 · {propiasMias.length === 1 ? 'Mi asignatura' : 'Mis asignaturas'}: temáticas, competencia, criterios, entregable y fecha de entrega</summary>
          <div className="space-y-3 mt-3">
            {propiasMias.map(a => <CriteriosAsignatura key={a.asignaturaId} plan={plan} a={a} gestor={gestor} eje={ejeDe(a.asignaturaId)} guia={guiaDe(a.asignaturaId)} nombre={nombres[a.asignaturaId]?.asignatura ?? a.asignaturaId} />)}
          </div>
        </details>
      )}
      {otrasMias.length > 0 && (
        <details className="rounded-2xl border border-line bg-card p-4">
          <summary className="cursor-pointer text-sm font-medium text-strong">Asignaturas de los otros docentes ({otrasMias.length})</summary>
          <div className="space-y-3 mt-3">
            {otrasMias.map(a => <CriteriosAsignatura key={a.asignaturaId} plan={plan} a={a} gestor={gestor} eje={ejeDe(a.asignaturaId)} guia={guiaDe(a.asignaturaId)} nombre={nombres[a.asignaturaId]?.asignatura ?? a.asignaturaId} />)}
          </div>
        </details>
      )}
      {responsable.map(g => <GuiaResponsable key={g.id} gestor={gestor} plan={plan} g={g} todas={guias ?? []} asigs={asigs ?? []} nombres={nombres} />)}
      {participo.map(g => <GuiaParticipante key={g.id} gestor={gestor} plan={plan} g={g} asigs={asigs ?? []} nombres={nombres} />)}
    </section>
  );
}

export default function PlanCasaDocente() {
  const [planes, setPlanes] = useState<PlanConDocentes[] | null>(null);
  const [error, setError] = useState('');
  const rol = useAppStore(s => s.rol);
  const [enEquipo, setEnEquipo] = useState<boolean | null>(null);
  useEffect(() => { leerEquipo().then(l => setEnEquipo(l.includes(correoActual()))); }, []);
  const gestor = rol === 'superusuario' || rol === 'coordinador' || enEquipo === true;
  useEffect(() => enEquipo === null ? undefined : escucharPlanes(gestor, setPlanes, e => { setError(e.message || 'No se pudieron leer los planes.'); setPlanes([]); }), [gestor, enEquipo]);

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      <h2 className="text-lg font-semibold text-strong">Plan Académico Especial</h2>
      {error && <CajaError>{error}</CajaError>}
      {!planes && <Cargando texto="Cargando planes…" />}
      {planes && planes.length === 0 && !error && <p className="text-sm text-soft">No tiene estudiantes con Plan Académico Especial.</p>}
      {planes?.filter(p => p.estado === 'activo').map(p => <PlanDocente key={p.id} plan={p} gestor={gestor} />)}
    </div>
  );
}
