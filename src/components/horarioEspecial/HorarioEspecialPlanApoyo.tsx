import { useMemo, useState } from 'react';
import { useAppStore } from '../../data/store';
import { USUARIOS } from '../../data/maestros';
import { cn } from '../../lib/utils';
import {
  PLAN_APOYO, PLAN_APOYO_TITULO, PLAN_APOYO_FUENTE, PLAN_APOYO_DESDE, PLAN_APOYO_HASTA,
  type EntradaEspecial, type JornadaEspecial,
} from '../../data/horarioEspecial/planApoyo2026';
import {
  GRADOS_FILTRO, type GradoFiltro, hoyBogota, diaInicial, pasaFiltros, contarCoincidencias, type FiltrosEspecial,
} from '../../data/horarioEspecial/logica';

import { SESIONES_PAE_MANANA, PROPUESTA_PAE_MANANA } from '../../data/horarioEspecial/sustentacionesPAE';

type Jor = 'manana' | 'tarde';

/** Coordinación: propuesta de distribución del miércoles 25 y el jueves 26 (Plan Académico Especial). */
function PropuestaPAECoordinacion() {
  const [abierta, setAbierta] = useState<string | null>(null);
  const dia = PROPUESTA_PAE_MANANA.find(d => d.fecha === abierta);
  return (
    <section className="rounded-2xl border-2 border-accent bg-card p-4 space-y-3">
      <div>
        <h3 className="text-lg font-bold text-strong">Plan Académico Especial · sustentaciones</h3>
        <p className="text-sm text-soft">
          Con esta distribución se garantiza que los estudiantes de 11.° tengan sus dos espacios (asesoría y sustentación)
          antes del jueves. Ningún estudiante tiene dos citas a la vez y ningún docente queda citado mientras da plan de apoyo.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {PROPUESTA_PAE_MANANA.map(d => (
          <button key={d.fecha} type="button" onClick={() => setAbierta(abierta === d.fecha ? null : d.fecha)}
            aria-pressed={abierta === d.fecha}
            className={cn('min-h-[44px] px-4 rounded-lg text-sm font-semibold border',
              abierta === d.fecha ? 'bg-accent text-accent-fg border-accent' : 'border-line text-strong')}>
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
    </section>
  );
}

function SustentacionesPAE({ nombreCorto }: { nombreCorto: string }) {
  const n = nombreCorto.toLowerCase().split(' ')[0];
  const dias = [...new Set(SESIONES_PAE_MANANA.map(x => x.fecha))].sort();
  return (
    <section className="rounded-2xl border border-line bg-card p-4 space-y-3">
      <div>
        <h3 className="text-lg font-bold text-strong">Plan Académico Especial · 10.° y 11.°</h3>
        <p className="text-sm text-soft">
          Jornada de la mañana. Cada docente da una hora de <b>orientación</b> y, otro día, una hora de <b>sustentación</b>.
          Ninguna hora se cruza con otra el mismo día. Claudia no estará: a sus estudiantes de 10.° los atiende Uriel.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {dias.map(fe => {
          const del = SESIONES_PAE_MANANA.filter(x => x.fecha === fe).sort((a, b) => a.hora.localeCompare(b.hora, 'es', { numeric: true }));
          return (
            <div key={fe} className="rounded-xl border border-line p-3">
              <p className="mb-2 text-sm font-semibold text-strong">{del[0].dia}</p>
              <ul className="space-y-1">
                {del.map(x => {
                  const mio = !!n && x.docente.toLowerCase().startsWith(n);
                  return (
                    <li key={x.docente + x.tipo} className={cn('rounded-lg px-2 py-1 text-sm',
                      mio ? 'bg-accent-soft text-accent-soft-fg font-semibold' : 'text-soft')}>
                      <div className="flex justify-between gap-2">
                        <span><span className="tabular-nums">{x.hora}</span> · {x.docente}</span>
                        <span className="text-xs uppercase tracking-wide">{x.tipo === 'orientacion' ? 'Orientación' : 'Sustentación'}</span>
                      </div>
                      {x.nota && <p className="text-xs text-muted">{x.nota}</p>}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Chip({ en, f }: { en: EntradaEspecial; f: FiltrosEspecial }) {
  const filtrando = f.grado !== null || f.soloMias;
  const coincide = !filtrando || pasaFiltros(en, f);
  return (
    <div
      className={cn(
        'rounded-lg border px-2 py-1.5 text-xs leading-snug',
        coincide ? 'border-line bg-elevated/70' : 'border-line/50 bg-card opacity-30',
        filtrando && coincide && 'ring-1 ring-accent/60 bg-accent-soft',
      )}
    >
      <span className="font-bold text-strong">{en.asignatura}</span>
      {en.grados && <span className="text-strong"> {en.grados}</span>}
      {en.nota && <span className="text-muted"> {en.nota}</span>}
      {en.docentes && <div className="text-soft">{en.docentes}</div>}
    </div>
  );
}

function Celda({ entradas, f }: { entradas: EntradaEspecial[]; f: FiltrosEspecial }) {
  return (
    <div className="flex flex-col gap-1">
      {entradas.map((en, i) => <Chip key={i} en={en} f={f} />)}
    </div>
  );
}

function Matriz({ j, f }: { j: JornadaEspecial; f: FiltrosEspecial }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="w-full border-collapse text-left min-w-[720px]">
        <thead>
          <tr className="bg-elevated">
            <th className="sticky left-0 z-10 bg-elevated p-2 text-xs font-semibold text-muted w-24">Hora</th>
            {j.dias.map(d => (
              <th key={d.fecha} className="p-2 text-xs font-semibold text-strong align-bottom">{d.etiqueta}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {j.franjas.map((fr, i) => (
            <tr key={fr.id} className="border-t border-line align-top">
              <th scope="row" className="sticky left-0 z-10 bg-card p-2 text-xs font-semibold text-strong whitespace-nowrap align-top">
                {fr.etiqueta}
                <div className="font-normal text-muted">{fr.horas}</div>
              </th>
              {j.dias.map(d => (
                <td key={d.fecha} className="p-1.5 min-w-[150px]">
                  <Celda entradas={d.entradas[i] ?? []} f={f} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function VistaDia({ j, f }: { j: JornadaEspecial; f: FiltrosEspecial }) {
  const [idx, setIdx] = useState(() => diaInicial(j, hoyBogota()));
  const i = Math.min(idx, j.dias.length - 1);
  const d = j.dias[i];
  return (
    <div className="space-y-3">
      <div role="tablist" aria-label="Día" className="flex overflow-x-auto [scrollbar-width:none] border-b border-line">
        {j.dias.map((x, k) => (
          <button
            key={x.fecha}
            role="tab"
            type="button"
            aria-selected={k === i}
            onClick={() => setIdx(k)}
            className={cn(
              'min-h-[44px] px-3 whitespace-nowrap text-sm -mb-px border-b-2 transition',
              k === i ? 'border-accent text-strong font-semibold' : 'border-transparent text-soft',
            )}
          >
            {x.etiqueta}
          </button>
        ))}
      </div>
      {j.franjas.map((fr, k) => (
        <div key={fr.id} className="rounded-xl border border-line bg-card p-2.5">
          <div className="mb-1.5 text-xs font-semibold text-strong">
            {fr.etiqueta} <span className="font-normal text-muted">· {fr.horas}</span>
          </div>
          {(d.entradas[k] ?? []).length > 0 ? <Celda entradas={d.entradas[k]} f={f} /> : <div className="text-xs text-muted">Sin clase</div>}
        </div>
      ))}
    </div>
  );
}

export default function HorarioEspecialPlanApoyo() {
  const userId = useAppStore(s => s.userId) ?? '';
  const jornadaUsuario = useAppStore(s => s.jornada);
  const sedeActual = useAppStore(s => s.sedeActual);
  const usuario = USUARIOS.find(u => u.id === userId);
  const nombreCorto = usuario?.nombreCorto ?? '';
  const rol = useAppStore(s => s.rol);
  const esDirectivo = rol === 'coordinador' || rol === 'rectora' || rol === 'superusuario';

  const [jornada, setJornada] = useState<Jor>(jornadaUsuario === 'tarde' ? 'tarde' : 'manana');
  const [grado, setGrado] = useState<GradoFiltro | null>(null);
  const [soloMias, setSoloMias] = useState(false);

  const j = PLAN_APOYO[jornada];
  const f: FiltrosEspecial = { grado, soloMias, userId, nombreCorto };
  const coincidencias = useMemo(() => contarCoincidencias(j, f), [j, grado, soloMias, userId, nombreCorto]); // eslint-disable-line react-hooks/exhaustive-deps
  const sinCoincidencias = (grado !== null || soloMias) && coincidencias === 0;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-strong">{PLAN_APOYO_TITULO}</h2>
        <p className="text-sm text-soft">
          Del {fechaCorta(PLAN_APOYO_DESDE)} al {fechaCorta(PLAN_APOYO_HASTA)} · Sede central, bachillerato
        </p>
        {sedeActual !== 'central' && (
          <p className="mt-1 text-xs text-muted">Este horario es de la sede central.</p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Jornada" className="inline-flex rounded-xl border border-line overflow-hidden">
          {(['manana', 'tarde'] as Jor[]).map(k => (
            <button
              key={k}
              type="button"
              aria-pressed={jornada === k}
              onClick={() => setJornada(k)}
              className={cn(
                'min-h-[44px] px-4 text-sm transition',
                jornada === k ? 'bg-accent-soft text-accent-soft-fg font-semibold' : 'bg-card text-soft hover:bg-elevated',
              )}
            >
              {k === 'manana' ? 'Mañana' : 'Tarde'}
            </button>
          ))}
        </div>

        <label className="inline-flex items-center gap-2 text-sm text-soft">
          Grado
          <select
            value={grado ?? ''}
            onChange={e => setGrado((e.target.value || null) as GradoFiltro | null)}
            className="min-h-[44px] rounded-xl border border-line bg-card px-2 text-strong"
          >
            <option value="">Todos</option>
            {GRADOS_FILTRO.map(g => <option key={g} value={g}>{g}°</option>)}
          </select>
        </label>

        {usuario && (
          <label className="inline-flex min-h-[44px] items-center gap-2 text-sm text-soft cursor-pointer">
            <input type="checkbox" checked={soloMias} onChange={e => setSoloMias(e.target.checked)} className="h-4 w-4" />
            Solo mis clases
          </label>
        )}
      </div>

      {sinCoincidencias && (
        <p className="rounded-xl border border-line bg-elevated/60 p-3 text-sm text-soft">
          {soloMias && grado === null
            ? 'No encontramos clases a tu nombre en esta jornada. Es posible que el horario de Coordinación no liste a los docentes de este grupo de grados: revisa por grado o consulta con Coordinación.'
            : 'No hay entradas para ese filtro en esta jornada.'}
        </p>
      )}

      <div className="hidden sm:block"><Matriz j={j} f={f} /></div>
      <div className="sm:hidden"><VistaDia key={jornada} j={j} f={f} /></div>

      {jornada === 'manana' && esDirectivo && <PropuestaPAECoordinacion />}
      {jornada === 'manana' && <SustentacionesPAE nombreCorto={nombreCorto} />}

      <p className="text-xs text-muted">{PLAN_APOYO_FUENTE}</p>
    </div>
  );
}

function fechaCorta(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${d} de ${meses[m - 1]} de ${y}`;
}
