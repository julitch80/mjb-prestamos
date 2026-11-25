// Plan Académico Especial (mañana, 9.°, 10.° y 11.°): sustentaciones.
//  - BannerSustentacionDocente: sección «Sustentación» arriba del plan del estudiante; cada docente marca lo SUYO.
//  - PanelSustentacionesPAE: coordinación ve el estado general, la matriz estudiantes × docentes y la propuesta.
import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { useAppStore } from '../../data/store';
import type { PlanCasa } from '../../data/planCasa/tipos';
import { guardarSustentacionPAE } from '../../data/planCasa/persistencia';
import { participaEnPAE, esOnce, esPAEManana, nombreDocente, resumenPlanPAE, type FilaDocentePAE, type ResumenPAE, type Valoracion } from '../../data/planCasa/sustentacionesPAE';
import { PROPUESTA_PAE_MANANA } from '../../data/horarioEspecial/sustentacionesPAE';
import { CajaError } from './comun';

function Casilla({ texto, marcada, onCambio, ocupado }: { texto: string; marcada: boolean; onCambio: (v: boolean) => void; ocupado: boolean }) {
  return (
    <label className={cn('flex items-center gap-3 min-h-[44px] px-3 rounded-xl border cursor-pointer text-sm font-semibold',
      marcada ? 'bg-success-soft text-success-soft-fg border-success' : 'border-line text-strong')}>
      <input type="checkbox" className="h-5 w-5" checked={marcada} disabled={ocupado} onChange={e => onCambio(e.target.checked)} />
      {texto}
    </label>
  );
}

/** Sección «Sustentación», PRIMERA al abrir el plan del estudiante: solo docentes del grupo, planes PAE de la mañana. */
export function BannerSustentacionDocente({ plan }: { plan: PlanCasa }) {
  const yo = useAppStore(s => s.userId) ?? '';
  const rol = useAppStore(s => s.rol);
  // Cualquier docente que tenga abierto el plan marca lo suyo (la asignación oficial no refleja
  // reemplazos como Camilo); los demás, solo si figuran en la asignación o en el plan.
  const puedeMarcar = rol === 'docente' || participaEnPAE(plan, yo);
  const mia = plan.sustentacionesPAE?.[yo];
  const [local, setLocal] = useState<{ asesoria?: boolean; sustentacion?: boolean; valoracion?: Valoracion }>({});
  const [obs, setObs] = useState(mia?.observacion ?? '');
  const [guardada, setGuardada] = useState(mia?.observacion ?? '');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { setObs(mia?.observacion ?? ''); setGuardada(mia?.observacion ?? ''); }, [plan.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!esPAEManana(plan.grupo) || !yo || !puedeMarcar) return null;
  const asesoria = local.asesoria ?? mia?.asesoria === true;
  const sustentacion = local.sustentacion ?? mia?.sustentacion === true;
  const valoracion: Valoracion = 'valoracion' in local ? local.valoracion : mia?.valoracion ?? null;
  async function guardar(c: Parameters<typeof guardarSustentacionPAE>[2]) {
    setError(''); setOcupado(true); setLocal(l => ({ ...l, ...c }));
    try { await guardarSustentacionPAE(plan.id, yo, c); if (c.observacion !== undefined) setGuardada(c.observacion); }
    catch (e) { setLocal({}); setError((e as Error).message || 'No se pudo guardar. Intente de nuevo.'); }
    finally { setOcupado(false); }
  }
  return (
    <div className="rounded-2xl border-2 border-accent bg-card p-3 space-y-3">
      <div>
        <h4 className="text-base font-bold text-strong">Sustentación</h4>
        <p className="text-xs text-soft">Lo suyo con {plan.nombres.split(' ')[0]}. Se guarda al marcar; la coordinación y el estudiante lo ven.</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Casilla texto="Se presentó a asesoría" marcada={asesoria} ocupado={ocupado} onCambio={v => guardar({ asesoria: v })} />
        <Casilla texto="Se presentó a sustentación" marcada={sustentacion} ocupado={ocupado} onCambio={v => guardar({ sustentacion: v })} />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-strong">Valoración</p>
        <div className="flex gap-2">
          {([['aprobo', 'Aprobó', 'bg-success-soft text-success-soft-fg border-success'], ['no_aprobo', 'No aprobó', 'bg-warning-soft text-warning-soft-fg border-warning']] as const).map(([v, t, on]) => (
            <button key={v} type="button" disabled={ocupado} aria-pressed={valoracion === v} onClick={() => guardar({ valoracion: valoracion === v ? null : v })}
              className={cn('min-h-[44px] flex-1 px-3 rounded-xl border text-sm font-semibold', valoracion === v ? on : 'border-line text-soft')}>{t}</button>
          ))}
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-sm font-semibold text-strong" htmlFor={`obs-${plan.id}`}>Observación (opcional)</label>
        <textarea id={`obs-${plan.id}`} rows={2} maxLength={300} value={obs} onChange={e => setObs(e.target.value)}
          onBlur={() => { if (obs.trim() !== guardada) guardar({ observacion: obs.trim() }); }}
          className="w-full px-3 py-2 rounded-xl bg-elevated border border-line text-sm text-strong" />
        <button type="button" disabled={ocupado || obs.trim() === guardada} onClick={() => guardar({ observacion: obs.trim() })}
          className="min-h-[44px] px-4 rounded-xl bg-accent text-strong text-sm font-medium disabled:opacity-40">Guardar observación</button>
      </div>
      {error && <CajaError>{error}</CajaError>}
    </div>
  );
}

