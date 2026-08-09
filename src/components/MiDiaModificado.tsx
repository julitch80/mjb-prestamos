// "Mi día": vista compacta del día efectivo de UN docente concreto cuando su
// horario tuvo cambios (ausencia propia, clase movida/cancelada, taller que
// supervisa). Se abre desde el banner "Tu horario cambió hoy" (PanelInicio)
// y desde una notificación tipo horario_modificado con el sufijo parseable
// (BannerNotificaciones). Reutiliza el mismo lenguaje visual de
// ModalDiaModificado.tsx vía celdaDocenteDia.tsx.
import { AnimatePresence, motion } from 'motion/react';
import { BLOQUES_MANANA, BLOQUES_TARDE, horaOrdinal } from '../data/maestros';
import { horarioBase } from '../data/horarioBase';
import {
  docentesAfectadosConDia,
  formatearFechaLegible,
} from '../data/horarioModificado';
import type { HorarioModificado } from '../data/horarioModificado';
import { renderCeldaDocenteDia } from './celdaDocenteDia';

interface Props {
  docenteId: string;
  fecha: string;
  jornada: 'manana' | 'tarde';
  horariosModificados: HorarioModificado[];
  onClose: () => void;
}

export default function MiDiaModificado({ docenteId, fecha, jornada, horariosModificados, onClose }: Props) {
  const bloques = jornada === 'tarde' ? BLOQUES_TARDE : BLOQUES_MANANA;

  const dias = docentesAfectadosConDia(fecha, jornada, horarioBase as any, horariosModificados);
  const miDia = dias.find(d => d.docenteId === docenteId) ?? null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/45 dark:bg-black/75 backdrop-blur-sm p-3 sm:p-6"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 30 }}
          className="w-full max-w-md bg-card border border-line rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          onClick={e => e.stopPropagation()}
        >
          <div className="px-5 pt-5 pb-4 border-b border-line flex items-center justify-between">
            <div>
              <h2 className="text-strong font-semibold text-base">Mi día</h2>
              <p className="text-xs text-muted mt-0.5">
                {formatearFechaLegible(fecha)} · Jornada {jornada === 'manana' ? 'mañana' : 'tarde'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-muted hover:text-strong transition text-lg leading-none p-1"
              aria-label="Cerrar"
            >✕</button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            {miDia && miDia.bloques.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {miDia.bloques.map(b => {
                  const info = bloques.find(x => x.id === b.bloque);
                  return (
                    <div key={b.bloque} className="flex flex-col gap-1">
                      <div className="text-center text-[10px] text-muted">
                        {horaOrdinal(b.bloque)} · {info?.inicio ?? ''}
                      </div>
                      <div style={{ height: 56 }}>{renderCeldaDocenteDia(b)}</div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted text-center py-6">
                No hay cambios registrados para ti en esta fecha.
              </p>
            )}
          </div>

          <div className="px-5 py-3 border-t border-line text-[11px] text-muted bg-card/80">
            Convenciones: <span className="text-info-soft-fg">movida</span> ·{' '}
            <span className="text-warning-soft-fg">taller</span> ·{' '}
            <span className="text-danger-soft-fg line-through">cancelada</span>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
