import { useEffect, useMemo, useState } from 'react';
import { PestanasSubrayadas } from './Navegacion';
import { useAppStore } from '../data/store';
import { getReservas, actualizarReserva } from '../data/api';
import type { Reserva } from '../data/api';
import { USUARIOS } from '../data/maestros';
import { nombreRecurso, nombreSolicitante, fechaLegible, bloqueLegible } from '../data/formatoReserva';
import { useCasosVencidos } from '../hooks/useCasosVencidos';

type Pestaña = 'pendientes' | 'hoy' | 'historial' | 'config';

export default function PanelAdmin() {
  const { reservas, setReservas, temaOscuro, toggleTema, actualizarReserva: actualizarStore, jornada, userId, setVistaActual } = useAppStore();
  const casosVencidos = useCasosVencidos(userId);
  const [pestaña, setPestaña] = useState<Pestaña>('pendientes');
  const [cargando, setCargando] = useState(false);
  const [enviando, setEnviando] = useState<string | null>(null);
  const [errorDecision, setErrorDecision] = useState<string | null>(null);

  const hoy = new Date().toISOString().split('T')[0];

  useEffect(() => {
    setCargando(true);
    getReservas()
      .then(setReservas)
      .catch(() => {})
      .finally(() => setCargando(false));
  }, [setReservas]);

  // Filtrar por jornada del coordinador: cada uno solo debe ver/aprobar lo suyo.
  // Si el solicitante no esta en USUARIOS, o la jornada del coordinador no es
  // 'manana'/'tarde' (ej. rectora con 'ambas'), se muestra igual: es preferible
  // ver una reserva de mas que perder una solicitud sin que nadie se entere.
  const reservasJornada = useMemo(() => {
    if (jornada !== 'manana' && jornada !== 'tarde') return reservas;
    return reservas.filter(r => {
      const jornadaSolicitante = USUARIOS.find(u => u.id === r.solicitante)?.jornada;
      if (!jornadaSolicitante) return true;
      return jornadaSolicitante === jornada || jornadaSolicitante === 'ambas';
    });
  }, [reservas, jornada]);

  const pendientes = reservasJornada.filter(r => r.estado === 'pendiente');
  const deHoy = reservasJornada.filter(r => r.fecha === hoy && r.estado === 'aprobada');

  async function handleDecision(r: Reserva, estado: 'aprobada' | 'rechazada') {
    if (enviando) return;
    setEnviando(r.id);
    setErrorDecision(null);
    try {
      await actualizarReserva(r.id, estado);
      actualizarStore(r.id, { estado });
    } catch (e) {
      const detalle = e instanceof Error && e.message ? ` (${e.message})` : '';
      setErrorDecision(`No se pudo ${estado === 'aprobada' ? 'aprobar' : 'rechazar'} la solicitud${detalle}. Revisa la conexión e inténtalo de nuevo.`);
    } finally {
      setEnviando(null);
    }
  }

  const pestañas: { id: Pestaña; label: string; badge?: number }[] = [
    { id: 'pendientes', label: 'Pendientes', badge: pendientes.length },
    { id: 'hoy',        label: 'Hoy',        badge: deHoy.length },
    { id: 'historial',  label: 'Historial' },
    { id: 'config',     label: 'Configuración' },
  ];

  return (
    <div className="space-y-4">
      <PestanasSubrayadas opciones={pestañas} activa={pestaña} onCambio={setPestaña} />

      {/* Casos de riesgo y Horario viven UNA sola vez (menú → Gestión del Riesgo → Casos; menú → Horario). */}
      {casosVencidos > 0 && (
        <button
          onClick={() => setVistaActual('riesgo')}
          className="w-full min-h-[44px] text-left rounded-xl border border-danger bg-danger-soft text-danger-soft-fg text-sm px-4 py-2"
        >
          🔴 {casosVencidos} {casosVencidos === 1 ? 'caso vencido' : 'casos vencidos'} sin seguimiento · Ver en Gestión del Riesgo → Casos
        </button>
      )}

      {errorDecision && (
        <div role="alert" className="flex items-start justify-between gap-3 rounded-xl border border-danger bg-danger-soft text-danger-soft-fg text-sm p-3">
          <span>{errorDecision}</span>
          <button onClick={() => setErrorDecision(null)} aria-label="Cerrar aviso" className="min-h-[44px] min-w-[44px] -my-2 -mr-2">✕</button>
        </div>
      )}

      {cargando && <div className="text-center py-8 text-soft">Cargando...</div>}

      {/* Pendientes */}
      {pestaña === 'pendientes' && !cargando && (
        <div className="space-y-3">
          {pendientes.length === 0 ? (
            <div className="text-center py-12 text-muted">No hay solicitudes pendientes.</div>
          ) : (
            pendientes.map(r => (
              <ReservaCard key={r.id} reserva={r} onDecision={handleDecision} enviando={enviando !== null} />
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

      {/* Configuración */}
      {pestaña === 'config' && (
        <div className="space-y-4 max-w-sm">
          <div className="bg-card rounded-xl p-6 space-y-4">
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
  enviando = false,
}: {
  reserva: Reserva;
  onDecision?: (r: Reserva, estado: 'aprobada' | 'rechazada') => void;
  enviando?: boolean;
}) {
  const cfg = ESTADO_CONFIG[reserva.estado];
  return (
    <div className="bg-card border border-gray-800 rounded-xl p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <p className="text-strong font-medium">{nombreRecurso(reserva.recurso)}</p>
          <p className="text-sm text-soft">{fechaLegible(reserva.fecha)} · {bloqueLegible(reserva)}</p>
          <p className="text-sm text-soft">{reserva.proposito}</p>
          <p className="text-xs text-muted mt-0.5">Solicitante: {nombreSolicitante(reserva.solicitante)}</p>
        </div>
        <span className={`text-xs font-medium flex-shrink-0 ${cfg.color}`}>{cfg.label}</span>
      </div>
      {onDecision && reserva.estado === 'pendiente' && (
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => onDecision(reserva, 'rechazada')}
            disabled={enviando}
            className="flex-1 min-h-[44px] py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed bg-danger-soft hover:bg-red-800/60 text-danger-soft-fg text-sm transition"
          >
            Rechazar
          </button>
          <button
            onClick={() => onDecision(reserva, 'aprobada')}
            disabled={enviando}
            className="flex-1 min-h-[44px] py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed bg-success-soft hover:bg-green-800/60 text-success-soft-fg text-sm transition"
          >
            Aprobar
          </button>
        </div>
      )}
    </div>
  );
}
