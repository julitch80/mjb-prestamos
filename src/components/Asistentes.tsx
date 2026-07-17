import { useState } from 'react';
import { ASISTENTES } from '../data/asistentes';
import type { Asistente } from '../data/asistentes';
import { cn } from '../lib/utils';

function TarjetaAsistente({ asistente, onAbrir }: { asistente: Asistente; onAbrir: () => void }) {
  const disponible = asistente.url !== null;

  return (
    <div
      className={cn(
        'rounded-2xl border border-line bg-card p-5 flex flex-col gap-3',
        !disponible && 'opacity-60'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-3xl">{asistente.emoji}</span>
        {!disponible && (
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-warning-soft text-warning">
            Próximamente
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="text-strong text-sm font-semibold">{asistente.nombre}</h3>
        <p className="text-muted text-xs leading-relaxed">{asistente.descripcion}</p>
      </div>
      <button
        onClick={onAbrir}
        disabled={!disponible}
        className={cn(
          'mt-auto text-xs font-medium px-3 py-2 rounded-lg transition',
          disponible
            ? 'bg-accent text-white hover:opacity-90'
            : 'bg-elevated text-muted cursor-not-allowed'
        )}
      >
        Abrir asistente
      </button>
    </div>
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
