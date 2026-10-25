// Planes en casa — panel del equipo (UAI / orientador), coordinación y superusuario.
// Crea planes, muestra el tablero por estudiante y el QR de la agenda pública.
import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { Check, ChevronDown, Copy, Plus, QrCode, RefreshCw, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buscarEstudiantes } from '../../asistencia/datos';
import type { Student } from '../../asistencia/domain/types';
import { ASIGNACION_2026 } from '../../data/asignacionAcademica';
import {
  AJUSTES_FRECUENTES, AJUSTE_SIN_TECNOLOGIA, TOPE_DIARIO_DEFECTO, type AsignaturaPlan, type GuiaPlan, type ModalidadGuias, type PlanCasa, type RitmoPlan,
} from '../../data/planCasa/tipos';
import {
  asignaturasDelGrupo, cambiarEstadoPlan, crearPlan, escucharAsignaturas, escucharGuias, escucharPlanes, type GuiaTransversalDef,
  guardarContexto, guardarSinTecnologia, leerMotivo, regenerarToken, urlPublica, type PlanConDocentes,
} from '../../data/planCasa/persistencia';
import { asignaturasConNombre } from './nombres';
import { conSinTecnologia } from '../../data/planCasa/logica';
import {
  BotonFormatoUAI, BotonCuadernillo, CajaError, Cargando, CLASE_BOTON, CLASE_BOTON_SEC, CLASE_INPUT, criteriosPuestos, Etiqueta, fechaCorta, Marca,
  resumenGuia, TEXTO_SUSTENTACION,
} from './comun';

const SEDE = 'central';
const GRUPOS = [...new Set(ASIGNACION_2026.map(e => e.grupo))];
const NIVEL = (g: string) => (g.includes('º') ? 1 : 0);

function hoyISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ── Formulario «Nuevo plan» ───────────────────────────────────────────────

