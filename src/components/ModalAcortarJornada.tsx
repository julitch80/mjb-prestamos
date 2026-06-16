import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppStore } from '../data/store';
import { getDocentes, horaOrdinal } from '../data/maestros';
import { enviarCorreoMasivo } from '../data/api';
import type { ResultadoCorreoMasivo } from '../data/api';
import {
  fechaHoyLocal,
  formatearFechaLegible,
  recalcularBloquesAcortados,
  generarIdJornadaReducida,
  diaDeSemana,
  INICIO_NORMAL,
  FIN_NORMAL,
} from '../data/horarioModificado';
import type { JornadaReducida } from '../data/horarioModificado';
import { generarPublicacionDeJornadaReducida } from '../data/publicacion';
import type { PublicacionPendiente } from '../data/publicacion';
import ModalRevisarPublicacion from './ModalRevisarPublicacion';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  jornada: 'manana' | 'tarde';
  onClose: () => void;
}

const MOTIVOS = ['Acto cívico', 'Reunión de docentes', 'Jornada pedagógica', 'Requerimiento institucional', 'Otro'];

export default function ModalAcortarJornada({ open, jornada, onClose }: Props) {
  const { userId, jornadasReducidas, agregarJornadaReducida, agregarPublicacionPendiente } = useAppStore();
  const [fecha, setFecha] = useState(fechaHoyLocal());
  const [horaInicio, setHoraInicio] = useState<string>(INICIO_NORMAL[jornada]);
  const [horaFin, setHoraFin] = useState(jornada === 'manana' ? '10:00' : '16:15');
  const [motivo, setMotivo] = useState(MOTIVOS[0]);
  const [motivoOtro, setMotivoOtro] = useState('');
  const [guardado, setGuardado] = useState<JornadaReducida | null>(null);
  const [publicacionPendiente, setPublicacionPendiente] = useState<PublicacionPendiente | null>(null);
  const [revisarPublicacionAbierta, setRevisarPublicacionAbierta] = useState(false);
  const [enviandoCorreo, setEnviandoCorreo] = useState(false);
  const [resultadoCorreo, setResultadoCorreo] = useState<ResultadoCorreoMasivo | null>(null);

  const dia = diaDeSemana(fecha);
  const esDiaLectivo = dia !== 'sabado' && dia !== 'domingo';

  const calculo = useMemo(() => recalcularBloquesAcortados(jornada, horaFin, horaInicio), [jornada, horaFin, horaInicio]);
  const bloques = Array.isArray(calculo) ? calculo : null;
  const error = Array.isArray(calculo) ? null : calculo.error;

  const yaExiste = jornadasReducidas.some(j => j.fecha === fecha && j.jornada === jornada);

  function reset() {
    setFecha(fechaHoyLocal());
    setHoraInicio(INICIO_NORMAL[jornada]);
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
      horaInicio,
      horaFin,
      motivo: motivoFinal,
      bloques,
      timestamp: new Date().toISOString(),
    };
    agregarJornadaReducida(jr);
    setGuardado(jr);

    // Crear publicación pendiente para la web del colegio
    const pub = generarPublicacionDeJornadaReducida(jr, userId);
    agregarPublicacionPendiente(pub);
    setPublicacionPendiente(pub);
  }

  function htmlJornadaReducidaPara(jr: JornadaReducida): string {
    const filas = jr.bloques.map(b =>
      `<tr><td style="padding:6px 8px;border:1px solid #fcd34d">${b.id}.ª hora</td><td style="padding:6px 8px;border:1px solid #fcd34d">${b.inicio} – ${b.fin}</td></tr>`
    ).join('');
    return `
      <div style="font-family:Arial,sans-serif;max-width:600px;color:#1f2937">
        <h2 style="margin:0 0 4px 0;color:#b45309">I.E. Manuel J. Betancur — Jornada acortada</h2>
        <p style="margin:0 0 16px 0;color:#475569"><strong>${formatearFechaLegible(jr.fecha)}</strong> · Jornada ${jr.jornada === 'manana' ? 'mañana' : 'tarde'}</p>
        <p style="margin:0 0 4px 0"><strong>Motivo:</strong> ${jr.motivo}</p>
        <p style="margin:0 0 16px 0"><strong>Horario:</strong> entrada ${jr.horaInicio} · salida ${jr.horaFin}</p>
        <h3 style="margin:8px 0 6px 0">Bloques del día</h3>
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead><tr style="background:#fef3c7"><th style="padding:6px 8px;border:1px solid #fcd34d;text-align:left">Hora</th><th style="padding:6px 8px;border:1px solid #fcd34d;text-align:left">Horario</th></tr></thead>
          <tbody>${filas}</tbody>
        </table>
        <p style="margin-top:20px;font-size:11px;color:#94a3b8">Generado por MJB Préstamos</p>
      </div>
    `;
  }

  async function enviarCorreoAhora() {
    if (!guardado) return;
    setEnviandoCorreo(true);
    setResultadoCorreo(null);
    const destinatarios = getDocentes(guardado.jornada)
      .map(d => d.correo)
      .filter(c => !!c && c.includes('@'));
    const cc = ['juancarlosbv@iemanueljbetancur.edu.co', 'uriel.lopez@iemanueljbetancur.edu.co'];
    const asunto = `[MJB] Jornada acortada — ${formatearFechaLegible(guardado.fecha)}`;
    const html = htmlJornadaReducidaPara(guardado);
    try {
      const res = await enviarCorreoMasivo(destinatarios, asunto, html, cc);
      setResultadoCorreo(res);
    } catch {
      setResultadoCorreo({ ok: false, error: 'Error de red. Verifica tu conexión.' });
    } finally {
      setEnviandoCorreo(false);
    }
  }

  function copiarResumen() {
    if (!guardado) return;
    const texto = [
      `*MJB — Jornada acortada*`,
      `${formatearFechaLegible(guardado.fecha)} · Jornada ${guardado.jornada === 'manana' ? 'mañana' : 'tarde'}`,
      `Motivo: ${guardado.motivo}`,
      `Horario: entrada ${guardado.horaInicio} · salida ${guardado.horaFin}`,
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
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/45 dark:bg-black/75 backdrop-blur-sm p-3 sm:p-6"
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
                  <span className="text-warning">⏱</span> Acortar jornada del día
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
                      className="w-full bg-card text-strong rounded-xl px-3 py-2.5 text-sm border border-line focus:outline-none focus:border-warning"
                    />
                    <div className="text-xs text-muted mt-1">{formatearFechaLegible(fecha)}</div>
                    {!esDiaLectivo && (
                      <div className="mt-2 text-xs text-warning-soft-fg bg-warning-soft border border-warning rounded-lg px-3 py-2">
                        ⚠ No es un día lectivo. Elige una fecha entre lunes y viernes.
                      </div>
                    )}
                    {yaExiste && esDiaLectivo && (
                      <div className="mt-2 text-xs text-danger-soft-fg bg-danger-soft border border-danger rounded-lg px-3 py-2">
                        Ya hay una jornada acortada guardada para esta fecha y jornada.
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-soft mb-1.5">Hora de inicio</label>
                      <input
                        type="time"
                        value={horaInicio}
                        onChange={e => setHoraInicio(e.target.value)}
                        className="w-full bg-card text-strong rounded-xl px-3 py-2.5 text-sm border border-line focus:outline-none focus:border-warning"
                      />
                      <div className="text-xs text-muted mt-1">Normal: {INICIO_NORMAL[jornada]}</div>
                    </div>
                    <div>
                      <label className="block text-xs text-soft mb-1.5">Hora de fin</label>
                      <input
                        type="time"
                        value={horaFin}
                        onChange={e => setHoraFin(e.target.value)}
                        className="w-full bg-card text-strong rounded-xl px-3 py-2.5 text-sm border border-line focus:outline-none focus:border-warning"
                      />
                      <div className="text-xs text-muted mt-1">Normal: {FIN_NORMAL[jornada]}</div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-soft mb-1.5">Motivo</label>
                    <select
                      value={motivo}
                      onChange={e => setMotivo(e.target.value)}
                      className="w-full bg-card text-strong rounded-xl px-3 py-2.5 text-sm border border-line focus:outline-none focus:border-warning"
                    >
                      {MOTIVOS.map(m => <option key={m}>{m}</option>)}
                    </select>
                    {motivo === 'Otro' && (
                      <input
                        type="text"
                        placeholder="Especifica el motivo…"
                        value={motivoOtro}
                        onChange={e => setMotivoOtro(e.target.value)}
                        className="mt-2 w-full bg-card text-strong rounded-xl px-3 py-2 text-sm border border-line focus:outline-none focus:border-warning"
                      />
                    )}
                  </div>

                  {/* Vista previa */}
                  {error && (
                    <div className="bg-danger-soft border border-danger rounded-xl px-3 py-2 text-xs text-danger-soft-fg">
                      {error}
                    </div>
                  )}
                  {bloques && (
                    <div className="bg-elevated border border-line rounded-2xl p-4">
                      <div className="text-xs font-semibold text-warning-soft-fg mb-2">Vista previa de bloques</div>
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
                  <div className="bg-success-soft border border-success rounded-2xl p-4 text-sm text-success-soft-fg">
                    ✓ Jornada acortada guardada para {formatearFechaLegible(guardado.fecha)}.
                  </div>
                  <div className="bg-elevated border border-line rounded-2xl p-4">
                    <div className="text-xs font-semibold text-warning-soft-fg mb-2">Bloques recalculados</div>
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
                    className="w-full px-4 py-2.5 rounded-xl bg-accent hover:bg-accent/85 text-accent-fg text-sm font-semibold transition"
                  >
                    Copiar resumen para difundir
                  </button>

                  <button
                    onClick={enviarCorreoAhora}
                    disabled={enviandoCorreo || resultadoCorreo?.ok === true}
                    className={cn(
                      'w-full px-4 py-2.5 rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2',
                      resultadoCorreo?.ok === true
                        ? 'bg-success text-white cursor-default'
                        : enviandoCorreo
                          ? 'bg-info/60 text-white cursor-not-allowed'
                          : 'bg-info hover:bg-info/85 text-white'
                    )}
                  >
                    {enviandoCorreo ? (
                      <>
                        <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Enviando correos…
                      </>
                    ) : resultadoCorreo?.ok === true ? (
                      <>✓ Correos enviados</>
                    ) : (
                      <>📧 Enviar correo a todos los docentes de la jornada</>
                    )}
                  </button>

                  {resultadoCorreo && (
                    <div className={cn(
                      'text-[11px] rounded-lg border px-3 py-2',
                      resultadoCorreo.ok
                        ? 'bg-success-soft border-success text-success-soft-fg'
                        : 'bg-danger-soft border-danger text-danger-soft-fg'
                    )}>
                      {resultadoCorreo.ok ? (
                        <>
                          ✓ {resultadoCorreo.enviados ?? 0} de {resultadoCorreo.total ?? 0} correos enviados correctamente.
                          {resultadoCorreo.fallidos && resultadoCorreo.fallidos.length > 0 && (
                            <div className="mt-1 opacity-80">
                              No se pudo enviar a: {resultadoCorreo.fallidos.map(f => f.correo).join(', ')}
                            </div>
                          )}
                        </>
                      ) : (
                        <>⛔ {resultadoCorreo.error ?? 'No se pudo enviar.'}</>
                      )}
                    </div>
                  )}

                  {publicacionPendiente && (
                    <button
                      onClick={() => setRevisarPublicacionAbierta(true)}
                      className="w-full px-4 py-2.5 rounded-xl bg-info hover:bg-info/85 text-white text-sm font-semibold transition flex items-center justify-center gap-2"
                    >
                      📄 Revisar publicación para la web del colegio
                    </button>
                  )}
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
                      puedeGuardar ? 'bg-warning hover:bg-warning/85' : 'bg-gray-700 cursor-not-allowed'
                    )}
                  >
                    Guardar jornada acortada
                  </button>
                </>
              ) : (
                <button
                  onClick={reset}
                  className="px-5 py-2.5 rounded-xl bg-accent hover:bg-accent/85 text-strong text-sm font-semibold transition"
                >
                  Cerrar
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Modal de revisión / aprobación / publicación */}
      <ModalRevisarPublicacion
        publicacion={revisarPublicacionAbierta ? publicacionPendiente : null}
        onClose={() => setRevisarPublicacionAbierta(false)}
      />
    </AnimatePresence>
  );
}
