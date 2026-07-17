// Selector de sede para directivos (Fase A — arquitectura multi-sede).
// Los docentes nunca ven este componente: su sede se fija automáticamente
// en el store a partir de su usuario (ver setUsuario en data/store.ts).
//
// Dos modos de uso, ambos montados desde App.tsx:
//   - <SelectorSedeMenu />   → overlay de pantalla completa tras el login,
//     una sola vez por sesión de navegador (sessionStorage).
//   - <SelectorSedePastilla /> → pastilla compacta en el header, siempre
//     visible para directivos, para cambiar de sede en cualquier momento.
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown, Check, Building2 } from 'lucide-react';
import { useAppStore } from '../data/store';
import { SEDES, type SedeId } from '../data/maestros';
import { cn } from '../lib/utils';

const SESSION_KEY = 'mjb-sede-elegida';

export function sedeYaElegidaEnSesion() {
  return sessionStorage.getItem(SESSION_KEY) === '1';
}

function nombreCorto(id: SedeId) {
  return SEDES.find((s) => s.id === id)?.nombre.split(' ')[0] ?? id;
}

/** Overlay de pantalla completa que se muestra una vez por sesión a los directivos. */
export function SelectorSedeMenu({ onElegir }: { onElegir: () => void }) {
  const setSedeActual = useAppStore((s) => s.setSedeActual);

  function elegir(id: SedeId) {
    setSedeActual(id);
    sessionStorage.setItem(SESSION_KEY, '1');
    onElegir();
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-lg rounded-2xl border border-line bg-card p-6 shadow-2xl"
      >
        <h2 className="text-strong text-lg font-semibold">¿Con qué sede quieres trabajar?</h2>
        <p className="text-muted text-xs mt-1 mb-5">
          Puedes cambiarla en cualquier momento desde la pastilla del encabezado.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          {SEDES.map((s) => (
            <button
              key={s.id}
              onClick={() => elegir(s.id)}
              className="flex flex-col items-start gap-2 rounded-xl border border-line bg-elevated p-4 text-left hover:border-line-strong hover:bg-elevated/80 transition"
            >
              <Building2 size={18} className="text-muted" />
              <span className="text-sm font-medium text-strong leading-tight">{s.nombre}</span>
              <span className="text-[11px] text-muted capitalize">{s.nivel}</span>
              {!s.configurada && (
                <span className="text-[10px] rounded-full px-2 py-0.5 bg-info-soft text-info-soft-fg">
                  En configuración
                </span>
              )}
            </button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

/** Pastilla compacta en el header, con dropdown, para cambiar de sede en cualquier momento. */
export function SelectorSedePastilla() {
  const { sedeActual, setSedeActual } = useAppStore();
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        onClick={() => setAbierto((v) => !v)}
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium border transition',
          'text-strong hover:bg-elevated',
          abierto ? 'bg-elevated border-line-strong' : 'border-line',
        )}
        title="Cambiar de sede"
      >
        <Building2 size={13} className="text-muted" />
        <span className="hidden sm:inline">{nombreCorto(sedeActual)}</span>
        <ChevronDown size={12} className="text-muted" />
      </button>

      <AnimatePresence>
        {abierto && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            className="absolute right-0 top-full mt-1.5 w-56 z-50 rounded-2xl border border-line bg-card shadow-xl overflow-hidden p-1.5"
          >
            {SEDES.map((s) => {
              const activo = s.id === sedeActual;
              return (
                <button
                  key={s.id}
                  role="menuitem"
                  onClick={() => {
                    setSedeActual(s.id);
                    sessionStorage.setItem(SESSION_KEY, '1');
                    setAbierto(false);
                  }}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left transition',
                    activo ? 'bg-elevated' : 'hover:bg-elevated/60',
                  )}
                >
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center gap-1.5">
                      <span className="text-sm font-medium text-strong truncate">{s.nombre}</span>
                      {activo && <Check size={13} className="text-info flex-shrink-0" />}
                    </span>
                    {!s.configurada && (
                      <span className="block text-[10px] text-muted mt-0.5">En configuración</span>
                    )}
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
