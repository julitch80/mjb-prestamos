import { useState } from 'react';
import { BookOpen, ExternalLink, Sparkles, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { siguientePildora, type Pildora } from '../data/tareas/pildoras';

/**
 * El recuadro «Estudio personal» de la agenda, convertido en botón (Julián,
 * 16-09-2026): cada toque muestra una píldora con una idea para aprovechar los
 * minutos diarios de estudio. Las píldoras y el orden viven en
 * data/tareas/pildoras.ts; el avance se guarda solo en este dispositivo.
 */
export default function PildoraEstudio({ grupo, minutos, compacto = false }: {
  grupo: string;
  minutos: number;
  compacto?: boolean;
}) {
  const [pildora, setPildora] = useState<Pildora | null>(null);

  return (
    <>
      <button
        onClick={() => setPildora(siguientePildora(grupo))}
        className={cn(
          'w-full rounded-xl bg-warning-soft border border-warning flex justify-between items-center gap-2 text-left hover:brightness-110 transition',
          compacto ? 'px-3 py-1.5' : 'px-3 py-2',
        )}
      >
        <span className={cn('text-warning-soft-fg flex items-center gap-1.5 font-medium', compacto ? 'text-[11px]' : 'text-xs')}>
          <BookOpen size={compacto ? 12 : 13} /> Estudio personal · {minutos} min
        </span>
        <span className={cn('text-warning-soft-fg flex items-center gap-1 font-semibold', compacto ? 'text-[10px]' : 'text-[11px]')}>
          <Sparkles size={compacto ? 11 : 12} /> Idea para hoy
        </span>
      </button>

      {pildora && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-3" onClick={() => setPildora(null)}>
          <div
            className="w-full max-w-sm rounded-2xl border border-warning bg-card p-5 space-y-3"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-warning-soft-fg">
                {pildora.ia ? '🤖 Inteligencia artificial' : '💡 Para tu estudio'}
              </p>
              <button onClick={() => setPildora(null)} className="p-1 -m-1 text-muted hover:text-strong" aria-label="Cerrar">
                <X size={16} />
              </button>
            </div>
            <p className="text-lg font-bold text-strong leading-snug">{pildora.titulo}</p>
            <p className="text-sm text-soft leading-relaxed">{pildora.texto}</p>
            {pildora.pruebalo && (
              <p className="rounded-xl bg-elevated border border-line px-3 py-2 text-sm text-strong">
                <b>Pruébalo hoy:</b> {pildora.pruebalo}
              </p>
            )}
            {pildora.enlace && (
              <a
                href={pildora.enlace}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
              >
                <ExternalLink size={14} /> Para saber más
              </a>
            )}
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setPildora(siguientePildora(grupo))}
                className="flex-1 min-h-[40px] rounded-xl border border-line text-sm font-medium text-soft hover:bg-elevated"
              >
                Otra idea
              </button>
              <button
                onClick={() => setPildora(null)}
                className="flex-1 min-h-[40px] rounded-xl bg-accent text-accent-fg text-sm font-semibold"
              >
                Listo
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
