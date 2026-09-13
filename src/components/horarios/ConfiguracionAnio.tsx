/**
 * Cómo es la semana del colegio este año.
 *
 * Los datos que hay aquí estaban escritos en el código porque son los de 2026 y
 * dentro del año no cambian. Entre años sí, y quien los conoce es el coordinador.
 * Esta pantalla es para que los ponga él antes de generar, sin que nadie tenga
 * que tocar el programa.
 *
 * Nada se guarda hasta que se pulsa Guardar, y siempre se puede volver a lo que
 * traen los datos de la app.
 */

import { useCallback, useState } from 'react';
import { RotateCcw, Save, Settings2 } from 'lucide-react';

import {
  configuracionPorDefecto, guardarConfiguracion, hayConfiguracionPropia,
  leerConfiguracion, materiasConfigurables, restablecerConfiguracion,
  type ConfiguracionAnio as Config,
} from '../../data/horarios/configuracion';
import { ciMananaDeducida } from '../../data/horarios/contrato';
import { DIAS, type Dia, type Jornada } from '../../data/horarios/tipos';
import { cn } from '../../lib/utils';

const NOMBRE_DIA: Record<string, string> = {
  lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles',
  jueves: 'Jueves', viernes: 'Viernes',
};
const NOMBRE_JORNADA: Record<Jornada, string> = { manana: 'Mañana', tarde: 'Tarde' };

function Interruptor({ activo, onClick, children }: {
  activo: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-lg border px-2.5 py-1 text-xs transition',
        activo
          ? 'border-accent bg-accent text-accent-fg font-medium'
          : 'border-line bg-card text-muted hover:bg-hover',
      )}
    >
      {children}
    </button>
  );
}

function Apartado({ titulo, explicacion, children }: {
  titulo: string; explicacion: string; children: React.ReactNode;
}) {
  return (
    <div className="pt-4 first:pt-0">
      <div className="text-strong text-sm font-medium">{titulo}</div>
      <p className="text-muted text-xs mt-0.5 mb-2">{explicacion}</p>
      {children}
    </div>
  );
}

