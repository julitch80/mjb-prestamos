// Formulario de seguimiento de un caso (contención o remisión al seguro).
// Contrato con el Lote 2 (docs/plan-gestor-casos.md sección 7): este archivo
// exporta CasoResumen, SeguimientoCaso, diasSinSeguimiento y nivelAlerta tal
// cual, sin cambiar firmas — TableroCasos.tsx los importa sin modificarlos.
import { useCallback, useState } from 'react';
import { cn } from '../lib/utils';
import { useAppStore } from '../data/store';
import { getUsuario } from '../data/maestros';
import { guardarSeguimiento } from '../data/api';
import { invalidarCasosVencidos } from '../hooks/useCasosVencidos';
import { useDictado } from '../hooks/useDictado';

export interface CasoResumen {
  id: string;
  tipo: 'contencion' | 'seguro';
  estudianteNombre: string;
  grado: string;
  fecha: string;                 // fecha de creación del caso
  estado: 'abierto' | 'en_seguimiento' | 'cerrado';
  proximaRevision?: string;
  ultimoSeguimiento?: string;    // fecha del último seguimiento, si hay
}

/** Días desde el último seguimiento (o desde la creación si no hay ninguno). */
export function diasSinSeguimiento(caso: CasoResumen): number {
  const referencia = caso.ultimoSeguimiento ?? caso.fecha;
  const desde = new Date(`${referencia}T00:00:00`);
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const ms = hoy.getTime() - desde.getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

/** Nivel de alerta: 'ninguna' | 'ambar' (>=8 días) | 'roja' (>=15 días).
 *  Un caso cerrado siempre devuelve 'ninguna'. */
export function nivelAlerta(caso: CasoResumen): 'ninguna' | 'ambar' | 'roja' {
  if (caso.estado === 'cerrado') return 'ninguna';
  const dias = diasSinSeguimiento(caso);
  if (dias >= 15) return 'roja';
  if (dias >= 8) return 'ambar';
  return 'ninguna';
}

type Decision = 'programar' | 'cerrar';

/** Formulario: nota (escrita o dictada) + decisión cerrar/programar. */
export function SeguimientoCaso({ caso, onGuardado, onCancelar }: {
  caso: CasoResumen;
  onGuardado: () => void;
  onCancelar: () => void;
}) {
  const userId = useAppStore(s => s.userId);
  const autor = getUsuario(userId ?? '');

  const [texto, setTexto] = useState('');
  const [decision, setDecision] = useState<Decision>('programar');
  const [proximaFecha, setProximaFecha] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dictado = useDictado(useCallback((reconocido: string) => {
    setTexto(prev => (prev ? `${prev} ${reconocido}` : reconocido));
  }, []));

  const notaVacia = !texto.trim();
  const faltaFecha = decision === 'programar' && !proximaFecha;
  // Al cerrar el caso la nota es obligatoria (queda como registro final);
  // al programar, lo obligatorio es la fecha del próximo seguimiento.
  const puedeGuardar = decision === 'cerrar' ? !notaVacia : !notaVacia && !faltaFecha;

  async function guardar() {
    if (!puedeGuardar || !autor) return;
    setGuardando(true);
    setError(null);
    const fecha = new Date().toISOString().slice(0, 10);
    const r = await guardarSeguimiento({
      casoId: caso.id,
      casoTipo: caso.tipo,
      fecha,
      autorNombre: autor.nombre,
      texto: texto.trim(),
      decision,
      proximaFecha: decision === 'programar' ? proximaFecha : '',
    });
    setGuardando(false);
    if (!r.ok) {
      setError(r.error || 'No se pudo guardar el seguimiento. Intenta de nuevo.');
      return;
    }
    // El contador del menú y el aviso de inicio quedarían mostrando el número
    // viejo si no se descarta la cuenta cacheada.
    invalidarCasosVencidos();
    onGuardado();
  }

  return (
    <div className="flex flex-col gap-3 p-4 rounded-2xl bg-card border border-line">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-strong">
          Nuevo seguimiento — {caso.estudianteNombre}
        </span>
        <button onClick={onCancelar} className="text-xs text-muted hover:text-soft">Cancelar</button>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[11px] text-muted">Nota de seguimiento</label>
          {dictado.disponible && (
            <button
              type="button"
              onClick={dictado.grabando ? dictado.detener : dictado.iniciar}
              className={cn(
                'text-[11px] font-semibold px-2 py-1 rounded-full border transition',
                dictado.grabando ? 'border-danger text-danger bg-danger-soft animate-pulse' : 'border-line text-muted hover:bg-hover',
              )}
            >
              {dictado.grabando ? '● Grabando…' : '🎤 Dictar'}
            </button>
          )}
        </div>
        <textarea
          value={texto}
          onChange={e => setTexto(e.target.value)}
          rows={4}
          placeholder="Qué pasó desde el último seguimiento, cómo sigue el estudiante…"
          className="w-full px-3 py-2 rounded-xl bg-elevated border border-line text-sm text-strong placeholder:text-muted focus:outline-none focus:border-line-strong resize-y"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-2 text-sm text-soft cursor-pointer">
          <input
            type="radio"
            name="decision-seguimiento"
            checked={decision === 'programar'}
            onChange={() => setDecision('programar')}
          />
          Programar próximo seguimiento
        </label>
        {decision === 'programar' && (
          <input
            type="date"
            value={proximaFecha}
            onChange={e => setProximaFecha(e.target.value)}
            className="ml-6 px-3 py-1.5 rounded-lg bg-elevated border border-line text-sm text-strong focus:outline-none focus:border-line-strong w-fit"
          />
        )}

        <label className="flex items-center gap-2 text-sm text-soft cursor-pointer">
          <input
            type="radio"
            name="decision-seguimiento"
            checked={decision === 'cerrar'}
            onChange={() => setDecision('cerrar')}
          />
          Cerrar el caso
        </label>
      </div>

      {error && (
        <div className="rounded-xl bg-danger-soft border border-danger px-3 py-2 text-xs text-danger-soft-fg">
          {error}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <button
          onClick={onCancelar}
          disabled={guardando}
          className="px-3 py-1.5 rounded-full border border-line text-sm text-soft hover:bg-hover transition disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          onClick={guardar}
          disabled={!puedeGuardar || guardando}
          className="px-4 py-1.5 rounded-full bg-accent text-accent-fg text-sm font-semibold hover:opacity-90 transition disabled:opacity-50"
        >
          {guardando ? 'Guardando…' : 'Guardar seguimiento'}
        </button>
      </div>
    </div>
  );
}
