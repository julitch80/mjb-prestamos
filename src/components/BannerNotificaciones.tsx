import { useState } from 'react';
import { useAppStore } from '../data/store';
import { marcarLeida, marcarTodasLeidas } from '../data/api';

const TIPO_CONFIG = {
  rectoria:    { label: 'Rectoría',    bg: 'bg-yellow-900/40',  border: 'border-yellow-700', icon: '👑' },
  coordinador: { label: 'Coordinador', bg: 'bg-red-900/40',     border: 'border-red-700',    icon: '📋' },
  intercambio: { label: 'Intercambio', bg: 'bg-blue-900/40',    border: 'border-blue-700',   icon: '🔄' },
  aprobada:    { label: 'Aprobada',    bg: 'bg-green-900/40',   border: 'border-green-700',  icon: '✅' },
  rechazada:   { label: 'Rechazada',   bg: 'bg-red-900/40',     border: 'border-red-700',    icon: '❌' },
  cancelada:   { label: 'Cancelada',   bg: 'bg-gray-800/40',    border: 'border-gray-700',   icon: '🚫' },
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
    <div className="bg-gray-900 border-b border-gray-800">
      <div className="max-w-7xl mx-auto px-4">
        <button
          onClick={() => setExpandido(v => !v)}
          className="w-full flex items-center gap-2 py-2 text-sm text-left"
        >
          <span className="text-yellow-400">🔔</span>
          <span className="text-white font-medium">
            {noLeidas.length > 0
              ? `${noLeidas.length} notificación${noLeidas.length > 1 ? 'es' : ''} nueva${noLeidas.length > 1 ? 's' : ''}`
              : 'Notificaciones'}
          </span>
          {noLeidas.length > 0 && (
            <span className="ml-1 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">
              {noLeidas.length}
            </span>
          )}
          <span className="ml-auto text-gray-500">{expandido ? '▲' : '▼'}</span>
        </button>

        {expandido && (
          <div className="pb-3 space-y-2">
            {noLeidas.length > 0 && (
              <div className="flex justify-end">
                <button
                  onClick={handleMarcarTodas}
                  className="text-xs text-blue-400 hover:text-blue-300 transition"
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
                    <p className="text-xs font-medium text-gray-300">{cfg.label}</p>
                    <p className="text-sm text-white mt-0.5">{n.mensaje}</p>
                    <p className="text-xs text-gray-500 mt-1">{n.timestamp}</p>
                  </div>
                  {!n.leida && (
                    <button
                      onClick={() => handleMarcarLeida(n.id)}
                      className="text-xs text-gray-500 hover:text-gray-300 flex-shrink-0 transition"
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
