// Lógica pura de «Sugerir preguntas orientadoras»: esquema, prompt y saneamiento. Sin red ni Firebase.

export interface EntradaPreguntas { tematica: string; asignaturas: string[]; grado: string; ajustes?: string[] }
export interface PreguntaSugerida { pregunta: string; porQue: string; aportes: { asignatura: string; aporte: string }[]; producto: string }

export const SISTEMA_PREGUNTAS = `Eres un experto en integración curricular colombiana: la «propuesta curricular integrada por áreas» de la UAI, que parte de un problema del contexto real y de una pregunta orientadora transversal.
Tu tarea: proponer a un docente 6 preguntas orientadoras para una guía de trabajo en casa.
Reglas:
- Español de Colombia, claro y cercano.
- Preguntas abiertas (nunca de sí o no), ancladas en el contexto real del estudiante: su casa, su barrio, San Antonio de Prado, Medellín.
- Cada pregunta debe necesitar de verdad TODAS las asignaturas listadas, no solo algunas.
- Adecuadas al grado indicado y realizables desde casa, con materiales cotidianos; si los ajustes piden poca carga, que sean sencillas y de poca carga.
- Para cada una: porQue (una línea), un aporte corto por cada asignatura listada, y una idea de producto integrado.
- No pidas ni incluyas nombres de estudiantes ni menciones diagnósticos o condiciones de salud.`;

export const ESQUEMA_PREGUNTAS = {
  type: 'object',
  additionalProperties: false,
  required: ['preguntas'],
  properties: {
    preguntas: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['pregunta', 'porQue', 'aportes', 'producto'],
        properties: {
          pregunta: { type: 'string' },
          porQue: { type: 'string' },
          aportes: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['asignatura', 'aporte'],
              properties: { asignatura: { type: 'string' }, aporte: { type: 'string' } },
            },
          },
          producto: { type: 'string' },
        },
      },
    },
  },
} as const;

function limpio(v: unknown, max: number): string {
  return typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

export function construirPromptPreguntas(e: EntradaPreguntas): string {
  const asigs = (Array.isArray(e.asignaturas) ? e.asignaturas : []).map(a => limpio(a, 100)).filter(Boolean).slice(0, 12);
  const ajustes = (Array.isArray(e.ajustes) ? e.ajustes : []).map(a => limpio(a, 300)).filter(Boolean).slice(0, 20);
  return [
    `Grado: ${limpio(e.grado, 20)}`,
    `Asignaturas que la pregunta debe integrar: ${asigs.join(', ')}`,
    `Temática o situación que el docente quiere trabajar: ${limpio(e.tematica, 400) || '(libre: propón tú temas del contexto)'}`,
    `Ajustes razonables a tener en cuenta:\n${ajustes.length ? ajustes.map(a => `- ${a}`).join('\n') : '- (ninguno específico)'}`,
    'Devuelve 6 preguntas orientadoras en el formato JSON indicado.',
  ].join('\n\n');
}

/** Valida la respuesta de la IA; descarta preguntas sin pregunta o sin producto. */
export function sanearPreguntas(bruto: unknown): PreguntaSugerida[] {
  const lista = bruto && typeof bruto === 'object' ? (bruto as Record<string, unknown>).preguntas : null;
  if (!Array.isArray(lista)) return [];
  const out: PreguntaSugerida[] = [];
  for (const p of lista) {
    if (!p || typeof p !== 'object') continue;
    const r = p as Record<string, unknown>;
    const pregunta = limpio(r.pregunta, 300);
    const producto = limpio(r.producto, 400);
    if (!pregunta || !producto) continue;
    const aportes = (Array.isArray(r.aportes) ? r.aportes : []).slice(0, 12).flatMap(x => {
      if (!x || typeof x !== 'object') return [];
      const a = x as Record<string, unknown>;
      const asignatura = limpio(a.asignatura, 100);
      const aporte = limpio(a.aporte, 300);
      return asignatura && aporte ? [{ asignatura, aporte }] : [];
    });
    out.push({ pregunta, porQue: limpio(r.porQue, 300), aportes, producto });
    if (out.length >= 8) break;
  }
  return out;
}
