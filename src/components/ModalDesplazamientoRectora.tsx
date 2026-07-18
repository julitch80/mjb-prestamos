import { useState } from 'react';
import { useAppStore } from '../data/store';
import { crearReserva, actualizarReserva } from '../data/api';
import type { Reserva } from '../data/api';
import { RECURSOS, BLOQUES_MANANA, BLOQUES_TARDE, horaOrdinal, getUsuario, MOTIVOS_DESPLAZAMIENTO_RECTORA } from '../data/maestros';

interface Props {
  recursoId: string;
  fecha: string;
  bloqueId: number;
  // Descripción de quién/qué ocupa el espacio: reserva de un docente, o
  // clase regular del horario (sin reserva asociada).
  ocupante: { tipo: 'reserva'; reserva: Reserva } | { tipo: 'clase'; descripcion: string };
  onCerrar: () => void;
}

// Modal de desplazamiento: la rectora toma un espacio ya ocupado (por
// reserva de un docente o por clase regular). Al confirmar, crea su propia
// reserva 'aprobada' y, si había una reserva de docente, la cancela y
// notifica al afectado con la justificación y las alternativas sugeridas.
export default function ModalDesplazamientoRectora({ recursoId, fecha, bloqueId, ocupante, onCerrar }: Props) {
  const { userId, jornada, agregarReserva, actualizarReserva: actualizarReservaStore } = useAppStore();

  const [alternativas, setAlternativas] = useState('');
  const [justificacion, setJustificacion] = useState('');
  const [justificacionOtro, setJustificacionOtro] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  const recurso = RECURSOS.find(r => r.id === recursoId);
  const bloques = jornada === 'tarde' ? BLOQUES_TARDE : BLOQUES_MANANA;
  const bloque = bloques.find(b => b.id === bloqueId);

  const justificacionFinal = justificacion === 'Otro' ? justificacionOtro : justificacion;

  const nombreOcupante = ocupante.tipo === 'reserva'
    ? (getUsuario(ocupante.reserva.solicitante)?.nombre ?? ocupante.reserva.solicitante)
    : null;

  async function handleConfirmar() {
    if (!userId || !justificacionFinal) return;
    setCargando(true);
    setError('');
    try {
      const motivoCompleto = alternativas
        ? `${justificacionFinal} · Alternativas sugeridas: ${alternativas}`
        : justificacionFinal;

      // 1. Si había una reserva de docente en ese espacio, se cancela y se
      //    notifica al afectado (actualizarReserva ya notifica al solicitante
      //    con el motivo — reusamos ese flujo existente).
      if (ocupante.tipo === 'reserva') {
        const resCancel = await actualizarReserva(ocupante.reserva.id, 'cancelada', motivoCompleto);
        if (!resCancel.ok) {
          setError(resCancel.error ?? 'No se pudo liberar la reserva existente');
          setCargando(false);
          return;
        }
        actualizarReservaStore(ocupante.reserva.id, { estado: 'cancelada', motivo: motivoCompleto });
      }

      // 2. Se crea la reserva de la rectora, ya 'aprobada'.
      const res = await crearReserva({
        recurso: recursoId,
        fecha,
        bloque: bloqueId,
        solicitante: userId,
        proposito: 'Asignación directa de rectoría (desplazamiento)',
        equipos: undefined,
        motivo: motivoCompleto,
        estado: 'aprobada',
      });
      if (res.ok && res.id) {
        agregarReserva({
          id: res.id,
          recurso: recursoId,
          fecha,
          bloque: bloqueId,
          solicitante: userId,
          proposito: 'Asignación directa de rectoría (desplazamiento)',
          motivo: motivoCompleto,
          estado: 'aprobada',
          timestamp: new Date().toISOString(),
        });
        onCerrar();
      } else {
        setError(res.error ?? 'No se pudo crear la asignación');
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 dark:bg-black/75 p-4">
      <div className="w-full max-w-md bg-card rounded-2xl border border-warning/50 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-line">
          <h3 className="text-strong font-semibold flex items-center gap-2">
            <span className="text-warning">👑</span> Espacio ocupado
          </h3>
          <button onClick={onCerrar} className="text-muted hover:text-strong text-xl transition">✕</button>
        </div>

        <div className="px-6 py-4 bg-elevated/60 border-b border-line text-sm space-y-2">
          <div className="flex justify-between">
            <span className="text-muted">Espacio</span>
            <span className="text-strong font-semibold">{recurso?.nombre}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Fecha</span>
            <span className="text-strong">{fecha}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">{bloque ? horaOrdinal(bloque.id) : ''} hora</span>
            <span className="text-strong">{bloque?.inicio} – {bloque?.fin}</span>
          </div>
          <div className="pt-2 mt-2 border-t border-line">
            <p className="text-danger text-xs">
              {ocupante.tipo === 'reserva'
                ? `Ocupado por reserva de ${nombreOcupante}.`
                : `Ocupado por clase regular: ${ocupante.descripcion}.`}
            </p>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm text-soft mb-1.5">Alternativas para el docente</label>
            <textarea
              value={alternativas}
              onChange={e => setAlternativas(e.target.value)}
              placeholder="Ej.: puede usar el Aula 7 o la biblioteca en ese bloque"
              rows={2}
              className="w-full bg-elevated text-strong rounded-xl px-3 py-2.5 text-sm border border-line focus:outline-none focus:border-warning transition resize-none"
            />
          </div>

          <div>
            <label className="block text-sm text-soft mb-1.5">Justificación *</label>
            <select
              value={justificacion}
              onChange={e => setJustificacion(e.target.value)}
              required
              className="w-full bg-elevated text-strong rounded-xl px-3 py-2.5 text-sm border border-line focus:outline-none focus:border-warning transition"
            >
              <option value="">Seleccionar...</option>
              {MOTIVOS_DESPLAZAMIENTO_RECTORA.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {justificacion === 'Otro' && (
            <input
              type="text"
              placeholder="Especificar justificación..."
              value={justificacionOtro}
              onChange={e => setJustificacionOtro(e.target.value)}
              required
              className="w-full bg-elevated text-strong rounded-xl px-3 py-2 text-sm border border-line focus:outline-none focus:border-warning transition"
            />
          )}

          {error && (
            <p className="text-danger text-xs bg-danger-soft border border-danger rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onCerrar}
              className="flex-1 py-3 rounded-xl bg-elevated text-soft hover:bg-hover text-sm transition font-medium"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirmar}
              disabled={cargando || !justificacionFinal}
              className="flex-1 py-3 rounded-xl bg-warning hover:bg-warning/85 disabled:opacity-40 text-strong font-semibold text-sm transition"
            >
              {cargando ? 'Asignando...' : 'Asignar de todas formas'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
