import { useState } from 'react';
import { ListChecks, Phone } from 'lucide-react';
import { ETIQUETA_JORNADA } from './domain/filtro-jornada';
import { jornadaDeGrado, toDateKey } from './domain/ids';
import type { Jornada } from './domain/types';
import TableroTerceraHora from './TableroTerceraHora';
import TerceraHora from './TerceraHora';

/**
 * La pestaña de tercera hora de coordinación, en DOS PASOS (2026-09-25), en el orden en
 * que trabaja la coordinadora:
 *   1. ¿Quién llamó lista?  — asegurar que todos los grupos tomaron asistencia.
 *   2. Ausentes y familias  — atender a los que no vinieron (el reporte de siempre).
 *
 * Es lo primero que ve la coordinadora al entrar al modulo (decision de Julián): reemplazo
 * a Planillas como pantalla de inicio, que quedo como pestaña de consulta.
 *
 * La fecha y la jornada viven aqui para que los dos pasos miren el mismo dia.
 */
export default function TerceraHoraCoordinacion({
  sede,
  jornadaLimitada,
  grados,
  onVerPlanillas,
}: {
  sede: string;
  jornadaLimitada: Jornada | null;
  /** Todos los grupos conocidos (de `asistenciaConfig/directores`); aqui se filtran por jornada. */
  grados: string[];
  onVerPlanillas: (grado: string) => void;
}) {
  const [paso, setPaso] = useState<'lista' | 'ausentes'>('lista');
  const [fecha, setFecha] = useState(() => toDateKey(new Date()));
  const [jornadaElegida, setJornada] = useState<Jornada>(
    () => jornadaLimitada ?? (new Date().getHours() < 12 ? 'manana' : 'tarde'),
  );
  // Un coordinador acotado a una jornada no puede salirse de ella: las reglas solo le
  // dejan leer las sesiones de la suya.
  const jornada = jornadaLimitada ?? jornadaElegida;
  const gradosDeLaJornada = grados.filter((g) => jornadaDeGrado(g) === jornada);

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-line bg-card p-3">
        <div className="flex flex-wrap items-end gap-2">
          <h2 className="text-base font-semibold text-strong">Tercera hora</h2>
          <span className="grow" />
          <label className="text-xs text-muted">
            Día{' '}
            <input
              type="date"
              value={fecha}
              onChange={(e) => e.target.value && setFecha(e.target.value)}
              className="rounded-lg border border-line bg-elevated p-1.5 text-sm text-strong"
            />
          </label>
          {jornadaLimitada ? (
            <span className="rounded-full bg-elevated px-2 py-1 text-xs text-soft">{ETIQUETA_JORNADA[jornadaLimitada]}</span>
          ) : (
            <label className="text-xs text-muted">
              Jornada{' '}
              <select
                value={jornada}
                onChange={(e) => setJornada(e.target.value as Jornada)}
                className="rounded-lg border border-line bg-elevated p-1.5 text-sm text-strong"
              >
                <option value="manana">Mañana</option>
                <option value="tarde">Tarde</option>
              </select>
            </label>
          )}
        </div>

        <div role="tablist" className="mt-3 flex border-b border-line">
          <BotonPaso activo={paso === 'lista'} onClick={() => setPaso('lista')}>
            <ListChecks size={16} aria-hidden /> 1. ¿Quién llamó lista?
          </BotonPaso>
          <BotonPaso activo={paso === 'ausentes'} onClick={() => setPaso('ausentes')}>
            <Phone size={16} aria-hidden /> 2. Ausentes y familias
          </BotonPaso>
        </div>
      </div>

      {paso === 'lista' ? (
        <TableroTerceraHora
          sede={sede}
          fecha={fecha}
          jornada={jornada}
          grados={gradosDeLaJornada}
          onVerPlanillas={onVerPlanillas}
        />
      ) : (
        <TerceraHora sede={sede} jornadaLimitada={jornadaLimitada} controlado={{ fecha, jornada }} />
      )}
    </div>
  );
}

function BotonPaso({
  activo,
  onClick,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      role="tab"
      aria-selected={activo}
      onClick={onClick}
      className={[
        '-mb-px flex min-h-11 items-center gap-1.5 border-b-2 px-3 text-sm',
        activo ? 'border-accent font-semibold text-strong' : 'border-transparent text-muted',
      ].join(' ')}
    >
      {children}
    </button>
  );
}
