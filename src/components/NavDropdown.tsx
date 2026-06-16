import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  CalendarPlus,
  ListChecks,
  LayoutDashboard,
  Stamp,
  CalendarDays,
  ChevronDown,
  Check,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '../lib/utils';

export type NavOption = {
  id: string;
  label: string;
  descripcion: string;
};

const ICONOS: Record<string, LucideIcon> = {
  disponibilidad: CalendarPlus,
  historial: ListChecks,
  admin: LayoutDashboard,
  rectora: Stamp,
  horario: CalendarDays,
};

interface Props {
  opciones: NavOption[];
  activa: string;
  onSelect: (id: string) => void;
  /** notificaciones nuevas, badge en "Reservar" y en el botón cerrado */
  badge?: number;
}

export default function NavDropdown({ opciones, activa, onSelect, badge = 0 }: Props) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const actual = opciones.find(o => o.id === activa) ?? opciones[0];
  const IconActual = ICONOS[actual?.id] ?? CalendarPlus;

  // Cerrar al hacer clic afuera o con Escape
  useEffect(() => {
    if (!abierto) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setAbierto(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [abierto]);

  function elegir(id: string) {
    onSelect(id);
    setAbierto(false);
  }

  return (
    <div ref={ref} className="relative flex-1 min-w-0">
      {/* Botón que muestra la sección actual */}
      <button
        onClick={() => setAbierto(v => !v)}
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
          'text-strong hover:bg-elevated border',
          abierto ? 'bg-elevated border-line-strong' : 'border-line',
        )}
        aria-haspopup="menu"
        aria-expanded={abierto}
      >
        <IconActual size={16} className="flex-shrink-0 text-muted" />
        <span className="truncate">{actual?.label}</span>
        {badge > 0 && actual?.id !== 'disponibilidad' && (
          <span className="min-w-4 h-4 bg-danger text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
            {badge}
          </span>
        )}
        <motion.span animate={{ rotate: abierto ? 180 : 0 }} transition={{ duration: 0.18 }} className="ml-0.5 text-muted">
          <ChevronDown size={15} />
        </motion.span>
      </button>

      {/* Menú desplegable */}
      <AnimatePresence>
        {abierto && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            className="absolute left-0 top-full mt-1.5 w-64 max-w-[calc(100vw-2rem)] z-50 rounded-2xl border border-line bg-card shadow-xl overflow-hidden p-1.5"
          >
            {opciones.map(op => {
              const Icon = ICONOS[op.id] ?? CalendarPlus;
              const activo = op.id === activa;
              const mostrarBadge = op.id === 'disponibilidad' && badge > 0;
              return (
                <button
                  key={op.id}
                  role="menuitem"
                  onClick={() => elegir(op.id)}
                  className={cn(
                    'w-full flex items-start gap-3 px-2.5 py-2 rounded-xl text-left transition',
                    activo ? 'bg-elevated' : 'hover:bg-elevated/60',
                  )}
                >
                  <span
                    className={cn(
                      'mt-0.5 flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center',
                      activo ? 'bg-info-soft text-info-soft-fg' : 'bg-elevated text-muted',
                    )}
                  >
                    <Icon size={16} />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center gap-1.5">
                      <span className="text-sm font-medium text-strong">{op.label}</span>
                      {mostrarBadge && (
                        <span className="min-w-4 h-4 bg-danger text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                          {badge}
                        </span>
                      )}
                      {activo && <Check size={13} className="ml-auto text-info flex-shrink-0" />}
                    </span>
                    <span className="block text-[11px] text-muted leading-tight mt-0.5">{op.descripcion}</span>
                  </span>
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
