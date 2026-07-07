import { useCallback, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, ClipboardList, Gift, Loader2, QrCode, Trash2, X } from 'lucide-react';
import QRCode from 'qrcode';
import { useAppStore } from '../data/store';
import { getDatosTareas, crearTarea, cancelarTarea, crearCesion } from '../data/api';
import { USUARIOS, colorGrado } from '../data/maestros';
import { getAsignatura, asignacionDeGrupo } from '../data/asignacionAcademica';
import type { Tarea, Cesion, FechaISO } from '../data/tareas/tipos';
import {
  addDias, esDiaHabil, esDiaEjecutable, hoyISO, parseFecha, formatFecha,
} from '../data/tareas/calendario';
import { CONFIG_NIVEL, nivelDeGrupo, cupoDeAsignatura } from '../data/tareas/config';
import {
  planificarAgenda, ocupacionPorDia, validarTarea, ventanaValida, cupoDisponible,
  clavePeriodo, fechaLegible,
} from '../data/tareas/motor';
import { diasDeClase, gruposAsignables, todosLosGrupos, esGrupoDeTarde } from '../data/tareas/horario';
import { cn } from '@/lib/utils';

function diaCortoDe(f: FechaISO): string {
  const [y, m, d] = f.split('-').map(Number);
  return ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][new Date(y, m - 1, d).getDay()];
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

// Semanas del mes (solo lunes a viernes) como matriz de fechas ISO o null.
function gridMes(year: number, month: number): (FechaISO | null)[][] {
  const weeks: (FechaISO | null)[][] = [];
  let week: (FechaISO | null)[] = [null, null, null, null, null];
  const ultimo = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= ultimo; d++) {
    const date = new Date(year, month, d);
    const dow = date.getDay();
    if (dow === 0 || dow === 6) continue;
    const col = dow - 1;
    if (col === 0 && week.some(x => x !== null)) {
      weeks.push(week);
      week = [null, null, null, null, null];
    }
    week[col] = formatFecha(date);
  }
  if (week.some(x => x !== null)) weeks.push(week);
  return weeks;
}

function urlAgendaPublica(grupo: string): string {
  return `${window.location.origin}${window.location.pathname}#/agenda/${encodeURIComponent(grupo)}`;
}

// ── Celda de carga (semáforo compartido docente/coordinador) ──────────────────

function colorCarga(ocupados: number, tope: number): string {
  if (ocupados <= 0) return 'transparent';
  const nivel = ocupados / tope;
  if (nivel < 0.5) return 'rgba(251,146,60,0.25)';
  if (nivel < 1) return 'rgba(251,146,60,0.55)';
  return 'rgba(239,68,68,0.65)';
}

// ── Panel del docente ─────────────────────────────────────────────────────────

