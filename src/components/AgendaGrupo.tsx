import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Check, Lock, Paperclip, Printer, QrCode as QrIcon, Tv } from 'lucide-react';
import QRCode from 'qrcode';
import { colorGrado, DIRECTORES_MANANA, DIRECTORES_TARDE, USUARIOS } from '../data/maestros';
import { getAsignatura } from '../data/asignacionAcademica';
import type { FechaISO, Tarea } from '../data/tareas/tipos';
import { addDias, esDiaEjecutable, esDiaHabil, hoyISO, lunesDe } from '../data/tareas/calendario';
import { CONFIG_NIVEL, nivelDeGrupo } from '../data/tareas/config';
import { planificarAgenda, ocupacionPorDia, fechaLegible } from '../data/tareas/motor';
import {
  ANCLA_OTRO, ANCLA_OTRO_MAX, anclasDeGrupo, etiquetaMomento,
  guardarMomento, leerMomentos, leerTachadas, alternarTachada, type MomentoElegido,
} from '../data/tareas/habitos';
import AgendaImprimible from './AgendaImprimible';
import AgendaProyeccion from './AgendaProyeccion';
import { cn } from '@/lib/utils';

const DIAS_LABEL = ['lun', 'mar', 'mié', 'jue', 'vie'];

export function urlAgendaPublica(grupo: string): string {
  return `${window.location.origin}${window.location.pathname}#/agenda/${encodeURIComponent(grupo)}`;
}

function diaLegibleLargo(f: FechaISO): string {
  const [y, m, d] = f.split('-').map(Number);
  const fecha = new Date(y, m - 1, d);
  const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  return `${dias[fecha.getDay()]} ${d} de ${meses[m - 1]}`;
}

/**
 * Selector de "¿cuándo la vas a hacer?". Aparece al tocar la tarea o el
 * chip invitador. La lista de anclas depende de la jornada del grupo
 * (ver data/tareas/habitos.ts) — es lo que engancha la tarea a una rutina
 * que ya ocurre sola (el almuerzo, la llegada a casa), así que tiene que
 * invitar, no esconderse en un ajuste.
 */
function SelectorMomento({ grupo, actual, onGuardar, onCerrar }: {
  grupo: string;
  actual?: MomentoElegido;
  onGuardar: (m: MomentoElegido | null) => void;
  onCerrar: () => void;
}) {
  const anclas = anclasDeGrupo(grupo);
  const [otroTexto, setOtroTexto] = useState(actual?.anclaId === ANCLA_OTRO ? (actual.texto ?? '') : '');
  const [mostrarOtro, setMostrarOtro] = useState(actual?.anclaId === ANCLA_OTRO);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-3" onClick={onCerrar}>
      <div
        className="w-full max-w-sm rounded-2xl border border-line bg-card p-4 space-y-3"
        onClick={e => e.stopPropagation()}
      >
        <p className="text-sm font-semibold text-strong">¿Cuándo la vas a hacer?</p>
        <div className="flex flex-col gap-2">
          {anclas.map(a => (
            <button
              key={a.id}
              onClick={() => { onGuardar({ anclaId: a.id }); onCerrar(); }}
              className={cn('text-left px-3 py-2.5 rounded-xl border text-sm transition-all min-h-[44px]',
                actual?.anclaId === a.id ? 'border-line-strong bg-hover text-strong font-medium' : 'border-line text-soft hover:bg-elevated')}
            >
              {a.label}
            </button>
          ))}
          {!mostrarOtro ? (
            <button
              onClick={() => setMostrarOtro(true)}
              className={cn('text-left px-3 py-2.5 rounded-xl border text-sm transition-all min-h-[44px]',
                actual?.anclaId === ANCLA_OTRO ? 'border-line-strong bg-hover text-strong font-medium' : 'border-line text-soft hover:bg-elevated')}
            >
              Otro{actual?.anclaId === ANCLA_OTRO && actual.texto ? `: ${actual.texto}` : '…'}
            </button>
          ) : (
            <div className="flex gap-2">
              <input
                autoFocus
                value={otroTexto}
                onChange={e => setOtroTexto(e.target.value.slice(0, ANCLA_OTRO_MAX))}
                placeholder="Ej: en el bus"
                maxLength={ANCLA_OTRO_MAX}
                className="flex-1 px-3 py-2.5 rounded-xl bg-elevated border border-line text-sm text-strong placeholder:text-muted focus:outline-none focus:border-line-strong"
              />
              <button
                onClick={() => { if (otroTexto.trim()) { onGuardar({ anclaId: ANCLA_OTRO, texto: otroTexto.trim() }); onCerrar(); } }}
                disabled={!otroTexto.trim()}
                className="px-3 py-2.5 rounded-xl text-sm font-semibold text-accent-fg bg-accent disabled:opacity-50"
              >
                OK
              </button>
            </div>
          )}
        </div>
        <div className="flex justify-between items-center pt-1">
          {actual && (
            <button onClick={() => { onGuardar(null); onCerrar(); }} className="text-xs text-muted hover:text-soft">
              Quitar momento
            </button>
          )}
          <button onClick={onCerrar} className="text-xs text-muted hover:text-soft ml-auto">Cancelar</button>
        </div>
        <p className="text-[10px] text-muted flex items-center gap-1 pt-1 border-t border-line">
          <Lock size={10} /> Esto se guarda solo en este teléfono. Nadie más lo ve.
        </p>
      </div>
    </div>
  );
}

