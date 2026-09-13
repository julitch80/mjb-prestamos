/**
 * Cuándo NO puede un docente. Una cuadrícula por persona.
 *
 * La app ya deduce sola una parte: quien baja a la tarde no está en la mañana
 * esos días. Eso sale marcado en gris y no se toca, porque no es una decisión
 * sino un hecho de su contrato.
 *
 * Lo que se marca aquí es lo otro, lo que solo sabe el coordinador: una
 * comisión, un permiso, y sobre todo **las horas de media técnica** — que
 * ocurren de verdad, no están en la asignación académica y hoy el motor no las
 * ve. Mientras no se marquen, el motor puede ponerle clase a Felipe o a
 * Valentina justo cuando están en su media técnica, y el horario saldría
 * pareciendo correcto sin serlo. Es el único agujero conocido.
 *
 * Bloquear una hora de más nunca produce un horario inválido: como mucho hace
 * el problema más difícil. Bloquear una de menos, sí. Por eso ante la duda
 * conviene marcar.
 */

import { useCallback, useMemo, useState } from 'react';
import { CalendarX2, RotateCcw, Save } from 'lucide-react';

import { USUARIOS } from '../../data/maestros';
import {
  guardarConfiguracion, leerConfiguracion,
} from '../../data/horarios/configuracion';
import { ciMananaDeducida, construirEntrada } from '../../data/horarios/contrato';
import type { Dia, Jornada } from '../../data/horarios/tipos';
import { cn } from '../../lib/utils';

const NOMBRE_DIA: Record<string, string> = {
  lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles',
  jueves: 'Jueves', viernes: 'Viernes',
};

const nombreDocente = (id: string) =>
  USUARIOS.find(u => u.id === id)?.nombreCorto ?? id;

/** Una franja concreta, como clave: `dia␟bloque`. */
const franja = (dia: string, bloque: number) => `${dia}␟${bloque}`;

