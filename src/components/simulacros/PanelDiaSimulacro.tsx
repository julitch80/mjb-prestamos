import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { useAppStore } from '../../data/store';
import { PUESTOS } from '../../data/simulacros/plantillaSismo2026';
import type { JornadaId, Puesto } from '../../data/simulacros/plantillaSismo2026';
import {
  JORNADA_NOMBRE, asignacionDe, fechaLarga, formatoMinutos, horaAMinutos, nombreDeSlot,
  personasDeJornada, puestosDeJornada, requiereAviso123, resumenPendientes,
} from '../../data/simulacros/logica';
import type { EstadoSimulacro } from '../../data/simulacros/logica';
import { simulacroCambiar, useCambios } from './useSimulacro';
import type { SimulacroConId } from './useSimulacro';

const MOTIVOS = ['Lluvia', 'Orden público', 'Solicitud de rectoría', 'Cambio del simulacro nacional', 'Otro'];
const ESTADOS: { k: EstadoSimulacro; n: string; d: string }[] = [
  { k: 'borrador', n: 'Borrador', d: 'Solo lo ven los editores' },
  { k: 'publicado', n: 'Publicado', d: 'Lo ven todos los docentes' },
  { k: 'ejecutado', n: 'Ejecutado', d: 'El simulacro ya se hizo' },
  { k: 'archivado', n: 'Archivado', d: 'Ya no aparece en la lista' },
];

const J_LISTA: JornadaId[] = ['manana', 'tarde'];

interface Pendiente {
  jornada: JornadaId;
  puestoId: string;
  slot: string | null;
  porConfirmar: boolean;
  texto: string;
}

function textoCuando(c: { toDate?: () => Date } | null | undefined): string {
  try { return c?.toDate ? c.toDate().toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' }) : ''; } catch { return ''; }
}
function valor(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if ('slot' in o) return o.slot ? nombreDeSlot(String(o.slot)) : 'sin asignar';
    if ('hora' in o || 'fecha' in o) return `${o.fecha ? String(o.fecha) : ''} ${o.hora ? String(o.hora) : ''}`.trim();
    return JSON.stringify(v);
  }
  return String(v);
}

