// Mensaje y avance del plan de apoyo (24-nov al 1-dic 2026) en la agenda pública del PAE.
// Solo para estudiantes de la jornada de la mañana (10.° y 11.°). Va arriba y resaltado.
// La lista es SOLO LECTURA: refleja lo que marcan los docentes (copia pública, sin observaciones).
import type { PlanPublico } from '../../data/planCasa/tipos';
import { docentesDelPlanPAE, esPAEManana, nombreDocente } from '../../data/planCasa/sustentacionesPAE';

export { esPAEManana };

const FIN = '2026-12-01';
const VAL: Record<string, string> = { aprobo: 'Aprobó', no_aprobo: 'No aprobó' };

export function HorarioPlanApoyoPAE({ plan, hoy }: { plan: PlanPublico; hoy: string }) {
  if (!esPAEManana(plan.grupo) || hoy > FIN) return null;
  // Primero los que ya hicieron o empezaron algo; después los pendientes.
  const empezo = (d: string) => { const m = plan.sustentacionesPAE?.[d]; return !!(m?.asesoria || m?.sustentacion || m?.valoracion); };
  const docentes = docentesDelPlanPAE({ grupo: plan.grupo.trim(), sustentacionesPAE: plan.sustentacionesPAE }).sort((a, b) => Number(empezo(b)) - Number(empezo(a)));
  return (
    <section className="rounded-2xl border-4 border-rose-500 bg-rose-500/10 p-4 shadow-lg space-y-3">
      <div>
        <h2 className="text-2xl font-extrabold text-strong leading-tight">🎤 SUSTENTACIONES</h2>
        <p className="text-lg font-semibold text-strong mt-2">
          Preséntate a las 6:00 a. m. Las sustentaciones se distribuyen según la disponibilidad de los docentes; las organiza la coordinación.
        </p>
      </div>
      {docentes.length > 0 && (
        <ul className="space-y-1.5" aria-label="Avance por docente">
          {docentes.map(d => {
            const m = plan.sustentacionesPAE?.[d];
            const est = (ok: boolean | undefined) => (ok ? '✓ Listo' : 'Pendiente');
            return (
              <li key={d} className="rounded-xl bg-card/80 border border-line px-3 py-2 text-sm">
                <p className="font-bold text-strong">{nombreDocente(d)}</p>
                <p className="text-soft">
                  Asesoría: <b className={m?.asesoria ? 'text-success' : 'text-strong'}>{est(m?.asesoria)}</b>
                  {' · '}Sustentación: <b className={m?.sustentacion ? 'text-success' : 'text-strong'}>{est(m?.sustentacion)}</b>
                  {m?.valoracion && <>{' · '}<b className={m.valoracion === 'aprobo' ? 'text-success' : 'text-warning'}>{VAL[m.valoracion]}</b></>}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
