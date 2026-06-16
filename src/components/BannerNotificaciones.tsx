import { AnimatePresence, motion } from 'motion/react';
import { useAppStore } from '../data/store';
import { marcarLeida, marcarTodasLeidas } from '../data/api';
import { cn } from '@/lib/utils';

const TIPO_CONFIG = {
  rectoria:    { label: 'Rectoría',    bg: 'bg-warning-soft', fg: 'text-warning-soft-fg', icon: '👑' },
  coordinador: { label: 'Coordinador', bg: 'bg-info-soft',    fg: 'text-info-soft-fg',    icon: '📋' },
  intercambio: { label: 'Intercambio', bg: 'bg-info-soft',    fg: 'text-info-soft-fg',    icon: '🔄' },
  aprobada:    { label: 'Aprobada',    bg: 'bg-success-soft', fg: 'text-success-soft-fg', icon: '✅' },
  rechazada:   { label: 'Rechazada',   bg: 'bg-danger-soft',  fg: 'text-danger-soft-fg',  icon: '❌' },
  cancelada:   { label: 'Cancelada',   bg: 'bg-elevated',     fg: 'text-soft',            icon: '🚫' },
} as const;

function tiempoRelativo(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const min = Math.round((Date.now() - d.getTime()) / 60000);
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
}

export default function BannerNotificaciones() {
  const { notificaciones, userId, marcarNotifLeida, marcarTodasLeidas: marcarTodasStore } =
    useAppStore();

  // Solo se muestran las NO leídas. Al marcarlas, desaparecen y el banner se
  // cierra solo; no vuelve a salir hasta que llegue una notificación nueva.
  const noLeidas = notificaciones.filter((n) => !n.leida);
  if (noLeidas.length === 0) return null;

  async function descartar(id: string) {
    if (!userId) return;
    marcarNotifLeida(id);
    await marcarLeida(userId, id).catch(() => {});
  }

  async function descartarTodas() {
    if (!userId) return;
    marcarTodasStore();
    await marcarTodasLeidas(userId).catch(() => {});
  }

  return (
    <div className="bg-card border-b border-line">
      <div className="max-w-7xl mx-auto px-4 py-2.5">
        <div className="flex items-center gap-2 mb-2">
          <span>🔔</span>
          <span className="text-strong font-medium text-sm">
            {noLeidas.length === 1
              ? 'Tienes 1 notificación nueva'
              : `Tienes ${noLeidas.length} notificaciones nuevas`}
          </span>
          <button
            onClick={descartarTodas}
            className="ml-auto text-xs text-muted hover:text-strong transition px-2 py-1 rounded-lg hover:bg-elevated"
          >
            Descartar todas
          </button>
        </div>

        <div className="space-y-2 max-h-64 overflow-y-auto">
          <AnimatePresence initial={false}>
            {noLeidas.map((n) => {
              const cfg = TIPO_CONFIG[n.tipo];
              return (
                <motion.div
                  key={n.id}
                  layout
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 20, height: 0, marginBottom: 0 }}
                  transition={{ duration: 0.18 }}
                  className={cn('flex items-start gap-3 p-3 rounded-xl border border-line', cfg.bg)}
                >
                  <span className="text-base leading-none mt-0.5">{cfg.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={cn('text-[11px] font-semibold', cfg.fg)}>{cfg.label}</p>
                      <span className="text-[10px] text-muted">{tiempoRelativo(n.timestamp)}</span>
                    </div>
                    <p className="text-sm text-strong mt-0.5">{n.mensaje}</p>
                  </div>
                  <button
                    onClick={() => descartar(n.id)}
                    className="flex-shrink-0 flex items-center gap-1 text-xs text-muted hover:text-strong transition px-2 py-1 rounded-lg hover:bg-elevated"
                    title="Marcar como leída y quitar"
                    aria-label="Descartar notificación"
                  >
                    ✕ <span className="hidden sm:inline">Listo</span>
                  </button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