function PanelDocente({ tareas, cesiones }: { tareas: Tarea[]; cesiones: Cesion[] }) {
  const { userId } = useAppStore();
  const qc = useQueryClient();
  const hoy = hoyISO();

  const misGrupos = useMemo(() => gruposAsignables(userId!), [userId]);

  const [grupo, setGrupo] = useState(misGrupos[0]?.grupo ?? '');
  const grupoInfo = misGrupos.find(g => g.grupo === grupo);
  const [asignaturaId, setAsignaturaId] = useState(grupoInfo?.asignaturaIds[0] ?? '');
  const [titulo, setTitulo] = useState('');
  const [momentos, setMomentos] = useState(1);
  const [fechaEntrega, setFechaEntrega] = useState<FechaISO | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  const [mostrarCesion, setMostrarCesion] = useState(false);

  const asignaturaActiva = grupoInfo?.asignaturaIds.includes(asignaturaId)
    ? asignaturaId
    : grupoInfo?.asignaturaIds[0] ?? '';

  const contexto = useMemo(() => ({
    hoy,
    tareas: tareas.filter(t => t.grupo === grupo),
    cesiones: cesiones.filter(c => c.grupo === grupo),
    diasClase: userId ? diasDeClase(userId, grupo) : [],
  }), [hoy, tareas, cesiones, grupo, userId]);

  const nivel = grupo ? nivelDeGrupo(grupo) : 'basica';
  const config = CONFIG_NIVEL[nivel];

  // Ventana de asignación: depende de HOY y del horario, no de la fecha de entrega
  const ventanaOk = useMemo(
    () => ventanaValida(hoy, contexto.diasClase),
    [hoy, contexto.diasClase],
  );

  const tareaPrevia = useCallback((fecha: FechaISO): Tarea => ({
    id: '_previa', grupo, asignaturaId: asignaturaActiva, docenteId: userId ?? '',
    titulo: titulo || '·', momentos, fechaAsignacion: hoy, fechaEntrega: fecha, estado: 'activa',
  }), [grupo, asignaturaActiva, userId, titulo, momentos, hoy]);

  // Estado de un día para el calendario-semáforo
  type EstadoDia = 'ok' | 'parcial' | 'lleno' | 'off';
  const estadoDe = useCallback((fecha: FechaISO): EstadoDia => {
    if (!grupo || !userId || !ventanaOk || fecha <= hoy || !esDiaHabil(fecha)) return 'off';
    const r = validarTarea(tareaPrevia(fecha), contexto);
    if (r.ok) return 'ok';
    if (!r.ok && r.alternativas?.maxMomentosParaFecha) return 'parcial';
    return 'lleno';
  }, [grupo, userId, ventanaOk, hoy, contexto, tareaPrevia]);

  // Mes visible en el calendario
  const [mesVisible, setMesVisible] = useState(() => {
    const d = parseFecha(hoy);
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const semanas = useMemo(() => gridMes(mesVisible.year, mesVisible.month), [mesVisible]);
  const puedeRetroceder = mesVisible.year > parseFecha(hoy).getFullYear() ||
    (mesVisible.year === parseFecha(hoy).getFullYear() && mesVisible.month > parseFecha(hoy).getMonth());

  // Momentos disponibles de la asignatura en el período de la entrega (o el actual)
  const etiquetaPeriodo = config.periodoCupo === 'quincena' ? 'quincena' : 'semana';
  const cupoInfo = useMemo(() => {
    if (!grupo || !asignaturaActiva) return null;
    const periodo = clavePeriodo(grupo, fechaEntrega ?? hoy);
    const base = cupoDeAsignatura(grupo, asignaturaActiva);
    const disponible = cupoDisponible(contexto, grupo, asignaturaActiva, periodo);
    const esActual = periodo === clavePeriodo(grupo, hoy);
    return { base, disponible, esActual, periodo };
  }, [grupo, asignaturaActiva, fechaEntrega, hoy, contexto]);

  // Vista previa de cómo se repartirán los momentos entre hoy y la entrega
  const distribucion = useMemo(() => {
    if (!grupo || !fechaEntrega || !userId) return [];
    const plan = planificarAgenda([...contexto.tareas, tareaPrevia(fechaEntrega)], grupo, hoy);
    const res: { fecha: FechaISO; momentos: number }[] = [];
    for (const [f, bloques] of Object.entries(plan.porDia)) {
      const b = bloques.find(x => x.tareaId === '_previa');
      if (b) res.push({ fecha: f, momentos: b.momentos });
    }
    return res.sort((a, b) => a.fecha.localeCompare(b.fecha));
  }, [grupo, fechaEntrega, userId, contexto, tareaPrevia, hoy]);

  const validacion = useMemo(() => {
    if (!grupo || !fechaEntrega || !userId) return null;
    return validarTarea({
      id: '_previa', grupo, asignaturaId: asignaturaActiva, docenteId: userId,
      titulo: titulo || '·', momentos, fechaAsignacion: hoy, fechaEntrega, estado: 'activa',
    }, contexto);
  }, [grupo, fechaEntrega, userId, asignaturaActiva, momentos, titulo, contexto, hoy]);

  const puedeGuardar = !!(titulo.trim() && fechaEntrega && validacion?.ok && !guardando);

  async function guardar() {
    if (!puedeGuardar || !userId || !fechaEntrega) return;
    setGuardando(true);
    setAviso(null);
    const r = await crearTarea({
      grupo, asignaturaId: asignaturaActiva, docenteId: userId,
      titulo: titulo.trim(), momentos, fechaAsignacion: hoy, fechaEntrega,
    });
    setGuardando(false);
    if (r.ok) {
      setAviso({ tipo: 'ok', texto: 'Tarea publicada. La agenda del grupo ya se actualizó.' });
      setTitulo(''); setFechaEntrega(null); setMomentos(1);
      qc.invalidateQueries({ queryKey: ['datosTareas'] });
    } else {
      setAviso({ tipo: 'error', texto: r.error ?? 'No se pudo guardar la tarea.' });
    }
  }

  const misTareas = tareas
    .filter(t => t.docenteId === userId && t.estado === 'activa' && t.fechaEntrega >= hoy)
    .sort((a, b) => a.fechaEntrega.localeCompare(b.fechaEntrega));

  async function cancelar(id: string) {
    if (!userId) return;
    const r = await cancelarTarea(id, userId);
    if (r.ok) qc.invalidateQueries({ queryKey: ['datosTareas'] });
  }

  if (misGrupos.length === 0) return (
    <div className="rounded-2xl border border-line bg-elevated/40 p-6 text-sm text-muted">
      No tienes asignación académica registrada, así que no puedes asignar tareas.
    </div>
  );

  return (
    <div className="space-y-5">
      {/* ── Formulario ─────────────────────────────────────── */}
      <section className="rounded-2xl border border-line bg-card p-4 space-y-4">
        <div className="flex items-center gap-2">
          <ClipboardList size={18} className="text-soft" />
          <h2 className="font-bold text-strong">Asignar tarea</h2>
          <span className="text-[11px] text-muted ml-auto">
            1 momento = {config.duracionMomentoMin} min
          </span>
        </div>

        <div className="flex flex-wrap gap-3">
          <div>
            <label className="text-[11px] text-muted block mb-1">Grupo</label>
            <div className="flex flex-wrap gap-1">
              {misGrupos.map(g => (
                <button
                  key={g.grupo}
                  onClick={() => { setGrupo(g.grupo); setFechaEntrega(null); }}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-bold border transition-all',
                    grupo === g.grupo ? 'bg-hover border-line-strong' : 'border-line text-muted hover:bg-elevated'
                  )}
                  style={grupo === g.grupo ? { color: colorGrado(g.grupo) } : undefined}
                >
                  {g.grupo}
                </button>
              ))}
            </div>
          </div>
          {(grupoInfo?.asignaturaIds.length ?? 0) > 1 && (
            <div>
              <label className="text-[11px] text-muted block mb-1">Asignatura</label>
              <div className="flex flex-wrap gap-1">
                {grupoInfo!.asignaturaIds.map(id => (
                  <button
                    key={id}
                    onClick={() => setAsignaturaId(id)}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-xs border transition-all',
                      asignaturaActiva === id ? 'bg-hover text-strong border-line-strong' : 'border-line text-muted hover:bg-elevated'
                    )}
                  >
                    {getAsignatura(id)?.nombre ?? id}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[220px]">
            <label className="text-[11px] text-muted block mb-1">Título de la tarea</label>
            <input
              value={titulo}
              onChange={e => setTitulo(e.target.value)}
              placeholder="Ej: Taller de ecuaciones, página 34"
              className="w-full px-3 py-2 rounded-xl bg-elevated border border-line text-sm text-strong placeholder:text-muted focus:outline-none focus:border-line-strong"
            />
          </div>
          <div>
            <label className="text-[11px] text-muted block mb-1">
              Momentos ({momentos * config.duracionMomentoMin} min)
            </label>
            <div className="flex gap-1">
              {[1, 2, 3, 4].map(m => (
                <button
                  key={m}
                  onClick={() => setMomentos(m)}
                  className={cn(
                    'w-9 h-9 rounded-xl text-sm font-bold border transition-all',
                    momentos === m ? 'bg-hover text-strong border-line-strong' : 'border-line text-muted hover:bg-elevated'
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Ventana de asignación cerrada */}
        {!ventanaOk && (
          <div className="rounded-xl border border-warning bg-warning-soft px-3 py-2.5 text-xs text-warning-soft-fg">
            Hoy no puedes asignarle tarea a {grupo}: la tarea debe asignarse el día
            de la clase o, a más tardar, los dos días siguientes. Podrás asignar el
            próximo día de clase con este grupo.
          </div>
        )}

        {/* Momentos disponibles del cupo */}
        {ventanaOk && cupoInfo && (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-line bg-elevated/40 px-3 py-2 text-xs">
            <span className="text-muted">
              {getAsignatura(asignaturaActiva)?.nombre} en{' '}
              <span className="font-bold" style={{ color: colorGrado(grupo) }}>{grupo}</span>
            </span>
            <span className={cn('font-semibold', cupoInfo.disponible <= 0 ? 'text-danger' : 'text-success')}>
              {cupoInfo.disponible} de {cupoInfo.base} momentos ·{' '}
              {cupoInfo.esActual ? `esta ${etiquetaPeriodo}` : `${etiquetaPeriodo} del ${cupoInfo.periodo.slice(8)}/${cupoInfo.periodo.slice(5, 7)}`}
            </span>
          </div>
        )}

        {/* Calendario-semáforo */}
        {ventanaOk && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-[11px] text-muted">
              Fecha de entrega — <span className="text-success">verde</span>: cabe ·{' '}
              <span className="text-warning">ámbar</span>: caben menos ·{' '}
              <span className="text-danger">rojo</span>: no cabe
            </label>
            <div className="flex items-center gap-1">
              <button
                onClick={() => puedeRetroceder && setMesVisible(m => {
                  const d = new Date(m.year, m.month - 1, 1);
                  return { year: d.getFullYear(), month: d.getMonth() };
                })}
                disabled={!puedeRetroceder}
                className="p-1 rounded-lg text-muted hover:text-strong hover:bg-elevated disabled:opacity-30 transition"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-xs font-semibold text-strong min-w-[110px] text-center capitalize">
                {MESES[mesVisible.month]} {mesVisible.year}
              </span>
              <button
                onClick={() => setMesVisible(m => {
                  const d = new Date(m.year, m.month + 1, 1);
                  return { year: d.getFullYear(), month: d.getMonth() };
                })}
                className="p-1 rounded-lg text-muted hover:text-strong hover:bg-elevated transition"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-5 gap-1">
            {['Lun', 'Mar', 'Mié', 'Jue', 'Vie'].map(d => (
              <div key={d} className="text-center text-[10px] text-muted pb-1">{d}</div>
            ))}
            {semanas.flatMap((semana, wi) => semana.map((fecha, di) => {
              if (!fecha) return <div key={`${wi}-${di}`} />;
              const estado = estadoDe(fecha);
              const activa = fechaEntrega === fecha;
              const bg = estado === 'ok' ? 'rgba(34,197,94,0.18)'
                : estado === 'parcial' ? 'rgba(251,146,60,0.5)'
                : estado === 'lleno' ? 'rgba(239,68,68,0.5)' : 'transparent';
              const txt = estado === 'ok' ? 'text-success'
                : estado === 'parcial' ? 'text-warning' : estado === 'lleno' ? 'text-danger' : 'text-muted opacity-40';
              return (
                <button
                  key={fecha}
                  onClick={() => estado !== 'off' && setFechaEntrega(fecha)}
                  disabled={estado === 'off'}
                  className={cn(
                    'h-9 rounded-lg border text-sm font-bold transition-all',
                    activa ? 'border-line-strong ring-1 ring-[var(--color-line-strong)]' : 'border-transparent',
                    estado === 'off' ? 'cursor-not-allowed' : 'hover:border-line-strong',
                    txt,
                  )}
                  style={{ backgroundColor: bg }}
                >
                  {Number(fecha.slice(8))}
                </button>
              );
            }))}
          </div>
        </div>
        )}

        {/* Vista previa del reparto de momentos */}
        {validacion?.ok && distribucion.length > 0 && (
          <div className="rounded-xl border border-line bg-elevated/40 px-3 py-2 text-[11px] text-muted">
            <span className="text-soft font-semibold">Se repartirá así:</span>{' '}
            {distribucion.map(d => `${diaCortoDe(d.fecha)} ${Number(d.fecha.slice(8))} (${d.momentos})`).join(' · ')}
            {' '}— entrega {fechaLegible(fechaEntrega!)}
          </div>
        )}

        {validacion && !validacion.ok && (
          <div className="rounded-xl border border-danger bg-danger-soft px-3 py-2.5 text-xs text-danger-soft-fg">
            {validacion.mensaje}
            {validacion.alternativas?.primeraEntregaViable && (
              <button
                className="ml-2 underline font-semibold"
                onClick={() => setFechaEntrega(validacion.alternativas!.primeraEntregaViable!)}
              >
                usar {fechaLegible(validacion.alternativas.primeraEntregaViable)}
              </button>
            )}
          </div>
        )}
        {aviso && (
          <div className={cn(
            'rounded-xl px-3 py-2.5 text-xs border flex items-center gap-2',
            aviso.tipo === 'ok' ? 'border-success bg-success-soft text-success-soft-fg' : 'border-danger bg-danger-soft text-danger-soft-fg'
          )}>
            {aviso.tipo === 'ok' && <CheckCircle2 size={14} />}
            {aviso.texto}
            <button className="ml-auto" onClick={() => setAviso(null)}><X size={12} /></button>
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={guardar}
            disabled={!puedeGuardar}
            className={cn(
              'px-4 py-2 rounded-xl text-sm font-semibold border transition-all',
              puedeGuardar
                ? 'bg-hover text-strong border-line-strong hover:opacity-90'
                : 'border-line text-muted opacity-50 cursor-not-allowed'
            )}
          >
            {guardando ? <Loader2 size={14} className="animate-spin inline" /> : 'Publicar tarea'}
          </button>
          <button
            onClick={() => setMostrarCesion(v => !v)}
            className="px-3 py-2 rounded-xl text-xs text-muted border border-line hover:bg-elevated transition-all flex items-center gap-1.5"
          >
            <Gift size={13} /> Ceder momentos
          </button>
        </div>

        <AnimatePresence>
          {mostrarCesion && (
            <motion.div
              initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }} className="overflow-hidden"
            >
              <FormCesion grupo={grupo} asignaturaOrigenId={asignaturaActiva} onCerrar={() => setMostrarCesion(false)} />
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* ── Mis tareas ─────────────────────────────────────── */}
      <section className="space-y-2">
        <h3 className="font-bold text-strong text-sm">Mis tareas vigentes</h3>
        {misTareas.length === 0 && (
          <p className="text-xs text-muted">No tienes tareas activas.</p>
        )}
        {misTareas.map(t => (
          <div key={t.id} className="flex items-center gap-3 rounded-xl border border-line bg-elevated/40 px-3 py-2.5 text-sm">
            <span className="font-bold text-xs" style={{ color: colorGrado(t.grupo) }}>{t.grupo}</span>
            <div className="flex-1 min-w-0">
              <div className="text-strong truncate">{t.titulo}</div>
              <div className="text-[11px] text-muted">
                {getAsignatura(t.asignaturaId)?.nombre} · {t.momentos} momento{t.momentos > 1 ? 's' : ''} · entrega {fechaLegible(t.fechaEntrega)}
              </div>
            </div>
            <button
              onClick={() => cancelar(t.id)}
              title="Cancelar tarea"
              className="p-1.5 rounded-lg text-muted hover:text-danger hover:bg-danger-soft transition"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </section>
    </div>
  );
}

// ── Formulario de cesión ──────────────────────────────────────────────────────

function FormCesion({ grupo, asignaturaOrigenId, onCerrar }: {
  grupo: string; asignaturaOrigenId: string; onCerrar: () => void;
}) {
  const { userId } = useAppStore();
  const qc = useQueryClient();
  const hoy = hoyISO();
  const config = CONFIG_NIVEL[nivelDeGrupo(grupo)];
  const etiqueta = config.periodoCupo === 'quincena' ? 'quincena' : 'semana';

  const destinos = useMemo(() =>
    [...new Set(asignacionDeGrupo(grupo).map(e => e.asignaturaId))]
      .filter(id => id !== asignaturaOrigenId && id !== 'ci'),
    [grupo, asignaturaOrigenId]);

  const [destino, setDestino] = useState('');
  const [momentos, setMomentos] = useState(1);
  const [periodo, setPeriodo] = useState<'actual' | 'siguiente'>('actual');
  const [enviando, setEnviando] = useState(false);
  const [hecho, setHecho] = useState(false);

  async function enviar() {
    if (!destino || !userId) return;
    setEnviando(true);
    const dias = config.periodoCupo === 'quincena' ? 14 : 7;
    const fechaRef = periodo === 'actual' ? hoy : addDias(hoy, dias);
    const r = await crearCesion({
      grupo,
      periodo: clavePeriodo(grupo, fechaRef),
      asignaturaOrigenId,
      asignaturaDestinoId: destino,
      docenteOrigenId: userId,
      momentos,
    });
    setEnviando(false);
    if (r.ok) {
      setHecho(true);
      qc.invalidateQueries({ queryKey: ['datosTareas'] });
      setTimeout(onCerrar, 1500);
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-line bg-elevated/40 p-3 space-y-3">
      <p className="text-[11px] text-muted">
        Cede momentos de <span className="font-semibold text-soft">{getAsignatura(asignaturaOrigenId)?.nombre}</span> en {grupo} a
        otra asignatura. La cesión vence al terminar la {etiqueta}.
      </p>
      <div className="flex flex-wrap gap-2 items-end">
        <div>
          <label className="text-[11px] text-muted block mb-1">Asignatura que recibe</label>
          <select
            value={destino}
            onChange={e => setDestino(e.target.value)}
            className="px-3 py-2 rounded-xl bg-card border border-line text-sm text-strong"
          >
            <option value="">Elegir…</option>
            {destinos.map(id => (
              <option key={id} value={id}>{getAsignatura(id)?.nombre ?? id}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[11px] text-muted block mb-1">Momentos</label>
          <div className="flex gap-1">
            {[1, 2].map(m => (
              <button key={m} onClick={() => setMomentos(m)}
                className={cn('w-8 h-8 rounded-lg text-sm font-bold border',
                  momentos === m ? 'bg-hover text-strong border-line-strong' : 'border-line text-muted')}>
                {m}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-[11px] text-muted block mb-1">Período</label>
          <div className="flex gap-1">
            {(['actual', 'siguiente'] as const).map(p => (
              <button key={p} onClick={() => setPeriodo(p)}
                className={cn('px-3 py-1.5 rounded-lg text-xs border',
                  periodo === p ? 'bg-hover text-strong border-line-strong' : 'border-line text-muted')}>
                {p === 'actual' ? `Esta ${etiqueta}` : `Próxima ${etiqueta}`}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={enviar}
          disabled={!destino || enviando || hecho}
          className="px-3 py-2 rounded-xl text-xs font-semibold border border-line-strong bg-hover text-strong disabled:opacity-40"
        >
          {hecho ? 'Cesión registrada ✓' : enviando ? '…' : 'Ceder'}
        </button>
      </div>
    </div>
  );
}

// ── Panel del coordinador / rectora ───────────────────────────────────────────

function PanelDirectivo({ tareas, cesiones }: { tareas: Tarea[]; cesiones: Cesion[] }) {
  const { userId, jornada } = useAppStore();
  const qc = useQueryClient();
  const hoy = hoyISO();
  const [filtroJornada, setFiltroJornada] = useState<'manana' | 'tarde'>(
    jornada === 'tarde' ? 'tarde' : 'manana'
  );
  const [qrGrupo, setQrGrupo] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const grupos = useMemo(() =>
    todosLosGrupos().filter(g => esGrupoDeTarde(g) === (filtroJornada === 'tarde')),
    [filtroJornada]);

  // Próximos 10 días hábiles
  const dias = useMemo(() => {
    const res: FechaISO[] = [];
    let f = hoy;
    while (res.length < 10) {
      if (esDiaHabil(f)) res.push(f);
      f = addDias(f, 1);
    }
    return res;
  }, [hoy]);

  const cargaPorGrupo = useMemo(() => {
    const res: Record<string, Record<FechaISO, number>> = {};
    for (const g of grupos) {
      const plan = planificarAgenda(tareas.filter(t => t.grupo === g), g, addDias(hoy, -1));
      res[g] = ocupacionPorDia(plan);
    }
    return res;
  }, [grupos, tareas, hoy]);

  const entregasPorGrupoDia = useMemo(() => {
    const res: Record<string, Set<string>> = {};
    for (const t of tareas) {
      if (t.estado !== 'activa') continue;
      (res[t.grupo] ??= new Set()).add(t.fechaEntrega);
    }
    return res;
  }, [tareas]);

  async function abrirQr(grupo: string) {
    setQrGrupo(grupo);
    const url = await QRCode.toDataURL(urlAgendaPublica(grupo), { width: 240, margin: 1 });
    setQrDataUrl(url);
  }

  const activas = tareas
    .filter(t => t.estado === 'activa' && t.fechaEntrega >= hoy && grupos.includes(t.grupo))
    .sort((a, b) => a.fechaEntrega.localeCompare(b.fechaEntrega));

  const cesionesVigentes = cesiones.filter(c =>
    grupos.includes(c.grupo) && c.periodo >= clavePeriodo(grupos[0] ?? '9.1', addDias(hoy, -14)));

  async function cancelarComoDirectivo(id: string) {
    if (!userId) return;
    const r = await cancelarTarea(id, userId, true);
    if (r.ok) qc.invalidateQueries({ queryKey: ['datosTareas'] });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <CalendarDays size={18} className="text-soft" />
        <h2 className="font-bold text-strong">Carga de tareas por grupo</h2>
        <div className="flex gap-1 ml-auto">
          {(['manana', 'tarde'] as const).map(j => (
            <button key={j} onClick={() => setFiltroJornada(j)}
              className={cn('px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                filtroJornada === j ? 'bg-hover text-strong border-line-strong' : 'text-muted border-line hover:bg-elevated')}>
              {j === 'manana' ? 'Mañana' : 'Tarde'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Mapa de calor grupo × día ───────────────────────── */}
      <div className="overflow-x-auto rounded-2xl border border-line bg-elevated/40">
        <table className="text-xs border-collapse w-full">
          <thead>
            <tr className="border-b border-line">
              <th className="text-left px-3 py-2 text-muted font-medium w-20">Grupo</th>
              {dias.map(f => (
                <th key={f} className="text-center px-1 py-2 min-w-[52px]">
                  <div className="text-soft text-[10px]">{diaCortoDe(f)}</div>
                  <div className="text-muted text-[9px]">{f.slice(8)}/{f.slice(5, 7)}</div>
                </th>
              ))}
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {grupos.map((g, ri) => {
              const tope = CONFIG_NIVEL[nivelDeGrupo(g)].topeDiario;
              return (
                <tr key={g} className={cn('border-b border-line', ri % 2 !== 0 ? 'bg-elevated/40' : '')}>
                  <td className="px-3 py-1.5 font-bold" style={{ color: colorGrado(g) }}>{g}</td>
                  {dias.map(f => {
                    const ejecutable = esDiaEjecutable(g, f);
                    const n = cargaPorGrupo[g]?.[f] ?? 0;
                    const entrega = entregasPorGrupoDia[g]?.has(f);
                    return (
                      <td key={f} className="p-1 text-center">
                        <div
                          className={cn(
                            'rounded-lg h-8 flex flex-col items-center justify-center text-[10px] font-semibold',
                            !ejecutable ? 'border border-dashed border-line text-muted opacity-50' : 'border border-line'
                          )}
                          style={ejecutable ? { backgroundColor: colorCarga(n, tope) } : undefined}
                          title={!ejecutable ? 'Sin tareas (festivo o contrajornada)' : `${n}/${tope} momentos`}
                        >
                          <span className={n >= tope ? 'text-strong' : 'text-soft'}>
                            {ejecutable ? `${n}/${tope}` : '—'}
                          </span>
                          {entrega && <span className="w-1 h-1 rounded-full bg-emerald-400 mt-0.5" />}
                        </div>
                      </td>
                    );
                  })}
                  <td className="text-center">
                    <button
                      onClick={() => abrirQr(g)}
                      title={`QR y enlace de la agenda de ${g}`}
                      className="p-1.5 rounded-lg text-muted hover:text-strong hover:bg-elevated transition"
                    >
                      <QrCode size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-muted">
        Cada celda: momentos agendados / tope diario. El punto verde marca días con entrega.
        Los días punteados no reciben tareas (festivo o contrajornada de media técnica).
      </p>

      {/* ── Tareas activas ─────────────────────────────────── */}
      <section className="space-y-2">
        <h3 className="font-bold text-strong text-sm">Tareas vigentes ({activas.length})</h3>
        {activas.length === 0 && <p className="text-xs text-muted">No hay tareas activas en esta jornada.</p>}
        {activas.map(t => {
          const docente = USUARIOS.find(u => u.id === t.docenteId);
          return (
            <div key={t.id} className="flex items-center gap-3 rounded-xl border border-line bg-elevated/40 px-3 py-2 text-sm">
              <span className="font-bold text-xs w-9" style={{ color: colorGrado(t.grupo) }}>{t.grupo}</span>
              <div className="flex-1 min-w-0">
                <div className="text-strong truncate text-xs">{t.titulo}</div>
                <div className="text-[11px] text-muted">
                  {getAsignatura(t.asignaturaId)?.nombre} · <span style={{ color: docente?.color }}>{docente?.nombreCorto}</span> · {t.momentos}m · entrega {fechaLegible(t.fechaEntrega)}
                </div>
              </div>
              <button
                onClick={() => cancelarComoDirectivo(t.id)}
                title="Cancelar tarea"
                className="p-1.5 rounded-lg text-muted hover:text-danger hover:bg-danger-soft transition"
              >
                <Trash2 size={13} />
              </button>
            </div>
          );
        })}
      </section>

      {/* ── Cesiones ───────────────────────────────────────── */}
      {cesionesVigentes.length > 0 && (
        <section className="space-y-2">
          <h3 className="font-bold text-strong text-sm">Cesiones registradas</h3>
          {cesionesVigentes.map(c => (
            <div key={c.id} className="text-xs text-muted rounded-xl border border-line bg-elevated/40 px-3 py-2">
              <span className="font-bold" style={{ color: colorGrado(c.grupo) }}>{c.grupo}</span>
              {' · '}{getAsignatura(c.asignaturaOrigenId)?.nombre} cede {c.momentos} momento{c.momentos > 1 ? 's' : ''} a {getAsignatura(c.asignaturaDestinoId)?.nombre}
              {' · '}período del {c.periodo}
            </div>
          ))}
        </section>
      )}

      {/* ── Modal QR ───────────────────────────────────────── */}
      <AnimatePresence>
        {qrGrupo && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
            onClick={() => { setQrGrupo(null); setQrDataUrl(null); }}
          >
            <div
              className="rounded-2xl border border-line bg-card p-5 max-w-xs w-full text-center space-y-3"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="font-bold text-strong">
                Agenda pública de <span style={{ color: colorGrado(qrGrupo) }}>{qrGrupo}</span>
              </h3>
              {qrDataUrl && (
                <img src={qrDataUrl} alt={`QR agenda ${qrGrupo}`} className="mx-auto rounded-xl bg-white p-2" />
              )}
              <p className="text-[11px] text-muted break-all">{urlAgendaPublica(qrGrupo)}</p>
              <div className="flex gap-2 justify-center">
                <button
                  onClick={() => navigator.clipboard.writeText(urlAgendaPublica(qrGrupo))}
                  className="px-3 py-1.5 rounded-xl text-xs border border-line text-soft hover:bg-elevated"
                >
                  Copiar enlace
                </button>
                <a
                  href={urlAgendaPublica(qrGrupo)}
                  target="_blank" rel="noreferrer"
                  className="px-3 py-1.5 rounded-xl text-xs border border-line text-soft hover:bg-elevated"
                >
                  Abrir
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Vista principal ───────────────────────────────────────────────────────────

export default function VistaTareas() {
  const { rol } = useAppStore();
  const esDirectivo = rol === 'coordinador' || rol === 'rectora';

  const { data, isLoading, isError } = useQuery({
    queryKey: ['datosTareas'],
    queryFn: () => getDatosTareas(),
    refetchInterval: 1000 * 60,
  });

  if (isLoading) return (
    <div className="flex items-center gap-2 text-muted text-sm p-6">
      <Loader2 size={16} className="animate-spin" /> Cargando tareas…
    </div>
  );
  if (isError || !data?.ok) return (
    <div className="rounded-2xl border border-danger bg-danger-soft p-4 text-sm text-danger-soft-fg">
      No se pudieron cargar las tareas. Verifica la conexión (o que el Apps Script tenga la versión con el módulo de tareas).
    </div>
  );

  return esDirectivo
    ? <PanelDirectivo tareas={data.tareas} cesiones={data.cesiones} />
    : <PanelDocente tareas={data.tareas} cesiones={data.cesiones} />;
}
