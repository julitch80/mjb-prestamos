// Funciones puras del chat: iniciales, color estable de avatar, etiquetas de
// fecha y agrupación de mensajes consecutivos. Sin dependencias de Firebase.

// Fondos oscuros/saturados: texto blanco con contraste >= 4,5 en tema claro y
// oscuro (el avatar lleva su propio fondo, no depende del tema).
export const PALETA_AVATAR = [
  '#1d4ed8', '#047857', '#b45309', '#7e22ce', '#be123c', '#0e7490',
  '#4d7c0f', '#a21caf', '#c2410c', '#0f766e', '#4338ca', '#9f1239',
];

export function colorAvatar(clave: string): string {
  let h = 0;
  const s = (clave || '').trim().toLowerCase();
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return PALETA_AVATAR[h % PALETA_AVATAR.length];
}

export function iniciales(nombre: string): string {
  const p = (nombre || '').replace(/@.*$/, '').split(/[\s._-]+/).filter(Boolean);
  if (p.length === 0) return '?';
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return (p[0][0] + p[1][0]).toUpperCase();
}

function inicioDia(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}
function diasEntre(d: Date, ahora: Date): number {
  return Math.round((inicioDia(ahora) - inicioDia(d)) / 86400000);
}
const pad = (n: number) => String(n).padStart(2, '0');

/** Hora de la lista: hoy «10:42», ayer «Ayer», otra fecha «24/10». */
export function etiquetaLista(d: Date, ahora: Date = new Date()): string {
  const dias = diasEntre(d, ahora);
  if (dias <= 0) return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (dias === 1) return 'Ayer';
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
}

/** Separador entre días: «Hoy», «Ayer» o «lunes 20 de octubre». */
export function etiquetaSeparador(d: Date, ahora: Date = new Date()): string {
  const dias = diasEntre(d, ahora);
  if (dias <= 0) return 'Hoy';
  if (dias === 1) return 'Ayer';
  return d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
}

export const VENTANA_RACHA_MS = 5 * 60 * 1000;

export interface MsgAgrupable { id: string; authorEmail: string; deleted?: boolean; fecha: Date | null }
export interface ItemAgrupado<T> {
  m: T;
  /** Etiqueta de separador de día antes de este mensaje (o null). */
  separador: string | null;
  inicioRacha: boolean;
  finRacha: boolean;
}

/** Marca inicio/fin de racha (mismo autor, <5 min, mismo día) y separadores. */
export function agruparMensajes<T extends MsgAgrupable>(msgs: T[], ahora: Date = new Date()): ItemAgrupado<T>[] {
  const out: ItemAgrupado<T>[] = [];
  let diaPrev = -1;
  msgs.forEach((m, i) => {
    const f = m.fecha ?? ahora; // pendiente de servidor: se trata como «ahora»
    const dia = inicioDia(f);
    const separador = dia !== diaPrev ? etiquetaSeparador(f, ahora) : null;
    diaPrev = dia;
    const prev = i > 0 ? msgs[i - 1] : null;
    const continua =
      !!prev && separador === null && !m.deleted && !prev.deleted &&
      prev.authorEmail === m.authorEmail &&
      f.getTime() - (prev.fecha ?? ahora).getTime() <= VENTANA_RACHA_MS;
    out.push({ m, separador, inicioRacha: !continua, finRacha: true });
    if (continua) out[i - 1].finRacha = false;
  });
  return out;
}
