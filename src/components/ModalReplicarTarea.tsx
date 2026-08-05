// Replicar una tarea a los otros grupos donde el docente dicta la MISMA asignatura.
//
// Nunca crea nada a ciegas: primero calcula el plan de cada grupo y lo muestra,
// porque el cupo se cuenta por grupo y una réplica puede rebotar aunque la
// original fuera válida. Si se crearan en silencio, las que rebotan se perderían
// sin que el docente se entere — peor que crearlas a mano.
import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { X } from 'lucide-react';
import { crearTarea } from '../data/api';
import { fechaLegible } from '../data/tareas/motor';
import { planificarReplicas, tareaDesdePlan } from '../data/tareas/replicar';
import { diasDeClase, gruposAsignables } from '../data/tareas/horario';
import type { Cesion, ContextoValidacion, Tarea } from '../data/tareas/tipos';

export default function ModalReplicarTarea({
  original,
  tareas,
  cesiones,
  cuposOverride,
  hoy,
  onClose,
  onCreadas,
}: {
  original: Tarea;
  tareas: Tarea[];
  cesiones: Cesion[];
  cuposOverride: Record<string, number>;
  hoy: string;
  onClose: () => void;
  onCreadas: () => void;
}) {
  // Solo los grupos donde dicta ESTA misma asignatura: replicar un taller de
  // física al grupo donde dicta química no tendría ningún sentido.
  const destinos = useMemo(
    () =>
      gruposAsignables(original.docenteId)
        .filter((g) => g.grupo !== original.grupo && g.asignaturaIds.includes(original.asignaturaId))
        .map((g) => g.grupo),
    [original],
  );

  const planes = useMemo(
    () =>
      planificarReplicas(original, destinos, (grupo): ContextoValidacion => ({
        hoy,
        tareas: tareas.filter((t) => t.grupo === grupo),
        cesiones: cesiones.filter((c) => c.grupo === grupo),
        diasClase: diasDeClase(original.docenteId, grupo),
        cuposOverride,
      })),
    [original, destinos, tareas, cesiones, cuposOverride, hoy],
  );

  const viables = planes.filter((p) => p.viable);
  const [elegidos, setElegidos] = useState<string[]>(() => viables.map((p) => p.grupo));
  const [guardando, setGuardando] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);

  function alternar(grupo: string) {
    setElegidos((prev) =>
      prev.includes(grupo) ? prev.filter((g) => g !== grupo) : [...prev, grupo],
    );
  }

  async function replicar() {
    setGuardando(true);
    let creadas = 0;
    const fallidas: string[] = [];
    for (const plan of viables.filter((p) => elegidos.includes(p.grupo))) {
      const nueva = tareaDesdePlan(original, plan);
      if (!nueva) continue;
      const r = await crearTarea(nueva);
      if (r.ok) creadas++;
      else fallidas.push(plan.grupo);
    }
    setGuardando(false);
    setResultado(
      fallidas.length === 0
        ? `Listo: ${creadas} grupo(s) más con esta tarea.`
        : `Se crearon ${creadas}. No se pudo en: ${fallidas.join(', ')}.`,
    );
    if (creadas > 0) onCreadas();
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center overflow-y-auto p-4"
      onClick={onClose}
    >
      <div
        className="rounded-2xl border border-line bg-card p-4 max-w-md w-full my-8 space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-strong text-sm">Replicar a otros grupos</h3>
            <p className="text-[11px] text-muted truncate">
              {original.titulo} · desde {original.grupo}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted hover:text-strong hover:bg-elevated"
          >
            <X size={16} />
          </button>
        </div>

        {destinos.length === 0 ? (
          <p className="text-xs text-muted">
            No dicta esta asignatura en ningún otro grupo, así que no hay a dónde replicarla.
          </p>
        ) : (
          <>
            <p className="text-[11px] text-muted leading-snug">
              Cada grupo recibe la tarea en su próxima clase con usted y conserva los mismos días
              de trabajo. La entrega también cae en una clase, para que pueda recibirla en persona.
            </p>

            <div className="space-y-1.5">
              {planes.map((p) => (
                <label
                  key={p.grupo}
                  className={
                    'flex items-start gap-2.5 rounded-xl border px-3 py-2 text-sm ' +
                    (p.viable
                      ? 'border-line bg-elevated/40 cursor-pointer'
                      : 'border-warning bg-warning-soft')
                  }
                >
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    disabled={!p.viable || guardando || !!resultado}
                    checked={elegidos.includes(p.grupo)}
                    onChange={() => alternar(p.grupo)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-strong font-semibold text-xs">{p.grupo}</div>
                    {p.viable ? (
                      <div className="text-[11px] text-muted">
                        Se asigna el {fechaLegible(p.fechaAsignacion!)} · entrega{' '}
                        {fechaLegible(p.fechaEntrega!)}
                      </div>
                    ) : (
                      <div className="text-[11px] text-warning-soft-fg leading-snug">{p.motivo}</div>
                    )}
                  </div>
                </label>
              ))}
            </div>

            {resultado ? (
              <p className="text-xs text-success-soft-fg">{resultado}</p>
            ) : (
              <button
                onClick={replicar}
                disabled={elegidos.length === 0 || guardando}
                className="w-full rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-strong transition hover:opacity-90 disabled:opacity-40"
              >
                {guardando
                  ? 'Creando…'
                  : `Replicar a ${elegidos.length} grupo${elegidos.length === 1 ? '' : 's'}`}
              </button>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}
