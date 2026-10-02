// Selección de formato para MediaRecorder: Chrome Android graba webm, Safari iOS solo mp4.
export const MAX_SEGUNDOS_AUDIO = 300;
const CANDIDATOS = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/ogg'];

export function elegirMimeType(esSoportado: (t: string) => boolean): string | null {
  for (const c of CANDIDATOS) {
    try { if (esSoportado(c)) return c; } catch { /* navegador sin soporte de ese tipo */ }
  }
  return null;
}
export const mimeBase = (m: string): string => m.split(';')[0].trim().toLowerCase();
export function extensionDeMime(m: string): string {
  const b = mimeBase(m);
  if (b === 'audio/webm') return 'webm';
  if (b === 'audio/mp4' || b === 'audio/x-m4a') return 'm4a';
  if (b === 'audio/ogg') return 'ogg';
  if (b === 'audio/mpeg') return 'mp3';
  return 'audio';
}
export function formatearDuracion(seg: number): string {
  const s = Math.max(0, Math.round(seg));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
