// «Propón una escena» para la cartilla ilustrada del manual de convivencia (Julián, 2026-10-01).
//
// Es una PROPUESTA PARA CONSTRUIR, no una escena que entra: queda en el buzón como pendiente,
// coordinación la revisa, se dibuja y después se incorpora al manual.
//
// Un docente que echa de menos un tema en las láminas de primaria la narra desde el manual
// digital abierto DENTRO de la app (public/convivencia/manual-digital.html con ?desde=app).
// El manual solo avisa por postMessage después de qué lámina va (o null, desde el aviso general); la ficha la llena el
// docente aquí, con sesión, y entra al buzón de sugerencias marcada con PREFIJO_ESCENA.
// Con esos campos se arma después el prompt de Gemini en el estilo de las 30 escenas.

export const PREFIJO_ESCENA = '[Escena para el manual]';

export interface LaminaDeReferencia {
  numero: number;
  titulo: string;
  grupo: string;
}

export interface PropuestaEscena {
  despuesDe: LaminaDeReferencia | null;
  tema: string;
  grados: string;
  lugar: string;
  personajes: string;
  queOcurre: string;
  aprendizaje: string;
}

export const PROPUESTA_VACIA: Omit<PropuestaEscena, 'despuesDe'> = {
  tema: '', grados: '', lugar: '', personajes: '', queOcurre: '', aprendizaje: '',
};

/** Lo que falta para poder enviarla, en palabras para el docente. Vacío = lista. */
export function faltantesPropuesta(p: PropuestaEscena): string[] {
  const f: string[] = [];
  if (p.tema.trim().length < 3) f.push('qué parte del manual falta');
  if (p.queOcurre.trim().length < 20) f.push('qué pasa en la escena (un poco más de detalle)');
  if (p.aprendizaje.trim().length < 5) f.push('qué debería entender el niño');
  return f;
}

/** El texto que entra al buzón de sugerencias. Una línea por campo, para leerlo de un vistazo. */
export function textoSugerenciaEscena(p: PropuestaEscena): string {
  const limpio = (s: string) => s.trim().replace(/\s+/g, ' ');
  const lineas = [
    `${PREFIJO_ESCENA} Propuesta de escena POR CONSTRUIR para la cartilla ilustrada`,
    p.despuesDe
      ? `Ubicación: después de la lámina ${p.despuesDe.numero}, «${limpio(p.despuesDe.titulo)}» (${limpio(p.despuesDe.grupo)})`
      : 'Ubicación: sin indicar (propuesta general)',
    `Tema del manual: ${limpio(p.tema)}`,
  ];
  if (p.grados.trim()) lineas.push(`Grados: ${limpio(p.grados)}`);
  if (p.lugar.trim()) lineas.push(`Dónde pasa: ${limpio(p.lugar)}`);
  if (p.personajes.trim()) lineas.push(`Quiénes aparecen: ${limpio(p.personajes)}`);
  lineas.push(`Qué pasa: ${limpio(p.queOcurre)}`);
  lineas.push(`Qué debe entender el niño: ${limpio(p.aprendizaje)}`);
  return lineas.join('\n');
}

/**
 * Valida el mensaje que manda el manual desde su marco. Es una entrada externa: se acepta
 * solo la forma exacta, y el título se recorta, porque termina en el texto de la sugerencia.
 * `despuesDe: null` = desde el aviso general de la cartilla, sin lámina. `null` = no es válido.
 */
export function leerMensajeManual(data: unknown): { despuesDe: LaminaDeReferencia | null } | null {
  if (!data || typeof data !== 'object') return null;
  const m = data as { tipo?: unknown; despuesDe?: unknown };
  if (m.tipo !== 'mjb-proponer-escena') return null;
  if (m.despuesDe === null) return { despuesDe: null };
  if (!m.despuesDe || typeof m.despuesDe !== 'object') return null;
  const d = m.despuesDe as { numero?: unknown; titulo?: unknown; grupo?: unknown };
  if (typeof d.numero !== 'number' || !Number.isInteger(d.numero) || d.numero < 1 || d.numero > 999) return null;
  if (typeof d.titulo !== 'string' || typeof d.grupo !== 'string') return null;
  return { despuesDe: { numero: d.numero, titulo: d.titulo.slice(0, 120), grupo: d.grupo.slice(0, 60) } };
}
