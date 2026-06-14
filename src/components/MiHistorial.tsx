import { useEffect, useState } from 'react';
import { useAppStore } from '../data/store';
import { getReservas } from '../data/api';
import type { Reserva } from '../data/api';

const ESTADO_CONFIG = {
  pendiente: { label: 'Pendiente', color: 'text-yellow-400', bg: 'bg-yellow-900/30' },
  aprobada:  { label: 'Aprobada',  color: 'text-green-400',  bg: 'bg-green-900/30' },
  rechazada: { label: 'Rechazada', color: 'text-red-400',    bg: 'bg-red-900/30' },
  cancelada: { label: 'Cancelada', color: 'text-soft',   bg: 'bg-elevated/30' },
} as const;

export default function MiHistorial() {
  const { userId, reservas, setReservas } = useAppStore();
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (!userId) return;
    setCargando(true);
    getReservas()
      .then(todas => {
        const mias = todas.filter(r => r.solicitante === userId);
        setReservas(mias);
      })
      .catch(() => {})
      .finally(() => setCargando(false));
  }, [userId, setReservas]);

  if (cargando) {
    return (
      <div className="flex items-center justify-center py-20 text-soft">
        Cargando historial...
      </div>
    );
  }

  if (reservas.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted">
        <p className="text-4xl mb-3">📋</p>
        <p>No tienes reservas registradas.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-strong mb-4">Mis reservas</h2>
      {reservas.map((r: Reserva) => {
        const cfg = ESTADO_CONFIG[r.estado];
        return (
          <div
            key={r.id}
            className="bg-card border border-gray-800 rounded-xl p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-strong font-medium">{r.recurso}</p>
                <p className="text-sm text-soft mt-0.5">
                  {r.fecha} · Bloque {r.bloque}
                </p>
                <p className="text-sm text-soft">{r.proposito}</p>
                {r.equipos && (
                  <p className="text-xs text-muted mt-1">Equipos: {r.equipos}</p>
                )}
                {r.motivo && (
                  <p className="text-xs text-muted mt-1">Motivo: {r.motivo}</p>
                )}
              </div>
              <span className={`flex-shrink-0 text-xs font-medium px-2.5 py-1 rounded-full ${cfg.color} ${cfg.bg}`}>
                {cfg.label}
              </span>
            </div>
            <p className="text-xs text-muted mt-2">{r.timestamp}</p>
          </div>
        );
      })}
    </div>
  );
}
