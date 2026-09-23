import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, Smartphone, X } from 'lucide-react';
import { getDatosTareas } from '../data/api';
import { grupoRecordado, recordarGrupo } from '../data/manifestAgenda';
import {
  detectarPlataforma, instalarNativo, puedeInstalarNativo, suscribir, yaInstalada,
} from '../data/installPrompt';
import { DIRECTORES_MANANA, DIRECTORES_TARDE } from '../data/maestros';
import AgendaGrupo from './AgendaGrupo';

/**
 * Agenda pública del grupo (QR, sin login). `grupo` es null cuando se abre la
 * «Agenda MJB» instalada en el celular (`#/agenda`): se usa el último grupo visto
 * en ese teléfono y, si no hay, se pide escogerlo.
 */
export default function AgendaPublica({ grupo }: { grupo: string | null }) {
  const [elegido, setElegido] = useState<string | null>(() => grupo ?? grupoRecordado());
  useEffect(() => { if (grupo) setElegido(grupo); }, [grupo]);
  useEffect(() => { if (elegido) recordarGrupo(elegido); }, [elegido]);

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-6">
      <div className="w-full max-w-md space-y-4">
        <header className="flex items-center gap-3">
          <img src={`${import.meta.env.BASE_URL}mjb_escudo.png`} alt="Escudo MJB" className="w-10 h-10 object-contain" />
          <div className="flex-1">
            <h1 className="font-bold text-strong leading-tight">Agenda de tareas</h1>
            <p className="text-[11px] text-muted">I.E. Manuel J. Betancur</p>
          </div>
          {elegido && !grupo && (
            <button onClick={() => setElegido(null)} className="text-[11px] text-muted hover:text-soft underline">
              Cambiar grupo
            </button>
          )}
        </header>

        {elegido ? <AgendaDelGrupo grupo={elegido} /> : <ElegirGrupo onElegir={setElegido} />}
      </div>
    </div>
  );
}

function AgendaDelGrupo({ grupo }: { grupo: string }) {
  const { data, dataUpdatedAt, isLoading } = useQuery({
    queryKey: ['agendaPublica', grupo],
    queryFn: () => getDatosTareas(grupo),
    // Antes 5 min: con profesores + esta agenda pública por QR refrescando
    // a la vez, ayudaba a saturar el límite de ejecuciones simultáneas de
    // Apps Script (ver getDatosTareas cacheado en docs/backend-Code.gs).
    // refetchIntervalInBackground: false (el default de react-query, mismo
    // que ya evita refrescar con la pestaña oculta) se deja explícito para
    // que quede documentado aquí.
    refetchInterval: 1000 * 60 * 15,
    refetchIntervalInBackground: false,
  });

  // "actualizado hace X min" con tic de refresco
  const [, setTic] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTic(t => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  const minAtras = Math.max(0, Math.round((Date.now() - dataUpdatedAt) / 60000));

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-line bg-elevated/40 p-6 text-center text-sm text-muted">
        Cargando la agenda…
      </div>
    );
  }
  return (
    <>
      <GuardarEnCelular />
      <AgendaGrupo grupo={grupo} tareas={data?.tareas ?? []} mostrarQR={false} anclasPorGrupo={data?.anclas} />
      <footer className="flex justify-between items-center text-[10px] text-muted px-1">
        <span className="flex items-center gap-1"><RefreshCw size={10} /> actualizado hace {minAtras} min</span>
        <span>se actualiza automáticamente</span>
      </footer>
    </>
  );
}

function ElegirGrupo({ onElegir }: { onElegir: (g: string) => void }) {
  const porNumero = (a: string, b: string) => a.localeCompare(b, 'es', { numeric: true });
  const grupos = [...Object.keys(DIRECTORES_TARDE).sort(porNumero), ...Object.keys(DIRECTORES_MANANA).sort(porNumero)];
  return (
    <div className="rounded-2xl border border-line bg-card p-4 space-y-3">
      <p className="text-sm font-semibold text-strong">¿De qué grupo eres?</p>
      <div className="grid grid-cols-4 gap-2">
        {grupos.map(g => (
          <button key={g} onClick={() => onElegir(g)}
            className="min-h-[44px] rounded-xl border border-line text-sm font-medium text-soft hover:bg-elevated">
            {g}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-muted">Se recuerda en este teléfono; lo puedes cambiar después.</p>
    </div>
  );
}

const CLAVE_OCULTO = 'mjb:agenda:guardarOculto';

/**
 * Cómo dejar la agenda como ícono en el celular. Instala la «Agenda MJB», no la
 * aplicación del colegio: ver data/manifestAgenda.ts.
 */
function GuardarEnCelular() {
  const [, setTick] = useState(0);
  useEffect(() => suscribir(() => setTick(t => t + 1)), []);
  const [oculto, setOculto] = useState(() => {
    try { return localStorage.getItem(CLAVE_OCULTO) === '1'; } catch { return false; }
  });
  const plataforma = detectarPlataforma();

  if (oculto || yaInstalada() || plataforma === 'pc') return null;

  function ocultar() {
    try { localStorage.setItem(CLAVE_OCULTO, '1'); } catch { /* nada */ }
    setOculto(true);
  }

  const nativo = puedeInstalarNativo();
  return (
    <div className="rounded-2xl border border-accent/40 bg-accent-soft px-4 py-3 space-y-2">
      <div className="flex items-start gap-2">
        <Smartphone size={16} className="text-accent mt-0.5 flex-shrink-0" />
        <p className="flex-1 text-sm text-strong font-medium">Deja la agenda como ícono en tu celular</p>
        <button onClick={ocultar} aria-label="No mostrar más" className="p-1 -m-1 text-muted hover:text-strong">
          <X size={14} />
        </button>
      </div>
      {nativo ? (
        <button onClick={() => { void instalarNativo(); }}
          className="w-full min-h-[40px] rounded-xl bg-accent text-accent-fg text-sm font-semibold">
          Agregar a mi celular
        </button>
      ) : plataforma === 'ios' ? (
        <p className="text-xs text-soft leading-snug">
          En Safari toca <b>Compartir</b> (el cuadro con la flecha hacia arriba) y luego <b>«Agregar a inicio»</b>.
        </p>
      ) : (
        <p className="text-xs text-soft leading-snug">
          En Chrome toca <b>⋮</b> (arriba a la derecha) y luego <b>«Agregar a la pantalla principal»</b> o <b>«Instalar»</b>.
        </p>
      )}
      <p className="text-[11px] text-muted">Abre directo en la agenda de tu grupo. No necesitas cuenta.</p>
    </div>
  );
}
