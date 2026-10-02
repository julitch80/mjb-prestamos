// Piezas pequeñas compartidas del formulario «Datos de la sede».
import { useEffect, useState } from 'react';
import { urlArchivoSede } from '../../data/sedeDatos/almacenamiento';
import { formatearDuracion } from '../../data/sedeDatos/audio';
import type { AudioNota } from '../../data/sedeDatos/tipos';

/** Chip de un toque (objetivo ≥44 px). */
export function Chip({ activo, onClick, children, disabled }: {
  activo: boolean; onClick: () => void; children: React.ReactNode; disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={activo}
      className={
        'min-h-[44px] px-4 rounded-full border text-sm font-medium transition disabled:opacity-50 ' +
        (activo ? 'bg-accent text-accent-fg border-accent' : 'bg-card text-soft border-line hover:text-strong hover:bg-elevated')
      }
    >
      {children}
    </button>
  );
}

export function Boton({ children, onClick, tono = 'neutro', disabled, type = 'button', className = '' }: {
  children: React.ReactNode; onClick?: () => void; tono?: 'neutro' | 'bien' | 'aviso' | 'primario';
  disabled?: boolean; type?: 'button' | 'submit'; className?: string;
}) {
  const tonos = {
    neutro: 'bg-card text-soft border-line hover:text-strong hover:bg-elevated',
    bien: 'bg-success-soft text-success-soft-fg border-success',
    aviso: 'bg-warning-soft text-warning-soft-fg border-warning',
    primario: 'bg-accent text-accent-fg border-accent',
  };
  return (
    <button type={type} disabled={disabled} onClick={onClick}
      className={`min-h-[44px] px-4 rounded-lg border text-sm font-medium transition disabled:opacity-50 ${tonos[tono]} ${className}`}>
      {children}
    </button>
  );
}

/** URL firmada de un archivo de Storage, resuelta al montar. */
export function useUrlSede(ruta: string): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    urlArchivoSede(ruta).then(u => { if (vivo) setUrl(u); }).catch(() => {});
    return () => { vivo = false; };
  }, [ruta]);
  return url;
}

export function ReproductorNota({ nota }: { nota: AudioNota }) {
  const url = useUrlSede(nota.ruta);
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {url
        ? <audio controls preload="none" src={url} className="h-10 max-w-full" />
        : <span className="text-xs text-muted">Cargando audio…</span>}
      <span className="text-xs text-muted">{formatearDuracion(nota.duracionSeg)}</span>
    </div>
  );
}

export function EnlaceArchivo({ ruta, children }: { ruta: string; children: React.ReactNode }) {
  const url = useUrlSede(ruta);
  return url
    ? <a href={url} target="_blank" rel="noopener noreferrer" className="text-info underline">{children}</a>
    : <span className="text-muted">{children}</span>;
}
