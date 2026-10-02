import type { ArchivoSede, RefArchivo } from './tipos';

export const MAX_BYTES_ARCHIVO = 20 * 1024 * 1024;

const POR_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf', doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif',
  mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav', ogg: 'audio/ogg', webm: 'audio/webm', aac: 'audio/aac',
  txt: 'text/plain', csv: 'text/csv',
};
const EXACTOS = new Set([
  'application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain', 'text/csv',
]);

/** Algunos celulares entregan archivos con `type` vacío: se deduce de la extensión. */
export function tipoDeArchivo(nombre: string, tipo: string): string {
  if (tipo) return tipo.split(';')[0].trim().toLowerCase();
  const ext = nombre.split('.').pop()?.toLowerCase() ?? '';
  return POR_EXTENSION[ext] ?? '';
}
export function tipoPermitido(tipo: string): boolean {
  return tipo.startsWith('image/') || tipo.startsWith('audio/') || EXACTOS.has(tipo);
}
/** Devuelve el motivo del rechazo, o null si el archivo sirve. */
export function validarArchivo(nombre: string, tipo: string, tamano: number): string | null {
  if (!tipoPermitido(tipoDeArchivo(nombre, tipo))) return 'Tipo no admitido (use imagen, PDF, Word, Excel o audio).';
  if (tamano > MAX_BYTES_ARCHIVO) return 'Supera los 20 MB.';
  if (tamano <= 0) return 'El archivo está vacío.';
  return null;
}

/** Siguiente etiqueta libre: A1, A2… (nunca reutiliza una ya entregada). */
export function siguienteEtiqueta(archivos: Pick<ArchivoSede, 'etiqueta'>[]): string {
  const max = archivos.reduce((m, a) => {
    const n = /^A(\d+)$/.exec(a.etiqueta);
    return n ? Math.max(m, Number(n[1])) : m;
  }, 0);
  return `A${max + 1}`;
}
export function nombreCorto(nombreOriginal: string): string {
  const sinExt = nombreOriginal.replace(/\.[a-zA-Z0-9]+$/, '').replace(/[_-]+/g, ' ').trim();
  return (sinExt || 'archivo').slice(0, 40);
}
/** «A1 p.2» (o solo «A1»). */
export function formatearRef(r: RefArchivo): string {
  return r.donde.trim() ? `${r.etiqueta} ${r.donde.trim()}` : r.etiqueta;
}
export function formatearTamano(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
