import { BotonCopiar } from './Ficha';
import {
  enlaceLlamada,
  enlaceWhatsApp,
  formatearTelefono,
  tipoDeTelefono,
} from './domain/telefonos';

/**
 * Un renglon por telefono, pensado para llamar de pie una familia tras otra: cifra
 * grande para dictarla, y los tres botones a mano en vez de obligar a copiar antes de
 * poder actuar.
 */
export default function TelefonoAcudiente({
  numero,
  onLlamar,
}: {
  numero: string;
  /** Se dispara al pulsar Llamar, para que quien registre la gestion sepa a cual
   *  numero se llamo de verdad (ver defecto corregido en TerceraHora). */
  onLlamar?: (numero: string) => void;
}) {
  const tipo = tipoDeTelefono(numero);
  const llamada = enlaceLlamada(numero);
  const whatsapp = enlaceWhatsApp(numero);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="flex items-center gap-1.5">
        <b className="font-mono text-base tabular-nums tracking-wide text-strong">
          {formatearTelefono(numero)}
        </b>
        {tipo !== 'desconocido' && (
          <span className="rounded-full bg-elevated px-1.5 py-0.5 text-[0.65rem] text-muted">
            {tipo === 'movil' ? 'móvil' : 'fijo'}
          </span>
        )}
      </span>
      <span className="flex gap-1">
        {llamada && (
          <a
            href={llamada}
            onClick={() => onLlamar?.(numero)}
            className="grid min-h-9 min-w-9 place-items-center rounded-lg border border-line px-2 text-xs text-strong"
          >
            Llamar
          </a>
        )}
        {whatsapp && (
          <a
            href={whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            className="grid min-h-9 min-w-9 place-items-center rounded-lg border border-line px-2 text-xs text-strong"
          >
            WhatsApp
          </a>
        )}
        <BotonCopiar valor={numero} />
      </span>
    </div>
  );
}
