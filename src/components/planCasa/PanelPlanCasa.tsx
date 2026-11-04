// Planes en casa — panel del equipo (UAI / orientador), coordinación y superusuario.
// Crea planes, muestra el tablero por estudiante y el QR de la agenda pública.
import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { Check, ChevronDown, Copy, Mail, Plus, QrCode, RefreshCw, Search, Sparkles, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buscarEstudiantes, leerEstudiante } from '../../asistencia/datos';
import type { Student } from '../../asistencia/domain/types';
import { ASIGNACION_2026 } from '../../data/asignacionAcademica';
import {
  AJUSTES_FRECUENTES, AJUSTE_SIN_TECNOLOGIA, TOPE_DIARIO_DEFECTO, type AsignaturaPlan, type GuiaPlan, type ModalidadGuias, type PlanCasa, type RitmoPlan, type SolicitudAutorizacion,
} from '../../data/planCasa/tipos';
import {
  asignaturasDelGrupo, cambiarEstadoPlan, crearPlan, escucharAsignaturas, escucharGuias, escucharPlanes, type GuiaTransversalDef,
  autorizarSolicitud, eliminarPlan, cambiarFechaSustentacion, escucharSolicitudes, guardarCierreEdicion, negarSolicitud,
  ponerEnEspera, quitarEnEspera, guardarContexto, guardarSinTecnologia, leerEquipo, leerMotivo, regenerarToken, urlPublica, type PlanConDocentes,
} from '../../data/planCasa/persistencia';
import { asignaturasConNombre } from './nombres';
import { completarPlanConIA, dosificarPlan, reprogramarPlan, type ItemProgreso, type ResumenCompletar } from '../../data/planCasa/completarConIA';
import { faltantesPlan, gradoDeGrupo } from '../../data/planCasa/completarPlan';
import { destinosPosibles, errorReplicar, replicarGuias, type ResumenReplicar } from '../../data/planCasa/replicarGuias';
import { guardarTopeDiario, leerAsignaturasYGuias, quitarAsignatura, sincronizarDocentes } from '../../data/planCasa/persistencia';
import { conSinTecnologia, fechaCierre, horaCierre, proximoViernes, topeNecesario } from '../../data/planCasa/logica';
import { hoyLocal } from '../../data/planCasa/completarPlan';

const isoLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
import { EntregasGuiaResumen } from './EntregasPaso';
import SeguimientoPlanCasa from './SeguimientoPlanCasa';
import { PestanasSubrayadas } from '../Navegacion';
import { construirAvanceDocentes, filtrarPorJornada, jornadaDePlan, type DatosPlanAvance, type FiltroJornada } from '../../data/planCasa/avanceDocentes';
import { claseBarra, construirInformeHTML, construirResumenTexto, filasInforme, fraccionTexto, resumenAvance, ETIQUETA_JORNADA, type Fraccion } from '../../data/planCasa/informeAvance';
import { useAppStore } from '../../data/store';
import { addDias } from '../../data/tareas/calendario';
import Ficha from '../../asistencia/Ficha';
import { leerDirectores } from '../../asistencia/datos';
import { auth } from '../../lib/firebase';
import { abrirCartas, abrirPlanilla, construirHtmlCartas, construirHtmlPlanilla, type EntradaCarta } from '../../data/planCasa/imprimibleCarta';
import { VENTANA_SUSTENTACION, textoEntre, resumenProgramadas, fechaValida } from '../../data/planCasa/ventanaSustentacion';
import { abrirImprimibleUAI } from '../../data/planCasa/imprimibleUAI';
import {
  MenuAcciones, tinteEstudiante, BotonFormatoUAI, BotonCuadernillo, CajaError, Cargando, CLASE_BOTON, CLASE_BOTON_SEC, CLASE_INPUT, criteriosPuestos, Etiqueta, fechaCorta, Marca,
  EtiquetaCoordinacion, fechaLarga, resumenGuia, TEXTO_SUSTENTACION, hora12,
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

/** Solicitudes pendientes de autorización para corregir guías cerradas. */
function SolicitudesPendientes({ plan, solicitudes, nombreGuia, onError }: {
  plan: PlanCasa; solicitudes: SolicitudAutorizacion[]; nombreGuia: (id: string) => string; onError: (m: string) => void;
}) {
  const [hasta, setHasta] = useState<Record<string, string>>({});
  const pendientes = solicitudes.filter(s => s.estado === 'pendiente');
  if (!pendientes.length) return null;
  return (
    <div className="rounded-xl border border-warning bg-warning-soft text-warning-soft-fg p-3 space-y-2">
      <p className="text-sm font-medium">Solicitudes para corregir guías cerradas ({pendientes.length})</p>
      {pendientes.map(s => (
        <div key={s.id} className="rounded-lg bg-card text-strong p-2.5 space-y-2 text-sm">
          <p><b>{nombreGuia(s.guiaId)}</b> · {s.correo}</p>
          <p className="text-xs text-soft">{s.motivo}{s.detalle ? ': ' + s.detalle : ''}</p>
          <div className="flex flex-wrap items-end gap-2">
            <div><Etiqueta>Autorizar hasta</Etiqueta>
              <input type="date" value={hasta[s.id] ?? ''} min={hoyISO()} onChange={e => setHasta(h => ({ ...h, [s.id]: e.target.value }))} className={CLASE_INPUT} /></div>
            <button disabled={!hasta[s.id]} className={CLASE_BOTON}
              onClick={() => autorizarSolicitud(plan.id, s, hasta[s.id]).catch(e => onError(e.message))}>Autorizar hasta esa fecha</button>
            <button className={CLASE_BOTON_SEC} onClick={() => negarSolicitud(plan.id, s).catch(e => onError(e.message))}>No autorizar</button>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * «Completar todo con IA» (coordinación): sin esperar a ningún docente, la IA genera lo que falte
 * (criterios, entregables, guías, integración) y se aprueba todo. Confirmación dentro de la página.
 */
function CompletarConIA({ plan, asigs, guias, nombres, puede }: {
  plan: PlanConDocentes; asigs: AsignaturaPlan[]; guias: GuiaPlan[]; nombres: Record<string, { asignatura: string; docente: string }>; puede: boolean;
}) {
  const [paso, setPaso] = useState<'cerrado' | 'confirmar' | 'corriendo' | 'fin'>('cerrado');
  const [tecleado, setTecleado] = useState('');
  const [items, setItems] = useState<ItemProgreso[]>([]);
  const [resumen, setResumen] = useState<ResumenCompletar | null>(null);
  const [error, setError] = useState('');
  const nombre = (id: string) => nombres[id]?.asignatura ?? id;
  const etiquetaGuia = (g: { id: string; eje?: string; asignaturaIds: string[] }) => g.asignaturaIds.length > 1 ? (g.eje?.trim() || g.asignaturaIds.map(nombre).join(' · ')) : nombre(g.asignaturaIds[0] ?? g.id);
  const f = faltantesPlan(plan, asigs, guias);
  if (!puede || (paso === 'cerrado' && !f.hayQueHacer)) return null;

  async function ejecutar() {
    setPaso('corriendo'); setError(''); setResumen(null);
    try {
      const r = await completarPlanConIA({ plan, asigs, guias, nombre, etiquetaGuia, onProgreso: setItems });
      setResumen(r);
    } catch (e) { setError((e as Error).message); }
    setPaso('fin');
  }

  return (
    <div className="rounded-xl border border-line p-3 space-y-2">
      {paso === 'cerrado' && (
        <button onClick={() => { setPaso('confirmar'); setTecleado(''); }} className={CLASE_BOTON_SEC}>
          <Sparkles size={15} />Completar todo con IA
        </button>
      )}
      {paso === 'confirmar' && (
        <div role="alert" className="space-y-2">
          <p className="text-sm text-strong">No se esperará a ningún docente; la IA generará lo que falte y se aprobará todo.</p>
          <p className="text-xs text-soft">
            Falta: {f.asignaturas.length ? `campos de ${f.asignaturas.length} asignatura(s)` : 'ningún criterio'}
            {f.entregables.length > 0 && `, entregable/fecha de ${f.entregables.length}`}
            {f.guias.length > 0 && `, y aprobar ${f.guias.length} guía(s)`}
            {f.ejes.length > 0 && `, pregunta orientadora de ${f.ejes.length} guía(s)`}
            {f.fechas.length > 0 && `, fecha de ${f.fechas.length} entregable(s)`}. Lo que ya escribió un docente no se cambia.
          </p>
          <label className="block text-xs text-soft">Escriba COMPLETAR para habilitar el botón
            <input value={tecleado} onChange={e => setTecleado(e.target.value)} className={CLASE_INPUT} autoComplete="off" /></label>
          <div className="flex flex-wrap gap-2">
            <button disabled={tecleado.trim().toUpperCase() !== 'COMPLETAR'} onClick={ejecutar} className={CLASE_BOTON}><Sparkles size={15} />Completar y aprobar</button>
            <button onClick={() => setPaso('cerrado')} className={CLASE_BOTON_SEC}>Cancelar</button>
          </div>
        </div>
      )}
      {(paso === 'corriendo' || paso === 'fin') && (
        <div className="space-y-2" aria-live="polite">
          <p className="text-sm font-medium text-strong">{paso === 'corriendo' ? 'Completando con IA… no cierre esta página.' : 'Proceso terminado'}</p>
          <ul className="space-y-0.5">
            {items.map(it => (
              <li key={it.id} className={cn('text-xs flex gap-1.5', it.estado === 'fallo' ? 'text-danger' : it.estado === 'ok' ? 'text-success' : 'text-soft')}>
                <span aria-hidden className="w-4 flex-shrink-0">{it.estado === 'ok' ? '✓' : it.estado === 'fallo' ? '✗' : it.estado === 'curso' ? '…' : '·'}</span>
                <span>{it.texto}</span>
              </li>
            ))}
          </ul>
          {error && <CajaError>{error}</CajaError>}
          {resumen && (
            <div className="rounded-lg bg-elevated p-2 text-xs space-y-1">
              <p className="text-strong">{resumen.hechos} paso(s) completados{resumen.publicado ? ' · agenda publicada' : ''}.</p>
              {resumen.fallos.length > 0 && (<>
                <p className="text-danger font-medium">No se pudo ({resumen.fallos.length}):</p>
                <ul className="list-disc pl-4 text-soft">{resumen.fallos.map((x, i) => <li key={i}>{x.texto}: {x.motivo}</li>)}</ul>
              </>)}
              {resumen.sinAprobar.length > 0
                ? <p className="text-warning-soft-fg">Sin aprobar (no entran al cuadernillo): {resumen.sinAprobar.join(', ')}. Puede volver a pulsar el botón para reintentar solo lo que falta.</p>
                : <p className="text-success">Todas las guías quedaron aprobadas: el cuadernillo ya se puede imprimir completo.</p>}
            </div>
          )}
          {paso === 'fin' && <button onClick={() => setPaso('cerrado')} className={CLASE_BOTON_SEC}>Cerrar</button>}
        </div>
      )}
    </div>
  );
}

/**
 * «Replicar guías a otro estudiante» (coordinación): para casos muy parecidos del mismo grado.
 * Copia criterios, entregables y guías de este plan al elegido y las aprueba con SUS fechas.
 */
function ReplicarGuias({ plan, planes, asigs, guias, nombres, puede }: {
  plan: PlanConDocentes; planes: PlanConDocentes[]; asigs: AsignaturaPlan[]; guias: GuiaPlan[];
  nombres: Record<string, { asignatura: string; docente: string }>; puede: boolean;
}) {
  const [paso, setPaso] = useState<'cerrado' | 'elegir' | 'corriendo' | 'fin'>('cerrado');
  const [destinoId, setDestinoId] = useState('');
  const [igualar, setIgualar] = useState(false);
  const [resumen, setResumen] = useState<ResumenReplicar | null>(null);
  const [error, setError] = useState('');
  const destinos = destinosPosibles(plan, planes);
  const conGuia = guias.some(g => g.aprobada || g.propuesta);
  // Los que no se pueden elegir se muestran con el motivo, para que se entienda por qué.
  const bloqueados = planes.filter(p => p.id !== plan.id && p.estado === 'activo' && gradoDeGrupo(p.grupo) === gradoDeGrupo(plan.grupo))
    .map(p => ({ p, motivo: errorReplicar(plan, p) })).filter((x): x is { p: PlanConDocentes; motivo: string } => !!x.motivo);
  if (!puede || !conGuia) return null;
  const nombre = (id: string) => nombres[id]?.asignatura ?? id;
  const etiquetaGuia = (g: GuiaPlan) => g.asignaturaIds.length > 1 ? (g.eje?.trim() || g.asignaturaIds.map(nombre).join(' · ')) : nombre(g.asignaturaIds[0] ?? g.id);
  const destino = destinos.find(p => p.id === destinoId);

  async function ejecutar() {
    if (!destino) return;
    setPaso('corriendo'); setError(''); setResumen(null);
    try {
      const d = await leerAsignaturasYGuias(destino.id);
      setResumen(await replicarGuias({ origen: plan, destino, asigsO: asigs, guiasO: guias, asigsD: d.asigs, guiasD: d.guias, nombre, etiquetaGuia, igualarAgrupacion: igualar }));
    } catch (e) { setError((e as Error).message); }
    setPaso('fin');
  }

  return (
    <div className="rounded-xl border border-line p-3 space-y-2">
      {paso === 'cerrado' && (
        <button onClick={() => { setPaso('elegir'); setDestinoId(''); }} className={CLASE_BOTON_SEC}><Copy size={15} />Replicar guías a otro estudiante</button>
      )}
      {paso === 'elegir' && (
        <div className="space-y-2">
          <p className="text-sm text-strong">Copiar las guías de {plan.nombres} {plan.apellidos} ({plan.grupo}) a:</p>
          <select value={destinoId} onChange={e => setDestinoId(e.target.value)} className={CLASE_INPUT}>
            <option value="">— Elija el estudiante (solo de {gradoTexto(plan.grupo)}) —</option>
            {destinos.map(p => <option key={p.id} value={p.id}>{p.nombres} {p.apellidos} · {p.grupo}</option>)}
          </select>
          {!destinos.length && <p className="text-xs text-warning">No hay otro estudiante de {gradoTexto(plan.grupo)} al que se pueda replicar.</p>}
          {bloqueados.length > 0 && (
            <ul className="text-[11px] text-muted list-disc pl-4">
              {bloqueados.map(({ p, motivo }) => <li key={p.id}>{p.nombres} {p.apellidos} · {p.grupo}: {motivo}</li>)}
            </ul>
          )}
          {destino && (
            <div className="rounded-lg bg-elevated p-2 text-xs text-soft space-y-1">
              <p>Se copian criterios, entregables y guías, y se aprueban con las fechas de {destino.nombres} ({fechaLarga(destino.desde)} a {fechaLarga(destino.hasta)}). Lo que ese plan ya tenga escrito o aprobado no se cambia.</p>
              <p><span className="font-medium text-strong">Ajustes de este caso:</span> {plan.ajustes.join(' · ') || 'ninguno'}</p>
              <p><span className="font-medium text-strong">Ajustes del destino:</span> {destino.ajustes.join(' · ') || 'ninguno'}</p>
              <p>Revise que los ajustes sean compatibles: la guía se escribió para los de este caso.</p>
            </div>
          )}
          {destino && (
            <label className="flex items-start gap-2 text-xs text-soft">
              <input type="checkbox" checked={igualar} onChange={e => setIgualar(e.target.checked)} className="mt-0.5" />
              <span>Dejar las guías agrupadas <span className="font-medium text-strong">exactamente igual</span> que las de {plan.nombres}.
                <span className="block text-[11px] text-warning">Reemplaza TODAS las guías de {destino.nombres}, también las ya aprobadas, y borra su avance registrado en ellas.</span></span>
            </label>
          )}
          <div className="flex flex-wrap gap-2">
            <button disabled={!destino} onClick={ejecutar} className={CLASE_BOTON}><Copy size={15} />Replicar y aprobar</button>
            <button onClick={() => setPaso('cerrado')} className={CLASE_BOTON_SEC}>Cancelar</button>
          </div>
        </div>
      )}
      {paso === 'corriendo' && <p className="text-sm text-strong" aria-live="polite">Replicando… no cierre esta página.</p>}
      {paso === 'fin' && (
        <div className="space-y-2 text-xs" aria-live="polite">
          {error && <CajaError>{error}</CajaError>}
          {resumen && (
            <div className="rounded-lg bg-elevated p-2 space-y-1">
              <p className="text-strong">{resumen.replicadas.length} guía(s) replicadas y aprobadas{resumen.publicado ? ' · agenda publicada' : ''}.</p>
              {resumen.aproximadas.length > 0 && <p className="text-warning-soft-fg">Copiadas de una guía con áreas un poco distintas (revíselas): {resumen.aproximadas.join(', ')}.</p>}
              {resumen.yaAprobadas.length > 0 && <p className="text-soft">Ya estaban aprobadas (no se tocaron): {resumen.yaAprobadas.join(', ')}.</p>}
              {resumen.sinOrigen.length > 0 && <p className="text-warning-soft-fg">Sin guía para copiar (quedan pendientes): {resumen.sinOrigen.join(', ')}.</p>}
              {resumen.fallos.length > 0 && <ul className="list-disc pl-4 text-danger">{resumen.fallos.map((x, i) => <li key={i}>{x.texto}: {x.motivo}</li>)}</ul>}
            </div>
          )}
          <button onClick={() => setPaso('cerrado')} className={CLASE_BOTON_SEC}>Cerrar</button>
        </div>
      )}
    </div>
  );
}

/** '9.2' → 'noveno', '7º1' → 'séptimo'. */
function gradoTexto(grupo: string): string {
  const n = parseInt(grupo, 10);
  return ({ 6: 'sexto', 7: 'séptimo', 8: 'octavo', 9: 'noveno', 10: 'décimo', 11: 'once' } as Record<number, string>)[n] ?? `grado ${n}`;
}

/** Genera los QR de varios planes y abre las cartas para la familia (una por página). */
async function imprimirCartas(planes: PlanCasa[]) {
  const entradas: EntradaCarta[] = await Promise.all(planes.map(async plan => {
    const url = urlPublica(plan.tokenPublico);
    const qr = await QRCode.toDataURL(url, { width: 400, margin: 1 }).catch(() => undefined);
    const est = await leerEstudiante(plan.studentId).catch(() => null);
    return { plan, url, qr, acudiente: est?.acudiente, parentesco: est?.parentesco };
  }));
  abrirCartas(construirHtmlCartas(entradas));
}

/** Abre la planilla de entrega (firmas de recibido) de los planes dados. */
async function imprimirPlanilla(planes: PlanCasa[]) {
  const filas = await Promise.all(planes.map(async plan => {
    const est = await leerEstudiante(plan.studentId).catch(() => null);
    return { plan, acudiente: est?.acudiente };
  }));
  abrirPlanilla(construirHtmlPlanilla(filas));
}

/** Control para activar/quitar «En espera — ingresó tarde» (plazo por defecto: próximo viernes). */
function EnEsperaControl({ plan, onError }: { plan: PlanConDocentes; onError: (m: string) => void }) {
  const [editando, setEditando] = useState(false);
  const [hasta, setHasta] = useState(plan.enEspera?.hasta ?? proximoViernes(hoyLocal()));
  const [nota, setNota] = useState(plan.enEspera?.nota ?? '');
  const fallo = (e: unknown) => onError((e as Error).message);
  if (!editando) {
    return (
      <div className="flex flex-wrap gap-2">
        {plan.enEspera
          ? <>
              <button className={CLASE_BOTON_SEC} onClick={() => { setHasta(plan.enEspera!.hasta); setNota(plan.enEspera!.nota ?? ''); setEditando(true); }}>Cambiar plazo</button>
              <button className={CLASE_BOTON_SEC} onClick={() => quitarEnEspera(plan.id).catch(fallo)}>Quitar «en espera»</button>
            </>
          : <button className={CLASE_BOTON_SEC} onClick={() => setEditando(true)}>Marcar «en espera — ingresó tarde»</button>}
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-line p-3 space-y-2">
      <Etiqueta>Plazo para los docentes (último día)</Etiqueta>
      <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className={cn(CLASE_INPUT, 'max-w-[11rem]')} />
      <Etiqueta>Nota (opcional)</Etiqueta>
      <input value={nota} onChange={e => setNota(e.target.value)} className={CLASE_INPUT} />
      <div className="flex gap-2">
        <button className={CLASE_BOTON_SEC} disabled={!hasta}
          onClick={() => ponerEnEspera(plan.id, hasta, nota).then(() => setEditando(false)).catch(fallo)}>Guardar</button>
        <button className={CLASE_BOTON_SEC} onClick={() => setEditando(false)}>Cancelar</button>
      </div>
    </div>
  );
}

function TarjetaPlan({ plan, planes }: { plan: PlanConDocentes; planes: PlanConDocentes[] }) {
  const [asigs, setAsigs] = useState<AsignaturaPlan[] | null>(null);
  const [guias, setGuias] = useState<GuiaPlan[] | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState<string | null>(null);
  const [verQR, setVerQR] = useState(false);
  const [ctx, setCtx] = useState(plan.contextoDocentes ?? '');
  const [ctxMsg, setCtxMsg] = useState('');
  const [error, setError] = useState('');
  const [solicitudes, setSolicitudes] = useState<SolicitudAutorizacion[]>([]);
  const [fechaSust, setFechaSust] = useState<Record<string, string>>({});
  const [cierre, setCierre] = useState(plan.cierreEdicion ?? '');
  const [cierreH, setCierreH] = useState(plan.cierreHora ?? '');
  const [cierreMsg, setCierreMsg] = useState('');
  // Eliminar: superusuario y equipo (UAI / orientación); la función lo vuelve a comprobar.
  const rolActual = useAppStore(s => s.rol);
  const [enEquipo, setEnEquipo] = useState(false);
  useEffect(() => {
    const correo = auth?.currentUser?.email?.toLowerCase() ?? '';
    leerEquipo().then(lista => setEnEquipo(lista.includes(correo))).catch(() => {});
  }, []);
  const esSuper = rolActual === 'superusuario' || enEquipo;
  // La rectora solo ve la marca; la ponen/quitan coordinación, superusuario y equipo.
  const puedeMarcar = rolActual === 'coordinador' || esSuper;
  const [confElim, setConfElim] = useState(false);
  const [quitando, setQuitando] = useState('');
  const [accion, setAccion] = useState<'' | 'espera' | 'completar' | 'replicar' | 'tope' | 'fechas'>('');
  const [verFicha, setVerFicha] = useState(false);
  const [directores, setDirectores] = useState<Record<string, string>>({});
  const userId = useAppStore(s => s.userId);
  const tinte = tinteEstudiante(plan.id);
  const [tecleado, setTecleado] = useState('');
  const [eliminando, setEliminando] = useState(false);
  const primerNombre = (plan.nombres ?? '').trim().split(/\s+/)[0] ?? '';

  useEffect(() => escucharSolicitudes(plan.id, setSolicitudes), [plan.id]);
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
    <div className={cn('rounded-2xl border p-3 space-y-2', tinte.fondo, tinte.borde, (abierto || accion || verQR) && 'sm:col-span-2 lg:col-span-3')}>
      <div className="flex items-start gap-1">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-strong leading-tight">{plan.nombres} {plan.apellidos}</p>
          <p className="text-xs text-soft">{plan.grupo} · {fechaCorta(plan.desde)} a {fechaCorta(plan.hasta)}{plan.estado === 'cerrado' && ' · cerrado'}</p>
          {plan.creadoEn ? <p className="text-[11px] text-muted">Creado el {new Date(plan.creadoEn).toLocaleDateString('es-CO')}</p> : null}
        </div>
        <button onClick={() => setVerQR(v => !v)} aria-label="QR de la agenda" aria-pressed={verQR}
          className="p-2 rounded-lg text-soft hover:text-strong hover:bg-elevated"><QrCode size={18} /></button>
        <button onClick={verMotivo} aria-label="Detalle" aria-expanded={abierto}
          className="p-2 rounded-lg text-soft hover:text-strong hover:bg-elevated"><ChevronDown size={18} className={cn('transition', abierto && 'rotate-180')} /></button>
      </div>
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
          <div>
            <Etiqueta>Fecha de cierre para corregir las guías (último día editable)</Etiqueta>
            <div className="flex flex-wrap items-center gap-2">
              <input type="date" value={cierre} onChange={e => { setCierre(e.target.value); setCierreMsg(''); }} className={cn(CLASE_INPUT, 'max-w-[11rem]')} />
              <input type="time" value={cierreH} aria-label="Hora límite" onChange={e => { setCierreH(e.target.value); setCierreMsg(''); }} className={cn(CLASE_INPUT, 'max-w-[8rem]')} />
              <button className={CLASE_BOTON_SEC} disabled={cierre === (plan.cierreEdicion ?? '') && cierreH === (plan.cierreHora ?? '')}
                onClick={() => guardarCierreEdicion(plan.id, cierre, cierreH).then(() => setCierreMsg('Guardado.')).catch(e => setError(e.message))}>Guardar cierre</button>
              {cierreMsg && <span className="text-xs text-soft">{cierreMsg}</span>}
            </div>
            <p className="text-[11px] text-muted">Vigente: {textoVigente(plan)}{plan.cierreEdicion ? (plan.cierreHora ? '' : ' (todo el día; ponga una hora para cerrar antes)') : ' (automática: último día hábil antes del inicio). Déjela vacía para volver a la automática.'}</p>
          </div>
          <p className="text-soft"><span className="font-medium text-strong">Tope diario:</span> {plan.topeDiario} momentos · ritmo {plan.ritmo === 'dia_por_medio' ? 'día por medio' : 'diario'}</p>
          <button onClick={() => cambiarEstadoPlan(plan.id, plan.estado === 'activo' ? 'cerrado' : 'activo').catch(e => setError(e.message))}
            className={CLASE_BOTON_SEC}>{plan.estado === 'activo' ? 'Cerrar plan' : 'Reabrir plan'}</button>
          {esSuper && plan.estado === 'cerrado' && (!confElim ? (
            <button onClick={() => { setConfElim(true); setTecleado(''); }}
              className="ml-2 rounded-lg border border-danger px-3 py-1.5 text-sm font-medium text-danger">Eliminar plan definitivamente</button>
          ) : (
            <div role="alert" className="mt-2 rounded-lg border border-danger p-3 space-y-2">
              <p className="text-sm text-danger">Esto borra el plan, sus guías, asignaturas, entregas y la agenda del estudiante. No se puede deshacer.</p>
              <label className="block text-xs text-soft">Escriba el primer nombre del estudiante para confirmar
                <input value={tecleado} onChange={e => setTecleado(e.target.value)} className={CLASE_INPUT} autoComplete="off" /></label>
              <div className="flex gap-2">
                <button disabled={eliminando || !primerNombre || tecleado.trim().toLowerCase() !== primerNombre.toLowerCase()}
                  onClick={() => { setEliminando(true); eliminarPlan(plan.id).catch(e => { setError(e.message); setEliminando(false); }); }}
                  className="rounded-lg bg-danger px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40">{eliminando ? 'Eliminando…' : 'Eliminar'}</button>
                <button disabled={eliminando} onClick={() => setConfElim(false)} className={CLASE_BOTON_SEC}>Cancelar</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {asigs && guias && (
        <p className={cn('text-xs', faltanCriterios || faltanGuias ? 'text-warning' : 'text-success')}>
          {faltanCriterios || faltanGuias
            ? `○ ${guias.length - faltanGuias} de ${guias.length} guías aprobadas${faltanCriterios ? ` · faltan criterios en ${faltanCriterios}` : ''}`
            : `✓ ${guias.length} de ${guias.length} guías aprobadas`}
        </p>
      )}
      <MenuAcciones etiqueta="Acciones">
        {cerrar => (<>
          <button onClick={() => { cerrar(); setVerFicha(true); leerDirectores().then(setDirectores).catch(() => {}); }}>Ficha del estudiante</button>
          {puedeMarcar && <button onClick={() => { cerrar(); setAccion(a => a === 'espera' ? '' : 'espera'); }}>{plan.enEspera ? 'Editar «en espera»' : 'Marcar en espera · ingresó tarde'}</button>}
          {(rolActual === 'coordinador' || esSuper) && <button onClick={() => { cerrar(); setAccion(a => a === 'completar' ? '' : 'completar'); }}>Completar todo con IA</button>}
          {(rolActual === 'coordinador' || esSuper) && <button onClick={() => { cerrar(); setAccion(a => a === 'replicar' ? '' : 'replicar'); }}>Replicar guías a otro estudiante</button>}
          {(rolActual === 'coordinador' || esSuper) && <button onClick={() => { cerrar(); setAccion(a => a === 'tope' ? '' : 'tope'); }}>Cambiar tope diario ({plan.topeDiario} momentos)</button>}
          {(rolActual === 'coordinador' || esSuper) && <button onClick={() => { cerrar(); setAccion(a => a === 'fechas' ? '' : 'fechas'); }}>Cambiar fechas del plan</button>}
          {guias && asigs && guias.some(g => g.aprobada || g.propuesta) && <span onClick={cerrar}><BotonFormatoUAI plan={plan} guias={guias} asigs={asigs} nombres={nombres} /></span>}
          {guias && <span onClick={cerrar}><BotonCuadernillo plan={plan} guias={guias} nombres={nombres} /></span>}
          <button onClick={() => { cerrar(); imprimirCartas([plan]).catch(e => setError(e.message)); }}>Carta para la familia</button>
          <button onClick={() => { cerrar(); setVerQR(v => !v); }}>{verQR ? 'Ocultar QR' : 'Ver QR de la agenda'}</button>
          <button onClick={() => { cerrar(); verMotivo(); }}>{abierto ? 'Ocultar detalle' : 'Ver detalle del plan'}</button>
        </>)}
      </MenuAcciones>

      {plan.enEspera && (
        <div role="status" className="rounded-xl bg-warning-soft text-warning-soft-fg text-xs p-3 space-y-1">
          <p>⏳ Este caso ingresó el {plan.creadoEn ? fechaLarga(isoLocal(new Date(plan.creadoEn))) : 'día de su creación'}, después del cierre. Plazo para los docentes: {fechaLarga(plan.enEspera.hasta)}. No completar con IA antes de esa fecha.</p>
          {plan.enEspera.nota && <p>{plan.enEspera.nota}</p>}
        </div>
      )}
      {accion === 'espera' && puedeMarcar && <EnEsperaControl plan={plan} onError={setError} />}
      {accion === 'completar' && asigs && guias && <CompletarConIA plan={plan} asigs={asigs} guias={guias} nombres={nombres} puede={rolActual === 'coordinador' || esSuper} />}
      {accion === 'completar' && asigs && guias && !faltantesPlan(plan, asigs, guias).hayQueHacer && <p className="text-xs text-success">✓ No le falta nada por completar.</p>}
      {accion === 'replicar' && asigs && guias && <ReplicarGuias plan={plan} planes={planes} asigs={asigs} guias={guias} nombres={nombres} puede={rolActual === 'coordinador' || esSuper} />}
      {accion === 'fechas' && <CambiarFechas planes={[plan]} nombreDe={() => nombreAsig} onError={setError} />}
      {accion === 'tope' && guias && <CambiarTope plan={plan} guias={guias} nombre={nombreAsig} onError={setError} />}
      {accion && <button onClick={() => setAccion('')} className="text-xs text-soft underline">Cerrar</button>}
      {verFicha && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm overflow-y-auto p-3" role="dialog" aria-label="Ficha del estudiante">
          <div className="max-w-2xl mx-auto rounded-2xl bg-card border border-line p-3">
            <Ficha studentId={plan.studentId} rol={rolActual} slotId={userId} directores={directores} onVolver={() => setVerFicha(false)} />
          </div>
        </div>
      )}

      <SolicitudesPendientes plan={plan} solicitudes={solicitudes} onError={setError}
        nombreGuia={id => { const g = guias?.find(x => x.id === id); return g ? (g.eje || g.asignaturaIds.map(nombreAsig).join(' · ')) : id; }} />

      {verQR && (plan.sinTecnologia
        ? <p className="rounded-xl bg-elevated text-sm text-soft p-3">Plan sin tecnología: se entrega la guía impresa.</p>
        : <BloqueQR plan={plan} />)}
      {error && <CajaError>{error}</CajaError>}
      {(!asigs || !guias) && !error && <Cargando texto="Cargando…" />}

      {abierto && (<>
      {filas.length > 0 && (
        <div>
          <p className="text-xs font-medium text-soft mb-1">Asignaturas</p>
          <ul className="divide-y divide-line">
            {filas.map(({ a, n }) => (
              <li key={a.asignaturaId} className="py-1.5 flex flex-wrap items-center gap-1.5">
                <span className="text-sm text-strong">{n?.asignatura ?? a.asignaturaId}<span className="text-xs text-muted"> · {n?.docente ?? a.docenteId}</span></span>
                <Marca ok={criteriosPuestos(a)} etiqueta="Criterios" />
                {a.porIA && <EtiquetaCoordinacion c={a.completadoPorCoordinacion} />}
                {puedeMarcar && (quitando === a.asignaturaId
                  ? <span className="flex items-center gap-1 text-xs">
                      <span className="text-warning">¿Quitar {n?.asignatura ?? a.asignaturaId} de este plan?</span>
                      <button className="underline text-danger" onClick={() => { setQuitando(''); quitarAsignatura(plan, a.asignaturaId, asigs ?? [], guias ?? []).catch(e => setError(e.message)); }}>Sí, quitar</button>
                      <button className="underline text-soft" onClick={() => setQuitando('')}>No</button>
                    </span>
                  : <button className="ml-auto text-xs text-muted underline" onClick={() => setQuitando(a.asignaturaId)}>Quitar del plan</button>)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {guias && guias.length > 0 && (
        <div>
          <p className="text-xs font-medium text-soft mb-1">Guías ({plan.modalidad === 'transversal' ? 'transversales' : 'por asignatura'})</p>
          {(() => {
            const aprobadas = guias.filter(x => x.aprobada);
            if (aprobadas.length === 0) return null;
            const r = resumenProgramadas(aprobadas.map(x => x.aprobada!.sustentacion.fecha));
            return <p className="text-xs text-soft mb-1" data-testid="resumen-sustentaciones">{r.texto}. {textoEntre()}.</p>;
          })()}
          <ul className="divide-y divide-line">
            {guias.map(g => {
              const r = resumenGuia(g);
              return (
                <li key={g.id} className="py-2">
                  <p className="text-sm text-strong">{g.eje || `Guía ${guias.indexOf(g) + 1} · ${g.asignaturaIds.map(nombreAsig).join(' · ')}`}
                    {g.eje && g.asignaturaIds.length > 1 && <span className="text-xs text-muted"> · {g.asignaturaIds.map(nombreAsig).join(', ')}</span>}</p>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    <Marca ok={r.guia} etiqueta="Aprobada" />
                    {g.completadoPorCoordinacion && g.completadoPorCoordinacion.fecha === g.aprobadaEn && <EtiquetaCoordinacion c={g.completadoPorCoordinacion} />}
                    {g.asignaturaIds.length > 1 && <span className="text-[11px] text-soft">Vistos buenos {r.vistos}/{r.vistosTotal}</span>}
                    {r.guia && <span className="text-[11px] text-soft">{r.avance}% ({r.pasosTotal} pasos) · Sustentación: {TEXTO_SUSTENTACION[r.sustentacion]}</span>}
                  </div>
                  {r.guia && <div className="h-1.5 rounded-full bg-elevated mt-1.5 overflow-hidden"><div className="h-full bg-success" style={{ width: `${r.avance}%` }} /></div>}
                  {r.guia && <EntregasGuiaResumen planId={plan.id} g={g} />}
                  {g.autorizacion && <p className="text-[11px] text-soft mt-1">Autorizada para corregir hasta el {fechaLarga(g.autorizacion.hasta)} ({g.autorizacion.por}).</p>}
                  {g.aprobada && (
                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                      <label className="text-[11px] text-soft">Sustentación:</label>
                      <input type="date" aria-label="Fecha de sustentación" value={fechaSust[g.id] ?? g.aprobada.sustentacion.fecha ?? ''} onChange={e => setFechaSust(f => ({ ...f, [g.id]: e.target.value }))}
                        min={VENTANA_SUSTENTACION.desde} max={VENTANA_SUSTENTACION.hasta}
                        className="px-2 py-1 rounded-lg bg-elevated border border-line text-xs text-strong" />
                      <span className="text-[11px] text-muted">{textoEntre()}</span>
                      <button disabled={fechaSust[g.id] === undefined || fechaSust[g.id] === (g.aprobada.sustentacion.fecha ?? '') || !fechaValida(fechaSust[g.id])}
                        onClick={() => cambiarFechaSustentacion(plan.id, g, fechaSust[g.id]).then(() => setFechaSust(f => { const n = { ...f }; delete n[g.id]; return n; })).catch(e => setError(e.message))}
                        className="text-xs px-3 py-1.5 rounded-lg bg-elevated text-soft hover:text-strong disabled:opacity-40">Guardar y publicar</button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      </>)}
    </div>
  );
}

/**
 * Coordinación: cambia inicio (y fin) de uno o varios planes y reprograma sus guías desde cero.
 * Con varios planes, el fin se conserva y solo se cambia el inicio.
 */
function CambiarFechas({ planes, nombreDe, onError }: { planes: PlanConDocentes[]; nombreDe: (p: PlanConDocentes) => (id: string) => string; onError: (m: string) => void }) {
  const uno = planes.length === 1 ? planes[0] : null;
  const [desde, setDesde] = useState(uno?.desde ?? addDias(hoyLocal(), 1));
  const [hasta, setHasta] = useState(uno?.hasta ?? '');
  const [msg, setMsg] = useState('');
  const [ocupado, setOcupado] = useState(false);
  async function aplicar() {
    setOcupado(true); setMsg('');
    let ok = 0; const malos: string[] = [];
    for (const p of planes) {
      try { await reprogramarPlan(p, desde, uno ? hasta : p.hasta, nombreDe(p)); ok++; }
      catch (e) { malos.push(`${p.nombres} ${p.apellidos}: ${(e as Error).message}`); }
      setMsg(`Reprogramando… ${ok + malos.length} de ${planes.length}`);
    }
    setMsg(`Listo: ${ok} plan(es) reprogramados desde el ${fechaLarga(desde)}; agendas publicadas.`);
    if (malos.length) onError(malos.join(' · '));
    setOcupado(false);
  }
  return (
    <div className="rounded-xl border border-line p-3 space-y-2 text-sm">
      <p className="font-medium text-strong">{uno ? 'Fechas del plan' : `Cambiar el inicio de ${planes.length} plan(es)`}</p>
      <p className="text-xs text-soft">Se reprograman todas las guías aprobadas dentro de las fechas nuevas, respetando el tope diario. Úselo antes de que el estudiante empiece a entregar.</p>
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs text-soft">Inicio <input type="date" value={desde} onChange={e => setDesde(e.target.value)} className={cn(CLASE_INPUT, 'max-w-[11rem]')} /></label>
        {uno && <label className="text-xs text-soft">Fin <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className={cn(CLASE_INPUT, 'max-w-[11rem]')} /></label>}
        <button disabled={ocupado || !desde || (!!uno && (!hasta || desde > hasta))} onClick={aplicar} className={CLASE_BOTON}>{ocupado ? 'Reprogramando…' : 'Guardar y reprogramar'}</button>
      </div>
      {!uno && <ul className="text-[11px] text-muted max-h-32 overflow-y-auto">{planes.map(p => <li key={p.id}>{p.nombres} {p.apellidos} · {p.grupo} · hoy {fechaCorta(p.desde)} a {fechaCorta(p.hasta)}</li>)}</ul>}
      {msg && <p className="text-xs text-success" aria-live="polite">{msg}</p>}
    </div>
  );
}

/** Coordinación: cambia el tope diario del plan y vuelve a dosificar sus entregas. */
function CambiarTope({ plan, guias, nombre, onError }: { plan: PlanConDocentes; guias: GuiaPlan[]; nombre: (id: string) => string; onError: (m: string) => void }) {
  const total = guias.reduce((s, g) => s + (g.aprobada?.pasos ?? []).reduce((t, p) => t + (p.momentos || 0), 0), 0);
  const nec = topeNecesario(plan, total, hoyLocal());
  const [tope, setTope] = useState(Math.max(plan.topeDiario, nec.tope));
  const [msg, setMsg] = useState('');
  const [ocupado, setOcupado] = useState(false);
  async function aplicar() {
    setOcupado(true); setMsg('');
    try {
      await guardarTopeDiario(plan.id, tope);
      const r = await dosificarPlan({ ...plan, topeDiario: tope }, nombre);
      setMsg(`Tope ${tope} guardado y entregas dosificadas: ${r.reacomodadas} reacomodada(s) · días sobre el tope ${r.sobreAntes} → ${r.sobreDespues}${r.publicado ? ' · agenda publicada' : ''}.`);
    } catch (e) { onError((e as Error).message); }
    setOcupado(false);
  }
  return (
    <div className="rounded-xl border border-line p-3 space-y-2 text-sm">
      <p className="font-medium text-strong">Tope diario de momentos</p>
      <p className="text-xs text-soft">Sus guías aprobadas suman {total} momentos para {nec.dias} día(s) de trabajo que quedan: necesita al menos <b className="text-strong">{nec.tope}</b> por día (cada momento ≈ 25 min). Hoy tiene {plan.topeDiario}.</p>
      {nec.tope > 6 && <p className="text-xs text-warning">Más de 6 momentos diarios (≈ 2½ horas) es mucho trabajo: considere reducir o agrupar las guías en lugar de subir el tope.</p>}
      <div className="flex flex-wrap items-center gap-2">
        <input type="number" min={1} max={12} value={tope} onChange={e => { setTope(Math.max(1, Math.min(12, Number(e.target.value) || 1))); setMsg(''); }}
          aria-label="Tope diario" className={cn(CLASE_INPUT, 'max-w-[6rem]')} />
        <button disabled={ocupado} onClick={aplicar} className={CLASE_BOTON}>
          {ocupado ? 'Guardando…' : 'Guardar y dosificar'}</button>
      </div>
      {msg && <p className="text-xs text-success">{msg}</p>}
    </div>
  );
}

// ── Avance por docente ────────────────────────────────────────────────────

/** Escucha asignaturas y guías de un plan y las reporta al padre (no pinta nada). */
function OyentePlan({ planId, onDatos }: { planId: string; onDatos: (id: string, a?: AsignaturaPlan[], g?: GuiaPlan[]) => void }) {
  useEffect(() => escucharAsignaturas(planId, a => onDatos(planId, a, undefined)), [planId, onDatos]);
  useEffect(() => escucharGuias(planId, g => onDatos(planId, undefined, g)), [planId, onDatos]);
  return null;
}

const COLOR_BARRA = { ok: 'bg-success', par: 'bg-warning', no: 'bg-danger' } as const;

/** Fracción con barrita: verde si completa, ámbar si parcial, roja si 0; «—» si no hay nada que medir. */
function Mini({ titulo, f }: { titulo: string; f: Fraccion }) {
  const c = f.y === 0 ? null : COLOR_BARRA[claseBarra(f)];
  return (
    <div className="min-w-[64px] flex-1">
      <p className="text-[11px] text-soft">{titulo}</p>
      <p className="text-xs font-medium text-strong">{f.y === 0 ? '—' : fraccionTexto(f)}</p>
      <div className="h-1.5 rounded-full bg-elevated overflow-hidden">
        {c && <div className={cn('h-full', c)} style={{ width: `${(f.x / f.y) * 100}%` }} />}
      </div>
    </div>
  );
}

const FILTROS: { id: FiltroJornada; label: string }[] = [
  { id: 'todas', label: 'Todas' }, { id: 'manana', label: 'Mañana' }, { id: 'tarde', label: 'Tarde' },
];

function AvanceDocentes({ planes }: { planes: PlanConDocentes[] }) {
  const rol = useAppStore(s => s.rol);
  const jornadaUsuario = useAppStore(s => s.jornada);
  // Un coordinador ve solo su jornada; rectora, superusuario y equipo ven todo y pueden filtrar.
  const fija: FiltroJornada | null = rol === 'coordinador' && (jornadaUsuario === 'manana' || jornadaUsuario === 'tarde') ? jornadaUsuario : null;
  const [elegida, setElegida] = useState<FiltroJornada>('todas');
  const jornada: FiltroJornada = fija ?? elegida;

  const activos = useMemo(() => planes.filter(p => p.estado === 'activo'), [planes]);
  const [datos, setDatos] = useState<Record<string, { a?: AsignaturaPlan[]; g?: GuiaPlan[] }>>({});
  const recibir = useMemo(() => (id: string, a?: AsignaturaPlan[], g?: GuiaPlan[]) =>
    setDatos(prev => ({ ...prev, [id]: { a: a ?? prev[id]?.a, g: g ?? prev[id]?.g } })), []);

  const cargando = activos.some(p => !datos[p.id]?.a || !datos[p.id]?.g);
  const docentes = useMemo(() => {
    const lista: DatosPlanAvance[] = activos.map(p => ({
      plan: p, asigs: datos[p.id]?.a ?? [], guias: datos[p.id]?.g ?? [], nombres: asignaturasConNombre(p.grupo),
    }));
    return filtrarPorJornada(construirAvanceDocentes(lista), jornada);
  }, [activos, datos, jornada]);
  const filas = useMemo(() => filasInforme(docentes), [docentes]);
  const r = useMemo(() => resumenAvance(docentes), [docentes]);

  const [copiado, setCopiado] = useState('');
  const copiarResumen = async () => {
    const texto = construirResumenTexto(docentes, new Date(), jornada);
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado('Resumen copiado.');
    } catch {
      window.prompt('Copie el resumen (Ctrl+C):', texto);
      setCopiado('');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {fija
          ? <span className="text-xs text-soft">{ETIQUETA_JORNADA[fija]}</span>
          : <PestanasSubrayadas opciones={FILTROS} activa={elegida} onCambio={setElegida} />}
      </div>
      {activos.length > 0 && !cargando && (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => abrirImprimibleUAI(construirInformeHTML(docentes, new Date(), jornada))} className={CLASE_BOTON}>📄 Informe ejecutivo</button>
          <button type="button" onClick={copiarResumen} className={CLASE_BOTON}>Copiar resumen</button>
          {copiado && <span className="text-xs text-soft">{copiado}</span>}
        </div>
      )}
      {activos.map(p => <OyentePlan key={p.id} planId={p.id} onDatos={recibir} />)}
      {cargando && activos.length > 0 && <Cargando texto="Cargando avance…" />}
      {activos.length === 0 && <p className="text-sm text-soft">No hay planes activos.</p>}
      {!cargando && activos.length > 0 && filas.length === 0 && <p className="text-sm text-soft">No hay docentes con planes activos en esta jornada.</p>}
      {!cargando && filas.length > 0 && (
        <>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            <div className="rounded-xl border border-line bg-surface p-2"><Mini titulo="Criterios" f={r.criterios} /></div>
            <div className="rounded-xl border border-line bg-surface p-2"><Mini titulo="Entregas" f={r.entregas} /></div>
            <div className="rounded-xl border border-line bg-surface p-2"><Mini titulo="Guías" f={r.guias} /></div>
            <div className="rounded-xl border border-line bg-surface p-2"><Mini titulo="Preguntas líderes" f={r.pregunta} /></div>
            <div className="rounded-xl border border-line bg-surface p-2"><Mini titulo="General" f={{ x: r.listas, y: r.total }} /></div>
          </div>
          <p className="text-xs text-soft">{r.alDia} docentes al día de {r.docentes} · {r.porcentaje} % de avance general</p>
        </>
      )}
      {!cargando && filas.map(f => (
        <details key={f.docente} className="rounded-2xl border border-line bg-surface">
          <summary className="p-3 cursor-pointer min-h-[44px] list-none">
            <p className="font-medium text-strong truncate mb-1.5">{f.docente} <span className="text-xs font-normal text-soft">· {f.porcentaje} %</span></p>
            <div className="flex gap-2">
              <Mini titulo="Criterios" f={f.criterios} />
              <Mini titulo="Entregas" f={f.entregas} />
              <Mini titulo="Guías" f={f.guias} />
              {f.pregunta.y > 0 && <Mini titulo="Líder: pregunta" f={f.pregunta} />}
              <Mini titulo="General" f={{ x: f.listas, y: f.total }} />
            </div>
          </summary>
          <div className="border-t border-line p-3 text-sm">
            <p className="text-xs text-soft mb-1">{f.planes} · «Líder: pregunta» aparece solo si lidera una guía.</p>
            {f.faltas.length === 0
              ? <p className="text-soft">Al día.</p>
              : <ul className="list-disc pl-5 space-y-0.5">{f.faltas.map((x, i) => <li key={i}>{x}</li>)}</ul>}
          </div>
        </details>
      ))}
    </div>
  );
}

/** Lista con casillas (todas marcadas) para imprimir las cartas de varias familias en un solo documento. */
function ElegirCartas({ planes, onCerrar }: { planes: PlanCasa[]; onCerrar: () => void }) {
  const [marcados, setMarcados] = useState<Set<string>>(() => new Set(planes.map(p => p.id)));
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const alternar = (id: string) => setMarcados(m => { const n = new Set(m); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const elegidos = planes.filter(p => marcados.has(p.id));
  async function imprimir() {
    setOcupado(true); setError('');
    try { await imprimirCartas(elegidos); } catch (e) { setError((e as Error).message); } finally { setOcupado(false); }
  }
  async function planilla() {
    setOcupado(true); setError('');
    try { await imprimirPlanilla(elegidos); } catch (e) { setError((e as Error).message); } finally { setOcupado(false); }
  }
  return (
    <div className="rounded-2xl border border-line bg-card p-4 space-y-2">
      <p className="text-sm font-semibold text-strong">Cartas para las familias</p>
      <div className="flex gap-3 text-xs">
        <button onClick={() => setMarcados(new Set(planes.map(p => p.id)))} className="text-soft underline">Marcar todos</button>
        <button onClick={() => setMarcados(new Set())} className="text-soft underline">Desmarcar todos</button>
      </div>
      <ul className="max-h-64 overflow-y-auto divide-y divide-line">
        {planes.map(p => (
          <li key={p.id}>
            <label className="flex items-center gap-2 py-1.5 text-sm text-strong min-h-[40px]">
              <input type="checkbox" checked={marcados.has(p.id)} onChange={() => alternar(p.id)} />
              {p.apellidos} {p.nombres} <span className="text-xs text-soft">· {p.grupo}{p.estado === 'cerrado' ? ' · cerrado' : ''}</span>
            </label>
          </li>
        ))}
      </ul>
      {error && <CajaError>{error}</CajaError>}
      <div className="flex gap-2">
        <button onClick={imprimir} disabled={ocupado || elegidos.length === 0} className={CLASE_BOTON}><Mail size={15} />{ocupado ? 'Preparando…' : `Imprimir ${elegidos.length} carta${elegidos.length === 1 ? '' : 's'}`}</button>
        <button onClick={planilla} disabled={ocupado || elegidos.length === 0} className={CLASE_BOTON_SEC}>Planilla de entrega</button>
        <button onClick={onCerrar} className={CLASE_BOTON_SEC}>Cerrar</button>
      </div>
    </div>
  );
}

/** «martes 4 de noviembre a las 5:00 p. m.» según el cierre vigente del plan. */
function textoVigente(p: PlanConDocentes): string {
  const h = horaCierre(p);
  return `${fechaLarga(fechaCierre(p))}${h ? ` a las ${hora12(h)}` : ''}`;
}

// ── Completar con IA a todos los estudiantes ────────────────────────────

interface FilaMasiva { id: string; texto: string; estado: 'espera' | 'curso' | 'ok' | 'fallo' | 'nada'; detalle?: string }

/** Coordinación: «Completar todo con IA» en cada plan activo que lo necesite, uno tras otro. */
function CompletarTodos({ planes, onCerrar }: { planes: PlanConDocentes[]; onCerrar: () => void }) {
  const [paso, setPaso] = useState<'confirmar' | 'corriendo' | 'fin'>('confirmar');
  const [tecleado, setTecleado] = useState('');
  const [filas, setFilas] = useState<FilaMasiva[]>([]);
  const candidatos = planes.filter(p => p.estado === 'activo' && !p.enEspera);
  const enEspera = planes.filter(p => p.estado === 'activo' && p.enEspera).length;

  async function ejecutar() {
    setPaso('corriendo');
    const fs: FilaMasiva[] = candidatos.map(p => ({ id: p.id, texto: `${p.nombres} ${p.apellidos} · ${p.grupo}`, estado: 'espera' }));
    const pintar = () => setFilas(fs.map(x => ({ ...x })));
    pintar();
    for (const [i, plan] of candidatos.entries()) {
      fs[i].estado = 'curso'; pintar();
      try {
        const { asigs, guias } = await leerAsignaturasYGuias(plan.id);
        if (!faltantesPlan(plan, asigs, guias).hayQueHacer) { fs[i].estado = 'nada'; fs[i].detalle = 'ya estaba completo'; pintar(); continue; }
        const nombres = asignaturasConNombre(plan.grupo);
        const nombre = (id: string) => nombres[id]?.asignatura ?? id;
        const etiquetaGuia = (g: GuiaPlan) => g.asignaturaIds.length > 1 ? (g.eje?.trim() || g.asignaturaIds.map(nombre).join(' · ')) : nombre(g.asignaturaIds[0] ?? g.id);
        const r = await completarPlanConIA({ plan, asigs, guias, nombre, etiquetaGuia, onProgreso: () => {} });
        const malo = r.fallos.length > 0 || r.sinAprobar.length > 0;
        fs[i].estado = malo ? 'fallo' : 'ok';
        fs[i].detalle = `${r.hechos} paso(s)${r.publicado ? ', agenda publicada' : ''}${r.sinAprobar.length ? ` · sin aprobar: ${r.sinAprobar.join(', ')}` : ''}${r.fallos.length ? ` · ${r.fallos.length} fallo(s)` : ''}`;
      } catch (e) { fs[i].estado = 'fallo'; fs[i].detalle = (e as Error).message; }
      pintar();
    }
    setPaso('fin');
  }

  return (
    <div className="rounded-xl border border-line p-3 space-y-2 text-sm">
      <p className="font-medium text-strong">Completar con IA a todos los estudiantes</p>
      {paso === 'confirmar' && (<>
        <p className="text-xs text-soft">Se revisan {candidatos.length} plan(es) activos, uno por uno. En cada uno la IA llena solo lo que falte y se aprueba todo; lo que ya escribió un docente no se cambia y las guías aprobadas no se tocan.{enEspera > 0 && ` Se omiten ${enEspera} caso(s) «en espera».`}</p>
        <label className="block text-xs text-soft">Escriba COMPLETAR para habilitar el botón
          <input value={tecleado} onChange={e => setTecleado(e.target.value)} className={CLASE_INPUT} autoComplete="off" /></label>
        <div className="flex flex-wrap gap-2">
          <button disabled={tecleado.trim().toUpperCase() !== 'COMPLETAR' || !candidatos.length} onClick={ejecutar} className={CLASE_BOTON}><Sparkles size={15} />Completar a todos</button>
          <button onClick={onCerrar} className={CLASE_BOTON_SEC}>Cancelar</button>
        </div>
      </>)}
      {paso !== 'confirmar' && (<>
        <p className="text-xs text-strong" aria-live="polite">{paso === 'corriendo' ? 'Completando… no cierre esta página (puede tardar varios minutos).' : 'Proceso terminado.'}</p>
        <ul className="space-y-0.5 max-h-72 overflow-y-auto">
          {filas.map(f => (
            <li key={f.id} className={cn('text-xs flex gap-1.5', f.estado === 'fallo' ? 'text-danger' : f.estado === 'ok' ? 'text-success' : 'text-soft')}>
              <span aria-hidden className="w-4 flex-shrink-0">{f.estado === 'ok' ? '✓' : f.estado === 'fallo' ? '✗' : f.estado === 'curso' ? '…' : f.estado === 'nada' ? '–' : '·'}</span>
              <span>{f.texto}{f.detalle ? ` — ${f.detalle}` : ''}</span>
            </li>
          ))}
        </ul>
        {paso === 'fin' && <p className="text-[11px] text-muted">Si alguno quedó con ✗, ábralo y use «Completar todo con IA» en su tarjeta para reintentar solo lo que falta.</p>}
        {paso === 'fin' && <button onClick={onCerrar} className={CLASE_BOTON_SEC}>Cerrar</button>}
      </>)}
    </div>
  );
}

// ── Abrir plazo a toda una jornada ───────────────────────────────────────

/** Coordinación: pone la misma fecha de cierre a todos los planes activos de una jornada. */
function AbrirPlazoJornada({ planes, jornadaFija, onCerrar }: { planes: PlanConDocentes[]; jornadaFija: 'manana' | 'tarde' | null; onCerrar: () => void }) {
  const [jornada, setJornada] = useState<'manana' | 'tarde' | 'ambas'>(jornadaFija ?? 'ambas');
  const [fecha, setFecha] = useState('');
  const [hora, setHora] = useState('');
  const [estado, setEstado] = useState<'' | 'guardando' | 'ok'>('');
  const [error, setError] = useState('');
  const elegidos = planes.filter(p => p.estado === 'activo' && (jornada === 'ambas' || jornadaDePlan(p.grupo) === jornada));
  const etiqueta = jornada === 'manana' ? 'la mañana' : jornada === 'tarde' ? 'la tarde' : 'las dos jornadas';

  async function aplicar() {
    setEstado('guardando'); setError('');
    const r = await Promise.allSettled(elegidos.map(p => guardarCierreEdicion(p.id, fecha, hora)));
    const malos = r.filter(x => x.status === 'rejected').length;
    if (malos) setError(`No se pudo guardar en ${malos} plan(es). Intente de nuevo.`);
    setEstado('ok');
  }

  return (
    <div className="rounded-xl border border-line p-3 space-y-2 text-sm">
      <p className="font-medium text-strong">Abrir plazo a los docentes de {etiqueta}</p>
      {!jornadaFija && (
        <div className="flex flex-wrap gap-3 text-xs">
          {(['manana', 'tarde', 'ambas'] as const).map(j => (
            <label key={j} className="flex items-center gap-1"><input type="radio" checked={jornada === j} onChange={() => { setJornada(j); setEstado(''); }} />
              {j === 'manana' ? 'Mañana' : j === 'tarde' ? 'Tarde' : 'Ambas'}</label>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs text-soft">Último día editable
          <input type="date" value={fecha} min={hoyLocal()} onChange={e => { setFecha(e.target.value); setEstado(''); }} className={cn(CLASE_INPUT, 'max-w-[11rem]')} /></label>
        <label className="text-xs text-soft">Hasta la hora
          <input type="time" value={hora} onChange={e => { setHora(e.target.value); setEstado(''); }} className={cn(CLASE_INPUT, 'max-w-[8rem]')} /></label>
      </div>
      {fecha && !hora && <p className="text-[11px] text-warning">Sin hora, el sistema queda abierto todo ese día (hasta las 11:59 p. m.).</p>}
      <ul className="text-xs text-soft space-y-0.5 max-h-48 overflow-y-auto">
        {elegidos.map(p => (
          <li key={p.id}>{p.nombres} {p.apellidos} · {p.grupo} — hoy abierto hasta {textoVigente(p)}{p.enEspera ? ' (en espera)' : ''}</li>
        ))}
      </ul>
      {error && <CajaError>{error}</CajaError>}
      {estado === 'ok' && !error && <p className="text-xs text-success">Listo: {elegidos.length} plan(es) quedan abiertos hasta {fechaLarga(fecha)}{hora ? ` a las ${hora12(hora)}` : ' (todo el día)'}.</p>}
      <div className="flex flex-wrap gap-2">
        <button disabled={!fecha || !elegidos.length || estado === 'guardando'} onClick={aplicar} className={CLASE_BOTON}>
          {estado === 'guardando' ? 'Guardando…' : `Abrir plazo a ${elegidos.length} plan(es)`}</button>
        <button onClick={onCerrar} className={CLASE_BOTON_SEC}>Cerrar</button>
      </div>
      <p className="text-[11px] text-muted">Aplica a todos los docentes de esos estudiantes. Un caso «en espera» conserva su fecha si es posterior.</p>
    </div>
  );
}

// ── Panel ─────────────────────────────────────────────────────────────────

export default function PanelPlanCasa({ vistaInicial }: { vistaInicial?: 'seguimiento' } = {}) {
  const [planes, setPlanes] = useState<PlanConDocentes[] | null>(null);
  const [error, setError] = useState('');
  const [creando, setCreando] = useState(false);
  const [aviso, setAviso] = useState('');
  const [vista, setVista] = useState<'planes' | 'avance' | 'seguimiento'>(vistaInicial ?? 'planes');
  const [eligiendoCartas, setEligiendoCartas] = useState(false);
  const [abriendoPlazo, setAbriendoPlazo] = useState(false);
  const [completandoTodos, setCompletandoTodos] = useState(false);
  const [sincMsg, setSincMsg] = useState('');
  const [busca, setBusca] = useState('');
  const [cambiandoInicio, setCambiandoInicio] = useState(false);
  const [jorFiltro, setJorFiltro] = useState<'todas' | 'manana' | 'tarde'>('todas');
  const rol = useAppStore(s => s.rol);
  const jornadaUsuario = useAppStore(s => s.jornada);
  // Un coordinador solo ve (y envía cartas de) su jornada; el resto ve todo.
  const jornadaFija = rol === 'coordinador' && (jornadaUsuario === 'manana' || jornadaUsuario === 'tarde') ? jornadaUsuario : null;
  const visibles = useMemo(() => (planes ?? []).filter(p => !jornadaFija || jornadaDePlan(p.grupo) === jornadaFija), [planes, jornadaFija]);

  const sinTilde = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const filtrados = visibles.filter(p => (jornadaFija || jorFiltro === 'todas' || jornadaDePlan(p.grupo) === jorFiltro)
    && (!busca.trim() || sinTilde(`${p.nombres} ${p.apellidos} ${p.grupo}`).includes(sinTilde(busca.trim()))))
    .sort((a, b) => `${a.nombres} ${a.apellidos}`.localeCompare(`${b.nombres} ${b.apellidos}`, 'es'));
  const gestiona = rol === 'coordinador' || rol === 'superusuario';

  useEffect(() => escucharPlanes(true, setPlanes, e => { setError(e.message || 'No se pudieron leer los planes.'); setPlanes([]); }), []);

  return (
    <div className={cn('space-y-4 mx-auto', vista === 'planes' ? 'max-w-5xl' : 'max-w-2xl')}>
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold text-strong flex-1">Plan Académico Especial</h2>
        {!creando && <button onClick={() => { setCreando(true); setAviso(''); }} className={CLASE_BOTON}><Plus size={16} />Nuevo plan</button>}
      </div>
      <PestanasSubrayadas opciones={[{ id: 'planes', label: 'Planes' }, { id: 'avance', label: 'Avance docentes' }, { id: 'seguimiento', label: 'Seguimiento' }]} activa={vista} onCambio={setVista} />
      {aviso && <p className="rounded-xl bg-success-soft text-success-soft-fg text-sm p-3">{aviso}</p>}
      {creando && <NuevoPlan onCerrar={() => setCreando(false)} onCreado={m => { setCreando(false); setAviso(m); }} />}
      {error && <CajaError>{error}</CajaError>}
      {!planes && <Cargando texto="Cargando planes…" />}
      {vista === 'planes' && planes && planes.length === 0 && !error && <p className="text-sm text-soft">Aún no hay planes. Cree el primero con «Nuevo plan».</p>}
      {vista === 'planes' && visibles.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative flex-1 min-w-[12rem]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
            <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar estudiante por nombre" aria-label="Buscar estudiante" className={cn(CLASE_INPUT, 'pl-9')} />
          </label>
          {!jornadaFija && (
            <div className="flex gap-1">
              {(['todas', 'manana', 'tarde'] as const).map(j => (
                <button key={j} onClick={() => setJorFiltro(j)} aria-pressed={jorFiltro === j}
                  className={cn('text-xs px-3 py-1.5 rounded-full border transition', jorFiltro === j ? 'bg-accent/15 border-accent/50 text-strong' : 'border-line text-soft hover:text-strong')}>
                  {j === 'todas' ? 'Todas' : j === 'manana' ? 'Mañana' : 'Tarde'}</button>))}
            </div>
          )}
          <MenuAcciones etiqueta="Acciones generales" alinear="derecha">
            {cerrar => (<>
              <button onClick={() => { cerrar(); setEligiendoCartas(v => !v); }}>{eligiendoCartas ? 'Ocultar cartas' : 'Cartas de todas las familias'}</button>
              <button onClick={() => { cerrar(); imprimirPlanilla(visibles).catch(e => setError(e.message)); }}>Planilla de entrega</button>
              {gestiona && <button onClick={() => { cerrar(); setAbriendoPlazo(v => !v); }}>{abriendoPlazo ? 'Ocultar plazo' : 'Abrir plazo a la jornada'}</button>}
              {gestiona && <button disabled={sincMsg === 'Actualizando…'} onClick={async () => {
                cerrar(); setSincMsg('Actualizando…');
                let n = 0, malos = 0;
                for (const p of visibles.filter(x => x.estado === 'activo')) { try { n += await sincronizarDocentes(p.id); } catch { malos++; } }
                setSincMsg(`Docentes actualizados: ${n} cambio(s) de correo${malos ? ` · ${malos} plan(es) con error` : ''}.`);
              }}>Actualizar docentes</button>}
              {gestiona && <button disabled={sincMsg === 'Dosificando…'} onClick={async () => {
                cerrar(); setSincMsg('Dosificando…');
                let np = 0, malos = 0, reac = 0, antes = 0, despues = 0;
                for (const p of visibles.filter(x => x.estado === 'activo' && !x.enEspera)) {
                  try {
                    const nombres = asignaturasConNombre(p.grupo);
                    const r = await dosificarPlan(p, id => nombres[id]?.asignatura ?? id);
                    np++; reac += r.reacomodadas; antes += r.sobreAntes; despues += r.sobreDespues;
                  } catch { malos++; }
                }
                setSincMsg(`Dosificación: ${np} plan(es) procesados · ${reac} entrega(s) reacomodadas · días sobre el tope ${antes} → ${despues}${malos ? ` · ${malos} plan(es) con error` : ''}.`);
              }}>Dosificar entregas</button>}
              {gestiona && <button onClick={() => { cerrar(); setCambiandoInicio(v => !v); }}>{cambiandoInicio ? 'Ocultar cambio de inicio' : 'Cambiar inicio de los planes'}</button>}
              {gestiona && <button onClick={() => { cerrar(); setCompletandoTodos(v => !v); }}>{completandoTodos ? 'Ocultar completar' : 'Completar a todos con IA'}</button>}
              <button onClick={() => { cerrar(); setCreando(true); setAviso(''); }}>Nuevo plan</button>
            </>)}
          </MenuAcciones>
        </div>
      )}
      {vista === 'planes' && sincMsg && <p className="text-xs text-soft" aria-live="polite">{sincMsg}</p>}
      {vista === 'planes' && cambiandoInicio && (
        <CambiarFechas planes={visibles.filter(p => p.estado === 'activo')} onError={setError}
          nombreDe={p => { const n = asignaturasConNombre(p.grupo); return id => n[id]?.asignatura ?? id; }} />
      )}
      {vista === 'planes' && completandoTodos && <CompletarTodos planes={visibles} onCerrar={() => setCompletandoTodos(false)} />}
      {vista === 'planes' && abriendoPlazo && <AbrirPlazoJornada planes={visibles} jornadaFija={jornadaFija} onCerrar={() => setAbriendoPlazo(false)} />}
      {vista === 'planes' && eligiendoCartas && <ElegirCartas planes={visibles} onCerrar={() => setEligiendoCartas(false)} />}
      {vista === 'planes' && visibles.length > 0 && filtrados.length === 0 && <p className="text-sm text-soft">Ningún estudiante coincide con «{busca}».</p>}
      {vista === 'planes' && filtrados.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 items-start">
          {filtrados.map(p => <TarjetaPlan key={p.id} plan={p} planes={planes ?? []} />)}
        </div>
      )}
      {vista === 'avance' && planes && <AvanceDocentes planes={planes} />}
      {vista === 'seguimiento' && <SeguimientoPlanCasa />}
    </div>
  );
}