/** Pantalla de inicio del docente: sus estudiantes PAE de mañana con su propio estado; toque uno para abrirlo. */
export function ResumenSustentacionDocente({ planes, onAbrir }: { planes: PlanCasa[]; onAbrir: (planId: string) => void }) {
  const yo = useAppStore(s => s.userId) ?? '';
  const rol = useAppStore(s => s.rol);
  const mios = planes.filter(p => esPAEManana(p.grupo) && yo && (rol === 'docente' || participaEnPAE(p, yo)))
    .map(p => ({ p, m: p.sustentacionesPAE?.[yo] }))
    .sort((a, b) => Number(!!a.m?.asesoria && !!a.m?.sustentacion) - Number(!!b.m?.asesoria && !!b.m?.sustentacion)
      || a.p.grupo.localeCompare(b.p.grupo, 'es', { numeric: true }) || a.p.nombres.localeCompare(b.p.nombres, 'es'));
  if (mios.length === 0) return null;
  const faltan = mios.filter(x => !(x.m?.asesoria && x.m?.sustentacion)).length;
  return (
    <section className="rounded-2xl border-2 border-accent bg-card p-3 space-y-2">
      <div>
        <h3 className="text-base font-bold text-strong">Sustentación</h3>
        <p className="text-xs text-soft">{faltan ? `${faltan} de ${mios.length} estudiantes con algo pendiente.` : 'Todo marcado.'} Toque un estudiante para marcar.</p>
      </div>
      <ul className="space-y-1">
        {mios.map(({ p, m }) => (
          <li key={p.id}>
            <button type="button" onClick={() => onAbrir(p.id)} className="w-full min-h-[44px] flex flex-wrap items-center gap-x-3 rounded-xl border border-line px-3 py-1.5 text-left text-sm">
              <span className="font-semibold text-strong flex-1 min-w-[8rem]">{p.nombres.split(' ')[0]} {p.apellidos.split(' ')[0]} <span className="font-normal text-soft">{p.grupo}</span></span>
              <span className={m?.asesoria ? 'text-success' : 'text-muted'}>Asesoría {m?.asesoria ? '✓' : '·'}</span>
              <span className={m?.sustentacion ? 'text-success' : 'text-muted'}>Sust. {m?.sustentacion ? '✓' : '·'}</span>
              {m?.valoracion && <span className={m.valoracion === 'aprobo' ? 'text-success' : 'text-warning'}>{m.valoracion === 'aprobo' ? 'Aprobó' : 'No aprobó'}</span>}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Propuesta() {
  const [abierta, setAbierta] = useState<string | null>(null);
  const dia = PROPUESTA_PAE_MANANA.find(d => d.fecha === abierta);
  return (
    <section className="rounded-2xl border-2 border-accent bg-card p-4 space-y-3">
      <div>
        <h3 className="text-base font-bold text-strong">Propuesta de distribución</h3>
        <p className="text-sm text-soft">Con esta distribución se garantiza que los estudiantes de 11.° tengan sus dos espacios.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {PROPUESTA_PAE_MANANA.map(d => (
          <button key={d.fecha} type="button" onClick={() => setAbierta(abierta === d.fecha ? null : d.fecha)} aria-pressed={abierta === d.fecha}
            className={cn('min-h-[44px] px-4 rounded-lg text-sm font-semibold border', abierta === d.fecha ? 'bg-accent text-accent-fg border-accent' : 'border-line text-strong')}>
            {d.titulo}
          </button>
        ))}
      </div>
      {dia && (
        <ul className="space-y-1">
          {dia.citas.map(x => (
            <li key={x.hora} className="rounded-lg border border-line px-3 py-2 text-sm">
              <div className="flex flex-wrap justify-between gap-2">
                <span><span className="tabular-nums font-semibold text-strong">{x.hora}</span> · {x.docente} · {x.asignatura}</span>
                <span className="text-xs uppercase tracking-wide text-soft">{x.tipo === 'orientacion' ? 'Asesoría' : 'Sustentación'}</span>
              </div>
              {x.nota && <p className="text-xs text-muted">{x.nota}</p>}
            </li>
          ))}
        </ul>
      )}
      <ul className="list-disc pl-5 space-y-0.5 text-xs text-soft">
        <li>El martes 24 se hicieron las asesorías, salvo Artística: Doris tiene la asesoría el miércoles y la sustentación el jueves.</li>
        <li>Ledis solo puede el miércoles a primera hora.</li>
        <li>Matemáticas de 11.° queda sin docente (Claudia no estará).</li>
        <li>El horario llega hasta las 12:00; no hay horas libres para rezagados (reposición directa con el docente).</li>
        <li>Camilo, jueves 11:00: es asesoría solo para 10.°.</li>
      </ul>
    </section>
  );
}

const VAL_TXT: Record<string, string> = { aprobo: 'Aprobó', no_aprobo: 'No aprobó' };

/** Celda compacta de la matriz: asesoría · sustentación · valoración. */
function Celda({ f }: { f: FilaDocentePAE | undefined }) {
  if (!f) return <td className="bg-elevated/40" />;
  const color = f.valoracion === 'no_aprobo' ? 'bg-warning-soft text-warning-soft-fg'
    : f.faltan.length === 0 ? 'bg-success-soft text-success-soft-fg'
    : f.asesoria || f.sustentacion ? 'bg-accent/10 text-strong' : 'text-muted';
  return (
    <td className={cn('px-1.5 py-1 text-center whitespace-nowrap font-medium', color)}
      title={`${nombreDocente(f.docenteId)}: asesoría ${f.asesoria ? 'sí' : 'pendiente'} · sustentación ${f.sustentacion ? 'sí' : 'pendiente'}${f.valoracion ? ` · ${VAL_TXT[f.valoracion]}` : ''}`}>
      {f.asesoria ? '✓' : '·'}{f.sustentacion ? '✓' : '·'}{f.valoracion === 'aprobo' ? ' Ap' : f.valoracion === 'no_aprobo' ? ' NoAp' : ''}
    </td>
  );
}

function Detalle({ p, r, onCerrar }: { p: PlanCasa; r: ResumenPAE; onCerrar: () => void }) {
  const faltan = r.filas.filter(f => f.faltan.length).map(f => `${nombreDocente(f.docenteId)} (${f.faltan.join(' y ')})`).join('; ');
  return (
    <div className="rounded-2xl border-2 border-accent bg-card p-3 space-y-2">
      <div className="flex items-center gap-2">
        <h4 className="font-bold text-strong flex-1">{p.nombres.split(' ')[0]} {p.apellidos.split(' ')[0]} · {p.grupo}°{esOnce(p.grupo) ? ' · PRIORIDAD (se gradúa)' : ''}</h4>
        <button type="button" onClick={onCerrar} className="min-h-[44px] px-3 text-sm text-soft">Cerrar</button>
      </div>
      <p className={cn('text-sm font-medium', r.pendientes ? 'text-warning' : 'text-success')}>
        {r.pendientes ? `Faltan ${r.pendientes} de ${r.total}: ${faltan}.` : 'Todo marcado.'}
      </p>
      <ul className="space-y-1.5">
        {r.filas.map(f => (
          <li key={f.docenteId} className="rounded-lg border border-line px-3 py-2 text-sm">
            <div className="flex flex-wrap gap-x-3 gap-y-0.5">
              <span className="font-semibold text-strong w-28">{nombreDocente(f.docenteId)}</span>
              <span>Asesoría: {f.asesoria ? '✓ presentó' : 'pendiente'}</span>
              <span>Sustentación: {f.sustentacion ? '✓ presentó' : 'pendiente'}</span>
              <span>Valoración: {f.valoracion ? VAL_TXT[f.valoracion] : 'sin valorar'}</span>
            </div>
            {f.observacion && <p className="text-xs text-soft mt-0.5">Observación: {f.observacion}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Cifra({ v, t, tono }: { v: string; t: string; tono?: string }) {
  return (
    <div className="rounded-xl border border-line bg-card px-3 py-2">
      <p className={cn('text-xl font-bold tabular-nums', tono ?? 'text-strong')}>{v}</p>
      <p className="text-[11px] text-soft leading-tight">{t}</p>
    </div>
  );
}

const btnFiltro = (act: boolean) => cn('min-h-[44px] px-3 rounded-lg text-sm border', act ? 'bg-accent/15 border-accent/50 text-strong' : 'border-line text-soft');

/** Coordinación: resumen, propuesta, matriz estudiantes × docentes y detalle. */
export function PanelSustentacionesPAE({ planes }: { planes: PlanCasa[] }) {
  const [grado, setGrado] = useState<'todos' | '9' | '10' | '11'>('todos');
  const [orden, setOrden] = useState<'pendientes' | 'grupo'>('pendientes');
  const [abierto, setAbierto] = useState<string | null>(null);
  const todas = useMemo(() => planes.filter(p => p.estado === 'activo' && esPAEManana(p.grupo)).map(p => ({ p, r: resumenPlanPAE(p.grupo, p.sustentacionesPAE, p.docentesCorreos) })), [planes]);
  const filas = useMemo(() => todas.filter(f => grado === 'todos' || f.p.grupo.startsWith(grado))
    .sort((a, b) => (orden === 'pendientes' ? b.r.pendientes - a.r.pendientes || Number(esOnce(b.p.grupo)) - Number(esOnce(a.p.grupo)) : 0)
      || a.p.grupo.localeCompare(b.p.grupo, 'es', { numeric: true }) || `${a.p.apellidos} ${a.p.nombres}`.localeCompare(`${b.p.apellidos} ${b.p.nombres}`, 'es')), [todas, grado, orden]);
  const docentes = useMemo(() => [...new Set(filas.flatMap(f => f.r.filas.map(x => x.docenteId)))].sort((a, b) => nombreDocente(a).localeCompare(nombreDocente(b), 'es')), [filas]);
  const once = todas.filter(f => esOnce(f.p.grupo));
  const suma = (fn: (r: ResumenPAE) => number) => todas.reduce((n, f) => n + fn(f.r), 0);
  const sel = todas.find(f => f.p.id === abierto);
  return (
    <div className="space-y-4">
      <section className="space-y-2">
        <h3 className="text-base font-bold text-strong">Estado general de las sustentaciones</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Cifra v={`${once.filter(f => f.r.completo).length} / ${once.length}`} t="estudiantes de 11.° completos" tono={once.some(f => !f.r.completo) ? 'text-danger' : 'text-success'} />
          <Cifra v={String(once.filter(f => !f.r.completo).length)} t="de 11.° con pendientes (cierran el jueves 26)" />
          <Cifra v={`${suma(r => r.sustentacionesHechas)} / ${suma(r => r.filas.length)}`} t="sustentaciones hechas" />
          <Cifra v={`${suma(r => r.asesoriasHechas)} / ${suma(r => r.filas.length)}`} t="asesorías hechas" />
          <Cifra v={String(suma(r => r.pendientes))} t="marcas faltantes (asesoría + sustentación)" />
          <Cifra v={String(suma(r => r.aprobadas))} t="valoraciones: aprobó" tono="text-success" />
          <Cifra v={String(suma(r => r.noAprobadas))} t="valoraciones: no aprobó" tono="text-warning" />
          <Cifra v={String(todas.length)} t="estudiantes PAE de la mañana" />
        </div>
      </section>

      <Propuesta />

      <section className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-bold text-strong flex-1">Estudiantes × docentes</h3>
          {(['todos', '9', '10', '11'] as const).map(g => <button key={g} type="button" aria-pressed={grado === g} onClick={() => setGrado(g)} className={btnFiltro(grado === g)}>{g === 'todos' ? 'Todos' : `${g}.°`}</button>)}
          <button type="button" onClick={() => setOrden(o => (o === 'pendientes' ? 'grupo' : 'pendientes'))} className={btnFiltro(false)}>
            Orden: {orden === 'pendientes' ? 'más pendientes primero' : 'por grupo'}
          </button>
        </div>
        <p className="text-xs text-soft">Cada celda: asesoría · sustentación · valoración (Ap = aprobó, NoAp = no aprobó). ✓ hecho, · pendiente. Toque un estudiante para ver el detalle. ★ = 11.° (prioridad).</p>
        {filas.length === 0 && <p className="text-sm text-soft">No hay planes PAE de la mañana.</p>}
        {filas.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-elevated text-muted">
                  <th className="sticky left-0 z-10 bg-elevated p-2 text-left font-medium">Estudiante</th>
                  <th className="p-1.5 font-medium">Faltan</th>
                  {docentes.map(d => <th key={d} className="p-1.5 font-medium whitespace-nowrap">{nombreDocente(d)}</th>)}
                </tr>
              </thead>
              <tbody>
                {filas.map(({ p, r }) => (
                  <tr key={p.id} className={cn('border-t border-line', abierto === p.id && 'ring-2 ring-accent ring-inset')}>
                    <th scope="row" className="sticky left-0 z-10 bg-card p-0 text-left font-normal">
                      <button type="button" onClick={() => setAbierto(abierto === p.id ? null : p.id)} className="min-h-[44px] w-full px-2 text-left whitespace-nowrap">
                        <span className="font-semibold text-strong">{p.nombres.split(' ')[0]} {p.apellidos.split(' ')[0]}</span>{' '}
                        <span className={esOnce(p.grupo) ? 'text-danger font-bold' : 'text-soft'}>{p.grupo}{esOnce(p.grupo) ? ' ★' : ''}</span>
                      </button>
                    </th>
                    <td className={cn('px-2 text-center font-bold tabular-nums', r.pendientes ? 'text-warning' : 'text-success')}>{r.pendientes || '✓'}</td>
                    {docentes.map(d => <Celda key={d} f={r.filas.find(x => x.docenteId === d)} />)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {sel && <Detalle p={sel.p} r={sel.r} onCerrar={() => setAbierto(null)} />}
      </section>
    </div>
  );
}
