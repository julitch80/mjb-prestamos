// Pestaña «Revisión de guías» (coordinación, rectora, superusuario): evolución de la revisión de las
// entregas de los estudiantes, por docente y por estudiante, con los atrasados primero.
import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import type { AsignaturaPlan, GuiaPlan, PlanCasa } from '../../data/planCasa/tipos';
import { escucharAsignaturas, escucharGuias } from '../../data/planCasa/persistencia';
import { asignaturasConNombre } from './nombres';
import { jornadaDePlan, type FiltroJornada } from '../../data/planCasa/avanceDocentes';
import { nombreDocente } from '../../data/planCasa/sustentacionesPAE';
import { DIAS_ATRASO, resumenRevision, type FilaDocenteRevision } from '../../data/planCasa/revisionGuias';
import { useAppStore } from '../../data/store';
import { Cargando } from './comun';

function Oyente({ planId, onDatos }: { planId: string; onDatos: (id: string, a?: AsignaturaPlan[], g?: GuiaPlan[]) => void }) {
  useEffect(() => escucharAsignaturas(planId, a => onDatos(planId, a, undefined)), [planId, onDatos]);
  useEffect(() => escucharGuias(planId, g => onDatos(planId, undefined, g)), [planId, onDatos]);
  return null;
}

const btn = (act: boolean) => cn('min-h-[44px] px-3 rounded-lg text-sm border', act ? 'bg-accent/15 border-accent/50 text-strong' : 'border-line text-soft');
const dias = (n: number) => (n === 0 ? 'hoy' : n === 1 ? 'hace 1 día' : `hace ${n} días`);

function Cifra({ v, t, tono }: { v: string; t: string; tono?: string }) {
  return (
    <div className="rounded-xl border border-line bg-card p-3">
      <p className={cn('text-2xl font-bold tabular-nums', tono ?? 'text-strong')}>{v}</p>
      <p className="text-[11px] text-soft leading-tight">{t}</p>
    </div>
  );
}

