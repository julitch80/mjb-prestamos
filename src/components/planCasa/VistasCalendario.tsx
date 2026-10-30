// Vistas de calendario (Día · Semana · Mes) de la agenda pública del plan en casa.
// La lógica de fechas vive en data/planCasa/calendarioAgenda.ts (con pruebas).
import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  aFecha, cuadriculaMes, enRango, hayMesAnterior, hayMesSiguiente, limitarMes, primeroDeMes, semanaDe, sumarDias, sumarMeses,
} from '../../data/planCasa/calendarioAgenda';
import type { FechaISO, PlanPublico } from '../../data/planCasa/tipos';

type Paso = PlanPublico['pasos'][number];
type Sust = PlanPublico['sustentaciones'][number];
type Agrupado<T> = Record<FechaISO, T[]>;
export type Vista = 'dia' | 'semana' | 'mes';

const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const DIAS_LARGO = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MESES_LARGO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const fechaLinda = (f: FechaISO) => { const d = aFecha(f); return `${DIAS_LARGO[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`; };
const fechaCorta = (f: FechaISO) => `${aFecha(f).getDate()} ${MESES[aFecha(f).getMonth()]}`;

/** Color estable por asignatura (tono distinto, legible en claro y oscuro). */
export function colorAsignatura(i: number): { fondo: string; borde: string } {
  const h = (i * 67 + 210) % 360;
  return { fondo: `hsl(${h} 70% 50% / 0.16)`, borde: `hsl(${h} 65% 50%)` };
}

const botonNav = 'min-h-[44px] min-w-[44px] rounded-xl border border-line bg-card text-soft disabled:opacity-30 flex items-center justify-center';

export function SelectorVista({ vista, setVista }: { vista: Vista; setVista: (v: Vista) => void }) {
  const op: { id: Vista; texto: string }[] = [{ id: 'dia', texto: 'Día' }, { id: 'semana', texto: 'Semana' }, { id: 'mes', texto: 'Mes' }];
  return (
    <div role="group" aria-label="Vista del calendario" className="grid grid-cols-3 rounded-xl border border-line bg-card p-1 gap-1">
      {op.map(o => (
        <button key={o.id} onClick={() => setVista(o.id)} aria-pressed={vista === o.id}
          className={`min-h-[44px] rounded-lg text-base font-semibold ${vista === o.id ? 'bg-accent text-accent-fg' : 'text-soft'}`}>
          {o.texto}
        </button>
      ))}
    </div>
  );
}

