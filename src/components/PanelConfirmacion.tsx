import { useState } from 'react';
import { useAppStore } from '../data/store';
import { crearReserva } from '../data/api';
import { RECURSOS, BLOQUES_MANANA, BLOQUES_TARDE, PROPOSITOS, horaOrdinal } from '../data/maestros';

interface Props {
  recursoId: string;
  fecha: string;
  bloqueId: number;
  onCerrar: () => void;
}

// Traduce mensajes de error del backend (Apps Script) al español
function traducirError(msg: string): string {
  if (!msg) return 'No se pudo crear la reserva';
  const m = msg.toLowerCase();
  if (m.includes('acción') && m.includes('desconocida')) return 'Error de comunicación con el servidor. Intenta de nuevo.';
  if (m.includes('unknown') || m.includes('accion get desconocida')) return 'Error de comunicación con el servidor. Intenta de nuevo.';
  if (m.includes('no autorizado') || m.includes('unauthorized')) return 'No tienes permiso para realizar esta acción.';
  if (m.includes('ya existe') || m.includes('already')) return 'Este espacio ya está reservado para ese horario.';
  if (m.includes('timeout') || m.includes('time out')) return 'El servidor tardó demasiado. Revisa tu conexión.';
  if (m.includes('network') || m.includes('fetch')) return 'Error de red. Verifica tu conexión a internet.';
  return msg; // devolver el mensaje original si no se reconoce
}

export default function PanelConfirmacion({ recursoId, fecha, bloqueId, onCerrar }: Props) {
  const { userId, jornada, agregarReserva } = useAppStore();
  const [proposito, setProposito] = useState('');
  const [equipos, setEquipos]     = useState('');
  const [cargando, setCargando]   = useState(false);
  const [error, setError]         = useState('');

  const recurso = RECURSOS.find(r => r.id === recursoId);
  const bloques = jornada === 'tarde' ? BLOQUES_TARDE : BLOQUES_MANANA;
  const bloque  = bloques.find(b => b.id === bloqueId);

  // Formatear fecha legible
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const [anio, mes, dia] = fecha.split('-');
  const fechaLegible = `${parseInt(dia)} ${MESES[parseInt(mes) - 1]} ${anio}`;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId || !proposito) return;
    setCargando(true);
    setError('');
    try {
      const res = await crearReserva({
        recurso: recursoId,
        fecha,
        bloque: bloqueId,
        solicitante: userId,
        proposito,
        equipos: equipos || undefined,
      });
      if (res.ok && res.id) {
        agregarReserva({
          id: res.id,
          recurso: recursoId,
          fecha,
          bloque: bloqueId,
          solicitante: userId,
          proposito,
          equipos: equipos || undefined,
          estado: 'pendiente',
          timestamp: new Date().toISOString(),
        });
        onCerrar();
      } else {
        setError(traducirError(res.error ?? ''));
      }
    } catch {
      setError('Error de conexión. Verifica tu internet.');
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-gray-900/95 rounded-2xl border border-white/10 shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-white/8">
          <h3 className="text-white font-semibold">Solicitar reserva</h3>
          <button
            onClick={onCerrar}
            className="text-gray-500 hover:text-white transition text-lg leading-none"
          >
            ✕
          </button>
        </div>

        {/* Resumen */}
        <div className="px-6 py-4 bg-white/3 border-b border-white/6 text-sm space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-500">Espacio</span>
            <span className="text-white font-semibold">{recurso?.nombre}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Fecha</span>
            <span className="text-white">{fechaLegible}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">{horaOrdinal(bloqueId)} hora</span>
            <span className="text-white">{bloque?.inicio} – {bloque?.fin}</span>
          </div>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Propósito *</label>
            <select
              value={proposito}
              onChange={e => setProposito(e.target.value)}
              required
              className="w-full bg-gray-800 text-white rounded-xl px-3 py-2.5 text-sm border border-white/10 focus:outline-none focus:border-blue-500 transition"
            >
              <option value="">Seleccionar...</option>
              {PROPOSITOS.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Equipos adicionales</label>
            <input
              type="text"
              placeholder="Ej: proyector, parlantes..."
              value={equipos}
              onChange={e => setEquipos(e.target.value)}
              className="w-full bg-gray-800 text-white rounded-xl px-3 py-2.5 text-sm border border-white/10 focus:outline-none focus:border-blue-500 transition"
            />
          </div>

          {error && (
            <p className="text-red-400 text-xs bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onCerrar}
              className="flex-1 py-3 rounded-xl bg-white/6 text-gray-300 hover:bg-white/10 text-sm transition font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={cargando || !proposito}
              className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-semibold text-sm transition"
            >
              {cargando ? 'Enviando...' : 'Solicitar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
