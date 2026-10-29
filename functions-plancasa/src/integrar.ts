// «Integrar la guía»: lógica pura (esquema, prompt y saneamiento) de la función planCasaIntegrarGuia.
// Sin red ni Firebase. Junta los entregables de los docentes en UNA entrega integrada por semana.
import { capacidadPorSemana, nSemanas, validarIntegrada } from '../../src/data/planCasa/integrada';
import type { EntradaIntegrarGuia, Guia } from '../../src/data/planCasa/tipos';
import { BLOQUE_SIN_TECNOLOGIA, ESQUEMA_GUIA, SISTEMA, sanearGuia } from './guia';

const MAX = { corto: 300, medio: 1200, largo: 3000, lectura: 4000 };
const RE_URL = /\bhttps?:\/\/\S+|\bwww\.\S+/gi;

function limpio(v: unknown, max: number): string {
  return typeof v === 'string' ? v.replace(RE_URL, '').replace(/\s+\n/g, '\n').trim().slice(0, max) : '';
}

export const SISTEMA_INTEGRAR = `${SISTEMA}

MODO «INTEGRAR LA GUÍA». Ya existe una guía con pasos y los docentes de cada asignatura dejaron su entregable, criterios y evidencia. Tu tarea es REORGANIZARLA para que el estudiante tenga UNA sola entrega integrada por semana, sin pedirles nada nuevo a los docentes.
- Hay exactamente UNA entrega parcial por semana (esEntregaParcial true) y es el ÚLTIMO paso de esa semana. Los pasos anteriores de la semana son preparatorios: conducen a esa entrega (esEntregaParcial false, componentes vacío []).
- La entrega de cada semana fusiona en UN solo producto los entregables de los docentes que corresponden a esa semana (por su fecha de entrega o por afinidad con los pasos). En «componentes» pon un elemento por cada asignatura que participa en esa entrega: asignaturaId (exactamente el id indicado), parte (lo que el estudiante incluye para esa asignatura, derivado del entregable del docente, dicho al estudiante en una frase) y queRevisar (lo que ese docente revisa, derivado de sus criterios y su evidencia, en una frase).
- Cada asignatura debe aparecer al menos en un componente a lo largo del plan. No inventes asignaturas ni ids.
- Conserva el contenido útil de la guía actual (pregunta orientadora, temas, lecturas, sustentación), pero reduce y fusiona pasos si hace falta para respetar el tiempo disponible. NO agregues pasos sueltos «Entregable de X».
- RESPETA la capacidad de momentos por semana que se indica: la suma de momentos de los pasos de cada semana no puede superarla.
- Los pasos preparatorios sí pueden llevar «lectura» escrita por ti (250 a 600 palabras); nunca pidas buscar o abrir documentos o enlaces externos.
- Mantén la sustentación (preguntasSustentacion y sustentacionModalidad) de la guía actual, ajustándola si hace falta para que cubra a todas las asignaturas.`;

/** Esquema de la guía con `componentes` por paso y el id de asignatura restringido a los reales. */
export function esquemaIntegrar(ids: string[]): Record<string, unknown> {
  const e = JSON.parse(JSON.stringify(ESQUEMA_GUIA)) as {
    properties: { pasos: { items: { required: string[]; properties: Record<string, unknown> } } };
  };
  const item = e.properties.pasos.items;
  item.required = [...item.required, 'componentes'];
  item.properties.componentes = {
    type: 'array',
    items: {
      type: 'object',
      additionalProperties: false,
      required: ['asignaturaId', 'parte', 'queRevisar'],
      properties: {
        asignaturaId: ids.length ? { type: 'string', enum: ids } : { type: 'string' },
        parte: { type: 'string' },
        queRevisar: { type: 'string' },
      },
    },
  };
  return e as unknown as Record<string, unknown>;
}

const topeN = (t: number) => (Number.isFinite(t) && t >= 1 ? Math.min(Math.round(t), 8) : 4);