export function VistaSemana({ plan, hoy, dia, setDia, porDia, sustPorDia, color, irADia }: {
  plan: PlanPublico; hoy: FechaISO; dia: FechaISO; setDia: (f: FechaISO) => void;
  porDia: Agrupado<Paso>; sustPorDia: Agrupado<Sust>;
  color: (a: string) => { fondo: string; borde: string }; irADia: (f: FechaISO) => void;
}) {
  const dias = semanaDe(dia);
  const lunes = dias[0], domingo = dias[6];
  const mover = (n: number) => setDia(sumarDias(dia, n * 7));
  return (
    <section aria-label="Vista de la semana" className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <button onClick={() => mover(-1)} disabled={lunes <= plan.desde} aria-label="Semana anterior" className={botonNav}><ChevronLeft size={20} /></button>
        <p className="text-base font-semibold text-strong text-center">{fechaCorta(lunes)} – {fechaCorta(domingo)}</p>
        <button onClick={() => mover(1)} disabled={domingo >= plan.hasta} aria-label="Semana siguiente" className={botonNav}><ChevronRight size={20} /></button>
      </div>
      <ul className="grid grid-cols-1 sm:grid-cols-7 gap-1.5">
        {dias.map(f => {
          const pasos = porDia[f] ?? [];
          const sust = sustPorDia[f] ?? [];
          const esHoy = f === hoy;
          const fuera = !enRango(f, plan.desde, plan.hasta);
          return (
            <li key={f} className="min-w-0">
              <button onClick={() => irADia(f)} aria-label={`${fechaLinda(f)}: ${pasos.length} pasos`}
                className={`w-full h-full text-left rounded-xl border p-2 space-y-1 sm:min-h-[140px] ${esHoy ? 'border-accent ring-2 ring-accent' : 'border-line'} ${fuera ? 'opacity-60' : 'bg-card'}`}>
                <div className="flex sm:block items-baseline gap-2">
                  <span className="text-xs uppercase text-muted">{DIAS[aFecha(f).getDay()]}</span>
                  <span className={`text-base font-bold ${esHoy ? 'text-accent' : 'text-strong'}`}>{aFecha(f).getDate()}</span>
                  {esHoy && <span className="text-[10px] font-semibold text-accent"> hoy</span>}
                </div>
                {pasos.length === 0 && sust.length === 0 && <p className="text-xs text-muted">·</p>}
                {pasos.map(p => {
                  const c = color(p.asignatura);
                  return (
                    <div key={`${p.asignatura}-${p.id}`} style={{ background: c.fondo, borderLeft: `3px solid ${c.borde}` }}
                      className={`rounded-md px-1.5 py-1 text-xs leading-tight text-strong break-words ${p.esEntregaParcial ? 'font-bold outline outline-1 outline-accent' : ''}`}>
                      {p.esEntregaParcial && <span aria-label="Entrega">★ </span>}
                      {p.entregadoEn && <span aria-label="Entregado">✓ </span>}
                      <span className="text-muted">{p.asignatura.length > 14 ? p.asignatura.slice(0, 12) + '…' : p.asignatura}</span>
                      <span className="block">{p.titulo}</span>
                    </div>
                  );
                })}
                {sust.map((s, i) => (
                  <div key={i} className="rounded-md px-1.5 py-1 text-xs leading-tight font-semibold bg-accent text-accent-fg">🎤 Sustentación · {s.asignatura}</div>
                ))}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted">★ entrega · ✓ ya entregado · toca un día para ver sus pasos.</p>
    </section>
  );
}

export function VistaMes({ plan, hoy, dia, porDia, sustPorDia, irADia }: {
  plan: PlanPublico; hoy: FechaISO; dia: FechaISO;
  porDia: Agrupado<Paso>; sustPorDia: Agrupado<Sust>; irADia: (f: FechaISO) => void;
}) {
  const [mes, setMes] = useState<FechaISO>(() => limitarMes(primeroDeMes(dia), plan.desde, plan.hasta));
  const celdas = cuadriculaMes(mes);
  const m = aFecha(mes);
  return (
    <section aria-label="Vista del mes" className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <button onClick={() => setMes(sumarMeses(mes, -1))} disabled={!hayMesAnterior(mes, plan.desde)} aria-label="Mes anterior" className={botonNav}><ChevronLeft size={20} /></button>
        <p className="text-base font-semibold text-strong capitalize">{MESES_LARGO[m.getMonth()]} {m.getFullYear()}</p>
        <button onClick={() => setMes(sumarMeses(mes, 1))} disabled={!hayMesSiguiente(mes, plan.hasta)} aria-label="Mes siguiente" className={botonNav}><ChevronRight size={20} /></button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs uppercase text-muted">
        {['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'].map(d => <div key={d}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {celdas.map(c => {
          const pasos = porDia[c.fecha] ?? [];
          const sust = (sustPorDia[c.fecha] ?? []).length > 0;
          const entrega = pasos.some(p => p.esEntregaParcial);
          const enPlan = enRango(c.fecha, plan.desde, plan.hasta);
          const esHoy = c.fecha === hoy;
          return (
            <button key={c.fecha} onClick={() => irADia(c.fecha)}
              aria-label={`${fechaLinda(c.fecha)}: ${pasos.length} pasos${entrega ? ', hay entrega' : ''}${sust ? ', sustentación' : ''}`}
              className={`min-w-0 min-h-[52px] rounded-lg border p-1 flex flex-col items-center justify-between text-sm
                ${enPlan ? 'bg-elevated border-line' : 'border-transparent'} ${c.delMes ? 'text-strong' : 'text-muted opacity-50'}
                ${esHoy ? 'ring-2 ring-accent' : ''}`}>
              <span className={`font-semibold ${esHoy ? 'text-accent' : ''}`}>{aFecha(c.fecha).getDate()}</span>
              <span className="flex items-center gap-0.5 h-4 text-[10px] leading-none">
                {pasos.length > 0 && <span className="px-1 rounded-full bg-accent/25 text-strong font-semibold">{pasos.length}</span>}
                {entrega && <span aria-hidden className="text-accent">★</span>}
                {sust && <span aria-hidden>🎤</span>}
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted">El número es la cantidad de pasos · ★ entrega · 🎤 sustentación · el fondo marcado es el plan. Toca un día para abrirlo.</p>
    </section>
  );
}
