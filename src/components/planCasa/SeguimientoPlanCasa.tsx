// Pestaña «Seguimiento» del Plan Académico Especial: cifras, filtros y una tarjeta por
// estudiante con anillo de avance y semáforo. El alcance depende del rol (ver
// seguimientoEstudiante.ts): equipo/rectora/superusuario todo, coordinador su jornada,
// docente solo sus estudiantes y sus asignaturas. Jamás muestra motivo ni diagnóstico.
import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { useAppStore } from '../../data/store';
import { PestanasSubrayadas } from '../Navegacion';
import type { GuiaPlan, LlamadaFamilia } from '../../data/planCasa/tipos';
import {
  correoActual, escucharGuias, escucharLlamadas, escucharPlanes, leerEquipo, registrarLlamada, type PlanConDocentes,
} from '../../data/planCasa/persistencia';
import { hoyLocal } from '../../data/planCasa/completarPlan';
import { textoVentana } from '../../data/planCasa/ventanaSustentacion';
import {
  DIAS_SIN_AVANCE, diaBogota, filtrarSeguimientos, guiasVisibles, puedeRegistrarLlamada, resumenSeguimientos, seguimientoDePlan,
  textoUltimaEntrega, veAmbasJornadas, veHistorialLlamadas, type FiltroSeguimiento, type Jornada, type QuienVe, type Semaforo,
  type SeguimientoEstudiante,
} from '../../data/planCasa/seguimientoEstudiante';
import { asignaturasConNombre } from './nombres';
import { CajaError, Cargando, CLASE_BOTON, CLASE_BOTON_SEC, CLASE_INPUT, fechaCorta } from './comun';

/** Si una notificación abrió la app con `?sub=seguimiento`, App.tsx dejó la marca en sessionStorage; se lee una sola vez. */
export function consumirSubPlanCasa(): 'seguimiento' | null {
  try {
    const v = sessionStorage.getItem('mjb_sub_plan_casa');
    if (v) sessionStorage.removeItem('mjb_sub_plan_casa');
    return v === 'seguimiento' ? 'seguimiento' : null;
  } catch { return null; }
}

const COLOR_TEXTO: Record<Semaforo, string> = { verde: 'text-success', amarillo: 'text-warning', rojo: 'text-danger' };
const COLOR_ANILLO: Record<Semaforo, string> = { verde: 'stroke-success', amarillo: 'stroke-warning', rojo: 'stroke-danger' };
const COLOR_PUNTO: Record<Semaforo, string> = { verde: 'bg-success', amarillo: 'bg-warning', rojo: 'bg-danger' };
const TEXTO_SEMAFORO: Record<Semaforo, string> = { verde: 'Al día', amarillo: 'Atrasado', rojo: 'Sin avance' };

function Anillo({ pct, semaforo }: { pct: number; semaforo: Semaforo }) {
  const r = 26, c = 2 * Math.PI * r;
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" role="img" aria-label={`${pct}% de avance`} className="flex-shrink-0">
      <circle cx="32" cy="32" r={r} fill="none" strokeWidth="6" className="stroke-elevated" />
      <circle cx="32" cy="32" r={r} fill="none" strokeWidth="6" strokeLinecap="round" className={COLOR_ANILLO[semaforo]}
        strokeDasharray={`${(c * pct) / 100} ${c}`} transform="rotate(-90 32 32)" />
      <text x="32" y="37" textAnchor="middle" className="fill-current text-strong" fontSize="15" fontWeight="600">{pct}%</text>
    </svg>
  );
}

/** Escucha las guías de un plan y las reporta al padre (no pinta nada). */
function OyenteGuias({ planId, onGuias }: { planId: string; onGuias: (id: string, g: GuiaPlan[]) => void }) {
  useEffect(() => escucharGuias(planId, g => onGuias(planId, g), () => onGuias(planId, [])), [planId, onGuias]);
  return null;
}

function Cifra({ valor, texto, tono }: { valor: string; texto: string; tono?: string }) {
  return (
    <div className="rounded-xl bg-elevated p-3 text-center">
      <p className={cn('text-xl font-semibold text-strong', tono)}>{valor}</p>
      <p className="text-[11px] text-soft leading-tight">{texto}</p>
    </div>
  );
}

const ESTADO_SUST = { sin_citar: 'Sin citar', citada: 'Citada', sustentada: 'Sustentada' } as const;

