import { useState } from 'react';
import { ChevronDown, ExternalLink, Paperclip } from 'lucide-react';
import type { Tarea } from '../data/tareas/tipos';
import { esUrlSegura, partirEnlaces } from '../data/tareas/textoEnlaces';
import { enlacesVisibles, nombreDeEnlace } from '../data/tareas/recordatorios';
import { cn } from '@/lib/utils';

/** Texto con saltos de línea y enlaces clicables, sin HTML crudo. */
function TextoConEnlaces({ texto }: { texto: string }) {
  return (
    <p className="text-xs text-soft whitespace-pre-line leading-snug break-words">
      {partirEnlaces(texto).map((t, i) =>
        t.tipo === 'enlace' ? (
          <a key={i} href={t.href} target="_blank" rel="noopener noreferrer" className="text-accent underline">
            {t.valor}
          </a>
        ) : (
          <span key={i}>{t.valor}</span>
        ),
      )}
    </p>
  );
}

/**
 * Botón «Ver detalle» (descripción + adjunto) desplegable. No pinta nada si la
 * tarea no tiene ni descripción ni adjunto. `abiertoInicial` para la vista del día.
 */
export default function DetalleTarea({ t, abiertoInicial = false }: { t: Tarea; abiertoInicial?: boolean }) {
  const [abierto, setAbierto] = useState(abiertoInicial);
  const desc = (t.descripcion ?? '').trim();
  const adjunto = t.adjuntoUrl && esUrlSegura(t.adjuntoUrl) ? t.adjuntoUrl : '';
  const enlaces = enlacesVisibles(t);
  if (!desc && !adjunto && enlaces.length === 0) return null;
  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => setAbierto(a => !a)}
        aria-expanded={abierto}
        className="inline-flex items-center gap-1 min-h-[44px] px-2 -ml-2 text-[11px] font-medium text-accent"
      >
        <ChevronDown size={14} className={cn('transition-transform', abierto && 'rotate-180')} />
        {abierto ? 'Ocultar detalle' : 'Ver detalle'}
        {(adjunto || enlaces.length > 0) && !abierto && <Paperclip size={12} />}
      </button>
      {abierto && (
        <div className="space-y-2 pb-1">
          {desc && <TextoConEnlaces texto={desc} />}
          {adjunto && (
            <a
              href={adjunto}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 min-h-[44px] px-3 rounded-lg border border-accent text-xs font-medium text-accent"
            >
              <Paperclip size={14} />
              Ver archivo adjunto{t.adjuntoNombre ? ` · ${t.adjuntoNombre}` : ''}
            </a>
          )}
          {/* Enlaces que compartió el docente: un botón por enlace, en otra pestaña. */}
          {enlaces.map((e, i) => (
            <a
              key={i}
              href={e.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 min-h-[44px] px-3 rounded-lg border border-accent text-xs font-medium text-accent"
            >
              <ExternalLink size={14} className="shrink-0" />
              <span className="truncate">{nombreDeEnlace(e)}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
