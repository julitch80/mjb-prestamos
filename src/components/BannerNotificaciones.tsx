import { useState } from 'react';
import { useAppStore } from '../data/store';
import { marcarLeida, marcarTodasLeidas } from '../data/api';

const TIPO_CONFIG = {
  rectoria:    { label: 'Rectoría',    bg: 'bg-warning-soft',  border: 'border-yellow-700', icon: '👑' },
  coordinador: { label: 'Coordinador', bg: 'bg-danger-soft',     border: 'border-red-700',    icon: '📋' },
  intercambio: { label: 'Intercambio', bg: 'bg-info-soft',    border: 'border-blue-700',   icon: '🔄' },
  aprobada:    { label: 'Aprobada',    bg: 'bg-success-soft',   border: 'border-green-700',  icon: '✅' },
  rechazada:   { label: 'Rechazada',   bg: 'bg-danger-soft',     border: 'border-red-700',    icon: '❌' },
  cancelada:   { label: 'Cancelada',   bg: 'bg-elevated/40',    border: 'border-line',   icon: '🚫' },
} as const;

export default function BannerNotificaciones() {
  const [expandido, setExpandido] = useState(false);
  const { notificaciones, userId, marcarNotifLeida, marcarTodasLeidas: marcarTodasStore } =
    useAppStore();

  const noLeidas = notificaciones.filter(n => !n.leida);
  if (notificaciones.length === 0) return null;

  async function handleMarcarLeida(id: string) {
    if (!userId) return;
    marcarNotifLeida(id);
    await marcarLeida(userId, id).catch(() => {});
  }

  async function handleMarcarTodas() {
    if (!userId) return;
    marcarTodasStore();
    await marcarTodasLeidas(userId).catch(() => {});
  }

  return (
    <div className="bg-card border-b border-gray-800">
      <div className="max-w-7xl mx-auto px-4">
        <button
          onClick={() => setExpandido(v => !v)}
          className="w-full flex items-center gap-2 py-2 text-sm text-left"
        >
          <span className="text-yellow-400">🔔</span>
          <span className="text-strong font-medium">
            {noLeidas.length > 0
              ? `${noLeidas.length} notificación${noLeidas.length > 1 ? 'es' : ''} nueva${noLeidas.length > 1 ? 's' : ''}`
              : 'Notificaciones'}
          </span>
          {noLeidas.length > 0 && (
            <span className="ml-1 bg-danger text-strong text-xs rounded-full px-1.5 py-0.5">
              {noLeidas.length}
            </span>
          )}
          <span className="ml-auto text-muted">{expandido ? '▲' : '▼'}</span>
        </button>

        {expandido && (
          <div className="pb-3 space-y-2">
            {noLeidas.length > 0 && (
              <div className="flex justify-end">
                <button
                  onClick={handleMarcarTodas}
                  className="text-xs text-info hover:text-info-soft-fg transition"
                >
                  Marcar todas como leídas
                </button>
              </div>
            )}

            {notificaciones.map(n => {
              const cfg = TIPO_CONFIG[n.tipo];
              return (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border ${cfg.bg} ${cfg.border} ${n.leida ? 'opacity-50' : ''}`}
                >
                  <span>{cfg.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-soft">{cfg.label}</p>
                    <p className="text-sm text-strong mt-0.5">{n.mensaje}</p>
                    <p className="text-xs text-muted mt-1">{n.timestamp}</p>
                  </div>
                  {!n.leida && (
                    <button
                      onClick={() => handleMarcarLeida(n.id)}
                      className="text-xs text-muted hover:text-soft flex-shrink-0 transition"
                    >
                      Leída
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
