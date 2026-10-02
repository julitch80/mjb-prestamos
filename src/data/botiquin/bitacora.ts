// Lógica pura de la «Bitácora de la emergencia». Sin red: los datos de salud de menores
// viven solo en memoria / sessionStorage.

export type TipoEvento =
  | 'accidente' | 'inconsciente' | 'consciente' | 'llame123' | 'reanimacion'
  | 'familia' | 'ambulancia' | 'traslado' | 'nota' | 'medicion';

export interface EventoBitacora {
  tipo: TipoEvento;
  /** Marca de tiempo absoluta (ms desde epoch). */
  t: number;
  /** Texto libre: destino, nota o resultado de medición. */
  detalle?: string;
}

export interface BotonEvento { tipo: TipoEvento; etiqueta: string; pideTexto?: string }

export const BOTONES_EVENTO: BotonEvento[] = [
  { tipo: 'accidente', etiqueta: 'Se accidentó / empezó' },
  { tipo: 'inconsciente', etiqueta: 'Perdió el conocimiento' },
  { tipo: 'consciente', etiqueta: 'Recuperó el conocimiento' },
  { tipo: 'llame123', etiqueta: 'Llamé al 123' },
  { tipo: 'reanimacion', etiqueta: 'Inicié reanimación' },
  { tipo: 'familia', etiqueta: 'Avisé a la familia' },
  { tipo: 'ambulancia', etiqueta: 'Llegó la ambulancia' },
  { tipo: 'traslado', etiqueta: 'Se lo llevaron', pideTexto: 'A dónde (hospital o clínica)' },
];

export function etiquetaEvento(tipo: TipoEvento): string {
  if (tipo === 'nota') return 'Nota';
  if (tipo === 'medicion') return 'Medición';
  return BOTONES_EVENTO.find(b => b.tipo === tipo)?.etiqueta ?? tipo;
}

const p2 = (n: number) => String(n).padStart(2, '0');

/** mm:ss (o h:mm:ss si pasa de una hora) a partir de segundos. */
export function formatearMmSs(segundos: number): string {
  const s = Math.max(0, Math.floor(segundos));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}:${p2(m)}:${p2(s % 60)}` : `${p2(m)}:${p2(s % 60)}`;
}

/** Tiempo transcurrido desde la hora 0, p. ej. «+03:25». */
export function formatearTranscurrido(inicioMs: number, t: number): string {
  return `+${formatearMmSs((t - inicioMs) / 1000)}`;
}

export function formatearHora(t: number): string {
  const d = new Date(t);
  return `${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;
}

export function crearEvento(tipo: TipoEvento, t: number, detalle?: string): EventoBitacora {
  const d = detalle?.trim();
  return d ? { tipo, t, detalle: d } : { tipo, t };
}

export function formatearLinea(inicioMs: number, e: EventoBitacora): string {
  const base = `${formatearHora(e.t)} (${formatearTranscurrido(inicioMs, e.t)}) ${etiquetaEvento(e.tipo)}`;
  return e.detalle ? `${base}: ${e.detalle}` : base;
}

/** Orden cronológico (estable). */
export function ordenar(eventos: EventoBitacora[]): EventoBitacora[] {
  return eventos.map((e, i) => ({ e, i })).sort((a, b) => a.e.t - b.e.t || a.i - b.i).map(x => x.e);
}

export function quitarUltimo(eventos: EventoBitacora[]): EventoBitacora[] {
  return eventos.slice(0, -1);
}

/** Texto plano para paramédicos y para el reporte de accidente laboral. */
export function formatearBitacora(inicioMs: number | null, eventos: EventoBitacora[]): string {
  if (inicioMs === null) return 'Bitácora de la emergencia: sin iniciar.';
  const d = new Date(inicioMs);
  const fecha = `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
  const lineas = ordenar(eventos).map(e => formatearLinea(inicioMs, e));
  return [`Bitácora de la emergencia — ${fecha}, hora 0: ${formatearHora(inicioMs)}`, ...(lineas.length ? lineas : ['(sin eventos)'])].join('\n');
}
