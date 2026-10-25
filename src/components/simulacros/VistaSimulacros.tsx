import { useMemo, useState } from 'react';
import { Siren } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '../../data/store';
import { JORNADA_NOMBRE, fechaLarga, formatoMinutos, horaAMinutos } from '../../data/simulacros/logica';
import type { JornadaId } from '../../data/simulacros/plantillaSismo2026';
import GuiaSimulacro from './GuiaSimulacro';
import ImprimirGuion from './ImprimirGuion';
import CrearSimulacro2026 from './CrearSimulacro2026';
import PanelDiaSimulacro from './PanelDiaSimulacro';
import { useListaSimulacros, useSimulacro } from './useSimulacro';
import type { SimulacroConId } from './useSimulacro';

/** Contenido de la pestaña «Simulacros» de Gestión del riesgo. */

function esEditor(s: SimulacroConId, userId: string | null, rol: string | null): boolean {
  if (rol === 'superusuario') return true;
  if (!userId) return false;
  return (['manana', 'tarde'] as JornadaId[]).some(j => (s.editores?.[j] ?? []).includes(userId));
}

function Detalle({ id, volver }: { id: string; volver: () => void }) {
  const userId = useAppStore(s => s.userId);
  const rol = useAppStore(s => s.rol);
  const sim = useSimulacro(id);
  const [verPanel, setVerPanel] = useState(true);

  if (sim === null) return <p className="text-muted text-sm">Cargando…</p>;
  if (sim === undefined) {
    return (
      <div className="flex flex-col gap-2">
        <button type="button" onClick={volver} className="self-start text-accent text-sm font-medium">← Volver a la lista</button>
        <p className="text-muted text-sm">Este simulacro no existe o todavía no está publicado.</p>
      </div>
    );
  }
  const editor = esEditor(sim, userId, rol);

  return (
    <div className="flex flex-col gap-4">
      <button type="button" onClick={volver} className="self-start text-accent text-sm font-medium">← Volver a la lista</button>
      {editor && (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setVerPanel(v => !v)}
            className="self-start px-3 py-1.5 rounded-full text-xs font-medium border border-line text-soft hover:bg-elevated"
          >
            {verPanel ? 'Ocultar el panel «Día del simulacro»' : 'Mostrar el panel «Día del simulacro»'}
          </button>
          {verPanel && <PanelDiaSimulacro sim={sim} />}
        </div>
      )}
      <ImprimirGuion sim={sim} />
      <GuiaSimulacro sim={sim} />
    </div>
  );
}

export default function VistaSimulacros() {
  const userId = useAppStore(s => s.userId);
  const rol = useAppStore(s => s.rol);
  const { lista, error } = useListaSimulacros();
  const [abierto, setAbierto] = useState<string | null>(null);

  const visibles = useMemo(() => {
    const todos = lista ?? [];
    return todos
      .filter(s => s.estado === 'publicado' || s.estado === 'ejecutado' || esEditor(s, userId, rol))
      .filter(s => s.estado !== 'archivado' || esEditor(s, userId, rol))
      .sort((a, b) => {
        const fa = a.jornadas?.manana?.fecha ?? a.nacional?.fecha ?? '';
        const fb = b.jornadas?.manana?.fecha ?? b.nacional?.fecha ?? '';
        return fb.localeCompare(fa);
      });
  }, [lista, userId, rol]);

  if (abierto) return <Detalle id={abierto} volver={() => setAbierto(null)} />;

  if (lista === null) return <p className="text-muted text-sm">Cargando simulacros…</p>;

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-strong text-sm font-semibold flex items-center gap-1.5"><Siren size={16} aria-hidden /> Simulacros</h3>
      {error && <p className="text-danger text-xs">No se pudo leer la lista: {error}</p>}
      {visibles.length === 0 ? (
        <>
          <p className="text-muted text-sm">Todavía no hay simulacros publicados. Cuando coordinación publique la guía, aparecerá aquí.</p>
          {/* El superusuario puede crear aquí mismo el simulacro 2026 (también está en su panel) */}
          {rol === 'superusuario' && <CrearSimulacro2026 />}
        </>
      ) : (
        visibles.map(s => (
          <button
            key={s.id}
            type="button"
            onClick={() => setAbierto(s.id)}
            className="text-left rounded-xl border border-line bg-card p-3 hover:bg-elevated transition-colors flex flex-col gap-1"
          >
            <span className="flex items-center gap-2">
              <span className="text-strong text-sm font-semibold">{s.titulo}</span>
              <span className={cn(
                'px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase',
                s.estado === 'publicado' ? 'bg-success-soft text-success-soft-fg' : 'bg-warning-soft text-warning-soft-fg',
              )}>{s.estado}</span>
            </span>
            {(['manana', 'tarde'] as JornadaId[]).map(j => {
              const v = s.jornadas?.[j];
              return v ? (
                <span key={j} className="text-muted text-xs">
                  {JORNADA_NOMBRE[j]}: {fechaLarga(v.fecha)}, {formatoMinutos(horaAMinutos(v.hora))}{v.motivo ? ' (reprogramado)' : ''}
                </span>
              ) : null;
            })}
          </button>
        ))
      )}
    </div>
  );
}