function BarrasSemana({ s }: { s: SeguimientoEstudiante }) {
  const max = Math.max(1, ...s.semanas.map(x => x.total));
  return (
    <div>
      <p className="text-xs font-medium text-soft mb-1">Entregas por semana</p>
      <div className="flex items-end gap-2 h-20">
        {s.semanas.map(x => (
          <div key={x.semana} className="flex-1 flex flex-col items-center justify-end h-full min-w-[28px]">
            <span className="text-[10px] text-soft">{x.entregados}/{x.total}</span>
            <div className="w-full rounded-t bg-elevated flex items-end" style={{ height: `${(x.total / max) * 100}%` }}>
              <div className="w-full rounded-t bg-accent" style={{ height: `${x.total ? (x.entregados / x.total) * 100 : 0}%` }} />
            </div>
            <span className="text-[10px] text-muted">S{x.semana}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BloqueLlamadas({ s, quien }: { s: SeguimientoEstudiante; quien: QuienVe }) {
  const [llamadas, setLlamadas] = useState<LlamadaFamilia[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [nota, setNota] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const verHistorial = veHistorialLlamadas(quien);
  useEffect(() => (verHistorial ? escucharLlamadas(s.planId, setLlamadas) : () => {}), [s.planId, verHistorial]);

  async function guardar() {
    setError(''); setGuardando(true);
    try { await registrarLlamada(s.planId, nota); setNota(''); setAbierto(false); }
    catch (e) { setError((e as Error).message || 'No se pudo guardar.'); }
    finally { setGuardando(false); }
  }
  const fecha = (ms: number) => fechaCorta(diaBogota(ms));

  return (
    <div className="space-y-2">
      {s.semaforo === 'rojo' && (
        <p className="rounded-lg bg-danger-soft text-danger-soft-fg text-xs p-2">
          {s.alerta
            ? `Alerta enviada a Orientación, UAI y Coordinación el ${fecha(s.alerta.en)}.`
            : `Lleva ${s.diasSinAvance ?? DIAS_SIN_AVANCE} días sin entregar. La alerta se envía cada mañana a las 7:00.`}
        </p>
      )}
      {puedeRegistrarLlamada(quien) && (s.semaforo === 'rojo' || llamadas.length > 0) && (
        abierto ? (
          <div className="space-y-2">
            <input value={nota} onChange={e => setNota(e.target.value)} maxLength={300} className={CLASE_INPUT}
              placeholder="Nota corta (sin datos de salud)" />
            <div className="flex gap-2">
              <button onClick={guardar} disabled={guardando} className={CLASE_BOTON}>{guardando ? 'Guardando…' : 'Guardar llamada'}</button>
              <button onClick={() => setAbierto(false)} className={CLASE_BOTON_SEC}>Cancelar</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAbierto(true)} className={CLASE_BOTON_SEC}>Ya llamamos a la familia</button>
        )
      )}
      {error && <p className="text-xs text-danger">{error}</p>}
      {verHistorial && llamadas.length > 0 && (
        <ul className="text-xs text-soft space-y-0.5">
          {llamadas.map(l => (
            <li key={l.id}>{fecha(l.en)} · {l.por}{l.nota ? ` — ${l.nota}` : ''}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Detalle({ s, quien }: { s: SeguimientoEstudiante; quien: QuienVe }) {
  return (
    <div className="mt-3 space-y-3 border-t border-line pt-3">
      {s.semanas.length > 0 && <BarrasSemana s={s} />}
      <div>
        <p className="text-xs font-medium text-soft mb-1">Avance por área</p>
        <ul className="space-y-1.5">
          {s.areas.map(a => (
            <li key={a.guiaId} className="text-xs">
              <div className="flex justify-between text-strong"><span className="truncate">{a.area}</span><span>{a.entregados}/{a.total}</span></div>
              <div className="h-1.5 rounded-full bg-elevated overflow-hidden">
                <div className="h-full bg-accent" style={{ width: `${a.total ? (a.entregados / a.total) * 100 : 0}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <p className="text-xs font-medium text-soft mb-1">Pasos vencidos ({s.vencidos.length})</p>
        {s.vencidos.length === 0
          ? <p className="text-xs text-muted">Ninguno.</p>
          : <ul className="text-xs text-strong space-y-0.5">
              {s.vencidos.map(v => <li key={`${v.guiaId}/${v.pasoId}`}>{v.area} · {v.titulo} <span className="text-muted">({fechaCorta(v.fecha)}, hace {v.diasAtraso} d)</span></li>)}
            </ul>}
      </div>
      <p className="text-xs text-soft">Pasos revisados por docentes: <span className="text-strong font-medium">{s.revisados}</span> de {s.total}</p>
      <div>
        <p className="text-xs font-medium text-soft mb-1">Sustentaciones (ventana {textoVentana()})</p>
        <ul className="text-xs text-strong space-y-0.5">
          {s.sustentaciones.map(x => (
            <li key={x.guiaId}>{x.area} · {x.fecha ? fechaCorta(x.fecha) : 'sin fecha'} · <span className="text-soft">{ESTADO_SUST[x.estado] ?? x.estado}</span></li>
          ))}
        </ul>
      </div>
      <BloqueLlamadas s={s} quien={quien} />
    </div>
  );
}

function Tarjeta({ s, hoy, quien }: { s: SeguimientoEstudiante; hoy: string; quien: QuienVe }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <div className="rounded-2xl border border-line bg-card p-3">
      <div className="flex items-center gap-3">
        <Anillo pct={s.porcentaje} semaforo={s.semaforo} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-strong truncate">{s.nombre} <span className="font-normal text-soft">· {s.grupo}</span></p>
          <p className={cn('text-xs font-medium flex items-center gap-1.5', COLOR_TEXTO[s.semaforo])}>
            <span className={cn('inline-block w-2 h-2 rounded-full', COLOR_PUNTO[s.semaforo])} />
            {s.enEspera ? 'En espera' : TEXTO_SEMAFORO[s.semaforo]}
            {s.semaforo === 'amarillo' && ` · ${s.vencidos.length} paso${s.vencidos.length === 1 ? '' : 's'}`}
          </p>
          <p className="text-[11px] text-soft">{textoUltimaEntrega(s, hoy)} · {s.entregados}/{s.total} pasos</p>
        </div>
        <button onClick={() => setAbierto(v => !v)} className={CLASE_BOTON_SEC} aria-expanded={abierto}>{abierto ? 'Ocultar' : 'Ver detalles'}</button>
      </div>
      {abierto && <Detalle s={s} quien={quien} />}
    </div>
  );
}

const FILTROS: { id: FiltroSeguimiento; label: string }[] = [
  { id: 'todos', label: 'Todos' }, { id: 'sin_avance', label: 'Sin avance' }, { id: 'atrasados', label: 'Atrasados' },
];
const FILTROS_JORNADA: { id: Jornada | 'todas'; label: string }[] = [
  { id: 'todas', label: 'Ambas' }, { id: 'manana', label: 'Mañana' }, { id: 'tarde', label: 'Tarde' },
];

export default function SeguimientoPlanCasa() {
  const rol = useAppStore(s => s.rol) ?? '';
  const jornadaUsuario = useAppStore(s => s.jornada);
  const [enEquipo, setEnEquipo] = useState<boolean | null>(null);
  const [planes, setPlanes] = useState<PlanConDocentes[] | null>(null);
  const [guias, setGuias] = useState<Record<string, GuiaPlan[]>>({});
  const [error, setError] = useState('');
  const [filtro, setFiltro] = useState<FiltroSeguimiento>('todos');
  const [jornada, setJornada] = useState<Jornada | 'todas'>('todas');

  useEffect(() => { leerEquipo().then(l => setEnEquipo(l.includes(correoActual()))); }, []);
  const quien: QuienVe = useMemo(
    () => ({ rol, jornada: jornadaUsuario, enEquipo: !!enEquipo, correo: correoActual() }),
    [rol, jornadaUsuario, enEquipo],
  );
  const verTodos = rol !== 'docente' || !!enEquipo;

  useEffect(() => {
    if (enEquipo === null) return;
    return escucharPlanes(verTodos, setPlanes, e => { setError(e.message || 'No se pudieron leer los planes.'); setPlanes([]); });
  }, [verTodos, enEquipo]);

  const activos = useMemo(() => (planes ?? []).filter(p => p.estado === 'activo'), [planes]);
  const recibir = useMemo(() => (id: string, g: GuiaPlan[]) => setGuias(prev => ({ ...prev, [id]: g })), []);
  const hoy = hoyLocal();

  const cargando = planes === null || activos.some(p => !guias[p.id]);
  const todos = useMemo(() => {
    const lista: SeguimientoEstudiante[] = [];
    for (const p of activos) {
      const visibles = guias[p.id] ? guiasVisibles(quien, p, guias[p.id]) : null;
      if (!visibles) continue;
      const nombres = asignaturasConNombre(p.grupo);
      const etiqueta = (g: GuiaPlan) => g.asignaturaIds.map(id => nombres[id]?.asignatura ?? id).join(', ') || g.eje;
      lista.push(seguimientoDePlan(p, visibles, hoy, etiqueta));
    }
    return lista;
  }, [activos, guias, quien, hoy]);

  const resumen = useMemo(() => resumenSeguimientos(todos), [todos]);
  const mostrados = useMemo(() => filtrarSeguimientos(todos, filtro, jornada), [todos, filtro, jornada]);

  return (
    <div className="space-y-3">
      {activos.map(p => <OyenteGuias key={p.id} planId={p.id} onGuias={recibir} />)}
      {error && <CajaError>{error}</CajaError>}
      {cargando && !error && <Cargando texto="Cargando seguimiento…" />}
      {!cargando && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Cifra valor={String(resumen.alDia)} texto="Al día" tono="text-success" />
            <Cifra valor={String(resumen.atrasados)} texto="Atrasados" tono="text-warning" />
            <Cifra valor={String(resumen.sinAvance)} texto={`Sin avance ${DIAS_SIN_AVANCE}+ días`} tono="text-danger" />
            <Cifra valor={`${resumen.sustProgramadas}/${resumen.sustTotal}`} texto="Sustentaciones programadas" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <PestanasSubrayadas opciones={FILTROS} activa={filtro} onCambio={setFiltro} />
            {veAmbasJornadas(quien) && <PestanasSubrayadas opciones={FILTROS_JORNADA} activa={jornada} onCambio={setJornada} />}
          </div>
          {mostrados.length === 0
            ? <p className="text-sm text-soft">{todos.length === 0 ? 'No hay estudiantes con plan activo en su alcance.' : 'Nadie coincide con este filtro.'}</p>
            : <div className="space-y-2">{mostrados.map(s => <Tarjeta key={s.planId} s={s} hoy={hoy} quien={quien} />)}</div>}
        </>
      )}
    </div>
  );
}