function FilaDocente({ f }: { f: FilaDocenteRevision }) {
  const [abierto, setAbierto] = useState(false);
  const total = f.revisadas + f.pendientes.length;
  const pct = total ? Math.round((f.revisadas / total) * 100) : 100;
  return (
    <li className="rounded-xl border border-line bg-card">
      <button type="button" onClick={() => setAbierto(a => !a)} aria-expanded={abierto} className="w-full min-h-[44px] px-3 py-2 text-left flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-semibold text-strong flex-1 min-w-[8rem]">{nombreDocente(f.correo)}</span>
        <span className="text-xs text-soft tabular-nums">{f.revisadas} revisadas</span>
        <span className={cn('text-xs font-semibold tabular-nums', f.pendientes.length ? 'text-warning' : 'text-success')}>
          {f.pendientes.length ? `${f.pendientes.length} pendientes` : 'al día ✓'}
        </span>
        {f.atrasadas > 0 && <span className="text-xs font-bold text-danger tabular-nums">{f.atrasadas} atrasadas · la más vieja {dias(f.masAntigua)}</span>}
        <span className="basis-full h-1.5 rounded-full bg-elevated overflow-hidden" aria-hidden>
          <span className={cn('block h-full', pct === 100 ? 'bg-success' : f.atrasadas ? 'bg-danger' : 'bg-warning')} style={{ width: `${pct}%` }} />
        </span>
      </button>
      {abierto && f.pendientes.length > 0 && (
        <ul className="border-t border-line px-3 py-2 space-y-1">
          {f.pendientes.map(p => (
            <li key={`${p.planId}-${p.guiaId}-${p.pasoId}-${p.asignaturas.join()}`} className="text-xs text-soft">
              <b className="text-strong">{p.estudiante}</b> · {p.grupo} · {p.titulo} · {p.asignaturas.join(', ')} ·{' '}
              <span className={p.dias >= DIAS_ATRASO ? 'text-danger font-semibold' : ''}>entregó {dias(p.dias)}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export default function RevisionGuias({ planes }: { planes: PlanCasa[] }) {
  const rol = useAppStore(s => s.rol);
  const jornadaUsuario = useAppStore(s => s.jornada);
  const fija: FiltroJornada | null = rol === 'coordinador' && (jornadaUsuario === 'manana' || jornadaUsuario === 'tarde') ? jornadaUsuario : null;
  const [elegida, setElegida] = useState<FiltroJornada>('todas');
  const jornada = fija ?? elegida;
  const [ver, setVer] = useState<'docentes' | 'estudiantes'>('docentes');

  const activos = useMemo(() => planes.filter(p => p.estado === 'activo'), [planes]);
  const [datos, setDatos] = useState<Record<string, { a?: AsignaturaPlan[]; g?: GuiaPlan[] }>>({});
  const recibir = useMemo(() => (id: string, a?: AsignaturaPlan[], g?: GuiaPlan[]) =>
    setDatos(prev => ({ ...prev, [id]: { a: a ?? prev[id]?.a, g: g ?? prev[id]?.g } })), []);
  const cargando = activos.some(p => !datos[p.id]?.a || !datos[p.id]?.g);

  const r = useMemo(() => {
    const nombres: Record<string, ReturnType<typeof asignaturasConNombre>> = {};
    const lista = activos.filter(p => jornada === 'todas' || jornadaDePlan(p.grupo) === jornada).map(p => {
      nombres[p.id] = asignaturasConNombre(p.grupo);
      return { plan: p, asigs: datos[p.id]?.a ?? [], guias: datos[p.id]?.g ?? [] };
    });
    return resumenRevision(lista, Date.now(), (pid, id) => nombres[pid]?.[id]?.asignatura ?? id);
  }, [activos, datos, jornada]);

  const pct = r.entregas ? Math.round((r.revisadas / r.entregas) * 100) : 0;
  return (
    <div className="space-y-4">
      {activos.map(p => <Oyente key={p.id} planId={p.id} onDatos={recibir} />)}
      {!fija && (
        <div className="flex gap-2">
          {(['todas', 'manana', 'tarde'] as const).map(j => <button key={j} type="button" aria-pressed={elegida === j} onClick={() => setElegida(j)} className={btn(elegida === j)}>{j === 'todas' ? 'Todas' : j === 'manana' ? 'Mañana' : 'Tarde'}</button>)}
        </div>
      )}
      {cargando && <Cargando texto="Cargando guías de los planes…" />}

      <section className="space-y-2">
        <h3 className="text-base font-bold text-strong">Cómo va la revisión</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Cifra v={String(r.entregas)} t="entregas recibidas de los estudiantes" />
          <Cifra v={`${r.revisadas} (${pct} %)`} t="ya revisadas" tono="text-success" />
          <Cifra v={String(r.pendientes)} t="por revisar" tono={r.pendientes ? 'text-warning' : 'text-success'} />
          <Cifra v={String(r.atrasadas)} t={`atrasadas (${DIAS_ATRASO} días o más sin revisar)`} tono={r.atrasadas ? 'text-danger' : 'text-success'} />
        </div>
        <p className="text-xs text-soft">Cuenta las entregas que el estudiante envió o que el docente marcó como entregadas. En las guías integradas, cada docente debe revisar su parte.</p>
      </section>

      <div className="flex gap-2">
        <button type="button" aria-pressed={ver === 'docentes'} onClick={() => setVer('docentes')} className={btn(ver === 'docentes')}>Por docente</button>
        <button type="button" aria-pressed={ver === 'estudiantes'} onClick={() => setVer('estudiantes')} className={btn(ver === 'estudiantes')}>Por estudiante</button>
      </div>

      {ver === 'docentes' && (
        <section className="space-y-2">
          <p className="text-xs text-soft">Primero los más atrasados. Toque un docente para ver qué le falta revisar.</p>
          {r.docentes.length === 0 && !cargando && <p className="text-sm text-soft">Aún no hay entregas para revisar.</p>}
          <ul className="space-y-2">{r.docentes.map(f => <FilaDocente key={f.correo} f={f} />)}</ul>
          {r.sinResponsable.length > 0 && (
            <div className="rounded-xl border border-danger/50 bg-danger/5 p-3 space-y-1">
              <p className="text-sm font-semibold text-strong">{r.sinResponsable.length} entregas sin docente asignado en el plan</p>
              <p className="text-xs text-soft">La asignatura no tiene docente registrado; nadie las verá en «Por revisar». Revise «Actualizar docentes» en Planes.</p>
              {r.sinResponsable.slice(0, 8).map(p => <p key={`${p.planId}-${p.guiaId}-${p.pasoId}`} className="text-xs text-soft"><b className="text-strong">{p.estudiante}</b> · {p.grupo} · {p.titulo} · {p.asignaturas.join(', ')}</p>)}
            </div>
          )}
        </section>
      )}

      {ver === 'estudiantes' && (
        <section className="space-y-2">
          <p className="text-xs text-soft">Primero los que tienen más entregas sin revisar.</p>
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full border-collapse text-sm">
              <thead><tr className="bg-elevated text-muted text-xs">
                <th className="p-2 text-left font-medium">Estudiante</th><th className="p-2 font-medium">Entregas</th>
                <th className="p-2 font-medium">Revisadas</th><th className="p-2 font-medium">Por revisar</th><th className="p-2 font-medium">La más vieja</th>
              </tr></thead>
              <tbody>
                {r.estudiantes.map(e => (
                  <tr key={e.planId} className="border-t border-line">
                    <td className="p-2 whitespace-nowrap"><span className="font-semibold text-strong">{e.estudiante}</span> <span className="text-soft text-xs">{e.grupo}</span></td>
                    <td className="p-2 text-center tabular-nums">{e.entregas}</td>
                    <td className="p-2 text-center tabular-nums text-success">{e.revisadas}</td>
                    <td className={cn('p-2 text-center tabular-nums font-semibold', e.pendientes ? 'text-warning' : 'text-success')}>{e.pendientes || '✓'}</td>
                    <td className={cn('p-2 text-center text-xs', e.pendientes && e.masAntigua >= DIAS_ATRASO ? 'text-danger font-semibold' : 'text-soft')}>{e.pendientes ? dias(e.masAntigua) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