function fondoCarga(n: number, tope: number): string {
  if (n <= 0) return 'transparent';
  const p = n / tope;
  if (p < 0.5) return 'rgba(251,146,60,0.22)';
  if (p < 1) return 'rgba(251,146,60,0.5)';
  return 'rgba(239,68,68,0.6)';
}

/**
 * Agenda de un grupo: vista semanal + diaria + QR. Se usa igual para el docente,
 * el coordinador, la rectora y la página pública. Recibe las tareas ya cargadas.
 */
export default function AgendaGrupo({ grupo, tareas, mostrarQR = true }: {
  grupo: string; tareas: Tarea[]; mostrarQR?: boolean;
}) {
  const hoy = hoyISO();
  const config = CONFIG_NIVEL[nivelDeGrupo(grupo)];
  const [vista, setVista] = useState<'semana' | 'dia'>('dia');

  const activas = useMemo(
    () => tareas.filter(t => t.estado === 'activa' && t.grupo === grupo),
    [tareas, grupo],
  );

  const plan = useMemo(() => planificarAgenda(activas, grupo, addDias(hoy, -1)), [activas, grupo, hoy]);
  const ocupacion = useMemo(() => ocupacionPorDia(plan), [plan]);

  const referencia = useMemo(() => {
    let f = hoy;
    while (!esDiaHabil(f)) f = addDias(f, 1);
    return f;
  }, [hoy]);

  const [diaSel, setDiaSel] = useState<FechaISO>(referencia);
  useEffect(() => { setDiaSel(referencia); }, [referencia]);

  const semana = useMemo(() => {
    const lunes = lunesDe(referencia);
    return [0, 1, 2, 3, 4].map(i => addDias(lunes, i));
  }, [referencia]);

  const entregasDelGrupo = useMemo(() => {
    const s = new Set<string>();
    for (const t of activas) s.add(t.fechaEntrega);
    return s;
  }, [activas]);

  const proximasEntregas = useMemo(() => activas
    .filter(t => t.fechaEntrega >= hoy)
    .sort((a, b) => a.fechaEntrega.localeCompare(b.fechaEntrega))
    .slice(0, 8), [activas, hoy]);

  const director = USUARIOS.find(u => u.id === (DIRECTORES_MANANA[grupo] ?? DIRECTORES_TARDE[grupo]));

  // QR
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!mostrarQR) return;
    let vivo = true;
    QRCode.toDataURL(urlAgendaPublica(grupo), { width: 220, margin: 1 })
      .then(u => { if (vivo) setQrDataUrl(u); });
    return () => { vivo = false; };
  }, [grupo, mostrarQR]);

  function tareasDelDia(f: FechaISO) {
    return (plan.porDia[f] ?? []).map(b => ({ b, t: activas.find(x => x.id === b.tareaId) }))
      .filter((x): x is { b: typeof x.b; t: Tarea } => !!x.t);
  }

  // ── Hábitos de estudio: momento elegido y tachado, por dispositivo ────────
  // Se cargan una vez y se refrescan tras cada cambio local (no hay servidor
  // que avise de cambios ajenos — no los hay, porque nada de esto sale de
  // este teléfono).
  const [momentos, setMomentos] = useState<Record<string, MomentoElegido>>({});
  const [tachadas, setTachadas] = useState<Record<string, true>>({});
  useEffect(() => { setMomentos(leerMomentos()); setTachadas(leerTachadas()); }, [grupo]);

  const [tareaEligiendoMomento, setTareaEligiendoMomento] = useState<Tarea | null>(null);
  const [mostrarImprimible, setMostrarImprimible] = useState(false);
  const [mostrarProyeccion, setMostrarProyeccion] = useState(false);

  function guardarMomentoTarea(tareaId: string, m: MomentoElegido | null) {
    guardarMomento(grupo, tareaId, m);
    setMomentos(leerMomentos());
  }

  function alternarTachadaTarea(tareaId: string) {
    alternarTachada(tareaId);
    setTachadas(leerTachadas());
  }

  return (
    <div className="space-y-4">
      {/* Encabezado */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="font-bold text-strong">
            Agenda de <span style={{ color: colorGrado(grupo) }}>{grupo}</span>
          </h3>
          {director && <p className="text-[11px] text-muted">Director: {director.nombreCorto}</p>}
        </div>
        <div className="flex gap-1">
          {(['dia', 'semana'] as const).map(v => (
            <button key={v} onClick={() => setVista(v)}
              className={cn('px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                vista === v ? 'bg-hover text-strong border-line-strong' : 'text-muted border-line hover:bg-elevated')}>
              {v === 'dia' ? 'Día' : 'Semana'}
            </button>
          ))}
        </div>
      </div>

      {/* Imprimir semana (para quien no tiene teléfono) y proyectar (para el salón) */}
      <div className="flex gap-2">
        <button
          onClick={() => setMostrarImprimible(true)}
          className="flex-1 min-h-[40px] flex items-center justify-center gap-1.5 rounded-xl border border-line text-xs font-medium text-soft hover:bg-elevated transition-all"
        >
          <Printer size={13} /> Imprimir semana
        </button>
        <button
          onClick={() => setMostrarProyeccion(true)}
          className="flex-1 min-h-[40px] flex items-center justify-center gap-1.5 rounded-xl border border-line text-xs font-medium text-soft hover:bg-elevated transition-all"
        >
          <Tv size={13} /> Proyectar en el salón
        </button>
      </div>

      {/* Mapa de calor semanal — selector de día */}
      <div className="grid grid-cols-5 gap-2">
        {semana.map((f, i) => {
          const ejecutable = esDiaEjecutable(grupo, f);
          const n = ocupacion[f] ?? 0;
          const esHoy = f === hoy;
          const activa = vista === 'dia' && f === diaSel;
          return (
            <button key={f} onClick={() => { setDiaSel(f); setVista('dia'); }} className="text-center">
              <div className={cn('text-[10px] mb-1', esHoy ? 'text-info font-bold' : 'text-muted')}>
                {DIAS_LABEL[i]}{esHoy ? ' · hoy' : ''}
              </div>
              <div className={cn('h-10 rounded-xl flex items-center justify-center text-xs font-semibold border transition-all',
                activa ? 'border-line-strong' : 'border-line',
                !ejecutable ? 'border-dashed text-muted opacity-60' : 'text-soft')}
                style={ejecutable ? { backgroundColor: fondoCarga(n, config.topeDiario) } : undefined}>
                {ejecutable ? `${n}/${config.topeDiario}` : '—'}
              </div>
              <div className="h-3 flex justify-center items-center">
                {entregasDelGrupo.has(f) && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
              </div>
            </button>
          );
        })}
      </div>

      {vista === 'dia' ? (
        /* ── Vista día ─────────────────────────────────── */
        <div className="rounded-2xl border border-line bg-card p-4 space-y-2.5">
          <div className="flex justify-between items-baseline">
            <span className="text-sm font-semibold text-strong">{diaLegibleLargo(diaSel)}</span>
            <span className="text-[11px] text-muted">{ocupacion[diaSel] ?? 0} de {config.topeDiario} momentos</span>
          </div>
          {!esDiaEjecutable(grupo, diaSel) ? (
            <p className="text-xs text-muted py-2">
              Este día no se programan tareas{nivelDeGrupo(grupo) === 'mt' ? ' (festivo o contrajornada)' : ' (festivo)'}.
            </p>
          ) : tareasDelDia(diaSel).length === 0 ? (
            <p className="text-xs text-muted py-2">Sin momentos de tarea programados. 🎉</p>
          ) : (
            tareasDelDia(diaSel).map(({ b, t }, i) => {
              const tachada = !!tachadas[t.id];
              const etiquetaMom = etiquetaMomento(grupo, momentos[t.id]);
              return (
                <div key={i} className={cn('rounded-xl border border-line px-3 py-2.5 flex gap-2.5 transition-all',
                  tachada ? 'bg-elevated/15 opacity-60' : 'bg-elevated/40')}>
                  {/* Casilla de "hecho": tocable, min 44px de alto para el dedo */}
                  <button
                    onClick={() => alternarTachadaTarea(t.id)}
                    aria-label={tachada ? 'Marcar como pendiente' : 'Marcar como hecha'}
                    className={cn('flex-shrink-0 w-6 h-6 mt-0.5 rounded-md border flex items-center justify-center transition-all',
                      tachada ? 'bg-accent border-accent' : 'border-line-strong')}
                  >
                    {tachada && <Check size={14} className="text-accent-fg" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-0.5">
                      <span className="text-[11px] font-semibold text-soft">{getAsignatura(t.asignaturaId)?.nombre ?? t.asignaturaId}</span>
                      <span className="text-[11px] text-muted">{b.momentos} momento{b.momentos > 1 ? 's' : ''} · {b.momentos * config.duracionMomentoMin} min</span>
                    </div>
                    <div className={cn('text-sm', tachada ? 'text-muted line-through' : 'text-strong')}>{t.titulo}</div>
                    {t.descripcion && (
                      <p className="text-xs text-soft mt-1 whitespace-pre-line leading-snug">{t.descripcion}</p>
                    )}
                    {t.adjuntoUrl && (
                      <a
                        href={t.adjuntoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 mt-1.5 text-[11px] text-accent hover:underline"
                      >
                        <Paperclip size={12} />
                        {t.adjuntoNombre || 'Archivo adjunto'}
                      </a>
                    )}
                    <div className="text-[11px] text-muted mt-0.5">entrega: {fechaLegible(t.fechaEntrega)}</div>
                    {/* Chip invitador de "¿cuándo?" — visible siempre, tocable, no un ajuste escondido */}
                    <button
                      onClick={() => setTareaEligiendoMomento(t)}
                      className={cn('mt-1.5 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-medium border min-h-[28px] transition-all',
                        etiquetaMom ? 'border-line-strong bg-hover text-strong' : 'border-accent text-accent animate-pulse')}
                    >
                      {etiquetaMom ? `🕓 ${etiquetaMom}` : '¿Cuándo la vas a hacer?'}
                    </button>
                  </div>
                </div>
              );
            })
          )}
          <div className="rounded-xl bg-warning-soft border border-warning px-3 py-2 flex justify-between items-center">
            <span className="text-xs text-warning-soft-fg flex items-center gap-1.5"><BookOpen size={13} /> Estudio personal</span>
            <span className="text-[11px] text-warning-soft-fg">{config.estudioMin} min · todos los días</span>
          </div>
          <p className="text-[10px] text-muted flex items-center gap-1 justify-center pt-1">
            <Lock size={10} /> Lo que marcas aquí se guarda solo en este teléfono. Nadie más lo ve.
          </p>
        </div>
      ) : (
        /* ── Vista semana ──────────────────────────────── */
        <div className="rounded-2xl border border-line bg-card p-3 space-y-2">
          {semana.map(f => {
            const ejecutable = esDiaEjecutable(grupo, f);
            const items = tareasDelDia(f);
            return (
              <div key={f} className="flex gap-3 border-b border-line last:border-0 pb-2 last:pb-0">
                <div className="w-16 flex-shrink-0 pt-0.5">
                  <div className={cn('text-xs font-semibold', f === hoy ? 'text-info' : 'text-strong')}>
                    {diaLegibleLargo(f).split(' ')[0]}
                  </div>
                  <div className="text-[10px] text-muted">{f.slice(8)}/{f.slice(5, 7)}</div>
                </div>
                <div className="flex-1 min-w-0">
                  {!ejecutable ? (
                    <span className="text-[11px] text-muted">Sin tareas (festivo o contrajornada)</span>
                  ) : items.length === 0 ? (
                    <span className="text-[11px] text-muted">Libre</span>
                  ) : (
                    <div className="space-y-1.5">
                      {items.map(({ b, t }, i) => {
                        const tachada = !!tachadas[t.id];
                        const etiquetaMom = etiquetaMomento(grupo, momentos[t.id]);
                        return (
                          <div key={i} className="flex items-start gap-1.5">
                            <button
                              onClick={() => alternarTachadaTarea(t.id)}
                              aria-label={tachada ? 'Marcar como pendiente' : 'Marcar como hecha'}
                              className={cn('flex-shrink-0 w-5 h-5 mt-0.5 rounded border flex items-center justify-center',
                                tachada ? 'bg-accent border-accent' : 'border-line-strong')}
                            >
                              {tachada && <Check size={11} className="text-accent-fg" />}
                            </button>
                            <div className="text-xs min-w-0">
                              <span className={cn('font-medium', tachada ? 'text-muted line-through' : 'text-soft')}>
                                {getAsignatura(t.asignaturaId)?.nombre}
                              </span>
                              <span className={cn(tachada ? 'text-muted line-through' : 'text-muted')}> · {b.momentos}m · {t.titulo}</span>
                              <button
                                onClick={() => setTareaEligiendoMomento(t)}
                                className={cn('ml-1.5 inline-block text-[10px] px-1.5 py-0.5 rounded-full border',
                                  etiquetaMom ? 'border-line text-soft' : 'border-accent text-accent')}
                              >
                                {etiquetaMom ? `🕓 ${etiquetaMom}` : '¿Cuándo?'}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {entregasDelGrupo.has(f) && (
                    <div className="text-[10px] text-emerald-500 mt-0.5">
                      ● entrega: {activas.filter(t => t.fechaEntrega === f).map(t => getAsignatura(t.asignaturaId)?.nombre).join(', ')}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <div className="rounded-xl bg-warning-soft border border-warning px-3 py-1.5 flex justify-between items-center">
            <span className="text-[11px] text-warning-soft-fg flex items-center gap-1.5"><BookOpen size={12} /> Estudio personal</span>
            <span className="text-[10px] text-warning-soft-fg">{config.estudioMin} min · todos los días</span>
          </div>
          <p className="text-[10px] text-muted flex items-center gap-1 justify-center pt-1">
            <Lock size={10} /> Lo que marcas aquí se guarda solo en este teléfono. Nadie más lo ve.
          </p>
        </div>
      )}

      {/* Próximas entregas */}
      {proximasEntregas.length > 0 && (
        <div className="rounded-2xl border border-line bg-card p-4">
          <span className="text-sm font-semibold text-strong block mb-2">Próximas entregas</span>
          <div className="space-y-1.5">
            {proximasEntregas.map(t => (
              <div key={t.id} className="flex justify-between gap-3 text-xs">
                <span className="text-muted truncate">
                  <span className="text-soft font-medium">{getAsignatura(t.asignaturaId)?.nombre}</span> · {t.titulo}
                </span>
                <span className="text-strong whitespace-nowrap">{fechaLegible(t.fechaEntrega)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* QR para compartir */}
      {mostrarQR && (
        <div className="rounded-2xl border border-line bg-card p-4 flex flex-col items-center gap-2">
          <span className="text-xs font-semibold text-strong flex items-center gap-1.5">
            <QrIcon size={14} /> Compartir esta agenda
          </span>
          {qrDataUrl && <img src={qrDataUrl} alt={`QR agenda ${grupo}`} className="rounded-xl bg-white p-2" width={180} height={180} />}
          <p className="text-[10px] text-muted break-all text-center">{urlAgendaPublica(grupo)}</p>
          <div className="flex gap-2">
            <button onClick={() => navigator.clipboard.writeText(urlAgendaPublica(grupo))}
              className="px-3 py-1.5 rounded-xl text-xs border border-line text-soft hover:bg-elevated">Copiar enlace</button>
            <a href={urlAgendaPublica(grupo)} target="_blank" rel="noreferrer"
              className="px-3 py-1.5 rounded-xl text-xs border border-line text-soft hover:bg-elevated">Abrir</a>
          </div>
        </div>
      )}

      {tareaEligiendoMomento && (
        <SelectorMomento
          grupo={grupo}
          actual={momentos[tareaEligiendoMomento.id]}
          onGuardar={m => guardarMomentoTarea(tareaEligiendoMomento.id, m)}
          onCerrar={() => setTareaEligiendoMomento(null)}
        />
      )}
      {mostrarImprimible && (
        <AgendaImprimible grupo={grupo} semana={semana} tareasDelDia={tareasDelDia} onCerrar={() => setMostrarImprimible(false)} />
      )}
      {mostrarProyeccion && (
        <AgendaProyeccion grupo={grupo} semana={semana} tareasDelDia={tareasDelDia} onCerrar={() => setMostrarProyeccion(false)} />
      )}
    </div>
  );
}