function NuevoPlan({ onCerrar, onCreado }: { onCerrar: () => void; onCreado: (msg: string) => void }) {
  const [texto, setTexto] = useState('');
  const [grupoFiltro, setGrupoFiltro] = useState('');
  const [resultados, setResultados] = useState<Student[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [est, setEst] = useState<Student | null>(null);
  const [desde, setDesde] = useState(hoyISO());
  const [hasta, setHasta] = useState('');
  const [motivo, setMotivo] = useState('');
  const [contexto, setContexto] = useState('');
  const [ajustes, setAjustes] = useState<string[]>([]);
  const [libre, setLibre] = useState('');
  const [sinTec, setSinTec] = useState(false);
  const [tope, setTope] = useState(TOPE_DIARIO_DEFECTO);
  const [ritmo, setRitmo] = useState<RitmoPlan>('diario');
  const [modalidad, setModalidad] = useState<ModalidadGuias>('por_asignatura');
  const [defs, setDefs] = useState<GuiaTransversalDef[]>([{ eje: '', asignaturaIds: [], responsableDocenteId: '' }]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [paso, setPaso] = useState(1);
  // Errores por campo: se muestran junto al campo que falla.
  const [errs, setErrs] = useState<Record<string, string>>({});

  // Búsqueda por nombre en los estudiantes de asistencia (solo lectura).
  useEffect(() => {
    if (est || texto.trim().length < 2) { setResultados([]); return; }
    let vivo = true;
    setBuscando(true);
    const t = setTimeout(() => {
      buscarEstudiantes(SEDE, texto, false, g => !grupoFiltro || g === grupoFiltro)
        .then(r => { if (vivo) setResultados(r); })
        .catch(() => { if (vivo) setResultados([]); })
        .finally(() => { if (vivo) setBuscando(false); });
    }, 250);
    return () => { vivo = false; clearTimeout(t); };
  }, [texto, grupoFiltro, est]);

  const asigs = useMemo(() => (est ? asignaturasDelGrupo(est.gradoActual) : []), [est]);
  const usadas = new Set(defs.flatMap(g => g.asignaturaIds));
  const sinAsignar = asigs.filter(a => !usadas.has(a.asignaturaId));
  const setDef = (i: number, c: Partial<GuiaTransversalDef>) => setDefs(l => l.map((g, j) => (j === i ? { ...g, ...c } : g)));
  function alternarAsig(i: number, aid: string) {
    const g = defs[i];
    const ids = g.asignaturaIds.includes(aid) ? g.asignaturaIds.filter(x => x !== aid) : [...g.asignaturaIds, aid];
    const docs = ids.map(x => asigs.find(a => a.asignaturaId === x)?.docenteId);
    setDef(i, { asignaturaIds: ids, responsableDocenteId: docs.includes(g.responsableDocenteId) ? g.responsableDocenteId : '' });
  }
  function cambiarSinTec(v: boolean) { const r = conSinTecnologia(ajustes, v); setSinTec(r.sinTecnologia); setAjustes(r.ajustes); }
  const alternar = (a: string) => {
    if (a === AJUSTE_SIN_TECNOLOGIA) return cambiarSinTec(!ajustes.includes(a));
    setAjustes(l => (l.includes(a) ? l.filter(x => x !== a) : [...l, a]));
  };

  function agregarLibre() {
    const t = libre.trim();
    if (t && !ajustes.includes(t)) setAjustes(l => [...l, t]);
    setLibre('');
  }

  // Valida un paso y devuelve los errores por campo (vacío = todo bien).
  function validar(p: number): Record<string, string> {
    const e: Record<string, string> = {};
    if (p === 1) {
      if (!est) e.est = 'Escoja al estudiante.';
      else if (!asigs.length) e.est = `No hay asignación académica para el grupo ${est.gradoActual}.`;
      if (!desde) e.desde = 'Indique la fecha de inicio.';
      if (!hasta) e.hasta = 'Indique la fecha final.';
      else if (desde && hasta < desde) e.hasta = '«Hasta» debe ser posterior a «desde».';
    }
    if (p === 2 && !motivo.trim()) e.motivo = 'Escriba el motivo (queda reservado).';
    if (p === 3 && modalidad === 'transversal') {
      if (sinAsignar.length) e.guias = `Faltan asignaturas por ubicar en una guía: ${sinAsignar.map(a => a.asignaturaNombre).join(', ')}.`;
      else if (defs.some(g => !g.asignaturaIds.length || !g.responsableDocenteId)) e.guias = 'Cada guía necesita asignaturas y responsable (quite las guías vacías).';
    }
    return e;
  }
  function siguiente() {
    const e = validar(paso);
    setErrs(e);
    if (Object.keys(e).length === 0) setPaso(paso + 1);
  }
  function atras() { setErrs({}); setError(''); setPaso(paso - 1); }

  async function guardar() {
    if (!est) return;
    // Revalida todos los pasos y vuelve al primero que falle.
    for (const p of [1, 2, 3]) {
      const e = validar(p);
      if (Object.keys(e).length) { setErrs(e); setPaso(p); return; }
    }
    setErrs({});
    setError(''); setGuardando(true);
    try {
      const r = await crearPlan({
        studentId: est.studentId, nombres: est.nombres, apellidos: est.apellidos, grupo: est.gradoActual,
        desde, hasta, motivo: motivo.trim(), contextoDocentes: contexto, ajustes, topeDiario: tope, ritmo, modalidad, ...(sinTec ? { sinTecnologia: true } : {}),
        ...(modalidad === 'transversal' ? { guiasTransversales: defs.map(g => ({ ...g, eje: g.eje.trim() })) } : {}),
      });
      let msg = `Plan creado para ${est.nombres}.`;
      if (r.sinCorreo.length) msg += ` Sin correo de docente (no verán el plan): ${r.sinCorreo.join(', ')}.`;
      if (!r.publicado) msg += ' El enlace público aún no se publicó (se publicará al aprobar la primera guía).';
      onCreado(msg);
    } catch (e) {
      setError((e as Error).message || 'No se pudo crear el plan.');
      setGuardando(false);
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-card p-4 space-y-4">
      <div className="flex items-center">
        <h3 className="text-base font-semibold text-strong">Nuevo plan</h3>
        <span className="ml-3 text-xs font-medium text-soft" aria-live="polite">Paso {paso} de 3</span>
        <button onClick={onCerrar} aria-label="Cerrar" className="ml-auto min-w-[44px] min-h-[44px] grid place-items-center rounded-lg text-muted hover:text-strong hover:bg-elevated"><X size={16} /></button>
      </div>
      <div className="flex gap-1.5" aria-hidden>
        {[1, 2, 3].map(n => <div key={n} className={cn('h-1 flex-1 rounded-full', n <= paso ? 'bg-accent' : 'bg-elevated')} />)}
      </div>

      {paso === 1 && (<>

      <div>
        <Etiqueta>Estudiante</Etiqueta>
        {est ? (
          <div className="flex items-center gap-2 rounded-xl bg-elevated px-3 py-2.5">
            <span className="text-sm text-strong min-w-0 flex-1 truncate">{est.apellidos} {est.nombres} · {est.gradoActual}</span>
            <button onClick={() => { setEst(null); setTexto(''); }} className="text-xs text-soft hover:text-strong">Cambiar</button>
          </div>
        ) : (
          <>
            <div className="flex gap-2">
              <div className="relative flex-1 min-w-0">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input value={texto} onChange={e => setTexto(e.target.value)} placeholder="Apellido o nombre"
                  className={cn(CLASE_INPUT, 'pl-8')} />
              </div>
              <select value={grupoFiltro} onChange={e => setGrupoFiltro(e.target.value)} aria-label="Grupo"
                className={cn(CLASE_INPUT, 'w-24 flex-shrink-0')}>
                <option value="">Grupo</option>
                {GRUPOS.sort((a, b) => NIVEL(a) - NIVEL(b) || a.localeCompare(b, 'es', { numeric: true }))
                  .map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            {buscando && <p className="text-xs text-muted mt-1">Buscando…</p>}
            {resultados.length > 0 && (
              <ul className="mt-2 rounded-xl border border-line divide-y divide-line overflow-hidden">
                {resultados.map(r => (
                  <li key={r.studentId}>
                    <button onClick={() => setEst(r)} className="w-full text-left px-3 py-2.5 text-sm text-strong hover:bg-hover">
                      {r.apellidos} {r.nombres} <span className="text-muted">· {r.gradoActual}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {!buscando && texto.trim().length >= 2 && resultados.length === 0 && (
              <p className="text-xs text-muted mt-1">Sin resultados.</p>
            )}
          </>
        )}
        {errs.est && <p role="alert" className="text-xs text-danger mt-1">{errs.est}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div><Etiqueta>Desde</Etiqueta><input type="date" value={desde} onChange={e => setDesde(e.target.value)} className={CLASE_INPUT} />{errs.desde && <p role="alert" className="text-xs text-danger mt-1">{errs.desde}</p>}</div>
        <div><Etiqueta>Hasta</Etiqueta><input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className={CLASE_INPUT} />{errs.hasta && <p role="alert" className="text-xs text-danger mt-1">{errs.hasta}</p>}</div>
      </div>

      </>)}

      {paso === 2 && (<>
      <div>
        <Etiqueta>Contexto para los docentes</Etiqueta>
        <textarea value={contexto} onChange={e => setContexto(e.target.value)} rows={3} className={CLASE_INPUT} />
        <p className="text-xs text-muted mt-1">Lo leen todos los docentes del plan. Escríbalo en lenguaje pedagógico, sin diagnósticos; lo sensible va en el motivo reservado.</p>
      </div>

      <div>
        <Etiqueta>Motivo reservado (solo UAI, orientación y coordinación)</Etiqueta>
        <textarea value={motivo} onChange={e => setMotivo(e.target.value)} rows={2} className={CLASE_INPUT} />
        {errs.motivo && <p role="alert" className="text-xs text-danger mt-1">{errs.motivo}</p>}
      </div>

      <div>
        <Etiqueta>Ajustes razonables (lenguaje pedagógico, sin diagnóstico)</Etiqueta>
        <div className="flex flex-wrap gap-1.5">
          {AJUSTES_FRECUENTES.map(a => (
            <button key={a} onClick={() => alternar(a)} aria-pressed={ajustes.includes(a)}
              className={cn('text-xs px-3 py-1.5 rounded-full transition text-left',
                ajustes.includes(a) ? 'bg-accent text-strong' : 'bg-elevated text-soft hover:text-strong')}>
              {ajustes.includes(a) && <Check size={11} className="inline mr-1" />}{a}
            </button>
          ))}
        </div>
        {ajustes.filter(a => !AJUSTES_FRECUENTES.includes(a)).map(a => (
          <div key={a} className="flex items-center gap-2 mt-2 text-sm text-strong">
            <span className="min-w-0 flex-1">{a}</span>
            <button onClick={() => alternar(a)} aria-label="Quitar" className="p-1 text-muted hover:text-danger"><X size={14} /></button>
          </div>
        ))}
        <div className="flex gap-2 mt-2">
          <input value={libre} onChange={e => setLibre(e.target.value)} placeholder="Otro ajuste…"
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); agregarLibre(); } }} className={CLASE_INPUT} />
          <button onClick={agregarLibre} className={CLASE_BOTON_SEC} aria-label="Agregar ajuste"><Plus size={16} /></button>
        </div>
      </div>

      <label className="flex items-start gap-2 text-sm text-strong cursor-pointer">
        <input type="checkbox" checked={sinTec} onChange={e => cambiarSinTec(e.target.checked)} className="mt-1" />
        <span>Sin uso de tecnología (guía impresa)
          <span className="block text-xs text-muted">El estudiante no tiene acceso a celular, computador ni internet: la guía se entrega impresa y las entregas y la sustentación son en papel, presenciales u orales.</span></span>
      </label>

      </>)}

      {paso === 3 && (<>
      <div>
        <Etiqueta>Máximo de momentos por día (1 momento = 25 min)</Etiqueta>
        <input type="number" min={1} max={8} value={tope} onChange={e => setTope(Math.max(1, Number(e.target.value) || 1))}
          className={cn(CLASE_INPUT, 'w-24')} />
      </div>

      <div>
        <Etiqueta>Ritmo de trabajo</Etiqueta>
        <div className="flex gap-2">
          {([['diario', 'Diario'], ['dia_por_medio', 'Día por medio']] as const).map(([v, t]) => (
            <button key={v} onClick={() => setRitmo(v)} aria-pressed={ritmo === v}
              className={cn('text-sm px-4 py-2 min-h-[44px] rounded-full transition', ritmo === v ? 'bg-accent text-strong' : 'bg-elevated text-soft hover:text-strong')}>{t}</button>
          ))}
        </div>
        <p className="text-xs text-muted mt-1.5">UAI: máximo 2–3 momentos por día, o trabajo solo un día hábil de cada dos. Con «día por medio» las fechas se reparten saltando un día hábil.</p>
      </div>

      <div>
        <Etiqueta>Modalidad de guías</Etiqueta>
        <div className="flex gap-2">
          {([['por_asignatura', 'Por asignatura'], ['transversal', 'Transversal']] as const).map(([v, t]) => (
            <button key={v} onClick={() => setModalidad(v)} aria-pressed={modalidad === v}
              className={cn('text-sm px-4 py-2 min-h-[44px] rounded-full transition', modalidad === v ? 'bg-accent text-strong' : 'bg-elevated text-soft hover:text-strong')}>{t}</button>
          ))}
        </div>
        <p className="text-xs text-muted mt-1.5">Transversal: menos guías que integran varias áreas. La pregunta orientadora la define después el responsable de cada guía.</p>
      </div>

      {modalidad === 'transversal' && est && (
        <div className="space-y-3">
          {defs.map((g, i) => (
            <div key={i} className="rounded-xl border border-line p-3 space-y-2">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-strong flex-1">Guía {i + 1}{g.asignaturaIds.length > 0 && ` · ${g.asignaturaIds.map(x => asigs.find(a => a.asignaturaId === x)?.asignaturaNombre ?? '').filter(Boolean).join(' · ')}`}</p>
                {defs.length > 1 && <button aria-label="Quitar guía" onClick={() => setDefs(l => l.filter((_, j) => j !== i))} className="p-2 text-muted hover:text-danger flex-shrink-0"><X size={15} /></button>}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {asigs.map(a => {
                  const mia = g.asignaturaIds.includes(a.asignaturaId);
                  const ajena = usadas.has(a.asignaturaId) && !mia;
                  return (
                    <button key={a.asignaturaId} disabled={ajena} onClick={() => alternarAsig(i, a.asignaturaId)} aria-pressed={mia}
                      className={cn('text-xs px-3 py-1.5 rounded-full transition disabled:opacity-30', mia ? 'bg-accent text-strong' : 'bg-elevated text-soft hover:text-strong')}>
                      {a.asignaturaNombre}
                    </button>
                  );
                })}
              </div>
              {g.asignaturaIds.length > 0 && (
                <div><Etiqueta>Responsable (pide y aprueba la guía)</Etiqueta>
                  <select value={g.responsableDocenteId} onChange={e => setDef(i, { responsableDocenteId: e.target.value })} className={CLASE_INPUT}>
                    <option value="">Escoger…</option>
                    {[...new Map(g.asignaturaIds.map(x => asigs.find(a => a.asignaturaId === x)!).map(a => [a.docenteId, a.docenteNombre])).entries()]
                      .map(([id, n]) => <option key={id} value={id}>{n}</option>)}
                  </select></div>
              )}
            </div>
          ))}
          <button onClick={() => setDefs(l => [...l, { eje: '', asignaturaIds: [], responsableDocenteId: '' }])} className={CLASE_BOTON_SEC}><Plus size={14} />Otra guía</button>
          <p className={cn('text-xs', sinAsignar.length ? 'text-warning' : 'text-success')}>
            {sinAsignar.length ? `Sin guía: ${sinAsignar.map(a => a.asignaturaNombre).join(', ')}.` : 'Todas las asignaturas están ubicadas.'}
          </p>
          {errs.guias && <p role="alert" className="text-xs text-danger mt-1">{errs.guias}</p>}
        </div>
      )}

      {asigs.length > 0 && (
        <p className="text-xs text-muted">
          Se crearán {asigs.length} asignaturas: {asigs.map(a => `${a.asignaturaNombre} (${a.docenteNombre})`).join(' · ')}.
        </p>
      )}

      </>)}

      {error && <CajaError>{error}</CajaError>}
      <div className="flex gap-2 justify-end">
        {paso === 1
          ? <button onClick={onCerrar} className={CLASE_BOTON_SEC}>Cancelar</button>
          : <button onClick={atras} disabled={guardando} className={CLASE_BOTON_SEC}>Atrás</button>}
        {paso < 3
          ? <button onClick={siguiente} className={CLASE_BOTON}>Siguiente</button>
          : <button onClick={guardar} disabled={guardando} className={CLASE_BOTON}>{guardando ? 'Creando…' : 'Crear plan'}</button>}
      </div>
    </div>
  );
}

// ── QR ────────────────────────────────────────────────────────────────────

function BloqueQR({ plan }: { plan: PlanCasa }) {
  const [img, setImg] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const url = urlPublica(plan.tokenPublico);

  useEffect(() => {
    let vivo = true;
    QRCode.toDataURL(url, { width: 220, margin: 1 }).then(u => { if (vivo) setImg(u); }).catch(() => {});
    return () => { vivo = false; };
  }, [url]);

  async function copiar() {
    try { await navigator.clipboard.writeText(url); setCopiado(true); setTimeout(() => setCopiado(false), 2000); }
    catch { setError('No se pudo copiar; seleccione el enlace y cópielo a mano.'); }
  }
  async function nuevo() {
    setOcupado(true); setError('');
    try { await regenerarToken(plan); setConfirmando(false); }
    catch (e) { setError((e as Error).message); }
    finally { setOcupado(false); }
  }

  return (
    <div className="rounded-xl bg-elevated p-3 space-y-3">
      <div className="flex flex-col sm:flex-row items-center gap-3">
        {img ? <img src={img} alt="QR de la agenda del estudiante" className="w-40 h-40 rounded-lg bg-white p-1 flex-shrink-0" />
          : <div className="w-40 h-40 rounded-lg bg-card flex-shrink-0" />}
        <div className="min-w-0 w-full space-y-2">
          <p className="text-xs text-soft">Agenda de {plan.nombres.split(' ')[0]} (solo lectura, sin iniciar sesión).</p>
          <p className="text-[11px] text-muted break-all">{url}</p>
          <div className="flex flex-wrap gap-2">
            <button onClick={copiar} className={CLASE_BOTON_SEC}>{copiado ? <Check size={14} /> : <Copy size={14} />}{copiado ? 'Copiado' : 'Copiar enlace'}</button>
            <button onClick={() => setConfirmando(true)} className={CLASE_BOTON_SEC}><RefreshCw size={14} />Generar nuevo QR</button>
          </div>
        </div>
      </div>
      {confirmando && (
        <div className="rounded-lg bg-warning-soft text-warning-soft-fg text-sm p-3 space-y-2">
          <p>El QR y el enlace actuales dejarán de funcionar. ¿Generar uno nuevo?</p>
          <div className="flex gap-2">
            <button onClick={nuevo} disabled={ocupado} className={CLASE_BOTON}>{ocupado ? 'Generando…' : 'Sí, generar'}</button>
            <button onClick={() => setConfirmando(false)} className={CLASE_BOTON_SEC}>No</button>
          </div>
        </div>
      )}
      {error && <CajaError>{error}</CajaError>}
    </div>
  );
}

// ── Tarjeta de un plan ────────────────────────────────────────────────────

function TarjetaPlan({ plan }: { plan: PlanConDocentes }) {
  const [asigs, setAsigs] = useState<AsignaturaPlan[] | null>(null);
  const [guias, setGuias] = useState<GuiaPlan[] | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState<string | null>(null);
  const [verQR, setVerQR] = useState(false);
  const [ctx, setCtx] = useState(plan.contextoDocentes ?? '');
  const [ctxMsg, setCtxMsg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => escucharAsignaturas(plan.id, setAsigs, e => setError(e.message)), [plan.id]);
  useEffect(() => escucharGuias(plan.id, setGuias, e => setError(e.message)), [plan.id]);

  const nombres = useMemo(() => asignaturasConNombre(plan.grupo), [plan.grupo]);
  const filas = (asigs ?? []).map(a => ({ a, n: nombres[a.asignaturaId] }))
    .sort((x, y) => (x.n?.asignatura ?? '').localeCompare(y.n?.asignatura ?? '', 'es'));
  const faltanCriterios = filas.filter(f => !criteriosPuestos(f.a)).length;
  const faltanGuias = (guias ?? []).filter(g => !g.aprobada).length;
  const nombreAsig = (id: string) => nombres[id]?.asignatura ?? id;

  async function verMotivo() {
    setAbierto(v => !v);
    if (motivo === null) { try { setMotivo(await leerMotivo(plan.id)); } catch { setMotivo('(sin permiso para ver el motivo)'); } }
  }

  return (
    <div className="rounded-2xl border border-line bg-card p-4 space-y-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-strong truncate">{plan.apellidos} {plan.nombres}</p>
          <p className="text-xs text-soft">{plan.grupo} · {fechaCorta(plan.desde)} a {fechaCorta(plan.hasta)}{plan.estado === 'cerrado' && ' · cerrado'}</p>
        </div>
        <button onClick={() => setVerQR(v => !v)} aria-label="QR de la agenda" aria-pressed={verQR}
          className="p-2 rounded-lg text-soft hover:text-strong hover:bg-elevated"><QrCode size={18} /></button>
        <button onClick={verMotivo} aria-label="Detalle" aria-expanded={abierto}
          className="p-2 rounded-lg text-soft hover:text-strong hover:bg-elevated"><ChevronDown size={18} className={cn('transition', abierto && 'rotate-180')} /></button>
      </div>

      {asigs && guias && (faltanCriterios > 0 || faltanGuias > 0) && (
        <p className="text-xs text-soft">
          Faltan criterios en {faltanCriterios} de {filas.length} asignaturas y aprobar {faltanGuias} de {guias.length} guías.
        </p>
      )}

      {verQR && (plan.sinTecnologia
        ? <p className="rounded-xl bg-elevated text-sm text-soft p-3">Plan sin tecnología: se entrega la guía impresa.</p>
        : <BloqueQR plan={plan} />)}
      {error && <CajaError>{error}</CajaError>}
      {(!asigs || !guias) && !error && <Cargando texto="Cargando…" />}

      {filas.length > 0 && (
        <div>
          <p className="text-xs font-medium text-soft mb-1">Asignaturas</p>
          <ul className="divide-y divide-line">
            {filas.map(({ a, n }) => (
              <li key={a.asignaturaId} className="py-1.5 flex flex-wrap items-center gap-1.5">
                <span className="text-sm text-strong">{n?.asignatura ?? a.asignaturaId}<span className="text-xs text-muted"> · {n?.docente ?? a.docenteId}</span></span>
                <Marca ok={criteriosPuestos(a)} etiqueta="Criterios" />
              </li>
            ))}
          </ul>
        </div>
      )}

      {guias && guias.length > 0 && (
        <div>
          <p className="text-xs font-medium text-soft mb-1">Guías ({plan.modalidad === 'transversal' ? 'transversales' : 'por asignatura'})</p>
          <ul className="divide-y divide-line">
            {guias.map(g => {
              const r = resumenGuia(g);
              return (
                <li key={g.id} className="py-2">
                  <p className="text-sm text-strong">{g.eje || `Guía ${guias.indexOf(g) + 1} · ${g.asignaturaIds.map(nombreAsig).join(' · ')}`}
                    {g.eje && g.asignaturaIds.length > 1 && <span className="text-xs text-muted"> · {g.asignaturaIds.map(nombreAsig).join(', ')}</span>}</p>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    <Marca ok={r.guia} etiqueta="Aprobada" />
                    {g.asignaturaIds.length > 1 && <span className="text-[11px] text-soft">Vistos buenos {r.vistos}/{r.vistosTotal}</span>}
                    {r.guia && <span className="text-[11px] text-soft">{r.avance}% ({r.pasosTotal} pasos) · Sustentación: {TEXTO_SUSTENTACION[r.sustentacion]}</span>}
                  </div>
                  {r.guia && <div className="h-1.5 rounded-full bg-elevated mt-1.5 overflow-hidden"><div className="h-full bg-success" style={{ width: `${r.avance}%` }} /></div>}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {guias && asigs && guias.some(g => g.aprobada || g.propuesta) && (
        <BotonFormatoUAI plan={plan} guias={guias} asigs={asigs} nombres={nombres} />
      )}
      {guias && <BotonCuadernillo plan={plan} guias={guias} nombres={nombres} />}

      {abierto && (
        <div className="rounded-xl bg-elevated p-3 space-y-2 text-sm">
          <p className="text-soft"><span className="font-medium text-strong">Motivo (reservado):</span> {motivo ?? 'Cargando…'}</p>
          <div>
            <p className="font-medium text-strong">Contexto para los docentes</p>
            <textarea value={ctx} onChange={e => { setCtx(e.target.value); setCtxMsg(''); }} rows={3} className={CLASE_INPUT} />
            <div className="flex items-center gap-2 mt-1">
              <button onClick={() => guardarContexto(plan.id, ctx).then(() => setCtxMsg('Guardado.')).catch(e => setError(e.message))}
                className={CLASE_BOTON_SEC}>Guardar contexto</button>
              {ctxMsg && <span className="text-xs text-soft">{ctxMsg}</span>}
            </div>
          </div>
          <label className="flex items-start gap-2 text-strong cursor-pointer">
            <input type="checkbox" checked={!!plan.sinTecnologia} className="mt-1"
              onChange={e => { const r = conSinTecnologia(plan.ajustes, e.target.checked); guardarSinTecnologia(plan.id, r.sinTecnologia, r.ajustes).catch(er => setError(er.message)); }} />
            <span>Sin uso de tecnología (guía impresa)
              <span className="block text-[11px] text-muted">El estudiante no tiene acceso a celular, computador ni internet: la guía se entrega impresa y las entregas y la sustentación son en papel, presenciales u orales.</span></span>
          </label>
          <p className="text-soft"><span className="font-medium text-strong">Ajustes:</span> {plan.ajustes.length ? plan.ajustes.join(' · ') : 'ninguno'}</p>
          <p className="text-soft"><span className="font-medium text-strong">Tope diario:</span> {plan.topeDiario} momentos · ritmo {plan.ritmo === 'dia_por_medio' ? 'día por medio' : 'diario'}</p>
          <button onClick={() => cambiarEstadoPlan(plan.id, plan.estado === 'activo' ? 'cerrado' : 'activo').catch(e => setError(e.message))}
            className={CLASE_BOTON_SEC}>{plan.estado === 'activo' ? 'Cerrar plan' : 'Reabrir plan'}</button>
        </div>
      )}
    </div>
  );
}

// ── Panel ─────────────────────────────────────────────────────────────────

export default function PanelPlanCasa() {
  const [planes, setPlanes] = useState<PlanConDocentes[] | null>(null);
  const [error, setError] = useState('');
  const [creando, setCreando] = useState(false);
  const [aviso, setAviso] = useState('');

  useEffect(() => escucharPlanes(true, setPlanes, e => { setError(e.message || 'No se pudieron leer los planes.'); setPlanes([]); }), []);

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold text-strong flex-1">Planes en casa</h2>
        {!creando && <button onClick={() => { setCreando(true); setAviso(''); }} className={CLASE_BOTON}><Plus size={16} />Nuevo plan</button>}
      </div>
      {aviso && <p className="rounded-xl bg-success-soft text-success-soft-fg text-sm p-3">{aviso}</p>}
      {creando && <NuevoPlan onCerrar={() => setCreando(false)} onCreado={m => { setCreando(false); setAviso(m); }} />}
      {error && <CajaError>{error}</CajaError>}
      {!planes && <Cargando texto="Cargando planes…" />}
      {planes && planes.length === 0 && !error && <p className="text-sm text-soft">Aún no hay planes. Cree el primero con «Nuevo plan».</p>}
      {planes?.map(p => <TarjetaPlan key={p.id} plan={p} />)}
    </div>
  );
}
