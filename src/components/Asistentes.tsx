import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { ASISTENTES } from '../data/asistentes';
import type { Asistente } from '../data/asistentes';
import { cn } from '../lib/utils';
import { IconoConvivencia, IconoEvaluacion } from './IconosNeon';

// Icono de línea + color por asistente. Se mapea por id en vez de guardar el
// componente en los datos (asistentes.ts se deja con el emoji intacto).
const ICONO_ASISTENTE: Record<string, { Icono: typeof IconoConvivencia; color: string }> = {
  convivencia: { Icono: IconoConvivencia, color: '#4ade80' },
  evaluacion: { Icono: IconoEvaluacion, color: '#60a5fa' },
};

function TarjetaAsistente({ asistente, onAbrir }: { asistente: Asistente; onAbrir: () => void }) {
  const disponible = asistente.url !== null;
  const { Icono, color } = ICONO_ASISTENTE[asistente.id] ?? { Icono: IconoConvivencia, color: '#94a3b8' };

  const contenido = (
    <>
      <div
        className="w-14 h-14 flex-shrink-0 rounded-2xl flex items-center justify-center"
        style={{ background: `${color}1a` }}
      >
        <Icono className="w-7 h-7" style={{ color }} />
      </div>
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <h3 className="text-strong text-base font-semibold leading-snug">{asistente.nombre}</h3>
          {!disponible && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-warning-soft text-warning-soft-fg flex-shrink-0">
              Próximamente
            </span>
          )}
        </div>
        <p className="text-muted text-xs leading-relaxed">{asistente.descripcion}</p>
      </div>
      {disponible && (
        <ChevronRight className="w-5 h-5 flex-shrink-0 text-muted self-center" />
      )}
    </>
  );

  const claseComun = cn(
    'w-full text-left rounded-2xl border border-line bg-card p-5 flex items-start gap-4 min-h-[7.5rem] transition',
    disponible ? 'hover:bg-elevated active:bg-hover cursor-pointer' : 'opacity-60 cursor-not-allowed'
  );

  // La tarjeta abre el asistente embebido dentro de la app (igual que hoy);
  // el enlace directo con target="_blank" solo aparece dentro de la vista
  // ya abierta ("Abrir en pestaña ↗"), como estaba antes.
  return (
    <button type="button" onClick={onAbrir} disabled={!disponible} className={claseComun}>
      {contenido}
    </button>
  );
}

export default function Asistentes() {
  const [abierto, setAbierto] = useState<string | null>(null);

  const asistenteAbierto = ASISTENTES.find(a => a.id === abierto) ?? null;

  if (asistenteAbierto && asistenteAbierto.url) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => setAbierto(null)}
            className="text-xs font-medium px-3 py-1.5 rounded-lg bg-elevated border border-line text-soft hover:text-strong transition"
          >
            ← Asistentes
          </button>
          <h2 className="text-strong text-sm font-semibold flex-1">
            {asistenteAbierto.emoji} {asistenteAbierto.nombre}
          </h2>
          <a
            href={asistenteAbierto.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-accent hover:underline"
          >
            Abrir en pestaña ↗
          </a>
        </div>

        <iframe
          src={asistenteAbierto.url}
          title={asistenteAbierto.nombre}
          className="w-full rounded-2xl border border-line bg-card"
          style={{ height: 'calc(100vh - 220px)', minHeight: 480 }}
          allow="clipboard-write; microphone"
        />

        <p className="text-muted text-xs">El asistente requiere conexión a internet.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-strong text-lg font-semibold">Asistentes</h2>
        <p className="text-muted text-sm">Chatbots institucionales de convivencia y evaluación.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {ASISTENTES.map(asistente => (
          <TarjetaAsistente
            key={asistente.id}
            asistente={asistente}
            onAbrir={() => asistente.url && setAbierto(asistente.id)}
          />
        ))}
      </div>
    </div>
  );
}
