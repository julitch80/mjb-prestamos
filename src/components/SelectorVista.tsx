import { useEffect, useState } from 'react';
import { LayoutGrid, List, type LucideIcon } from 'lucide-react';
import { cn } from '../lib/utils';

// «Ver: [▦] [☰]» — un solo conmutador de forma de ver para toda la app (Julián,
// 26-oct-2026; docs/revision-visual/vistas-duplicadas.md § D). Solo para cuando la
// MISMA información cabe de dos formas; los modos de trabajo y los filtros no lo usan.

export type OpcionVista<T extends string> = { id: T; label: string; Icono: LucideIcon };

export const OPCIONES_MATRIZ_LISTA: OpcionVista<'matriz' | 'lista'>[] = [
  { id: 'matriz', label: 'Matriz', Icono: LayoutGrid },
  { id: 'lista', label: 'Lista', Icono: List },
];

const PREFIJO = 'mjb.vista.';

// Suscriptores en vivo por clave: dos pantallas con la misma clave (Inicio y el menú) cambian a la vez.
const suscriptores = new Map<string, Set<(v: string) => void>>();

/** Estado de la vista recordado por pantalla y por dispositivo (si el almacenamiento falla, no recuerda y ya). */
export function useVistaRecordada<T extends string>(clave: string, inicial: T, validas?: readonly T[]): [T, (v: T) => void] {
  const [vista, setVista] = useState<T>(() => {
    try {
      const v = localStorage.getItem(PREFIJO + clave) as T | null;
      if (v && (!validas || validas.includes(v))) return v;
    } catch { /* sin almacenamiento */ }
    return inicial;
  });
  useEffect(() => {
    const fn = (v: string) => { if (!validas || (validas as readonly string[]).includes(v)) setVista(v as T); };
    let set = suscriptores.get(clave);
    if (!set) { set = new Set(); suscriptores.set(clave, set); }
    set.add(fn);
    return () => { set!.delete(fn); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);
  function cambiar(v: T) {
    setVista(v);
    try { localStorage.setItem(PREFIJO + clave, v); } catch { /* sin almacenamiento */ }
    suscriptores.get(clave)?.forEach(fn => fn(v));
  }
  return [vista, cambiar];
}

export default function SelectorVista<T extends string>({
  valor, onCambio, opciones, etiqueta = 'Ver:', className,
}: {
  valor: T;
  onCambio: (v: T) => void;
  /** Por defecto matriz / lista. Para tiempo, siempre en orden «Día, Semana». */
  opciones?: OpcionVista<T>[];
  etiqueta?: string;
  className?: string;
}) {
  const ops = (opciones ?? OPCIONES_MATRIZ_LISTA) as OpcionVista<T>[];
  return (
    <div role="group" aria-label="Cambiar la forma de ver" className={cn('inline-flex items-center gap-2', className)}>
      {etiqueta && <span className="text-xs font-medium text-muted">{etiqueta}</span>}
      <div className="inline-flex rounded-lg border border-line bg-elevated p-0.5">
        {ops.map(({ id, label, Icono }) => {
          const activo = id === valor;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={activo}
              aria-label={`Ver en ${label.toLowerCase()}`}
              title={label}
              onClick={() => onCambio(id)}
              className={cn(
                'min-h-[44px] min-w-[44px] px-2.5 inline-flex items-center justify-center gap-1.5 rounded-md text-xs font-semibold transition',
                activo ? 'bg-card text-strong ring-1 ring-line-strong shadow-sm' : 'text-muted hover:text-strong',
              )}
            >
              <Icono size={18} aria-hidden />
              <span className="hidden sm:inline">{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
