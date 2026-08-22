import { Phone } from 'lucide-react';
import { BotonCopiar } from './Ficha';
import {
  enlaceLlamada,
  enlaceWhatsApp,
  formatearTelefono,
  tipoDeTelefono,
} from './domain/telefonos';

/**
 * Logo de WhatsApp, dibujado a mano.
 *
 * No sale de `lucide-react`: esa libreria RETIRO los logos de marca, asi que no hay un
 * `<Whatsapp />` que importar y no lo va a haber. Traer una libreria entera de logos por
 * un solo icono no se justifica, y el contrato de integracion pide no anadir
 * dependencias sin motivo.
 *
 * El verde va literal y no por token: aqui el color no es tema de la aplicacion, es parte
 * del logo — en claro y en oscuro WhatsApp es el mismo verde, igual que la marca de
 * asistencia lleva su color propio.
 */
function IconoWhatsApp() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="#25D366" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  );
}

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
      {/*
        Iconos y no palabras. Un telefono y el logo de WhatsApp se reconocen sin leer, y
        en la fila caben los tres botones sin que el numero —que es lo que de verdad hay
        que ver— quede arrinconado.

        Al perder el texto, el `aria-label` deja de ser un adorno: es lo unico que oye
        quien usa lector de pantalla. Y lleva el numero dentro, porque en una ficha con
        dos telefonos "Llamar" a secas no dice a cual.
      */}
      <span className="flex gap-1">
        {llamada && (
          <a
            href={llamada}
            onClick={() => onLlamar?.(numero)}
            aria-label={`Llamar al ${formatearTelefono(numero)}`}
            title="Llamar"
            className="grid min-h-9 min-w-9 place-items-center rounded-lg border border-line text-strong"
          >
            <Phone size={16} aria-hidden />
          </a>
        )}
        {whatsapp && (
          <a
            href={whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Abrir WhatsApp con el ${formatearTelefono(numero)}`}
            title="WhatsApp"
            className="grid min-h-9 min-w-9 place-items-center rounded-lg border border-line"
          >
            <IconoWhatsApp />
          </a>
        )}
        <BotonCopiar valor={numero} soloIcono />
      </span>
    </div>
  );
}