export default function PanelDiaSimulacro({ sim }: { sim: SimulacroConId }) {
  const userId = useAppStore(s => s.userId);
  const rol = useAppStore(s => s.rol);
  const cambios = useCambios(sim.id, 20);

  const esSuper = rol === 'superusuario';
  const editables = J_LISTA.filter(j => esSuper || (!!userId && (sim.editores?.[j] ?? []).includes(userId)));

  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [pendiente, setPendiente] = useState<Pendiente | null>(null);
  const [estadoNuevo, setEstadoNuevo] = useState<EstadoSimulacro | null>(null);
  const [reprog, setReprog] = useState<{ jornada: JornadaId; fecha: string; hora: string; motivo: string } | null>(null);

  // Borradores del formulario de cada jornada
  const [form, setForm] = useState<Record<JornadaId, { fecha: string; hora: string; motivo: string; otro: string }>>({
    manana: { fecha: '', hora: '', motivo: MOTIVOS[0], otro: '' },
    tarde: { fecha: '', hora: '', motivo: MOTIVOS[0], otro: '' },
  });

  // Mantiene el formulario sincronizado con los valores vivos (si nadie lo está editando a mano)
  const claveVivos = J_LISTA.map(j => `${sim.jornadas?.[j]?.fecha}|${sim.jornadas?.[j]?.hora}`).join(';');
  useEffect(() => {
    setForm(prev => {
      const n = { ...prev };
      for (const j of J_LISTA) {
        const v = sim.jornadas?.[j];
        if (v) n[j] = { ...n[j], fecha: v.fecha, hora: v.hora };
      }
      return n;
    });
  }, [claveVivos]); // eslint-disable-line react-hooks/exhaustive-deps

  if (editables.length === 0) return null;

  async function ejecutar(fn: () => Promise<string | null>, okTexto: string) {
    setOcupado(true); setMsg(null);
    const err = await fn();
    setOcupado(false);
    setMsg(err ? { ok: false, t: err } : { ok: true, t: okTexto });
    return !err;
  }

  async function confirmarReprog() {
    if (!reprog) return;
    const f = form[reprog.jornada];
    const motivo = f.motivo === 'Otro' && f.otro.trim() ? f.otro.trim() : f.motivo;
    const ok = await ejecutar(
      () => simulacroCambiar(sim.id, { accion: 'hora', jornada: reprog.jornada, hora: reprog.hora, fecha: reprog.fecha, motivo }),
      'Listo: el cronograma se recalculó para todos.',
    );
    if (ok) setReprog(null);
  }

  async function confirmarAsignacion(p: Pendiente) {
    const ok = await ejecutar(
      () => simulacroCambiar(sim.id, { accion: 'asignar', jornada: p.jornada, puestoId: p.puestoId, slot: p.slot, porConfirmar: p.porConfirmar, puestoNombre: PUESTOS.find(x => x.id === p.puestoId)?.nombre }),
      'Encargado actualizado.',
    );
    if (ok) setPendiente(null);
  }

  function pedirAsignacion(j: JornadaId, puesto: Puesto, slot: string | null, porConfirmar: boolean) {
    const actual = asignacionDe(sim.asignaciones ?? {}, puesto.id, j);
    const habiaAlguien = !!(actual?.slot || actual?.textoLibre);
    const cambiaPersona = (actual?.slot ?? null) !== slot;
    const nuevo: Pendiente = {
      jornada: j, puestoId: puesto.id, slot, porConfirmar,
      texto: `${puesto.nombre} (${JORNADA_NOMBRE[j].toLowerCase()}): ${slot ? nombreDeSlot(slot) : 'sin asignar'}${porConfirmar ? ' · por confirmar' : ''}`,
    };
    if (habiaAlguien && cambiaPersona) { setPendiente(nuevo); setMsg(null); return; }
    void confirmarAsignacion(nuevo);
  }

  const cajaInput = 'bg-elevated border border-line rounded-lg px-2 py-1.5 text-sm text-strong';

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-strong text-base font-semibold">Día del simulacro</h3>
        <p className="text-muted text-xs">
          Aquí reprogramas la hora, cambias encargados y publicas la guía. Cada cambio llega al instante a todos y queda en el registro.
        </p>
      </div>

      {/* Aviso del 123 */}
      {editables.filter(j => requiereAviso123(sim.jornadas?.[j], sim.nacional)).map(j => {
        const v = sim.jornadas?.[j];
        return (
          <div key={j} role="alert" className="rounded-xl border-2 border-danger bg-danger-soft p-3 flex flex-col gap-2">
            <p className="text-danger-soft-fg text-sm font-semibold">
              Recuerde llamar al 123 para informar el ejercicio (hora nueva: {v ? `${fechaLarga(v.fecha)}, ${formatoMinutos(horaAMinutos(v.hora))}` : ''}).
            </p>
            <p className="text-danger-soft-fg text-xs">
              Jornada de la {JORNADA_NOMBRE[j].toLowerCase()}. El simulacro nacional es el {fechaLarga(sim.nacional.fecha)} a las {formatoMinutos(horaAMinutos(sim.nacional.hora))}.
            </p>
            <button
              type="button"
              disabled={ocupado}
              onClick={() => void ejecutar(() => simulacroCambiar(sim.id, { accion: 'llamada123', jornada: j }), 'Quedó registrado que ya llamaste al 123.')}
              className="self-start px-3 py-1.5 rounded-lg bg-danger text-white text-sm font-semibold disabled:opacity-50"
            >
              Ya llamé
            </button>
          </div>
        );
      })}

      {msg && (
        <p role="status" className={cn('text-xs rounded-lg px-3 py-2', msg.ok ? 'bg-success-soft text-success-soft-fg' : 'bg-danger-soft text-danger-soft-fg')}>
          {msg.t}
        </p>
      )}

      {/* Estado */}
      <div className="rounded-xl border border-line bg-card p-3 flex flex-col gap-2">
        <h4 className="text-strong text-sm font-semibold">Estado de la guía</h4>
        <div className="flex flex-wrap gap-1.5">
          {ESTADOS.map(e => (
            <button
              key={e.k}
              type="button"
              disabled={ocupado || e.k === sim.estado}
              onClick={() => setEstadoNuevo(e.k)}
              title={e.d}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                sim.estado === e.k ? 'bg-accent-soft border-accent text-accent' : 'border-line text-soft hover:bg-elevated',
              )}
            >
              {e.n}
            </button>
          ))}
        </div>
        {estadoNuevo && (
          <div className="flex flex-wrap items-center gap-2 bg-warning-soft rounded-lg px-3 py-2">
            <span className="text-warning-soft-fg text-xs">
              ¿Pasar la guía a «{ESTADOS.find(e => e.k === estadoNuevo)?.n}»? {ESTADOS.find(e => e.k === estadoNuevo)?.d}.
            </span>
            <button
              type="button" disabled={ocupado}
              onClick={async () => { const ok = await ejecutar(() => simulacroCambiar(sim.id, { accion: 'estado', estado: estadoNuevo }), 'Estado actualizado.'); if (ok) setEstadoNuevo(null); }}
              className="px-2.5 py-1 rounded-lg bg-accent text-accent-fg text-xs font-semibold disabled:opacity-50"
            >Sí, cambiar</button>
            <button type="button" onClick={() => setEstadoNuevo(null)} className="px-2.5 py-1 rounded-lg border border-line text-soft text-xs">Cancelar</button>
          </div>
        )}
      </div>

      {editables.map(j => {
        const v = sim.jornadas?.[j];
        const f = form[j];
        const puestos = puestosDeJornada(j, PUESTOS);
        const personas = personasDeJornada(j);
        const res = resumenPendientes(sim.asignaciones ?? {}, j);
        const grupos: { titulo: string; items: Puesto[] }[] = [];
        for (const p of puestos) {
          let g = grupos.find(x => x.titulo === p.grupo);
          if (!g) { g = { titulo: p.grupo, items: [] }; grupos.push(g); }
          g.items.push(p);
        }
        const cambio = !!v && (f.fecha !== v.fecha || f.hora !== v.hora);
        return (
          <div key={j} className="rounded-xl border border-line bg-card p-3 flex flex-col gap-3">
            <h4 className="text-strong text-sm font-semibold">Jornada de la {JORNADA_NOMBRE[j].toLowerCase()}</h4>

            {/* Fecha y hora */}
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-end gap-2">
                <label className="flex flex-col gap-0.5 text-xs text-muted">
                  Fecha
                  <input type="date" className={cajaInput} value={f.fecha} onChange={e => setForm(p => ({ ...p, [j]: { ...p[j], fecha: e.target.value } }))} />
                </label>
                <label className="flex flex-col gap-0.5 text-xs text-muted">
                  Hora del timbre prolongado
                  <input type="time" className={cajaInput} value={f.hora} onChange={e => setForm(p => ({ ...p, [j]: { ...p[j], hora: e.target.value } }))} />
                </label>
                <label className="flex flex-col gap-0.5 text-xs text-muted">
                  Motivo
                  <select className={cajaInput} value={f.motivo} onChange={e => setForm(p => ({ ...p, [j]: { ...p[j], motivo: e.target.value } }))}>
                    {MOTIVOS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </label>
                {f.motivo === 'Otro' && (
                  <label className="flex flex-col gap-0.5 text-xs text-muted">
                    Cuál
                    <input type="text" className={cajaInput} value={f.otro} onChange={e => setForm(p => ({ ...p, [j]: { ...p[j], otro: e.target.value } }))} />
                  </label>
                )}
                <button
                  type="button"
                  disabled={ocupado || !cambio || !f.fecha || !f.hora}
                  onClick={() => { setMsg(null); setReprog({ jornada: j, fecha: f.fecha, hora: f.hora, motivo: f.motivo }); }}
                  className="px-3 py-1.5 rounded-lg bg-accent text-accent-fg text-sm font-semibold disabled:opacity-40"
                >
                  Reprogramar
                </button>
              </div>
              {v && <p className="text-muted text-xs">Ahora: {fechaLarga(v.fecha)}, {formatoMinutos(horaAMinutos(v.hora))}{v.motivo ? ` · motivo: ${v.motivo}` : ''}.</p>}
              {reprog?.jornada === j && (
                <div className="flex flex-wrap items-center gap-2 bg-warning-soft rounded-lg px-3 py-2">
                  <span className="text-warning-soft-fg text-xs">
                    ¿Mover la jornada de la {JORNADA_NOMBRE[j].toLowerCase()} al {fechaLarga(reprog.fecha)}, {formatoMinutos(horaAMinutos(reprog.hora))}? Todos verán las horas nuevas al instante.
                  </span>
                  <button type="button" disabled={ocupado} onClick={() => void confirmarReprog()} className="px-2.5 py-1 rounded-lg bg-accent text-accent-fg text-xs font-semibold disabled:opacity-50">Sí, reprogramar</button>
                  <button type="button" onClick={() => setReprog(null)} className="px-2.5 py-1 rounded-lg border border-line text-soft text-xs">Cancelar</button>
                </div>
              )}
            </div>

            {/* Encargados */}
            <div className="flex flex-col gap-2">
              <p className="text-soft text-xs font-medium">
                Encargados · {res.porAsignar} por asignar · {res.porConfirmar} por confirmar
              </p>
              {pendiente?.jornada === j && (
                <div className="flex flex-wrap items-center gap-2 bg-warning-soft rounded-lg px-3 py-2">
                  <span className="text-warning-soft-fg text-xs">Reasignar: {pendiente.texto}. A la persona anterior se le quita y la nueva recibe aviso.</span>
                  <button type="button" disabled={ocupado} onClick={() => void confirmarAsignacion(pendiente)} className="px-2.5 py-1 rounded-lg bg-accent text-accent-fg text-xs font-semibold disabled:opacity-50">Sí, reasignar</button>
                  <button type="button" onClick={() => setPendiente(null)} className="px-2.5 py-1 rounded-lg border border-line text-soft text-xs">Cancelar</button>
                </div>
              )}
              {grupos.map(g => (
                <details key={g.titulo} className="rounded-lg border border-line">
                  <summary className="cursor-pointer px-3 py-2 text-strong text-sm font-medium">{g.titulo}</summary>
                  <div className="flex flex-col divide-y divide-line">
                    {g.items.map(p => {
                      const a = asignacionDe(sim.asignaciones ?? {}, p.id, j);
                      const slot = a?.slot ?? '';
                      const fueraDeLista = !!slot && !personas.some(u => u.id === slot);
                      return (
                        <div key={p.id} className="px-3 py-2 flex flex-col gap-1">
                          <span className="text-soft text-xs">
                            {p.nombre}{p.detalle ? ` · ${p.detalle}` : ''}{p.opcional ? ' (opcional)' : ''}
                          </span>
                          <div className="flex flex-wrap items-center gap-2">
                            <select
                              className={cn(cajaInput, 'min-w-[12rem]')}
                              value={slot}
                              disabled={ocupado}
                              aria-label={`Encargado de ${p.nombre}`}
                              onChange={e => pedirAsignacion(j, p, e.target.value || null, !!a?.porConfirmar)}
                            >
                              <option value="">{a?.textoLibre ? `Fuera de la app: ${a.textoLibre}` : 'Sin asignar'}</option>
                              {fueraDeLista && <option value={slot}>{nombreDeSlot(slot)}</option>}
                              {personas.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
                            </select>
                            <label className="flex items-center gap-1.5 text-xs text-muted">
                              <input
                                type="checkbox"
                                checked={!!a?.porConfirmar}
                                disabled={ocupado || !slot}
                                onChange={e => void confirmarAsignacion({ jornada: j, puestoId: p.id, slot: slot || null, porConfirmar: e.target.checked, texto: '' })}
                              />
                              Por confirmar
                            </label>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </details>
              ))}
            </div>
          </div>
        );
      })}

      {/* Registro */}
      <div className="rounded-xl border border-line bg-card p-3 flex flex-col gap-2">
        <h4 className="text-strong text-sm font-semibold">Registro de cambios</h4>
        {cambios.length === 0 ? (
          <p className="text-muted text-xs">Todavía no hay cambios registrados.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {cambios.map(c => (
              <li key={c.id} className="py-1.5 text-xs text-soft">
                <span className="text-muted">{textoCuando(c.cuando)}</span>{' · '}
                <span className="text-strong font-medium">{c.porSlot ? nombreDeSlot(c.porSlot) : (c.por ?? 'Alguien')}</span>{' · '}
                {c.tipo}{c.jornada ? ` (${c.jornada})` : ''}: {valor(c.antes)} → {valor(c.despues)}
                {c.motivo ? ` · motivo: ${c.motivo}` : ''}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
