// Lógica PURA de las entregas desde la agenda pública. La usan la página pública (para avisar
// antes de subir) y la función planCasaSubirEntrega (que es la que de verdad decide).
// Ver docs/plan-casa/ENTREGAS-PRD.md.
import type { EstadoPaso, SeguimientoPaso, TipoEntrega } from './tipos';

/** 10 MB por archivo (decisión de Julián). */
export const TOPE_BYTES = 10 * 1024 * 1024;
/** Máximo de envíos por día y por plan. */
export const TOPE_DIARIO_ENVIOS = 20;
/** Lado mayor al que se reduce una foto en el cliente. */
export const LADO_FOTO = 1600;

/** Tipos MIME admitidos → tipo de entrega. */
export const MIME_ENTREGA: Record<string, Exclude<TipoEntrega, 'enlace'>> = {
  'image/jpeg': 'foto', 'image/png': 'foto', 'image/heic': 'foto', 'image/heif': 'foto', 'image/webp': 'foto',
  'audio/mpeg': 'audio', 'audio/mp3': 'audio', 'audio/mp4': 'audio', 'audio/x-m4a': 'audio', 'audio/m4a': 'audio', 'audio/aac': 'audio',
  'audio/ogg': 'audio', 'audio/webm': 'audio', 'audio/wav': 'audio', 'audio/x-wav': 'audio', 'audio/wave': 'audio',
  'application/pdf': 'pdf',
};
const EXT_MIME: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', heic: 'image/heic', heif: 'image/heif', webp: 'image/webp',
  mp3: 'audio/mpeg', m4a: 'audio/mp4', ogg: 'audio/ogg', oga: 'audio/ogg', webm: 'audio/webm', wav: 'audio/wav', pdf: 'application/pdf',
};
/** Para el `accept` del input file. */
export const ACCEPT_ENTREGA = 'image/*,audio/*,application/pdf,.heic,.m4a,.mp3,.ogg,.wav,.webm,.pdf';

/** Algunos celulares mandan el MIME vacío o genérico: se deduce por la extensión. */
export function mimeEfectivo(nombre: string, mime: string): string {
  const m = String(mime ?? '').toLowerCase().split(';')[0].trim();
  if (m && MIME_ENTREGA[m]) return m;
  const ext = String(nombre ?? '').toLowerCase().split('.').pop() ?? '';
  return EXT_MIME[ext] ?? m;
}

export type ResultadoValidacion = { ok: true; tipo: Exclude<TipoEntrega, 'enlace'>; contentType: string } | { ok: false; error: string };

export function validarArchivo(nombre: string, mime: string, bytes: number): ResultadoValidacion {
  const ct = mimeEfectivo(nombre, mime);
  const tipo = MIME_ENTREGA[ct];
  if (!tipo) {
    if (ct.startsWith('video/')) return { ok: false, error: 'Los videos no se suben aquí: súbelo a Drive o YouTube y pega el enlace.' };
    return { ok: false, error: 'Tipo de archivo no permitido. Envía una foto, un audio o un PDF.' };
  }
  if (!(bytes > 0)) return { ok: false, error: 'El archivo está vacío.' };
  if (bytes > TOPE_BYTES) return { ok: false, error: `El archivo es muy grande (${(bytes / 1048576).toFixed(1)} MB). El máximo es 10 MB.` };
  return { ok: true, tipo, contentType: ct };
}

export function validarEnlace(url: string): { ok: true; url: string } | { ok: false; error: string } {
  const u = String(url ?? '').trim();
  if (u.length > 1000) return { ok: false, error: 'El enlace es demasiado largo.' };
  try {
    const x = new URL(u);
    if (x.protocol !== 'https:' && x.protocol !== 'http:') throw new Error();
    return { ok: true, url: x.toString() };
  } catch { return { ok: false, error: 'Pega un enlace completo (empieza por https://).' }; }
}

/** Bytes reales de un base64 (sin decodificarlo). */
export function bytesDeBase64(b64: string): number {
  const s = String(b64 ?? '').replace(/\s/g, '');
  if (!s) return 0;
  const relleno = s.endsWith('==') ? 2 : s.endsWith('=') ? 1 : 0;
  return Math.floor((s.length * 3) / 4) - relleno;
}

/** Nombre apto para la ruta de Storage: ASCII, sin barras, máx. 80 caracteres. */
export function nombreSeguro(nombre: string): string {
  const limpio = String(nombre ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^[._]+/, '').slice(-80);
  return limpio || 'archivo';
}

/** Inicio del día en Colombia (UTC−5, sin horario de verano), en ms. */
export function inicioDiaColombia(ahora: number): number {
  const off = 5 * 3600_000;
  const local = ahora - off;
  return local - (((local % 86400_000) + 86400_000) % 86400_000) + off;
}

export function cupoDiario(enviosHoy: number): { ok: true } | { ok: false; error: string } {
  return enviosHoy >= TOPE_DIARIO_ENVIOS
    ? { ok: false, error: `Ya se enviaron ${TOPE_DIARIO_ENVIOS} archivos hoy. Intenta de nuevo mañana.` }
    : { ok: true };
}

/** Fin del año lectivo (31-dic del año de la entrega, hora Colombia), en ms. */
export function finAnioLectivo(ahora: number): number {
  const anio = new Date(ahora - 5 * 3600_000).getUTCFullYear();
  return Date.UTC(anio, 11, 31, 23 + 5, 59, 59) ; // 23:59:59 en Colombia
}

/** Seguimiento del paso tras una entrega: pasa a 'entregado' salvo que ya esté 'revisado'. */
export function seguimientoTrasEntrega(previo: SeguimientoPaso | undefined, ahora: number): SeguimientoPaso {
  const estado: EstadoPaso = previo?.estado === 'revisado' ? 'revisado' : 'entregado';
  return { ...(previo ?? {}), estado, entregadoEn: ahora, actualizadoEn: ahora };
}

/** Clave estable de un paso dentro del plan (los ids de paso se repiten entre guías). */
export const clavePaso = (guiaId: string, pasoId: string) => `${guiaId}/${pasoId}`;

export function formatoTamano(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${Math.round(b / 1024)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
}
