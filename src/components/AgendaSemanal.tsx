import { useState } from 'react';
import { cn } from '@/lib/utils';
import { AGENDA_ACTUAL } from '../data/agendaSemanal';
import type { ActividadAgenda, DiaAgenda } from '../data/agendaSemanal';

const DIAS_LABEL: Record<string, string> = {
  lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles', jueves: 'Jueves', viernes: 'Viernes',
};
const DIAS_CORTO: Record<string, string> = {
  lunes: 'Lu', martes: 'Ma', miercoles: 'Mi', jueves: 'Ju', viernes: 'Vi',
};

function formatearFecha(fecha: string): string {
  const [y, m, d] = fecha.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString('es-CO', { day: 'numeric', month: 'long' });
}

function hoyEnSemana(): string | null {
  const hoy = new Date();
  const iso = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
  const dia = AGENDA_ACTUAL.dias.find(d => d.fecha === iso);
  return dia ? dia.dia : null;
}

// ── Tarjeta de actividad ─────────────────────────────────────────────────────

function TarjetaActividad({ act }: { act: ActividadAgenda }) {
  return (
    <div className="rounded-xl border border-line bg-card px-4 py-3 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-3">
        <span className="text-strong text-sm font-medium leading-snug">{act.actividad}</span>
        <span className="flex-shrink-0 text-[11px] font-semibold px-2 py-1 rounded-lg bg-accent-soft text-accent whitespace-nowrap">
          {act.hora || 'Durante la jornada'}
        </span>
      </div>
      {(act.asisten || act.lugar || act.responsables) && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
          {act.asisten && <span>👥 {act.asisten}</span>}
          {act.lugar && <span>📍 {act.lugar}</span>}
          {act.responsables && <span>🧭 {act.responsables}</span>}
        </div>
      )}
    </div>
  );
}

// ── Bloque de un día (festivo / notas / actividades) ─────────────────────────

function BloqueDia({ dia, mostrarTitulo }: { dia: DiaAgenda; mostrarTitulo?: boolean }) {
  return (
    <div className="flex flex-col gap-2.5">
      {mostrarTitulo && (
        <div className="flex items-baseline gap-2">
          <h3 className="text-strong text-sm font-semibold">{DIAS_LABEL[dia.dia]}</h3>
          <span className="text-muted text-xs">{formatearFecha(dia.fecha)}</span>
        </div>
      )}
      {dia.festivo && (
        <div className="rounded-xl bg-warning-soft border border-line px-4 py-3 flex items-center gap-2">
          <span className="text-lg">🎉</span>
          <span className="text-sm font-medium text-strong">Día festivo — {dia.festivo}</span>
        </div>
      )}
      {dia.notas?.map((n, i) => (
        <div key={i} className="rounded-xl bg-info-soft border border-line px-4 py-2.5 text-xs text-soft leading-relaxed">
          ℹ️ {n}
        </div>
      ))}
      {dia.actividades.length > 0 && (
        <div className="flex flex-col gap-2">
          {dia.actividades.map((a, i) => <TarjetaActividad key={i} act={a} />)}
        </div>
      )}
      {!dia.festivo && dia.actividades.length === 0 && (
        <p className="text-xs text-muted italic px-1">Sin actividades registradas.</p>
      )}
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function AgendaSemanal() {
  const [vista, setVista] = useState<'semana' | 'dia'>('semana');
  const [diaSel, setDiaSel] = useState<string>(() => hoyEnSemana() ?? AGENDA_ACTUAL.dias[0]?.dia ?? 'lunes');

  const agenda = AGENDA_ACTUAL;
  const diaActivo = agenda.dias.find(d => d.dia === diaSel) ?? agenda.dias[0];

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-5">

      {/* Encabezado */}
      <div className="flex flex-col gap-1">
        <h2 className="text-strong text-lg font-semibold">
          Agenda — Semana {agenda.semana} · {agenda.periodo}.º periodo
        </h2>
        <p className="text-muted text-xs">
          {formatearFecha(agenda.desde)} – {formatearFecha(agenda.hasta)} · {agenda.publicadaPor}
        </p>
      </div>

      {/* Toggle Semana/Día */}
      <div className="flex items-center gap-1.5 p-1 rounded-xl bg-elevated border border-line w-fit">
        {(['semana', 'dia'] as const).map(v => (
          <button
            key={v}
            onClick={() => setVista(v)}
            className={cn(
              'px-4 py-1.5 rounded-lg text-xs font-medium transition-all',
              vista === v ? 'bg-hover border border-line-strong text-strong' : 'text-muted hover:text-soft'
            )}
          >
            {v === 'semana' ? 'Semana' : 'Día'}
          </button>
        ))}
      </div>

      {vista === 'dia' && (
        <>
          {/* Selector Lu–Vi */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {agenda.dias.map(d => (
              <button
                key={d.dia}
                onClick={() => setDiaSel(d.dia)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                  diaSel === d.dia
                    ? 'bg-accent-soft border-accent text-accent'
                    : 'border-line text-muted hover:text-soft hover:bg-elevated'
                )}
              >
                {DIAS_CORTO[d.dia]}
              </button>
            ))}
          </div>

          {diaActivo && <BloqueDia dia={diaActivo} />}
        </>
      )}

      {vista === 'semana' && (
        <div className="flex flex-col gap-6">
          {agenda.dias.map(d => <BloqueDia key={d.dia} dia={d} mostrarTitulo />)}
        </div>
      )}

      {agenda.notaFinal && (
        <p className="text-[11px] text-muted italic border-t border-line pt-3 mt-1">
          {agenda.notaFinal}
        </p>
      )}
    </div>
  );
}
