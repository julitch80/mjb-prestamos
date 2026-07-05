import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, RefreshCw } from 'lucide-react';
import { getDatosTareas } from '../data/api';
import { colorGrado, DIRECTORES_MANANA, DIRECTORES_TARDE, USUARIOS } from '../data/maestros';
import { getAsignatura } from '../data/asignacionAcademica';
import type { FechaISO } from '../data/tareas/tipos';
import {
  addDias, esDiaEjecutable, esDiaHabil, hoyISO, lunesDe,
} from '../data/tareas/calendario';
import { CONFIG_NIVEL, nivelDeGrupo } from '../data/tareas/config';
import { planificarAgenda, ocupacionPorDia, fechaLegible } from '../data/tareas/motor';
import { cn } from '@/lib/utils';

const DIAS_LABEL = ['lun', 'mar', 'mié', 'jue', 'vie'];

function diaLegibleLargo(f: FechaISO): string {
  const [y, m, d] = f.split('-').map(Number);
  const fecha = new Date(y, m - 1, d);
  const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  return `${dias[fecha.getDay()]} ${d} de ${meses[m - 1]}`;
}

// Intensidad del mapa de calor (misma semántica que el panel del coordinador)
function fondoCarga(n: number, tope: number): string {
  if (n <= 0) return 'transparent';
  const p = n / tope;
  if (p < 0.5) return 'rgba(251,146,60,0.22)';
  if (p < 1) return 'rgba(251,146,60,0.5)';
  return 'rgba(239,68,68,0.6)';
}