export default function DisponibilidadDocente({ sede, jornada, anio, onCambio }: {
  sede: string; jornada: Jornada; anio: number; onCambio?: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [config, setConfig] = useState(() => leerConfiguracion(ciMananaDeducida()));
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * De la entrada del motor salen dos cosas: quién da clase en esta jornada y
   * qué horas tiene ya bloqueadas por deducción. Se lee de ahí y no de los datos
   * maestros para que la pantalla y el generador vean exactamente lo mismo.
   */
  const entrada = useMemo(() => {
    try {
      return construirEntrada({ sede, jornada, anio });
    } catch {
      return null;
    }
  }, [sede, jornada, anio]);

  const dias = entrada?.config.dias ?? [];
  const bloques = useMemo(
    () => Array.from({ length: entrada?.config.bloques_por_jornada[jornada] ?? 0 },
      (_, i) => i + 1),
    [entrada, jornada],
  );

  const docentes = useMemo(
    () => (entrada?.docentes ?? [])
      .map(d => ({ id: d.id, etiqueta: nombreDocente(d.id) }))
      .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta)),
    [entrada],
  );

  const [elegido, setElegido] = useState('');
  const docente = docentes.some(d => d.id === elegido) ? elegido : (docentes[0]?.id ?? '');

  /** Lo que la app deduce sola. Se muestra, pero no se puede quitar. */
  const deducidas = useMemo(() => {
    const s = new Set<string>();
    const ficha = entrada?.docentes.find(d => d.id === docente);
    const propias = new Set<string>();
    for (const f of config.noDisponible[docente] ?? []) {
      if (f.jornada === jornada) for (const b of f.bloques) propias.add(franja(f.dia, b));
    }
    for (const f of ficha?.no_disponible ?? []) {
      if (f.jornada !== jornada) continue;
      for (const b of f.bloques) {
        const k = franja(f.dia, b);
        if (!propias.has(k)) s.add(k);
      }
    }
    return s;
  }, [entrada, docente, jornada, config]);

  /** Lo que marcó el coordinador para este docente en esta jornada. */
  const marcadas = useMemo(() => {
    const s = new Set<string>();
    for (const f of config.noDisponible[docente] ?? []) {
      if (f.jornada === jornada) for (const b of f.bloques) s.add(franja(f.dia, b));
    }
    return s;
  }, [config, docente, jornada]);

  const alternar = useCallback((dia: Dia, bloque: number) => {
    setMensaje(null);
    setConfig(previo => {
      const suyas = previo.noDisponible[docente] ?? [];
      const otras = suyas.filter(f => f.jornada !== jornada);
      const deEstaJornada = new Set<string>();
      for (const f of suyas) {
        if (f.jornada === jornada) for (const b of f.bloques) deEstaJornada.add(franja(f.dia, b));
      }
      const k = franja(dia, bloque);
      if (deEstaJornada.has(k)) deEstaJornada.delete(k);
      else deEstaJornada.add(k);

      // Se vuelve a agrupar por día, que es la forma que espera el motor.
      const porDia = new Map<string, number[]>();
      for (const clave of deEstaJornada) {
        const [d, b] = clave.split('␟');
        porDia.set(d, [...(porDia.get(d) ?? []), Number(b)]);
      }
      const nuevas = [...porDia].map(([d, bs]) => ({
        jornada, dia: d as Dia, bloques: bs.sort((x, y) => x - y),
      }));

      return {
        ...previo,
        noDisponible: { ...previo.noDisponible, [docente]: [...otras, ...nuevas] },
      };
    });
  }, [docente, jornada]);

  const guardar = useCallback(() => {
    const r = guardarConfiguracion(config);
    if (!r.ok) {
      setError(r.mensaje ?? 'No se pudo guardar.');
      return;
    }
    setError(null);
    setMensaje('Guardado. El próximo horario que se genere respetará estas horas.');
    onCambio?.();
  }, [config, onCambio]);

  const descartar = useCallback(() => {
    setConfig(leerConfiguracion(ciMananaDeducida()));
    setMensaje('Se deshicieron los cambios sin guardar.');
    setError(null);
  }, []);

  const cuantasMarcadas = Object.values(config.noDisponible)
    .flat().filter(f => f.jornada === jornada)
    .reduce((s, f) => s + f.bloques.length, 0);

  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        className="rounded-2xl border border-line bg-card p-4 text-left hover:bg-hover transition
                   flex items-center gap-3"
      >
        <CalendarX2 className="w-4 h-4 text-muted flex-shrink-0" />
        <div>
          <div className="text-strong text-sm font-medium">
            Cuándo no puede cada docente
            {cuantasMarcadas > 0 && (
              <span className="text-accent text-xs ml-2">
                · {cuantasMarcadas} hora{cuantasMarcadas === 1 ? '' : 's'} bloqueada
                {cuantasMarcadas === 1 ? '' : 's'}
              </span>
            )}
          </div>
          <div className="text-muted text-xs">
            Comisiones, permisos y las horas de media técnica, que el motor no ve solo.
          </div>
        </div>
      </button>
    );
  }

  if (!entrada || docentes.length === 0) {
    return (
      <div className="rounded-2xl border border-line bg-card p-5">
        <h3 className="text-strong text-base font-semibold">Cuándo no puede cada docente</h3>
        <p className="text-muted text-sm mt-1">
          No hay docentes con clase en esta sede y jornada, así que no hay nada que marcar.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-line bg-card p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-strong text-base font-semibold">Cuándo no puede cada docente</h3>
          <p className="text-muted text-sm mt-0.5">
            Marca las horas en que esta persona <span className="text-strong">no</span> puede
            recibir clase. Las grises ya las sabe la app y no se tocan.
          </p>
        </div>
        <button
          onClick={() => setAbierto(false)}
          className="text-xs text-muted hover:text-strong transition px-2 py-1"
        >
          Cerrar
        </button>
      </div>

      {error && (
        <div className="mt-3 rounded-xl border border-danger-soft bg-danger-soft px-4 py-2.5">
          <p className="text-danger-soft-fg text-sm">{error}</p>
        </div>
      )}
      {mensaje && (
        <div className="mt-3 rounded-xl border border-line bg-hover px-4 py-2.5">
          <p className="text-muted text-sm">{mensaje}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5 my-4">
        {docentes.map(d => {
          const suyas = (config.noDisponible[d.id] ?? [])
            .filter(f => f.jornada === jornada)
            .reduce((s, f) => s + f.bloques.length, 0);
          return (
            <button
              key={d.id}
              onClick={() => setElegido(d.id)}
              className={cn(
                'rounded-lg border px-2.5 py-1 text-xs transition',
                d.id === docente
                  ? 'border-accent bg-accent text-accent-fg font-medium'
                  : 'border-line bg-card text-strong hover:bg-hover',
              )}
            >
              {d.etiqueta}
              {suyas > 0 && <span className="ml-1 opacity-70">·{suyas}</span>}
            </button>
          );
        })}
      </div>

      <div
        className="grid gap-1.5"
        style={{ gridTemplateColumns: `2.5rem repeat(${dias.length}, minmax(0, 1fr))` }}
      >
        <div />
        {dias.map(d => (
          <div key={d} className="text-muted text-[11px] font-medium text-center pb-1">
            {NOMBRE_DIA[d] ?? d}
          </div>
        ))}
        {bloques.map(b => (
          <div key={b} className="contents">
            <div className="text-muted text-[11px] flex items-center justify-center">{b}.ª</div>
            {dias.map(dia => {
              const k = franja(dia, b);
              const fija = deducidas.has(k);
              const puesta = marcadas.has(k);
              return (
                <button
                  key={dia}
                  onClick={() => !fija && alternar(dia as Dia, b)}
                  disabled={fija}
                  title={fija
                    ? 'La app ya sabe que no está: ese día baja a la otra jornada'
                    : (puesta ? 'Marcada como no disponible. Pulsa para quitarla'
                      : 'Pulsa para marcar que no puede a esta hora')}
                  className={cn(
                    'h-11 rounded-lg border text-[10px] transition',
                    fija && 'border-line bg-hover text-muted cursor-not-allowed',
                    !fija && puesta && 'border-danger-soft bg-danger-soft text-danger-soft-fg',
                    !fija && !puesta && 'border-dashed border-line text-muted hover:bg-hover',
                  )}
                >
                  {fija ? 'otra jornada' : (puesta ? 'no puede' : '')}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 mt-5">
        <button
          onClick={guardar}
          className="inline-flex items-center gap-1.5 rounded-xl bg-accent text-accent-fg
                     px-4 py-2 text-sm font-medium transition hover:opacity-90"
        >
          <Save className="w-4 h-4" /> Guardar
        </button>
        <button
          onClick={descartar}
          className="inline-flex items-center gap-1.5 rounded-xl border border-line px-4 py-2
                     text-sm font-medium text-strong transition hover:bg-hover"
        >
          <RotateCcw className="w-4 h-4" /> Descartar cambios
        </button>
      </div>

      <p className="text-muted text-xs mt-3">
        Bloquear una hora de más nunca hace inválido un horario: como mucho lo hace más
        difícil de armar. Bloquear una de menos, sí. Ante la duda, márcala.
      </p>
    </div>
  );
}
