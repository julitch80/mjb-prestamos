import { useEffect, useMemo, useState } from 'react';
import { BookOpen, QrCode as QrIcon } from 'lucide-react';
import QRCode from 'qrcode';
import { colorGrado, DIRECTORES_MANANA, DIRECTORES_TARDE, USUARIOS } from '../data/maestros';
import { getAsignatura } from '../data/asignacionAcademica';
import type { FechaISO, Tarea } from '../data/tareas/tipos';
import { addDias, esDiaEjecutable, esDiaHabil, hoyISO, lunesDe } from '../data/tareas/calendario';
import { CONFIG_NIVEL, nivelDeGrupo } from '../data/tareas/config';
import { planificarAgenda, ocupacionPorDia, fechaLegible } from '../data/tareas/motor';
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
            tareasDelDia(diaSel).map(({ b, t }, i) => (
              <div key={i} className="rounded-xl border border-line bg-elevated/40 px-3 py-2.5">
                <div className="flex justify-between items-center mb-0.5">
                  <span className="text-[11px] font-semibold text-soft">{getAsignatura(t.asignaturaId)?.nombre ?? t.asignaturaId}</span>
                  <span className="text-[11px] text-muted">{b.momentos} momento{b.momentos > 1 ? 's' : ''} · {b.momentos * config.duracionMomentoMin} min</span>
                </div>
                <div className="text-sm text-strong">{t.titulo}</div>
                <div className="text-[11px] text-muted mt-0.5">entrega: {fechaLegible(t.fechaEntrega)}</div>
              </div>
            ))
          )}
          <div className="rounded-xl bg-warning-soft border border-warning px-3 py-2 flex justify-between items-center">
            <span className="text-xs text-warning-soft-fg flex items-center gap-1.5"><BookOpen size={13} /> Estudio personal</span>
            <span className="text-[11px] text-warning-soft-fg">{config.estudioMin} min · todos los días</span>
          </div>
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
                    <div className="space-y-1">
                      {items.map(({ b, t }, i) => (
                        <div key={i} className="text-xs">
                          <span className="text-soft font-medium">{getAsignatura(t.asignaturaId)?.nombre}</span>
                          <span className="text-muted"> · {b.momentos}m · {t.titulo}</span>
                        </div>
                      ))}
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
    </div>
  );
}
