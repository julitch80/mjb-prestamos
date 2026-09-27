import { useState } from 'react';
import { cn } from '@/lib/utils';
import { AGENDA_ACTUAL } from '../data/agendaSemanal';
import type { ActividadAgenda, DiaAgenda } from '../data/agendaSemanal';
import { useAppStore } from '../data/store';
import { getReservas, crearReserva, actualizarReserva } from '../data/api';
import { RECURSOS } from '../data/maestros';
import { horarioBase } from '../data/horarioBase';
import { construirPlanReservasAgenda } from '../data/agendaReservas';
import type { OcupanteClaseRegular, PlanReservasAgenda } from '../data/agendaReservas';

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

// ── Reserva automática de espacios al publicar la agenda ─────────────────────
// Ver src/data/agendaReservas.ts para la lógica pura (parseo de lugar/hora,
// choques, idempotencia). Aquí solo se arma la ocupación de clase regular
// (horarioBase no tiene fecha, solo día de la semana — se cruza con las
// fechas concretas de esta agenda) y se ejecuta el plan contra el backend.

function ocupantesClaseRegularDeAgenda(agenda: typeof AGENDA_ACTUAL): OcupanteClaseRegular[] {
  const ocupantes: OcupanteClaseRegular[] = [];
  for (const dia of agenda.dias) {
    for (const recurso of RECURSOS) {
      if (recurso.tipo === 'equipo') continue;
      const nombreAula = recurso.nombreHorario ?? recurso.nombre;
      for (const entrada of horarioBase) {
        if (entrada.aula !== nombreAula || entrada.dia !== dia.dia) continue;
        ocupantes.push({
          recursoId: recurso.id,
          fecha: dia.fecha,
          bloque: entrada.bloque,
          descripcion: `${entrada.docente} · Grado ${entrada.grado}`,
        });
      }
    }
  }
  return ocupantes;
}

function ResumenPublicacion({ plan, creadas, liberadas, onCerrar }: {
  plan: PlanReservasAgenda; creadas: number; liberadas: number; onCerrar: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 dark:bg-black/75 p-4">
      <div className="w-full max-w-lg bg-card rounded-2xl p-6 border border-line shadow-2xl max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-strong font-semibold">Reserva automática de la agenda</h3>
          <button onClick={onCerrar} className="text-muted hover:text-strong text-xl transition">✕</button>
        </div>
        <p className="text-sm text-soft mb-4">
          {creadas} espacio{creadas === 1 ? '' : 's'} reservado{creadas === 1 ? '' : 's'} · {plan.choques.length} choque{plan.choques.length === 1 ? '' : 's'} · {plan.noReconocidos.length} lugar{plan.noReconocidos.length === 1 ? '' : 'es'} no reconocido{plan.noReconocidos.length === 1 ? '' : 's'}
          {liberadas > 0 && <> · {liberadas} reserva{liberadas === 1 ? '' : 's'} anterior{liberadas === 1 ? '' : 'es'} liberada{liberadas === 1 ? '' : 's'}</>}
        </p>

        {plan.choques.length > 0 && (
          <div className="mb-4">
            <h4 className="text-xs font-semibold text-danger mb-2">Choques — decide a mano</h4>
            <ul className="flex flex-col gap-1.5 text-xs text-soft">
              {plan.choques.map((c, i) => (
                <li key={i} className="rounded-lg bg-danger-soft border border-line px-3 py-2">
                  <strong>{c.recursoNombre}</strong>, {DIAS_LABEL[c.dia] ?? c.dia} bloque {c.bloque}: ya {c.ocupante} — actividad «{c.actividad}»
                </li>
              ))}
            </ul>
          </div>
        )}

        {plan.noReconocidos.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-muted mb-2">No se reservó: lugar no reconocido</h4>
            <ul className="flex flex-col gap-1.5 text-xs text-soft">
              {plan.noReconocidos.map((n, i) => (
                <li key={i} className="rounded-lg bg-elevated border border-line px-3 py-2">
                  «{n.lugar}» — {DIAS_LABEL[n.dia] ?? n.dia}, «{n.actividad}»
                </li>
              ))}
            </ul>
          </div>
        )}

        <button
          onClick={onCerrar}
          className="mt-5 w-full py-2.5 rounded-lg bg-elevated text-soft hover:bg-hover text-sm transition"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function AgendaSemanal() {
  const [vista, setVista] = useState<'semana' | 'dia'>('semana');
  const [diaSel, setDiaSel] = useState<string>(() => hoyEnSemana() ?? AGENDA_ACTUAL.dias[0]?.dia ?? 'lunes');
  const { userId, rol } = useAppStore();
  const [publicando, setPublicando] = useState(false);
  const [errorPublicar, setErrorPublicar] = useState('');
  const [resultado, setResultado] = useState<{ plan: PlanReservasAgenda; creadas: number; liberadas: number } | null>(null);

  const agenda = AGENDA_ACTUAL;
  const diaActivo = agenda.dias.find(d => d.dia === diaSel) ?? agenda.dias[0];
  const puedePublicar = rol === 'coordinador' || rol === 'rectora';

  async function handlePublicar() {
    if (!userId) return;
    setPublicando(true);
    setErrorPublicar('');
    try {
      const reservasExistentes = await getReservas();
      const ocupantesClaseRegular = ocupantesClaseRegularDeAgenda(agenda);
      const plan = construirPlanReservasAgenda(agenda, { reservasExistentes, ocupantesClaseRegular });

      let creadas = 0;
      for (const item of plan.crear) {
        const res = await crearReserva({
          recurso: item.recurso,
          fecha: item.fecha,
          bloque: item.bloque,
          solicitante: userId,
          proposito: 'Agenda institucional',
          motivo: item.motivo,
          estado: 'aprobada',
        });
        if (res.ok) creadas++;
      }

      let liberadas = 0;
      for (const item of plan.liberar) {
        const res = await actualizarReserva(item.reservaId, 'cancelada', item.motivo);
        if (res.ok) liberadas++;
      }

      setResultado({ plan, creadas, liberadas });
    } catch {
      setErrorPublicar('No se pudo completar la reserva automática. Intenta de nuevo.');
    } finally {
      setPublicando(false);
    }
  }

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

      {puedePublicar && (
        <div className="flex flex-col gap-1.5">
          <button
            onClick={handlePublicar}
            disabled={publicando}
            className="self-start px-4 py-2 rounded-lg bg-accent text-white text-xs font-medium hover:opacity-90 disabled:opacity-50 transition"
          >
            {publicando ? 'Reservando espacios...' : 'Publicar y reservar espacios'}
          </button>
          {errorPublicar && <p className="text-danger text-xs">{errorPublicar}</p>}
        </div>
      )}

      {resultado && (
        <ResumenPublicacion
          plan={resultado.plan}
          creadas={resultado.creadas}
          liberadas={resultado.liberadas}
          onCerrar={() => setResultado(null)}
        />
      )}

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