export default function AgendaPublica({ grupo }: { grupo: string }) {
  const hoy = hoyISO();
  const { data, dataUpdatedAt, isLoading } = useQuery({
    queryKey: ['agendaPublica', grupo],
    queryFn: () => getDatosTareas(grupo),
    refetchInterval: 1000 * 60 * 5,
  });

  // "actualizado hace X min" con tic de refresco
  const [, setTic] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTic(t => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  const tareas = useMemo(
    () => (data?.tareas ?? []).filter(t => t.estado === 'activa'),
    [data],
  );

  const config = CONFIG_NIVEL[nivelDeGrupo(grupo)];

  // Día de referencia: hoy, o el próximo hábil si es fin de semana/festivo
  const referencia = useMemo(() => {
    let f = hoy;
    while (!esDiaHabil(f)) f = addDias(f, 1);
    return f;
  }, [hoy]);

  const [diaSel, setDiaSel] = useState<FechaISO>(referencia);

  const plan = useMemo(
    () => planificarAgenda(tareas, grupo, addDias(hoy, -1)),
    [tareas, grupo, hoy],
  );
  const ocupacion = useMemo(() => ocupacionPorDia(plan), [plan]);

  const semana = useMemo(() => {
    const lunes = lunesDe(referencia);
    return [0, 1, 2, 3, 4].map(i => addDias(lunes, i));
  }, [referencia]);

  const entregasDelGrupo = useMemo(() => {
    const s = new Set<string>();
    for (const t of tareas) s.add(t.fechaEntrega);
    return s;
  }, [tareas]);

  const bloquesDia = plan.porDia[diaSel] ?? [];
  const proximasEntregas = tareas
    .filter(t => t.fechaEntrega >= hoy)
    .sort((a, b) => a.fechaEntrega.localeCompare(b.fechaEntrega))
    .slice(0, 8);

  const director = USUARIOS.find(u =>
    u.id === (DIRECTORES_MANANA[grupo] ?? DIRECTORES_TARDE[grupo]));

  const minAtras = Math.max(0, Math.round((Date.now() - dataUpdatedAt) / 60000));

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-6">
      <div className="w-full max-w-md space-y-4">

        {/* ── Encabezado ─────────────────────────────────── */}
        <header className="flex items-center gap-3">
          <img
            src={`${import.meta.env.BASE_URL}mjb_escudo.png`}
            alt="Escudo MJB"
            className="w-10 h-10 object-contain"
          />
          <div>
            <h1 className="font-bold text-strong leading-tight">
              Grupo <span style={{ color: colorGrado(grupo) }}>{grupo}</span> · agenda de tareas
            </h1>
            <p className="text-[11px] text-muted">
              I.E. Manuel J. Betancur{director ? ` · Dir. ${director.nombreCorto}` : ''}
            </p>
          </div>
        </header>

        {isLoading ? (
          <div className="rounded-2xl border border-line bg-elevated/40 p-6 text-center text-sm text-muted">
            Cargando la agenda…
          </div>
        ) : (
          <>
            {/* ── Mapa de calor de la semana ───────────────── */}
            <section className="rounded-2xl border border-line bg-card p-4">
              <div className="flex justify-between items-baseline mb-3">
                <span className="text-sm font-semibold text-strong">Cómo viene la semana</span>
                <span className="text-[11px] text-muted">
                  {semana[0].slice(8)}/{semana[0].slice(5, 7)} – {semana[4].slice(8)}/{semana[4].slice(5, 7)}
                </span>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {semana.map((f, i) => {
                  const ejecutable = esDiaEjecutable(grupo, f);
                  const n = ocupacion[f] ?? 0;
                  const esHoy = f === hoy;
                  const activa = f === diaSel;
                  return (
                    <button key={f} onClick={() => setDiaSel(f)} className="text-center">
                      <div className={cn('text-[10px] mb-1', esHoy ? 'text-info font-bold' : 'text-muted')}>
                        {DIAS_LABEL[i]}{esHoy ? ' · hoy' : ''}
                      </div>
                      <div
                        className={cn(
                          'h-11 rounded-xl flex items-center justify-center text-xs font-semibold border transition-all',
                          activa ? 'border-line-strong' : 'border-line',
                          !ejecutable ? 'border-dashed text-muted opacity-60' : 'text-soft'
                        )}
                        style={ejecutable ? { backgroundColor: fondoCarga(n, config.topeDiario) } : undefined}
                      >
                        {ejecutable ? `${n}/${config.topeDiario}` : '—'}
                      </div>
                      <div className="h-3 flex justify-center items-center">
                        {entregasDelGrupo.has(f) && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                      </div>
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-muted mt-1">
                Más intenso = día más cargado · el punto marca los días con entrega · toca un día para verlo
              </p>
            </section>

            {/* ── Tareas del día seleccionado ──────────────── */}
            <section className="rounded-2xl border border-line bg-card p-4 space-y-2.5">
              <div className="flex justify-between items-baseline">
                <span className="text-sm font-semibold text-strong">{diaLegibleLargo(diaSel)}</span>
                <span className="text-[11px] text-muted">
                  {(ocupacion[diaSel] ?? 0)} de {config.topeDiario} momentos
                </span>
              </div>

              {!esDiaEjecutable(grupo, diaSel) ? (
                <p className="text-xs text-muted py-2">
                  Este día no se programan tareas{nivelDeGrupo(grupo) === 'mt' ? ' (festivo o contrajornada de media técnica)' : ' (festivo)'}.
                </p>
              ) : bloquesDia.length === 0 ? (
                <p className="text-xs text-muted py-2">Sin momentos de tarea programados. 🎉</p>
              ) : (
                bloquesDia.map((b, i) => {
                  const t = tareas.find(x => x.id === b.tareaId);
                  if (!t) return null;
                  return (
                    <div key={i} className="rounded-xl border border-line bg-elevated/40 px-3 py-2.5">
                      <div className="flex justify-between items-center mb-0.5">
                        <span className="text-[11px] font-semibold text-soft">
                          {getAsignatura(t.asignaturaId)?.nombre ?? t.asignaturaId}
                        </span>
                        <span className="text-[11px] text-muted">
                          {b.momentos} momento{b.momentos > 1 ? 's' : ''} · {b.momentos * config.duracionMomentoMin} min
                        </span>
                      </div>
                      <div className="text-sm text-strong">{t.titulo}</div>
                      <div className="text-[11px] text-muted mt-0.5">
                        entrega: {fechaLegible(t.fechaEntrega)}
                      </div>
                    </div>
                  );
                })
              )}

              {/* Momento fijo de estudio */}
              <div className="rounded-xl bg-warning-soft border border-warning px-3 py-2 flex justify-between items-center">
                <span className="text-xs text-warning-soft-fg flex items-center gap-1.5">
                  <BookOpen size={13} /> Estudio personal
                </span>
                <span className="text-[11px] text-warning-soft-fg">{config.estudioMin} min · todos los días</span>
              </div>
            </section>

            {/* ── Próximas entregas ────────────────────────── */}
            <section className="rounded-2xl border border-line bg-card p-4">
              <span className="text-sm font-semibold text-strong block mb-2">Próximas entregas</span>
              {proximasEntregas.length === 0 ? (
                <p className="text-xs text-muted">No hay entregas pendientes.</p>
              ) : (
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
              )}
            </section>

            {/* ── Pie ──────────────────────────────────────── */}
            <footer className="flex justify-between items-center text-[10px] text-muted px-1">
              <span className="flex items-center gap-1">
                <RefreshCw size={10} /> actualizado hace {minAtras} min
              </span>
              <span>se actualiza automáticamente</span>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}
