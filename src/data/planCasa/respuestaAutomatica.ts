// Respuesta automática (sin IA, solo palabras clave) a las consultas TÉCNICAS frecuentes del Plan
// Académico Especial. Lógica PURA compartida con functions-plancasa. Solo responde si la consulta es
// técnica, coincide EXACTAMENTE un tema y no menciona nada sensible; lo demás va a una persona.
import type { TipoConsulta } from './consultas';

export type TemaAuto = 'video-audio' | 'archivo-pesado' | 'memoria' | 'no-carga' | 'pantalla-inicio';

export type ClasificacionConsulta =
  | { auto: true; tema: TemaAuto; respuesta: string }
  | { auto: false; motivo: string };

export const CIERRE_AUTO = 'Esta es una respuesta automática. Si no resolvió tu duda, escribe de nuevo contando qué mensaje te aparece y te responde una persona.';
export const RESPONDIDA_POR_AUTO = 'respuesta-automatica';

/** Minúsculas, sin tildes ni signos raros, espacios colapsados. */
export function normalizarTexto(t: string): string {
  return t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

// Sobre texto ya normalizado. Prefijos (sin \b final) para tomar variantes: «suicid», «oper»…
const SENSIBLES: RegExp[] = [
  /\bsalud\b/, /\benferm/, /\boperad/, /\bcirugia/, /\bhospital/, /\bmedic/, /\bincapacid/, /\bpsicolog/,
  /\bfamilia/, /\b(papa|mama|padre|madre|abuel[oa])\b.*\b(muri|fallec|murio)/, /\b(murio|fallecio|fallecimiento|duelo)\b/,
  /\bviolen/, /\bacoso/, /\babus/, /\bembaraz/, /\bdroga/, /\bsuicid/, /\bdeprim/, /\bamenaz/,
  /\bnotas?\b/, /\bperd(er|i|io|ido|ida)\b/, /\bperdid/, /\bsustentaci/, /\bcalific/, /\breprob/,
  /\bdocente\b/, /\bprofesor/, /\bprofe\b/, /\bpagar\b/, /\bpago\b/, /\bdemanda/, /\bqueja/, /\breclamo/,
];

// Un tema coincide si se cumple AL MENOS UN grupo, y dentro de un grupo TODAS sus expresiones.
const TEMAS: { tema: TemaAuto; grupos: RegExp[][]; respuesta: string }[] = [
  {
    tema: 'video-audio',
    grupos: [[/\b(video|videos|audio|audios|grabacion|grabar|grabe|nota de voz)\b/, /\b(enviar|envio|envia|mandar|mando|subir|subo|entregar|entrego|como|donde|puedo)\b/]],
    respuesta: 'El video no se sube directamente: súbelo a Google Drive o a YouTube, compártelo como «Cualquier persona con el enlace» y pégalo en la agenda con el botón «Pegar enlace (video)». '
      + 'Si es un audio, grábalo con la grabadora del celular y luego toca «Entregar» para elegirlo desde tus archivos. '
      + 'Si dudas, toca «ℹ️ Cómo enviar» o «📖 Manual» en la agenda.',
  },
  {
    tema: 'archivo-pesado',
    grupos: [[/\b(pesad[oa]s?|peso|pesa|tamano|megas?|mb|muy grande|demasiado grande|excede|supera)\b/], [/\bno (se )?(puede |me deja |logro )?(sube|subir|subo)\b/]],
    respuesta: 'Cada archivo puede pesar máximo 20 MB. Si tu foto o PDF pesa más, tómala de nuevo con menos calidad o envíala en partes (una página por foto). '
      + 'Los videos no se suben a la agenda: súbelos a Google Drive o YouTube, compártelos como «Cualquier persona con el enlace» y usa «Pegar enlace (video)». '
      + 'Se aceptan fotos, audio, PDF y documentos de Word, PowerPoint o Excel; toca «ℹ️ Cómo enviar» para ver los detalles.',
  },
  {
    tema: 'memoria',
    grupos: [[/\bmemoria\b/], [/\bse (reinicia|reinician|cierra|recarga|congela|traba|pega)\b/], [/\b(al|cuando) (tomar|tomo|sacar|saco) (la |una )?foto\b/]],
    respuesta: 'A veces el celular se queda sin memoria al abrir la cámara desde la agenda. Haz esto: cierra las demás aplicaciones, toma la foto con la cámara normal del celular (la de siempre, fuera de la agenda) '
      + 'y luego en la agenda toca «Entregar» y elígela desde la galería. Así no usa tanta memoria.',
  },
  {
    tema: 'no-carga',
    grupos: [[/\bno (me )?(carga|cargan|abre|abren|funciona|funcionan|sirve|aparece)\b/], [/\b(enlace|link)\b.*\b(valido|invalido|roto|vencido|reemplazado)\b/], [/\bpagina en blanco\b/]],
    respuesta: 'Prueba esto: recarga la página y revisa que tengas internet. Abre el enlace completo tal como llegó en el mensaje original (sin cortarlo ni copiarlo a medias). '
      + 'Si la pantalla dice «Este enlace no es válido o fue reemplazado», es que el colegio generó uno nuevo: pide el enlace nuevo al colegio.',
  },
  {
    tema: 'pantalla-inicio',
    grupos: [[/\bpantalla (de )?(inicio|principal)\b/], [/\bno (encuentro|se donde|veo) (esta |la |mi )?agenda\b/], [/\b(donde (esta|queda|encuentro)|perdi|encontrar) (la |mi )?agenda\b/], [/\bacceso directo\b/], [/\bagregar (la )?agenda\b/]],
    respuesta: 'Abre el enlace de la agenda en el navegador del celular. Para tenerla a la mano, abre el menú del navegador (los tres puntos o el botón de compartir) y elige «Agregar a la pantalla de inicio»: quedará un ícono como cualquier aplicación. '
      + 'Si no encuentras la agenda, vuelve a abrir el enlace del mensaje original que te envió el colegio.',
  },
];

export function clasificarConsulta(tipo: TipoConsulta | string, texto: string): ClasificacionConsulta {
  if (tipo !== 'tecnica') return { auto: false, motivo: 'Consulta pedagógica: la responde una persona.' };
  const n = normalizarTexto(String(texto ?? ''));
  if (!n) return { auto: false, motivo: 'Consulta vacía.' };
  if (SENSIBLES.some(re => re.test(n))) return { auto: false, motivo: 'Menciona un tema sensible o personal: requiere una persona.' };
  const coinciden = TEMAS.filter(t => t.grupos.some(g => g.every(re => re.test(n))));
  if (coinciden.length === 0) return { auto: false, motivo: 'No coincide con ningún tema técnico frecuente.' };
  if (coinciden.length > 1) return { auto: false, motivo: `Coincide con varios temas (${coinciden.map(c => c.tema).join(', ')}): requiere una persona.` };
  const t = coinciden[0];
  return { auto: true, tema: t.tema, respuesta: `${t.respuesta}\n\n${CIERRE_AUTO}` };
}
