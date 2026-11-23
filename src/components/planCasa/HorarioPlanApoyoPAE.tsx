// Horario de orientación y sustentación del plan de apoyo (24-nov al 1-dic 2026), en la agenda
// pública del PAE. Solo para estudiantes de la jornada de la mañana (10.° y 11.°).
import { SESIONES_PAE_MANANA } from '../../data/horarioEspecial/sustentacionesPAE';
import type { PlanPublico } from '../../data/planCasa/tipos';

const FIN = '2026-12-01';
const sinTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Mañana = notación con punto (10.1, 11.2); la tarde usa «º». */
export function esPAEManana(grupo: string): boolean {
  return !grupo.includes('º') && /^1[01]\b|^1[01]\./.test(grupo.trim());
}

export function HorarioPlanApoyoPAE({ plan, hoy }: { plan: PlanPublico; hoy: string }) {
  if (!esPAEManana(plan.grupo) || hoy > FIN) return null;
  const once = plan.grupo.trim().startsWith('11');
  // Los de 11.° terminan todo entre el 24 y el 26 de noviembre (se gradúan).
  const sesiones = SESIONES_PAE_MANANA.filter(s => !once || s.fecha <= '2026-11-26');
  // Docentes del plan (primer nombre), para resaltar las citas que le tocan.
  const mios = new Set([...plan.pasos.map(p => p.docente), ...plan.sustentaciones.map(s => s.docente)]
    .map(d => sinTildes(String(d ?? '')).split(/\s+/)[0]).filter(Boolean));
  const esMia = (doc: string) => mios.has(sinTildes(doc).split(/\s+/)[0]) || (doc === 'Uriel' && mios.has('claudia'));
  const dias = [...new Set(sesiones.map(s => s.fecha))].sort();
  return (
    <section className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 space-y-2">
      <h2 className="text-base font-bold text-strong">📅 Plan de apoyo: orientación y sustentación</h2>
      <p className="text-sm text-soft">Cada profesor da 1 hora de <b>orientación</b> y 1 de <b>sustentación</b>. Asiste a las de tus profesores{mios.size ? ' (resaltadas)' : ''}.{once ? ' Grado 11.°: todo se termina entre el 24 y el 26 de noviembre.' : ''}</p>
      {dias.map(f => (
        <div key={f}>
          <p className="text-sm font-semibold text-strong mt-1">{sesiones.find(s => s.fecha === f)?.dia}</p>
          <ul className="space-y-1">
            {sesiones.filter(s => s.fecha === f).sort((a, b) => a.hora.localeCompare(b.hora, 'es', { numeric: true })).map((s, i) => (
              <li key={i} className={`text-sm rounded-lg px-2 py-1 ${esMia(s.docente) ? 'bg-amber-500/25 font-semibold text-strong' : 'text-soft'}`}>
                {s.hora} · {s.tipo === 'orientacion' ? 'Orientación' : 'Sustentación'} · {s.docente}{s.nota && s.nota !== 'Ese día no tiene refuerzo' ? ` — ${s.nota}` : ''}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