export default function ConfiguracionAnio({ onCambio }: { onCambio?: () => void }) {
  const [abierto, setAbierto] = useState(false);
  const [config, setConfig] = useState<Config>(() => leerConfiguracion(ciMananaDeducida()));
  const [propia, setPropia] = useState(() => hayConfiguracionPropia());
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cambiar = useCallback((cambio: Partial<Config>) => {
    setConfig(previo => ({ ...previo, ...cambio }));
    setMensaje(null);
  }, []);

  const guardar = useCallback(() => {
    const r = guardarConfiguracion(config);
    if (!r.ok) {
      setError(r.mensaje ?? 'No se pudo guardar.');
      return;
    }
    setError(null);
    setPropia(true);
    setMensaje('Guardado. El próximo horario que se descargue ya sale con esto.');
    onCambio?.();
  }, [config, onCambio]);

  const restablecer = useCallback(() => {
    restablecerConfiguracion();
    setConfig(leerConfiguracion(ciMananaDeducida()));
    setPropia(false);
    setError(null);
    setMensaje('Se volvió a lo que dicen los datos de la app.');
    onCambio?.();
  }, [onCambio]);

  const alternarDia = (dia: Dia) => {
    const tiene = config.diasLectivos.includes(dia);
    // Sin días no hay semana: el último no se puede quitar.
    if (tiene && config.diasLectivos.length === 1) return;
    cambiar({
      diasLectivos: tiene
        ? config.diasLectivos.filter(d => d !== dia)
        : DIAS.filter(d => d === dia || config.diasLectivos.includes(d)),
    });
  };

  const alternarExigente = (id: string) => cambiar({
    exigentes: config.exigentes.includes(id)
      ? config.exigentes.filter(x => x !== id)
      : [...config.exigentes, id],
  });

  const ponerCI = (jornada: Jornada, valor: { dia: Dia; bloque: number } | null) =>
    cambiar({ centroInteres: { ...config.centroInteres, [jornada]: valor } });

  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        className="rounded-2xl border border-line bg-card p-4 text-left hover:bg-hover transition
                   flex items-center gap-3"
      >
        <Settings2 className="w-4 h-4 text-muted flex-shrink-0" />
        <div>
          <div className="text-strong text-sm font-medium">
            Cómo es la semana este año
            {propia && <span className="text-accent text-xs ml-2">· configurada a mano</span>}
          </div>
          <div className="text-muted text-xs">
            Franja del Centro de Interés, días y horas de clase, materias que van temprano.
          </div>
        </div>
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-line bg-card p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-strong text-base font-semibold">Cómo es la semana este año</h3>
          <p className="text-muted text-sm mt-0.5">
            Esto es lo que se le dice al motor. Cambiarlo no toca el horario vigente.
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

      <div className="divide-y divide-line mt-4">
        <Apartado
          titulo="Días de clase"
          explicacion="Los días en que hay clase. Casi siempre los cinco."
        >
          <div className="flex flex-wrap gap-1.5">
            {DIAS.map(d => (
              <Interruptor
                key={d}
                activo={config.diasLectivos.includes(d)}
                onClick={() => alternarDia(d)}
              >
                {NOMBRE_DIA[d]}
              </Interruptor>
            ))}
          </div>
        </Apartado>

        <Apartado
          titulo="Horas de clase al día"
          explicacion="Cuántos bloques tiene el día en cada jornada."
        >
          <div className="flex flex-wrap gap-4">
            {(['manana', 'tarde'] as Jornada[]).map(j => (
              <label key={j} className="flex items-center gap-2 text-sm text-muted">
                {NOMBRE_JORNADA[j]}
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={config.bloques[j]}
                  onChange={e => cambiar({
                    bloques: {
                      ...config.bloques,
                      [j]: Math.max(1, Math.min(12, Number(e.target.value) || 1)),
                    },
                  })}
                  className="w-16 rounded-lg border border-line bg-card px-2 py-1
                             text-strong text-sm"
                />
              </label>
            ))}
          </div>
        </Apartado>

        <Apartado
          titulo="Centro de Interés"
          explicacion="La franja que se reserva y en la que no se pone clase. Si una
                       jornada no lo tiene, se marca «ninguna»."
        >
          <div className="flex flex-col gap-2">
            {(['manana', 'tarde'] as Jornada[]).map(j => {
              const franja = config.centroInteres[j];
              return (
                <div key={j} className="flex flex-wrap items-center gap-2">
                  <span className="text-muted text-sm w-16">{NOMBRE_JORNADA[j]}</span>
                  <Interruptor
                    activo={franja === null}
                    onClick={() => ponerCI(j, franja === null
                      ? (configuracionPorDefecto(ciMananaDeducida()).centroInteres[j]
                        ?? { dia: 'martes', bloque: 1 })
                      : null)}
                  >
                    ninguna
                  </Interruptor>
                  {franja && (
                    <>
                      <select
                        value={franja.dia}
                        onChange={e => ponerCI(j, { ...franja, dia: e.target.value as Dia })}
                        className="rounded-lg border border-line bg-card px-2 py-1
                                   text-strong text-sm"
                      >
                        {config.diasLectivos.map(d => (
                          <option key={d} value={d}>{NOMBRE_DIA[d]}</option>
                        ))}
                      </select>
                      <select
                        value={franja.bloque}
                        onChange={e => ponerCI(j, { ...franja, bloque: Number(e.target.value) })}
                        className="rounded-lg border border-line bg-card px-2 py-1
                                   text-strong text-sm"
                      >
                        {Array.from({ length: config.bloques[j] }, (_, i) => i + 1).map(b => (
                          <option key={b} value={b}>{b}.ª hora</option>
                        ))}
                      </select>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </Apartado>

        <Apartado
          titulo="Materias que van temprano"
          explicacion="El motor intentará ponerlas en las primeras horas del día. Es una
                       preferencia, no una obligación: si no caben temprano, se ubican igual."
        >
          <div className="flex flex-wrap gap-1.5">
            {materiasConfigurables().map(m => (
              <Interruptor
                key={m.id}
                activo={config.exigentes.includes(m.id)}
                onClick={() => alternarExigente(m.id)}
              >
                {m.nombre}
              </Interruptor>
            ))}
          </div>
        </Apartado>

        <Apartado
          titulo="Media técnica en contrajornada"
          explicacion="Los días en que cada grupo sale a su media técnica. El motor no
                       programa esas horas, pero sí necesita saber cuándo ocurren."
        >
          <div className="flex flex-col gap-2">
            {Object.entries(config.contrajornada).sort().map(([grupo, dias]) => (
              <div key={grupo} className="flex flex-wrap items-center gap-1.5">
                <span className="text-muted text-sm w-16">{grupo}</span>
                {DIAS.map(d => (
                  <Interruptor
                    key={d}
                    activo={dias.includes(d)}
                    onClick={() => cambiar({
                      contrajornada: {
                        ...config.contrajornada,
                        [grupo]: dias.includes(d)
                          ? dias.filter(x => x !== d)
                          : DIAS.filter(x => x === d || dias.includes(x)),
                      },
                    })}
                  >
                    {NOMBRE_DIA[d].slice(0, 3)}
                  </Interruptor>
                ))}
              </div>
            ))}
          </div>
        </Apartado>
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
          onClick={restablecer}
          disabled={!propia}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-xl border border-line px-4 py-2',
            'text-sm font-medium transition',
            propia ? 'text-strong hover:bg-hover' : 'text-muted opacity-50 cursor-not-allowed',
          )}
        >
          <RotateCcw className="w-4 h-4" /> Volver a los datos de la app
        </button>
      </div>
    </div>
  );
}
