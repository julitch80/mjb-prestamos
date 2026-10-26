import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight, type LucideIcon } from 'lucide-react';
import { cn } from '../lib/utils';

// Tres niveles de navegación, cada uno con su propia forma (Julián, 27-oct-2026):
//   1. Sección del módulo  → <SelectorSeccion>: título «Módulo · Sección ▾» que abre una matriz.
//   2. Páginas de un objeto → una sola fila de pastillas (lo que ya hay), con <Migas> encima.
//   3. Partes de una página → <PestanasSubrayadas>: texto con raya bajo la activa.
// Regla: nunca dos filas de pastillas apiladas.

export type Opcion<T extends string> = { id: T; label: string; Icono?: LucideIcon; badge?: number; atenuada?: boolean };

/** Nivel 1: «Asistencia · Planillas ▾» → matriz de secciones. */
export function SelectorSeccion<T extends string>({ modulo, opciones, activa, onCambio, Icono }: {
  modulo: string;
  opciones: Opcion<T>[];
  activa: T;
  onCambio: (id: T) => void;
  Icono?: LucideIcon;
}) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const actual = opciones.find(o => o.id === activa) ?? opciones[0];
  const totalBadges = opciones.filter(o => o.id !== activa).reduce((n, o) => n + (o.badge ?? 0), 0);

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false); };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setAbierto(false);
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', fuera); document.removeEventListener('keydown', esc); };
  }, [abierto]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setAbierto(v => !v)}
        aria-haspopup="menu"
        aria-expanded={abierto}
        className="w-full min-h-[48px] flex items-center gap-2 rounded-xl border border-line bg-card px-3 text-left hover:bg-elevated transition"
      >
        {Icono && <Icono size={20} className="text-accent flex-shrink-0" aria-hidden />}
        <span className="flex-1 min-w-0 truncate text-base">
          <span className="text-muted">{modulo} · </span>
          <span className="font-semibold text-strong">{actual?.label}</span>
        </span>
        {totalBadges > 0 && (
          <span className="min-w-5 h-5 px-1 rounded-full bg-danger text-white text-[11px] font-bold flex items-center justify-center">{totalBadges}</span>
        )}
        <ChevronDown size={20} className={cn('text-muted transition-transform', abierto && 'rotate-180')} aria-hidden />
      </button>
      {abierto && (
        <div role="menu" className="absolute left-0 right-0 top-full mt-1.5 z-40 rounded-2xl border border-line bg-card shadow-xl p-2">
          <div className="grid grid-cols-3 gap-1.5">
            {opciones.map(o => {
              const activo = o.id === activa;
              const Ic = o.Icono;
              return (
                <button
                  key={o.id}
                  role="menuitem"
                  type="button"
                  aria-current={activo ? 'page' : undefined}
                  onClick={() => { onCambio(o.id); setAbierto(false); }}
                  className={cn(
                    'relative min-h-[72px] flex flex-col items-center justify-center gap-1.5 rounded-lg px-1 py-2 text-center transition',
                    activo ? 'bg-accent-soft text-accent-soft-fg ring-1 ring-accent/40' : 'bg-elevated/70 text-strong hover:bg-elevated',
                    o.atenuada && !activo && 'opacity-60',
                  )}
                >
                  {Ic && <Ic size={22} aria-hidden />}
                  <span className="text-xs font-medium leading-tight">{o.label}</span>
                  {(o.badge ?? 0) > 0 && (
                    <span className="absolute top-1 right-1 min-w-5 h-5 px-1 rounded-full bg-danger text-white text-[11px] font-bold flex items-center justify-center">{o.badge}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/** Ruta «Mis grupos › 11.2 › Reporte»: el último tramo no es enlace. */
export function Migas({ tramos }: { tramos: { label: string; onClick?: () => void }[] }) {
  return (
    <nav aria-label="Ubicación" className="flex flex-wrap items-center gap-0.5 text-sm">
      {tramos.map((t, i) => {
        const ultimo = i === tramos.length - 1;
        return (
          <span key={i} className="inline-flex items-center gap-0.5">
            {t.onClick && !ultimo ? (
              <button type="button" onClick={t.onClick} className="min-h-[44px] px-1 text-accent hover:underline">{t.label}</button>
            ) : (
              <span className={cn('px-1', ultimo ? 'font-semibold text-strong' : 'text-muted')} aria-current={ultimo ? 'page' : undefined}>{t.label}</span>
            )}
            {!ultimo && <ChevronRight size={16} className="text-muted" aria-hidden />}
          </span>
        );
      })}
    </nav>
  );
}

/** Nivel 3: pestañas subrayadas. Desplazables si no caben; la activa se trae a la vista. */
export function PestanasSubrayadas<T extends string>({ opciones, activa, onCambio, extra }: {
  opciones: Opcion<T>[];
  activa: T;
  onCambio: (id: T) => void;
  extra?: ReactNode;
}) {
  const fila = useRef<HTMLDivElement>(null);
  useEffect(() => {
    fila.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [activa]);
  return (
    <div className="flex items-end gap-2 border-b border-line">
      <div ref={fila} role="tablist" className="flex-1 min-w-0 flex overflow-x-auto [scrollbar-width:none]">
        {opciones.map(o => {
          const activo = o.id === activa;
          return (
            <button
              key={o.id}
              role="tab"
              type="button"
              aria-selected={activo}
              onClick={() => onCambio(o.id)}
              className={cn(
                'relative min-h-[44px] px-3 whitespace-nowrap text-sm transition -mb-px border-b-2',
                activo ? 'border-accent text-strong font-semibold' : 'border-transparent text-soft hover:text-strong',
                o.atenuada && !activo && 'opacity-60',
              )}
            >
              {o.label}
              {(o.badge ?? 0) > 0 && (
                <span className="ml-1.5 inline-flex min-w-5 h-5 px-1 rounded-full bg-danger text-white text-[11px] font-bold items-center justify-center align-middle">{o.badge}</span>
              )}
            </button>
          );
        })}
      </div>
      {extra}
    </div>
  );
}
