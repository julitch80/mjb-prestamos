import { useState } from 'react';

interface Props {
  /** Nombre de la persona que se está viendo (ya viene de store.nombre, que
   *  authStore recarga solo con la identidad suplantada tras el signInWithCustomToken). */
  nombre: string | null;
  onSalir: () => Promise<void>;
}

/**
 * Aviso de suplantación, fijo y pegado al header (ver App.tsx: ambos van
 * dentro del mismo contenedor `sticky top-0`). La versión vieja era un aviso
 * dentro de una pantalla y por eso se perdía de vista al navegar o hacer
 * scroll -- esta va con la barra de navegación a todas partes.
 */
export default function BarraSuplantacion({ nombre, onSalir }: Props) {
  const [saliendo, setSaliendo] = useState(false);

  async function handleSalir() {
    setSaliendo(true);
    try {
      await onSalir();
    } catch {
      setSaliendo(false);
    }
  }

  return (
    <div className="w-full border-b border-warning bg-warning-soft text-warning-soft-fg">
      <div className="max-w-7xl mx-auto px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm">
        <span className="leading-snug font-medium">
          👁 SOLO LECTURA — viendo la sesión de <strong>{nombre ?? 'otra persona'}</strong>.
        </span>
        <button
          type="button"
          onClick={handleSalir}
          disabled={saliendo}
          className="flex-shrink-0 px-3 py-1 rounded-full bg-warning-soft border border-warning hover:opacity-80 transition font-semibold disabled:opacity-50"
        >
          {saliendo ? 'Saliendo…' : 'Salir'}
        </button>
      </div>
    </div>
  );
}
