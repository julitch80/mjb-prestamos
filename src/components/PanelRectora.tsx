import { useEffect, useState } from 'react';
import { useAppStore } from '../data/store';
import { getReservas } from '../data/api';
import type { Reserva } from '../data/api';
import PopupRectora from './PopupRectora';

export default function PanelRectora() {
  const { userId, reservas, setReservas } = useAppStore();
  const [cargando, setCargando] = useState(false);
  const [popupAbierto, setPopupAbierto] = useState(false);

  useEffect(() => {
    setCargando(true);
    getReservas()
      .then(todas => {
        const mias = todas.filter(r => r.solicitante === userId);
        setReservas(mias);
      })
      .catch(() => {})
      .finally(() => setCargando(false));
  }, [userId, setReservas]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Panel Rectoría</h2>
        <button
          onClick={() => setPopupAbierto(true)}
          className="px-4 py-2 rounded-lg bg-yellow-600 hover:bg-yellow-500 text-white text-sm font-medium transition"
        >
          + Asignación directa
        </button>
      </div>

      {/* Historial de asignaciones */}
      {cargando ? (
        <div className="text-center py-12 text-gray-400">Cargando...</div>
      ) : reservas.length === 0 ? (
        <div className="text-center py-12 text-gray-500">Sin asignaciones registradas.</div>
      ) : (
        <div className="space-y-3">
          {reservas.map((r: Reserva) => (
            <div key={r.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-white font-medium">{r.recurso}</p>
                  <p className="text-sm text-gray-400">{r.fecha} · Bloque {r.bloque}</p>
                  <p className="text-sm text-gray-400">{r.proposito}</p>
                  {r.motivo && <p className="text-xs text-gray-500 mt-1">{r.motivo}</p>}
                </div>
                <span className="text-xs text-yellow-400 font-medium">Directa</span>
              </div>
              <p className="text-xs text-gray-600 mt-2">{r.timestamp}</p>
            </div>
          ))}
        </div>
      )}

      {popupAbierto && <PopupRectora onCerrar={() => setPopupAbierto(false)} />}
    </div>
  );
}
