/**
 * Validacion de la foto del soporte que llega con la respuesta al aviso (2026-09-23).
 * Ver `SoporteAviso` en `domain/avisos.ts`.
 *
 * La manda una pagina publica, sin sesion: todo lo que llega se trata como hostil. El tipo
 * se comprueba por el CONTENIDO del archivo (sus primeros bytes), no por lo que diga la
 * peticion: un texto renombrado a .jpg, un PDF o un SVG —que puede llevar codigo— se
 * rechazan aunque vengan etiquetados como imagen.
 *
 * Sin dependencias de Firebase a proposito: se prueba con vitest directamente.
 */

import { SOPORTE_MAX_BYTES, TIPOS_SOPORTE, type TipoSoporte } from '../../src/asistencia/domain/avisos';

export type RechazoSoporte = 'soporte_mal_formado' | 'soporte_tipo' | 'soporte_vacio' | 'soporte_grande';

const FIRMAS: Record<TipoSoporte, number[]> = {
  'image/jpeg': [0xff, 0xd8, 0xff],
  'image/png': [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
};

function empiezaCon(buf: Buffer, firma: number[]): boolean {
  return buf.length >= firma.length && firma.every((b, i) => buf[i] === b);
}

/**
 * `entrada` es lo que manda la pagina: `{ tipo, datosBase64 }`. Devuelve el archivo listo
 * para guardar, o por que se rechaza.
 */
export function decodificarSoporte(
  entrada: unknown,
): { buf: Buffer; tipo: TipoSoporte } | { rechazo: RechazoSoporte } {
  const e = entrada as { tipo?: unknown; datosBase64?: unknown } | null | undefined;
  if (!e || typeof e !== 'object' || typeof e.tipo !== 'string' || typeof e.datosBase64 !== 'string') {
    return { rechazo: 'soporte_mal_formado' };
  }
  if (!(TIPOS_SOPORTE as readonly string[]).includes(e.tipo)) return { rechazo: 'soporte_tipo' };
  const tipo = e.tipo as TipoSoporte;

  // Base64 estricto: `Buffer.from` ignora en silencio lo que no entiende, y eso dejaria
  // pasar basura. El largo se mira ANTES de decodificar, para no gastar memoria en un
  // archivo que igual se va a rechazar.
  const b64 = e.datosBase64;
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(b64) || b64.length % 4 !== 0) return { rechazo: 'soporte_mal_formado' };
  if (b64.length === 0) return { rechazo: 'soporte_vacio' };
  if ((b64.length / 4) * 3 > SOPORTE_MAX_BYTES + 3) return { rechazo: 'soporte_grande' };

  const buf = Buffer.from(b64, 'base64');
  if (buf.length === 0) return { rechazo: 'soporte_vacio' };
  if (buf.length > SOPORTE_MAX_BYTES) return { rechazo: 'soporte_grande' };
  if (!empiezaCon(buf, FIRMAS[tipo])) return { rechazo: 'soporte_tipo' };
  return { buf, tipo };
}
