import { motion, AnimatePresence } from 'motion/react';
import {
  USUARIOS,
  BLOQUES_MANANA,
  BLOQUES_TARDE,
  DIRECTORES_MANANA,
  DIRECTORES_TARDE,
  COLORES_AULA,
  colorGrado,
  horaOrdinal,
} from '../data/maestros';
import { horarioBase } from '../data/horarioBase';
import {
  aplicarModificacionesAlDia,
  formatearFechaLegible,
} from '../data/horarioModificado';
import type { HorarioModificado, EntradaEfectiva } from '../data/horarioModificado';
import { cn } from '@/lib/utils';

interface Props {
  modificacion: HorarioModificado | null;
  onClose: () => void;
}

function abrevAula(aula: string): string {
  return aula
    .replace('Aula ', 'A')
    .replace('Lab. Ciencias', 'Lab.')
    .replace('Sala Informática', 'SI')
    .replace('Sala Info.', 'SI');
}

export default function ModalDiaModificado({ modificacion, onClose }: Props) {
  if (!modificacion) {
    return (
      <AnimatePresence>{null}</AnimatePresence>
    );
  }

  const bloques = modificacion.jornada === 'tarde' ? BLOQUES_TARDE : BLOQUES_MANANA;
  const directores = modificacion.jornada === 'manana' ? DIRECTORES_MANANA : DIRECTORES_TARDE;

  const entradas = aplicarModificacionesAlDia(
    modificacion.fecha,
    modificacion.jornada,
    horarioBase as any,
    [modificacion],
  );

  // Grupos afectados (los que tuvieron al menos una modificación)
  const gruposAfectados = new Set<string>();
  modificacion.modificaciones.forEach(mod => gruposAfectados.add(mod.grupo));
  const todosGrupos = Array.from(new Set(entradas.map(e => e.grado))).sort();
  const grupos = todosGrupos.filter(g => gruposAfectados.has(g));
  const finalGrupos = grupos.length > 0 ? grupos : todosGrupos.slice(0, 3);

  function celdaPorGrupoBloque(grupo: string, bloque: number): EntradaEfectiva | null {
    return entradas.find(e => e.grado === grupo && e.bloque === bloque) ?? null;
  }

  function infoAusenciaParaCelda(grupo: string, bloque: number) {
    // ¿Originalmente había clase con un docente ausente que fue cancelada?
    const dia = entradas[0]?.dia ?? '';
    const original = (horarioBase as any[]).find(e =>
      e.dia === dia && e.bloque === bloque && e.jornada === modificacion.jornada &&
      (e.grado.includes('/') ? e.grado.split('/')[0] : e.grado) === grupo
    );
    if (!original) return null;
    const ausencia = modificacion.ausencias.find(a => a.docenteId === original.docente);
    const esAusente = ausencia?.bloques.includes(bloque) ?? false;
    return esAusente
      ? { docente: original.docente, aula: original.aula, cancelada: true }
      : null;
  }

  return (
    <AnimatePresence>
      {modificacion && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/45 dark:bg-black/75 backdrop-blur-sm p-3 sm:p-6"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            className="w-full max-w-2xl bg-card border border-line rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-6 pt-5 pb-4 border-b border-line flex items-center justify-between">
              <div>
                <h2 className="text-strong font-semibold text-base">Horario modificado del día</h2>
                <p className="text-xs text-muted mt-0.5">
                  {formatearFechaLegible(modificacion.fecha)} · Jornada {modificacion.jornada === 'manana' ? 'mañana' : 'tarde'}
                </p>
              </div>
              <button
                onClick={onClose}
                className="text-muted hover:text-strong transition text-lg leading-none p-1"
                aria-label="Cerrar"
              >✕</button>
            </div>

            <div className="px-6 py-3 border-b border-line flex flex-wrap items-center gap-3 text-[11px]">
              <span className="text-muted">Convenciones:</span>
              <span className="px-2 py-0.5 rounded-full bg-info-soft text-info-soft-fg border border-info">movida</span>
              <span className="px-2 py-0.5 rounded-full bg-warning-soft text-warning-soft-fg border border-warning">taller</span>
              <span className="px-2 py-0.5 rounded-full bg-danger-soft text-danger-soft-fg border border-danger line-through">cancelada</span>
            </div>

            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-4">
              {finalGrupos.map(grupo => {
                const dirId = directores[grupo];
                const dir = USUARIOS.find(u => u.id === dirId);
                return (
                  <div key={grupo} className="rounded-2xl border border-line bg-elevated/60 overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-line flex items-center justify-between">
                      <div className="flex items-baseline gap-2">
                        <span className="font-bold text-base" style={{ color: colorGrado(grupo) }}>{grupo}</span>
                        {dir && <span className="text-xs text-muted">Director: {dir.nombreCorto}</span>}
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-line">
                            {bloques.map(b => (
                              <th key={b.id} className="px-2 py-2 text-center font-normal min-w-[80px]">
                                <div className="text-soft font-semibold">{horaOrdinal(b.id)}</div>
                                <div className="text-[9px] text-muted">{b.inicio}</div>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            {bloques.map(b => {
                              const celda = celdaPorGrupoBloque(grupo, b.id);
                              const ausente = !celda ? infoAusenciaParaCelda(grupo, b.id) : null;
                              if (celda) {
                                const doc = USUARIOS.find(u => u.id === celda.docente);
                                const supervisor = celda.supervisorId ? USUARIOS.find(u => u.id === celda.supervisorId) : undefined;
                                const colorBorde = celda.esTaller ? '#f59e0b' : doc?.color ?? '#aaa';
                                return (
                                  <td key={b.id} className="p-1.5" style={{ height: 64 }}>
                                    <div
                                      className={cn(
                                        'h-full rounded-lg flex flex-col items-center justify-center gap-0.5 px-1 border',
                                        (celda.esModificada || celda.esTaller) && 'border-dashed'
                                      )}
                                      style={{
                                        borderColor: colorBorde,
                                        backgroundColor: celda.esTaller
                                          ? `${colorBorde}25`
                                          : celda.esModificada
                                            ? '#1e3a8a40'
                                            : `${colorBorde}18`,
                                      }}
                                    >
                                      {celda.esTaller ? (
                                        <>
                                          <span className="text-[10px] font-bold text-warning-soft-fg">Taller</span>
                                          <span className="text-[9px] text-warning-soft-fg/80">
                                            {supervisor ? `con ${supervisor.nombreCorto}` : `por ${doc?.nombreCorto ?? celda.docente}`}
                                          </span>
                                          <span className="text-[9px] text-muted">{abrevAula(celda.aula)}</span>
                                        </>
                                      ) : (
                                        <>
                                          <span className="text-[10px] font-bold" style={{ color: doc?.color }}>{doc?.nombreCorto ?? celda.docente}</span>
                                          <span className="text-[9px]" style={{ color: COLORES_AULA[celda.aula] ?? '#94a3b8' }}>{abrevAula(celda.aula)}</span>
                                          {celda.esModificada && celda.bloqueOriginal && (
                                            <span className="text-[8px] text-info-soft-fg font-medium">
                                              ← desde {celda.bloqueOriginal}.ª
                                            </span>
                                          )}
                                        </>
                                      )}
                                    </div>
                                  </td>
                                );
                              }
                              if (ausente) {
                                const doc = USUARIOS.find(u => u.id === ausente.docente);
                                return (
                                  <td key={b.id} className="p-1.5" style={{ height: 64 }}>
                                    <div className="h-full rounded-lg border border-dashed border-danger bg-danger-soft/50 flex flex-col items-center justify-center gap-0.5 px-1">
                                      <span className="text-[10px] font-bold line-through text-danger/80">{doc?.nombreCorto ?? ausente.docente}</span>
                                      <span className="text-[9px] text-danger-soft-fg/60">cancelada</span>
                                    </div>
                                  </td>
                                );
                              }
                              return (
                                <td key={b.id} className="p-1.5" style={{ height: 64 }}>
                                  <div className="h-full rounded-lg border border-dashed border-line flex items-center justify-center">
                                    <span className="text-muted opacity-70 text-[10px]">—</span>
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="px-6 py-3 border-t border-line text-[11px] text-muted bg-card/80">
              {grupos.length > 0
                ? `Solo se muestran los grupos afectados (${grupos.length}). El resto del horario sigue como siempre.`
                : 'No hay grupos afectados visibles.'}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
