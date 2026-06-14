import { useEffect, useState } from 'react';
import { useAppStore } from '../data/store';
import { getReservas, actualizarReserva } from '../data/api';
import type { Reserva } from '../data/api';
import VistaHorario from './VistaHorario';

type Pestaña = 'pendientes' | 'hoy' | 'historial' | 'horario' | 'config';

export default function PanelAdmin() {
  const { reservas, setReservas, temaOscuro, toggleTema, actualizarReserva: actualizarStore } = useAppStore();
  const [pestaña, setPestaña] = useState<Pestaña>('pendientes');
  const [cargando, setCargando] = useState(false);

  const hoy = new Date().toISOString().split('T')[0];

  useEffect(() => {
    setCargando(true);
    getReservas()
      .then(setReservas)
      .catch(() => {})
      .finally(() => setCargando(false));
  }, [setReservas]);

  // Filtrar por jornada del coordinador
  const reservasJornada = reservas;

  const pendientes = reservasJornada.filter(r => r.estado === 'pendiente');
  const deHoy = reservasJornada.filter(r => r.fecha === hoy && r.estado === 'aprobada');

  async function handleDecision(r: Reserva, estado: 'aprobada' | 'rechazada') {
    try {
      await actualizarReserva(r.id, estado);
      actualizarStore(r.id, { estado });
    } catch {
      // silencioso
    }
  }

  const pestañas: { id: Pestaña; label: string; badge?: number }[] = [
    { id: 'pendientes', label: 'Pendientes', badge: pendientes.length },
    { id: 'hoy',        label: 'Hoy',        badge: deHoy.length },
    { id: 'historial',  label: 'Historial' },
    { id: 'horario',    label: 'Horario del J' },
    { id: 'config',     label: 'Configuración' },
  ];

  return (
    <div className="space-y-4">
      {/* Pestañas */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {pestañas.map(p => (
          <button
            key={p.id}
            onClick={() => setPestaña(p.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
              pestaña === p.id
                ? 'bg-accent text-strong'
                : 'bg-elevated text-soft hover:text-strong hover:bg-gray-700'
            }`}
          >
            {p.label}
            {p.badge !== undefined && p.badge > 0 && (
              <span className="bg-danger text-strong text-xs rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center">
                {p.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {cargando && <div className="text-center py-8 text-soft">Cargando...</div>}

      {/* Pendientes */}
      {pestaña === 'pendientes' && !cargando && (
        <div className="space-y-3">
          {pendientes.length === 0 ? (
            <div className="text-center py-12 text-muted">No hay solicitudes pendientes.</div>
          ) : (
            pendientes.map(r => (
              <ReservaCard key={r.id} reserva={r} onDecision={handleDecision} />
            ))
          )}
        </div>
      )}

      {/* Hoy */}
      {pestaña === 'hoy' && !cargando && (
        <div className="space-y-3">
          {deHoy.length === 0 ? (
            <div className="text-center py-12 text-muted">Sin reservas aprobadas para hoy.</div>
          ) : (
            deHoy.map(r => (
              <ReservaCard key={r.id} reserva={r} />
            ))
          )}
        </div>
      )}

      {/* Historial */}
      {pestaña === 'historial' && !cargando && (
        <div className="space-y-3">
          {reservasJornada.length === 0 ? (
            <div className="text-center py-12 text-muted">Sin historial.</div>
          ) : (
            reservasJornada.map(r => (
              <ReservaCard key={r.id} reserva={r} />
            ))
          )}
        </div>
      )}

      {/* Horario */}
      {pestaña === 'horario' && <VistaHorario />}

      {/* Configuración */}
      {pestaña === 'config' && (
        <div className="bg-card rounded-xl p-6 space-y-4 max-w-sm">
          <h3 className="text-strong font-semibold">Configuración</h3>
          <div className="flex items-center justify-between">
            <span className="text-soft text-sm">Tema de la interfaz</span>
            <button
              onClick={toggleTema}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-elevated text-soft hover:bg-gray-700 text-sm transition"
            >
              {temaOscuro ? '🌙 Oscuro' : '☀️ Claro'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Componente tarjeta de reserva ──────────────────────────────────────────────

const ESTADO_CONFIG = {
  pendiente: { label: 'Pendiente', color: 'text-yellow-400' },
  aprobada:  { label: 'Aprobada',  color: 'text-success' },
  rechazada: { label: 'Rechazada', color: 'text-danger' },
  cancelada: { label: 'Cancelada', color: 'text-soft' },
} as const;

function ReservaCard({
  reserva,
  onDecision,
}: {
  reserva: Reserva;
  onDecision?: (r: Reserva, estado: 'aprobada' | 'rechazada') => void;
}) {
  const cfg = ESTADO_CONFIG[reserva.estado];
  return (
    <div className="bg-card border border-gray-800 rounded-xl p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <p className="text-strong font-medium">{reserva.recurso}</p>
          <p className="text-sm text-soft">{reserva.fecha} · Bloque {reserva.bloque}</p>
          <p className="text-sm text-soft">{reserva.proposito}</p>
          <p className="text-xs text-muted mt-0.5">Solicitante: {reserva.solicitante}</p>
        </div>
        <span className={`text-xs font-medium flex-shrink-0 ${cfg.color}`}>{cfg.label}</span>
      </div>
      {onDecision && reserva.estado === 'pendiente' && (
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => onDecision(reserva, 'rechazada')}
            className="flex-1 py-2 rounded-lg bg-danger-soft hover:bg-red-800/60 text-danger-soft-fg text-sm transition"
          >
            Rechazar
          </button>
          <button
            onClick={() => onDecision(reserva, 'aprobada')}
            className="flex-1 py-2 rounded-lg bg-success-soft hover:bg-green-800/60 text-success-soft-fg text-sm transition"
          >
            Aprobar
          </button>
        </div>
      )}
    </div>
  );
}
