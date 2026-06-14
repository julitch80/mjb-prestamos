import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppStore } from '../data/store';
import { horaOrdinal } from '../data/maestros';
import {
  fechaHoyLocal,
  formatearFechaLegible,
  recalcularBloquesAcortados,
  generarIdJornadaReducida,
  diaDeSemana,
} from '../data/horarioModificado';
import type { JornadaReducida } from '../data/horarioModificado';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  jornada: 'manana' | 'tarde';
  onClose: () => void;
}

const MOTIVOS = ['Acto cívico', 'Reunión de docentes', 'Jornada pedagógica', 'Requerimiento institucional', 'Otro'];

export default function ModalAcortarJornada({ open, jornada, onClose }: Props) {
  const { userId, jornadasReducidas, agregarJornadaReducida } = useAppStore();
  const [fecha, setFecha] = useState(fechaHoyLocal());
  const [horaFin, setHoraFin] = useState(jornada === 'manana' ? '10:00' : '16:15');
  const [motivo, setMotivo] = useState(MOTIVOS[0]);
  const [motivoOtro, setMotivoOtro] = useState('');
  const [guardado, setGuardado] = useState<JornadaReducida | null>(null);

  const dia = diaDeSemana(fecha);
  const esDiaLectivo = dia !== 'sabado' && dia !== 'domingo';

  const calculo = useMemo(() => recalcularBloquesAcortados(jornada, horaFin), [jornada, horaFin]);
  const bloques = Array.isArray(calculo) ? calculo : null;
  const error = Array.isArray(calculo) ? null : calculo.error;

  const yaExiste = jornadasReducidas.some(j => j.fecha === fecha && j.jornada === jornada);

  function reset() {
    setFecha(fechaHoyLocal());
    setHoraFin(jornada === 'manana' ? '10:00' : '16:15');
    setMotivo(MOTIVOS[0]);
    setMotivoOtro('');
    setGuardado(null);
    onClose();
  }

  function guardar() {
    if (!userId || !bloques) return;
    const motivoFinal = motivo === 'Otro' ? (motivoOtro.trim() || 'Otro') : motivo;
    const jr: JornadaReducida = {
      id: generarIdJornadaReducida(),
      fecha,
      jornada,
      autor: userId,
      horaFin,
      motivo: motivoFinal,
      bloques,
      timestamp: new Date().toISOString(),
    };
    agregarJornadaReducida(jr);
    setGuardado(jr);
  }

  function copiarResumen() {
    if (!guardado) return;
    const texto = [
      `*MJB — Jornada acortada*`,
      `${formatearFechaLegible(guardado.fecha)} · Jornada ${guardado.jornada === 'manana' ? 'mañana' : 'tarde'}`,
      `Motivo: ${guardado.motivo}`,
      `Hora de salida: ${guardado.horaFin}`,
      '',
      ...guardado.bloques.map(b => `${b.id}.ª hora: ${b.inicio} – ${b.fin}`),
      '',
      '— MJB Préstamos',
    ].join('\n');
    navigator.clipboard.writeText(texto).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = texto;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    });
  }

  const puedeGuardar = !!bloques && esDiaLectivo && !yaExiste && (motivo !== 'Otro' || motivoOtro.trim() !== '');

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-6"
          onClick={reset}
        >
          <motion.div
            initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            className="w-full max-w-xl bg-card border border-line rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-6 pt-5 pb-4 border-b border-line flex items-center justify-between">
              <div>
                <h2 className="text-strong font-semibold text-base flex items-center gap-2">
                  <span className="text-amber-400">⏱</span> Acortar jornada del día
                </h2>
                <p className="text-xs text-muted mt-0.5">
                  Recalcula las clases manteniendo descansos institucionales (20+10 min).
                </p>
              </div>
              <button onClick={reset} className="text-muted hover:text-strong text-lg leading-none p-1" aria-label="Cerrar">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              {!guardado ? (
                <>
                  <div>
                    <label className="block text-xs text-soft mb-1.5">Fecha</label>
                    <input
                      type="date"
                      value={fecha}
                      min={fechaHoyLocal()}
                      onChange={e => setFecha(e.target.value)}
                      className="w-full bg-card text-strong rounded-xl px-3 py-2.5 text-sm border border-line focus:outline-none focus:border-amber-500"
                    />
                    <div className="text-xs text-muted mt-1">{formatearFechaLegible(fecha)}</div>
                    {!esDiaLectivo && (
                      <div className="mt-2 text-xs text-yellow-300 bg-yellow-900/20 border border-yellow-700/40 rounded-lg px-3 py-2">
                        ⚠ No es un día lectivo. Elige una fecha entre lunes y viernes.
                      </div>
                    )}
                    {yaExiste && esDiaLectivo && (
                      <div className="mt-2 text-xs text-red-300 bg-red-900/20 border border-red-700/40 rounded-lg px-3 py-2">
                        Ya hay una jornada acortada guardada para esta fecha y jornada.
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs text-soft mb-1.5">Hora en que termina la jornada hoy</label>
                    <input
                      type="time"
                      value={horaFin}
                      onChange={e => setHoraFin(e.target.value)}
                      className="w-full bg-card text-strong rounded-xl px-3 py-2.5 text-sm border border-line focus:outline-none focus:border-amber-500"
                    />
                    <div className="text-xs text-muted mt-1">
                      Normal: {jornada === 'manana' ? '12:00' : '18:15'}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-soft mb-1.5">Motivo</label>
                    <select
                      value={motivo}
                      onChange={e => setMotivo(e.target.value)}
                      className="w-full bg-card text-strong rounded-xl px-3 py-2.5 text-sm border border-line focus:outline-none focus:border-amber-500"
                    >
                      {MOTIVOS.map(m => <option key={m}>{m}</option>)}
                    </select>
                    {motivo === 'Otro' && (
                      <input
                        type="text"
                        placeholder="Especifica el motivo…"
                        value={motivoOtro}
                        onChange={e => setMotivoOtro(e.target.value)}
                        className="mt-2 w-full bg-card text-strong rounded-xl px-3 py-2 text-sm border border-line focus:outline-none focus:border-amber-500"
                      />
                    )}
                  </div>

                  {/* Vista previa */}
                  {error && (
                    <div className="bg-red-900/20 border border-red-700/40 rounded-xl px-3 py-2 text-xs text-red-300">
                      {error}
                    </div>
                  )}
                  {bloques && (
                    <div className="bg-elevated border border-line rounded-2xl p-4">
                      <div className="text-xs font-semibold text-amber-300 mb-2">Vista previa de bloques</div>
                      <table className="w-full text-xs">
                        <tbody>
                          {bloques.map(b => (
                            <tr key={b.id} className="border-b border-line last:border-b-0">
                              <td className="py-1.5 text-soft w-24">{horaOrdinal(b.id)} hora</td>
                              <td className="py-1.5 font-semibold text-strong tabular-nums">{b.inicio} – {b.fin}</td>
                              <td className="py-1.5 text-muted text-right tabular-nums">
                                {(() => {
                                  const [hi, mi] = b.inicio.split(':').map(Number);
                                  const [hf, mf] = b.fin.split(':').map(Number);
                                  const min = (hf * 60 + mf) - (hi * 60 + mi);
                                  return `${min} min`;
                                })()}
                              </td>
                            </tr>
                          ))}
                          <tr><td colSpan={3} className="pt-2 text-[10px] text-muted">
                            Descansos institucionales mantenidos: 20 min después de 2.ª · 10 min después de 4.ª
                          </td></tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="bg-green-950/30 border border-green-700/40 rounded-2xl p-4 text-sm text-green-200">
                    ✓ Jornada acortada guardada para {formatearFechaLegible(guardado.fecha)}.
                  </div>
                  <div className="bg-elevated border border-line rounded-2xl p-4">
                    <div className="text-xs font-semibold text-amber-300 mb-2">Bloques recalculados</div>
                    <table className="w-full text-xs">
                      <tbody>
                        {guardado.bloques.map(b => (
                          <tr key={b.id} className="border-b border-line last:border-b-0">
                            <td className="py-1.5 text-soft w-24">{horaOrdinal(b.id)} hora</td>
                            <td className="py-1.5 font-semibold text-strong tabular-nums">{b.inicio} – {b.fin}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <button
                    onClick={copiarResumen}
                    className="w-full px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-strong text-sm font-semibold transition"
                  >
                    Copiar resumen para difundir
                  </button>
                </>
              )}
            </div>

            <div className="px-6 py-4 border-t border-line bg-card/80 flex justify-end gap-3">
              {!guardado ? (
                <>
                  <button onClick={reset} className="px-4 py-2.5 rounded-xl bg-elevated hover:bg-hover text-soft text-sm transition">
                    Cancelar
                  </button>
                  <button
                    onClick={guardar}
                    disabled={!puedeGuardar}
                    className={cn(
                      'px-5 py-2.5 rounded-xl text-strong text-sm font-semibold transition',
                      puedeGuardar ? 'bg-amber-600 hover:bg-amber-500' : 'bg-gray-700 cursor-not-allowed'
                    )}
                  >
                    Guardar jornada acortada
                  </button>
                </>
              ) : (
                <button
                  onClick={reset}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-strong text-sm font-semibold transition"
                >
                  Cerrar
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
