import { useState } from 'react';
import { useAppStore } from '../data/store';
import { crearReserva } from '../data/api';
import { RECURSOS, BLOQUES_MANANA, BLOQUES_TARDE, PROPOSITOS } from '../data/maestros';

interface Props {
  recursoId: string;
  fecha: string;
  bloqueId: number;
  onCerrar: () => void;
}

export default function PanelConfirmacion({ recursoId, fecha, bloqueId, onCerrar }: Props) {
  const { userId, jornada, agregarReserva } = useAppStore();
  const [proposito, setProposito] = useState('');
  const [equipos, setEquipos] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  const recurso = RECURSOS.find(r => r.id === recursoId);
  const bloques = jornada === 'tarde' ? BLOQUES_TARDE : BLOQUES_MANANA;
  const bloque = bloques.find(b => b.id === bloqueId);

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
        setError(res.error ?? 'No se pudo crear la reserva');
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md bg-gray-900 rounded-2xl p-6 border border-gray-800 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold">Solicitar reserva</h3>
          <button onClick={onCerrar} className="text-gray-500 hover:text-white text-xl transition">✕</button>
        </div>

        {/* Resumen */}
        <div className="bg-gray-800/60 rounded-xl p-3 mb-4 text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-gray-400">Espacio</span>
            <span className="text-white font-medium">{recurso?.nombre}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Fecha</span>
            <span className="text-white">{fecha}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Bloque {bloqueId}</span>
            <span className="text-white">{bloque?.inicio} – {bloque?.fin}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Propósito *</label>
            <select
              value={proposito}
              onChange={e => setProposito(e.target.value)}
              required
              className="w-full bg-gray-800 text-white rounded-lg px-3 py-2.5 text-sm border border-gray-700 focus:outline-none focus:border-blue-500"
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
              className="w-full bg-gray-800 text-white rounded-lg px-3 py-2.5 text-sm border border-gray-700 focus:outline-none focus:border-blue-500"
            />
          </div>

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCerrar}
              className="flex-1 py-3 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 text-sm transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={cargando || !proposito}
              className="flex-1 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium text-sm transition"
            >
              {cargando ? 'Enviando...' : 'Solicitar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
