import { ETIQUETA_JORNADA, type FiltroJornada } from './domain/filtro-jornada';
import type { Jornada } from './domain/types';

/**
 * El mismo selector en evasiones, permanencia y llegadas tarde. Ver
 * `domain/filtro-jornada.ts` para el porque.
 *
 * Al coordinador limitado a una jornada no se le ofrece escoger: se le dice cual esta
 * viendo. Mostrarle un selector con una opcion que no puede usar seria prometer algo que
 * la pantalla no va a cumplir.
 */
export default function SelectorJornada({
  limitada,
  valor,
  onCambio,
}: {
  limitada: Jornada | null;
  valor: FiltroJornada;
  onCambio: (f: FiltroJornada) => void;
}) {
  if (limitada) {
    return (
      <span className="rounded-full bg-elevated px-2 py-1 text-xs text-soft">
        {ETIQUETA_JORNADA[limitada]}
      </span>
    );
  }
  return (
    <label className="text-xs text-muted">
      Jornada{' '}
      <select
        value={valor}
        onChange={(e) => onCambio(e.target.value as FiltroJornada)}
        className="rounded-lg border border-line bg-elevated p-1.5 text-sm text-strong"
      >
        <option value="ambas">Las dos</option>
        <option value="manana">Mañana</option>
        <option value="tarde">Tarde</option>
      </select>
    </label>
  );
}
