import { useState } from 'react';
import { useAppStore } from '../data/store';
import { crearReserva } from '../data/api';
import { RECURSOS, MOTIVOS_RECTORA } from '../data/maestros';

interface Props {
  // Puede recibir datos preseleccionados si se abre desde DisponibilidadGrid
  recursoIdInicial?: string;
  fechaInicial?: string;
  bloqueIdInicial?: number;
  onCerrar: () => void;
}

export default function PopupRectora({ recursoIdInicial, fechaInicial, bloqueIdInicial, onCerrar }: Props) {
  const { userId, agregarReserva } = useAppStore();

  const [recursoId, setRecursoId] = useState(recursoIdInicial ?? '');
  const [fecha, setFecha] = useState(fechaInicial ?? new Date().toISOString().split('T')[0]);
  const [bloqueId, setBloqueId] = useState<number>(bloqueIdInicial ?? 1);
  const [motivo, setMotivo] = useState('');
  const [motivoPersonalizado, setMotivoPersonalizado] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  const recursosDisponibles = RECURSOS;
  const motivoFinal = motivo === 'Otro' ? motivoPersonalizado : motivo;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId || !recursoId || !fecha || !bloqueId || !motivoFinal) return;
    setCargando(true);
    setError('');
    try {
      const res = await crearReserva({
        recurso: recursoId,
        fecha,
        bloque: bloqueId,
        solicitante: userId,
        proposito: 'Asignación directa de rectoría',
        equipos: undefined,
      });
      if (res.ok && res.id) {
        agregarReserva({
          id: res.id,
          recurso: recursoId,
          fecha,
          bloque: bloqueId,
          solicitante: userId,
          proposito: 'Asignación directa de rectoría',
          motivo: motivoFinal,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-sm bg-card rounded-2xl p-6 border border-yellow-900/50 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-strong font-semibold flex items-center gap-2">
            <span className="text-yellow-400">👑</span> Asignación directa
          </h3>
          <button onClick={onCerrar} className="text-muted hover:text-strong text-xl transition">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs text-soft mb-1">Espacio</label>
            <select
              value={recursoId}
              onChange={e => setRecursoId(e.target.value)}
              required
              className="w-full bg-elevated text-strong rounded-lg px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:border-yellow-500"
            >
              <option value="">Seleccionar...</option>
              {recursosDisponibles.map(r => (
                <option key={r.id} value={r.id}>{r.nombre}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-soft mb-1">Fecha</label>
              <input
                type="date"
                value={fecha}
                onChange={e => setFecha(e.target.value)}
                required
                className="w-full bg-elevated text-strong rounded-lg px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:border-yellow-500"
              />
            </div>
            <div>
              <label className="block text-xs text-soft mb-1">Bloque</label>
              <select
                value={bloqueId}
                onChange={e => setBloqueId(Number(e.target.value))}
                required
                className="w-full bg-elevated text-strong rounded-lg px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:border-yellow-500"
              >
                {[1,2,3,4,5,6].map(b => (
                  <option key={b} value={b}>Bloque {b}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-soft mb-1">Motivo</label>
            <select
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              required
              className="w-full bg-elevated text-strong rounded-lg px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:border-yellow-500"
            >
              <option value="">Seleccionar...</option>
              {MOTIVOS_RECTORA.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {motivo === 'Otro' && (
            <input
              type="text"
              placeholder="Especificar motivo..."
              value={motivoPersonalizado}
              onChange={e => setMotivoPersonalizado(e.target.value)}
              required
              className="w-full bg-elevated text-strong rounded-lg px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:border-yellow-500"
            />
          )}

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onCerrar}
              className="flex-1 py-2.5 rounded-lg bg-elevated text-soft hover:bg-gray-700 text-sm transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={cargando}
              className="flex-1 py-2.5 rounded-lg bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50 text-strong font-medium text-sm transition"
            >
              {cargando ? 'Asignando...' : 'Asignar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