/** Mensaje de usuario: guía actual + datos de cada docente + capacidad por semana. Nunca nombre ni motivo del estudiante. */
export function construirPromptIntegrar(e: EntradaIntegrarGuia, avisoExceso = ''): string {
  const cap = capacidadPorSemana(e.desde, e.hasta, e.topeDiario, e.ritmo);
  const n = nSemanas(e.desde, e.hasta);
  const ajustes = (e.ajustes ?? []).map(a => limpio(a, MAX.corto)).filter(Boolean);
  const g = e.guia;
  const pasosActuales = (g?.pasos ?? []).filter(p => !/^ent-/.test(String(p.id))).map(p =>
    `- [semana ${Number(p.semana) || 1} · ${Number(p.momentos) || 1} mom.${p.esEntregaParcial ? ' · entrega parcial' : ''}] ${limpio(p.titulo, MAX.corto)}\n  Instrucciones: ${limpio(p.instrucciones, MAX.largo).replace(/\n/g, ' / ')}${p.lectura ? `\n  Lectura actual: ${limpio(p.lectura, MAX.lectura)}` : ''}`).join('\n');
  const partes = [
    ...(e.sinTecnologia ? [BLOQUE_SIN_TECNOLOGIA] : []),
    `Pregunta orientadora: ${limpio(e.eje, MAX.corto)}`,
    `Grado: ${limpio(e.grado, 20)}`,
    `Periodo: del ${limpio(e.desde, 10)} al ${limpio(e.hasta, 10)} (${n} semana${n === 1 ? '' : 's'}).`,
    `Máximo de momentos de 25 minutos por día, sumando todas las asignaturas: ${topeN(e.topeDiario)}. Ritmo: ${e.ritmo === 'dia_por_medio' ? 'día por medio' : 'diario'}.`,
    `CAPACIDAD de momentos por semana (la suma de los pasos de cada semana NO puede superarla):\n${cap.map((c, i) => `- Semana ${i + 1}: ${c} momentos`).join('\n')}`,
    ...(avisoExceso ? [avisoExceso] : []),
    `Ajustes razonables que debes aplicar:\n${ajustes.length ? ajustes.map(a => `- ${a}`).join('\n') : '- (ninguno específico)'}`,
    `Asignaturas y lo que dejó cada docente (usa EXACTAMENTE estos ids en «componentes»):\n${(e.asignaturas ?? []).map(a =>
      [`- id «${limpio(a.asignaturaId, 100)}» · ${limpio(a.nombre, 100)}`,
        limpio(a.tematicas, MAX.largo) ? `  Temáticas: ${limpio(a.tematicas, MAX.largo)}` : '',
        limpio(a.competencia, MAX.largo) ? `  Competencia: ${limpio(a.competencia, MAX.largo)}` : '',
        `  Criterios: ${limpio(a.criterios, MAX.largo) || '(no indicados)'}`,
        limpio(a.evidencia, MAX.largo) ? `  Evidencia esperada: ${limpio(a.evidencia, MAX.largo)}` : '',
        limpio(a.entregable, MAX.largo) ? `  Entregable pedido: ${limpio(a.entregable, MAX.largo)}` : '  Entregable pedido: (ninguno)',
        a.fechaEntrega ? `  Fecha de entrega pedida: ${limpio(a.fechaEntrega, 10)}` : ''].filter(Boolean).join('\n')).join('\n')}`,
    `Producto integrado actual: ${limpio(g?.productoFinal, MAX.medio)}`,
    `Criterios de evaluación actuales:\n${(g?.criteriosEvaluacion ?? []).map(c => `- ${limpio(c, MAX.medio)}`).join('\n')}`,
    `Pasos actuales de la guía:\n${pasosActuales || '(sin pasos)'}`,
    `Sustentación actual: ${limpio(g?.sustentacion?.modalidad, 20)}. Preguntas: ${(g?.sustentacion?.preguntasGuia ?? []).map(q => limpio(q, MAX.medio)).join(' | ')}`,
    'Devuelve la guía integrada completa en el formato JSON indicado.',
  ];
  return partes.join('\n\n');
}

/** Valida la respuesta de la IA, la repara con las reglas del plan y devuelve la guía integrada + avisos. */
export function sanearIntegrada(bruto: unknown, e: EntradaIntegrarGuia): { guia: Guia; avisos: string[] } | null {
  const base = sanearGuia(bruto, e.topeDiario, nSemanas(e.desde, e.hasta), e.sinTecnologia === true);
  if (!base) return null;
  return validarIntegrada(base, {
    asignaturas: (e.asignaturas ?? []).map(a => ({
      asignaturaId: a.asignaturaId, nombre: limpio(a.nombre, 100) || a.asignaturaId, criterios: limpio(a.criterios, 500),
      entregable: limpio(a.entregable, 500), fechaEntrega: a.fechaEntrega || undefined,
    })),
    desde: e.desde, hasta: e.hasta, topeDiario: e.topeDiario, ritmo: e.ritmo === 'dia_por_medio' ? 'dia_por_medio' : 'diario',
  });
}
