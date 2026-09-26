import { useState } from 'react';
import { ListChecks, Phone } from 'lucide-react';
import { ETIQUETA_JORNADA } from './domain/filtro-jornada';
import { jornadaDeGrado, toDateKey } from './domain/ids';
import type { Jornada } from './domain/types';
import AlertaDiasSinAsistir from './AlertaDiasSinAsistir';
import TableroTerceraHora from './TableroTerceraHora';
import TerceraHora from './TerceraHora';

/**
 * La pestaña de tercera hora de coordinación, en DOS PASOS (2026-09-25), en el orden en
 * que trabaja la coordinadora:
 *   1. ¿Quién llamó lista?  — asegurar que todos los grupos tomaron asistencia.
 *   2. Ausentes y familias  — atender a los que no vinieron (el reporte de siempre).
 *
 * Va despues de Planillas y Llegadas tarde; se entra al modulo por Planillas (Julián,
 * 2026-09-25, revirtiendo el mismo dia la entrada directa a esta pestaña).
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
      <div className="space-y-3 rounded-xl border border-line bg-card p-3">
        <div>
          <h2 className="text-base font-semibold text-strong">Tercera hora</h2>
          <p className="text-xs text-muted">
            Esta pestaña tiene dos pantallas. Escoja cuál ver:
          </p>
        </div>

        {/*
          Los dos pasos como PASTILLAS grandes, con el estilo de las demas pastillas de la
          aplicacion (borde y fondo de acento en la elegida). Antes eran dos pestañas
          subrayadas que se leian como un titulo: Julián descubrio «por pura casualidad»
          que eran dos pantallas distintas (2026-09-25). Cada una dice que muestra.
        */}
        <div role="tablist" aria-label="Pantallas de tercera hora" className="grid gap-2 sm:grid-cols-2">
          <PastillaPaso
            activo={paso === 'lista'}
            onClick={() => setPaso('lista')}
            icono={<ListChecks size={18} aria-hidden />}
            titulo="1. ¿Quién llamó lista?"
            detalle="Grupo por grupo: si ya se tomó la asistencia a tercera hora."
          />
          <PastillaPaso
            activo={paso === 'ausentes'}
            onClick={() => setPaso('ausentes')}
            icono={<Phone size={18} aria-hidden />}
            titulo="2. Ausentes y familias"
            detalle="Quién no vino, los avisos por mensaje y las llamadas a las familias."
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
          <span className="text-xs text-muted">Mostrando:</span>
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
        <>
          <AlertaDiasSinAsistir sede={sede} fecha={fecha} jornada={jornada} />
          <TerceraHora sede={sede} jornadaLimitada={jornadaLimitada} controlado={{ fecha, jornada }} />
        </>
      )}
    </div>
  );
}

function PastillaPaso({
  activo,
  onClick,
  icono,
  titulo,
  detalle,
}: {
  activo: boolean;
  onClick: () => void;
  icono: React.ReactNode;
  titulo: string;
  detalle: string;
}) {
  return (
    <button
      role="tab"
      aria-selected={activo}
      onClick={onClick}
      className={[
        'flex min-h-14 items-start gap-2 rounded-2xl border-2 px-3 py-2 text-left',
        activo
          ? 'border-accent bg-accent-soft text-accent-soft-fg'
          : 'border-line bg-elevated text-soft hover:bg-hover',
      ].join(' ')}
    >
      <span className="mt-0.5 shrink-0">{icono}</span>
      <span className="min-w-0">
        <span className={`block text-sm ${activo ? 'font-bold' : 'font-semibold text-strong'}`}>{titulo}</span>
        <span className="block text-xs opacity-80">{detalle}</span>
      </span>
    </button>
  );
}
