// «Sustentaciones finales» del plan de apoyo (24-nov al 1-dic 2026) en la agenda pública del PAE.
// Solo para estudiantes de la jornada de la mañana (10.° y 11.°). Va arriba, grande y resaltado.
import { SESIONES_PAE_MANANA, type SesionPAE } from '../../data/horarioEspecial/sustentacionesPAE';
import type { PlanPublico } from '../../data/planCasa/tipos';
import { asignacionDeGrupo } from '../../data/asignacionAcademica';

/** Nombre en el horario de sustentaciones → id del docente en la asignación académica. */
const ID_DOCENTE: Record<string, string> = {
  'Juan Carlos Blandón': 'yoguis', Margarita: 'margara', Doris: 'doris', Jorge: 'jorge', 'Julián Medina': 'julian',
  'Gloria Álvarez': 'gloria_a', Adolfo: 'adolfo', 'Carlos Cárdenas': 'carlos', Ledis: 'ledis', Johana: 'johana',
  Uriel: 'uriel', Beatriz: 'beatriz',
};

const FIN = '2026-12-01';
const sinTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Mañana = notación con punto (10.1, 11.2); la tarde usa «º». */
export function esPAEManana(grupo: string): boolean {
  return !grupo.includes('º') && /^1[01]\b|^1[01]\./.test(grupo.trim());
}

function Cita({ s, hoy }: { s: SesionPAE; hoy: string }) {
  const sust = s.tipo === 'sustentacion';
  const esHoy = s.fecha === hoy;
  return (
    <li className={`rounded-xl border-2 p-3 ${sust ? 'border-rose-500 bg-rose-500/15' : 'border-sky-500 bg-sky-500/10'} ${esHoy ? 'ring-4 ring-amber-400' : ''}`}>
      <p className={`text-xs font-bold uppercase tracking-wide ${sust ? 'text-rose-400' : 'text-sky-400'}`}>
        {sust ? '🎤 Sustentación' : '📘 Orientación'}{esHoy ? ' · ¡HOY!' : ''}
      </p>
      <p className="text-lg font-bold text-strong leading-tight">{s.dia} · {s.hora}</p>
      <p className="text-base text-strong">Profesor(a): {s.docente}</p>
      {s.nota && s.nota !== 'Ese día no tiene refuerzo' && <p className="text-xs text-soft">{s.nota}</p>}
    </li>
  );
}

export function HorarioPlanApoyoPAE({ plan, hoy }: { plan: PlanPublico; hoy: string }) {
  if (!esPAEManana(plan.grupo) || hoy > FIN) return null;
  const once = plan.grupo.trim().startsWith('11');
  // Los de 11.° terminan todo entre el 24 y el 26 de noviembre (se gradúan).
  const todas = SESIONES_PAE_MANANA.filter(s => (!once || s.fecha <= '2026-11-26') && s.fecha >= hoy)
    .sort((a, b) => (a.fecha + a.hora.padStart(13, '0')).localeCompare(b.fecha + b.hora.padStart(13, '0')));
  // Docentes del plan (primer nombre) para mostrar solo SUS citas; Uriel atiende a los de Claudia.
  const mios = new Set([...plan.pasos.map(p => p.docente), ...plan.sustentaciones.map(s => s.docente)]
    .map(d => sinTildes(String(d ?? '')).split(/\s+/)[0]).filter(Boolean));
  // La sustentación es con CADA profesor del grupo: se toman todos los docentes de su asignación académica.
  const delGrupo = new Set(asignacionDeGrupo(plan.grupo.trim()).map(e => e.docenteId));
  const esMia = (doc: string) => delGrupo.has(ID_DOCENTE[doc] ?? '') || mios.has(sinTildes(doc).split(/\s+/)[0])
    || (doc === 'Uriel' && (mios.has('claudia') || delGrupo.has('claudia')));
  const mias = todas.filter(s => esMia(s.docente));
  const lista = mias.length ? mias : todas;
  if (!lista.length) return null;
  return (
    <section className="rounded-2xl border-4 border-rose-500 bg-rose-500/10 p-4 space-y-3 shadow-lg">
      <div>
        <h2 className="text-2xl font-extrabold text-strong leading-tight">🎤 SUSTENTACIONES FINALES</h2>
        <p className="text-sm text-soft mt-1">
          Plan de apoyo · {once ? '24 al 26 de noviembre (grado 11.°)' : '24 de noviembre al 1 de diciembre'}. Ve a la <b>orientación</b> y luego a la <b>sustentación</b> de cada profesor, en el colegio.
        </p>
      </div>
      <ul className="space-y-2">{lista.map((s, i) => <Cita key={i} s={s} hoy={hoy} />)}</ul>
      {!mias.length && <p className="text-xs text-soft">Asiste a las de tus profesores.</p>}
    </section>
  );
}
