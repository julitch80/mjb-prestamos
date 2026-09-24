/**
 * La llave del enlace de los avisos de inasistencia (ver `domain/avisos.ts`).
 *
 * El enlace lleva `<id>.<firma>`. El id es al azar y no es secreto; la firma es un HMAC
 * del id con una clave que solo tiene el servidor. Por eso:
 *  - la base de datos NO guarda ninguna llave: una filtracion no deja enlaces vivos;
 *  - el servidor puede volver a calcular la firma cuando coordinacion reanuda la cola
 *    despues de recargar la pagina, sin haberla guardado.
 *
 * ── Por que la clave SALE de DOC_HASH_KEY y no es un secreto nuevo ─────────────
 * Crear un secreto en Secret Manager no es idempotente y ya costo horas una vez (ver la
 * memoria del proyecto sobre DOC_HASH_KEY). Derivar una clave propia con un HMAC y una
 * etiqueta fija es separacion de claves estandar: conocer la clave de avisos no revela
 * DOC_HASH_KEY, y los enlaces no sirven para calcular el hash de ningun documento. Si
 * algun dia DOC_HASH_KEY cambiara, los avisos vivos (48 horas) dejarian de abrir — un
 * costo minimo al lado de lo que ese cambio romperia en todo lo demas.
 *
 * Sin dependencias de Firebase a proposito: se prueba con vitest directamente.
 */

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { LARGO_FIRMA_AVISO, LARGO_ID_AVISO } from '../../src/asistencia/domain/avisos';

const ETIQUETA = 'asistencia/avisos-inasistencia/v1';

export function claveDeAvisos(docHashKey: string): Buffer {
  if (!docHashKey) throw new Error('Falta la clave del servidor.');
  return createHmac('sha256', docHashKey).update(ETIQUETA).digest();
}

/** 60 bits al azar en base64url. Identifica el aviso; no abre nada por si solo. */
export function nuevoIdDeAviso(): string {
  return randomBytes(8).toString('base64url').slice(0, LARGO_ID_AVISO);
}

export function firmarAviso(clave: Buffer, avisoId: string): string {
  return createHmac('sha256', clave).update(avisoId).digest('base64url').slice(0, LARGO_FIRMA_AVISO);
}

/** Comparacion en tiempo constante: no deja adivinar la firma caracter por caracter. */
export function firmaValida(clave: Buffer, avisoId: string, firma: string): boolean {
  if (typeof firma !== 'string' || firma.length !== LARGO_FIRMA_AVISO) return false;
  const esperada = Buffer.from(firmarAviso(clave, avisoId));
  const recibida = Buffer.from(firma);
  return esperada.length === recibida.length && timingSafeEqual(esperada, recibida);
}
