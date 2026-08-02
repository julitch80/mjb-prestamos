import React, { useState, useMemo, useEffect } from 'react';
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
  descansosInstitucionales,
} from '../data/horarioModificado';
import type { JornadaReducida, DescansoConfig } from '../data/horarioModificado';
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
  const [numBloques, setNumBloques] = useState<number>(6);
  // Descansos: arrancan en el patrón institucional. `descansosTocados` distingue
  // si el coordinador los editó a mano — mientras no lo haga, se recalculan solos
  // al cambiar numBloques (ver efecto abajo).
  const [descansos, setDescansos] = useState<DescansoConfig[]>(() => descansosInstitucionales(6));
  const [descansosTocados, setDescansosTocados] = useState(false);
  const [motivo, setMotivo] = useState(MOTIVOS[0]);
  const [motivoOtro, setMotivoOtro] = useState('');
  const [guardado, setGuardado] = useState<JornadaReducida | null>(null);
  const [publicacionPendiente, setPublicacionPendiente] = useState<PublicacionPendiente | null>(null);
  const [revisarPublicacionAbierta, setRevisarPublicacionAbierta] = useState(false);
  const [enviandoCorreo, setEnviandoCorreo] = useState(false);
  const [resultadoCorreo, setResultadoCorreo] = useState<ResultadoCorreoMasivo | null>(null);

  const dia = diaDeSemana(fecha);
  const esDiaLectivo = dia !== 'sabado' && dia !== 'domingo';

  // Si el coordinador no ha tocado los descansos, recalcularlos con el patrón
  // institucional cada vez que cambia el número de bloques. Si ya los tocó,
  // respetar lo que puso pero descartar los que queden fuera de rango (el
  // bloque tras el que iban ya no existe con el nuevo numBloques).
  useEffect(() => {
    if (!descansosTocados) {
      setDescansos(descansosInstitucionales(numBloques));
    } else {
      setDescansos(ds => ds.filter(d => d.despuesDe >= 1 && d.despuesDe < numBloques));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numBloques]);

  const calculo = useMemo(
    () => recalcularBloquesAcortados(jornada, horaFin, horaInicio, numBloques, descansos),
    [jornada, horaFin, horaInicio, numBloques, descansos]
  );
  const bloques = Array.isArray(calculo) ? calculo : null;
  const error = Array.isArray(calculo) ? null : calculo.error;

  const yaExiste = jornadasReducidas.some(j => j.fecha === fecha && j.jornada === jornada);

  function restaurarPatronInstitucional() {
    setDescansos(descansosInstitucionales(numBloques));
    setDescansosTocados(false);
  }

  function actualizarDescanso(idx: number, cambio: Partial<DescansoConfig>) {
    setDescansosTocados(true);
    setDescansos(ds => ds.map((d, i) => i === idx ? { ...d, ...cambio } : d));
  }

  function eliminarDescanso(idx: number) {
    setDescansosTocados(true);
    setDescansos(ds => ds.filter((_, i) => i !== idx));
  }

  function anadirDescanso() {
    setDescansosTocados(true);
    // Bloque por defecto: el primero disponible que no tenga ya un descanso
    const usados = new Set(descansos.map(d => d.despuesDe));
    let despuesDe = 1;
    for (let b = 1; b < numBloques; b++) {
      if (!usados.has(b)) { despuesDe = b; break; }
    }
    setDescansos(ds => [...ds, { despuesDe, duracion: 10 }]);
  }

  function reset() {
    setFecha(fechaHoyLocal());
    setHoraInicio(INICIO_NORMAL[jornada]);
    setHoraFin(jornada === 'manana' ? '10:00' : '16:15');
    setNumBloques(6);
    setDescansos(descansosInstitucionales(6));
    setDescansosTocados(false);
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
      numBloques,
      // Solo se guarda si el coordinador los tocó a mano: ausente = patrón
      // institucional (necesario para que las jornadas ya guardadas sigan
      // comportándose igual, y para no inflar el JSON en el caso común).
      ...(descansosTocados ? { descansos } : {}),
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
    const filas = jr.bloques.map(b => {
      const descansoTxt = b.descansoDespues
        ? `<tr><td colspan="2" style="padding:2px 8px;border:1px solid #fcd34d;color:#92400e;font-style:italic">Descanso de ${b.descansoDespues} min</td></tr>`
        : '';
      return `<tr><td style="padding:6px 8px;border:1px solid #fcd34d">${b.id}.ª hora</td><td style="padding:6px 8px;border:1px solid #fcd34d">${b.inicio} – ${b.fin}</td></tr>${descansoTxt}`;
    }).join('');
    return `
      <div style="font-family:Arial,sans-serif;max-width:600px;color:#1f2937">
        <h2 style="margin:0 0 4px 0;color:#b45309">I.E. Manuel J. Betancur — Jornada acortada</h2>
        <p style="margin:0 0 16px 0;color:#475569"><strong>${formatearFechaLegible(jr.fecha)}</strong> · Jornada ${jr.jornada === 'manana' ? 'mañana' : 'tarde'}</p>
        <p style="margin:0 0 4px 0"><strong>Motivo:</strong> ${jr.motivo}</p>
        <p style="margin:0 0 16px 0"><strong>Horario:</strong> entrada ${jr.horaInicio} · salida ${jr.horaFin} · ${jr.numBloques ?? jr.bloques.length} hora${(jr.numBloques ?? jr.bloques.length) === 1 ? '' : 's'} de clase</p>
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
      `Horario: entrada ${guardado.horaInicio} · salida ${guardado.horaFin} · ${guardado.numBloques ?? guardado.bloques.length} hora${(guardado.numBloques ?? guardado.bloques.length) === 1 ? '' : 's'} de clase`,
      '',
      ...guardado.bloques.flatMap(b => [
        `${b.id}.ª hora: ${b.inicio} – ${b.fin}`,
        ...(b.descansoDespues ? [`   ⏸ Descanso de ${b.descansoDespues} min`] : []),
      ]),
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
                  Recalcula las clases con los descansos que definas abajo (por defecto, el patrón institucional).
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
                    <label className="block text-xs text-soft mb-1.5">Horas de clase a dictar</label>
                    <select
                      value={numBloques}
                      onChange={e => setNumBloques(Number(e.target.value))}
                      className="w-full bg-card text-strong rounded-xl px-3 py-2.5 text-sm border border-line focus:outline-none focus:border-warning"
                    >
                      {[1, 2, 3, 4, 5, 6].map(n => (
                        <option key={n} value={n}>{n} hora{n === 1 ? '' : 's'} de clase</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs text-soft">Descansos</label>
                      {descansosTocados && (
                        <button
                          type="button"
                          onClick={restaurarPatronInstitucional}
                          className="text-[11px] text-accent hover:underline"
                        >
                          Volver al patrón institucional
                        </button>
                      )}
                    </div>
                    <div className="space-y-2">
                      {descansos.map((d, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <span className="text-xs text-muted shrink-0">Tras la</span>
                          <select
                            value={d.despuesDe}
                            onChange={e => actualizarDescanso(idx, { despuesDe: Number(e.target.value) })}
                            className="bg-card text-strong rounded-lg px-2 py-1.5 text-xs border border-line focus:outline-none focus:border-warning"
                          >
                            {Array.from({ length: numBloques - 1 }, (_, i) => i + 1).map(b => (
                              <option key={b} value={b}>{horaOrdinal(b)}</option>
                            ))}
                          </select>
                          <input
                            type="number"
                            min={1}
                            max={120}
                            value={d.duracion}
                            onChange={e => actualizarDescanso(idx, { duracion: Math.max(1, Number(e.target.value)) })}
                            className="w-16 bg-card text-strong rounded-lg px-2 py-1.5 text-xs border border-line focus:outline-none focus:border-warning tabular-nums"
                          />
                          <span className="text-xs text-muted">min</span>
                          <button
                            type="button"
                            onClick={() => eliminarDescanso(idx)}
                            className="ml-auto text-danger hover:text-danger/80 text-xs px-2 py-1"
                            aria-label="Eliminar descanso"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                      {descansos.length === 0 && (
                        <div className="text-[11px] text-muted italic">Sin descansos: la jornada corre seguida.</div>
                      )}
                      {descansos.length < 3 && numBloques >= 2 && (
                        <button
                          type="button"
                          onClick={anadirDescanso}
                          className="text-[11px] text-accent hover:underline"
                        >
                          + Añadir descanso
                        </button>
                      )}
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
                            <React.Fragment key={b.id}>
                              <tr className="border-b border-line last:border-b-0">
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
                              {b.descansoDespues && (
                                <tr className="border-b border-line last:border-b-0">
                                  <td colSpan={3} className="py-1 text-[11px] text-warning-soft-fg italic">
                                    ⏸ Descanso de {b.descansoDespues} min
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          ))}
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
                          <React.Fragment key={b.id}>
                            <tr className="border-b border-line last:border-b-0">
                              <td className="py-1.5 text-soft w-24">{horaOrdinal(b.id)} hora</td>
                              <td className="py-1.5 font-semibold text-strong tabular-nums">{b.inicio} – {b.fin}</td>
                            </tr>
                            {b.descansoDespues && (
                              <tr className="border-b border-line last:border-b-0">
                                <td colSpan={2} className="py-1 text-[11px] text-warning-soft-fg italic">
                                  ⏸ Descanso de {b.descansoDespues} min
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
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
                      puedeGuardar ? 'bg-warning hover:bg-warning/85' : 'bg-elevated cursor-not-allowed'
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
