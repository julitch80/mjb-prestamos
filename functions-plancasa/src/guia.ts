// Lógica pura de la guía con IA: esquema, prompt y saneamiento. Sin red ni Firebase (se prueba aparte).
import type { EntradaGuiaIA, EvidenciaTipo, Guia, ModalidadSustentacion, PasoGuia } from '../../src/data/planCasa/tipos';

export const MODELO = 'claude-sonnet-5-5';
export const EVIDENCIAS: EvidenciaTipo[] = ['foto', 'texto', 'audio', 'video', 'documento'];
export const MODALIDADES: ModalidadSustentacion[] = ['presencial', 'virtual', 'video', 'audio', 'entrevista', 'guia_corta', 'esquema'];
const MAX = { corto: 300, medio: 1200, largo: 3000, referencia: 12000 };

export const SISTEMA = `Eres un experto en educación secundaria colombiana (grados 6 a 11) y en ajustes razonables para estudiantes que trabajan desde casa, con el espíritu del Decreto 1421 de 2017 y el Diseño Universal para el Aprendizaje (DUA).
Tu tarea: proponer a un docente una guía de trabajo en casa, clara, breve y realizable por un estudiante que estudia solo, sin acompañamiento permanente.
Reglas:
- Escribe en español de Colombia, con un tono cercano y respetuoso, dirigido al estudiante (tú).
- Un "momento" es un bloque de trabajo de 25 minutos. Cada paso dura entre 1 y 4 momentos.
- Los ajustes razonables que recibes son orientaciones pedagógicas: aplícalos de verdad en el contenido (por ejemplo, si piden lecturas cortas, incluye tú mismo textos breves dentro de las instrucciones; si piden instrucciones de un paso a la vez, cada paso tiene una sola acción; si permiten entregas orales, ofrece audio o video como evidencia).
- Alinea los criterios de evaluación con los criterios mínimos de promoción dados.
- Sigue la «Guía para propuesta curricular integrada por áreas» de la UAI: (1) todo gira alrededor de una pregunta orientadora o problema del contexto; (2) por cada área se prioriza UNA competencia esencial (EBC/DBA); (3) cada área define una evidencia de aprendizaje y entre todas se construye UN solo producto integrado; (4) hay un cronograma de entregas parciales, una por semana, con ajuste razonable y canal/formato de entrega por fase.
- Entre 3 y 4 criterios de evaluación; entre 3 y 4 preguntas guía de sustentación.
- Organiza los pasos en fases semanales: usa las semanas indicadas (campo semana, de 1 a n). Cada semana tiene entre 1 y 3 pasos y el ÚLTIMO paso de cada semana es la entrega parcial de esa semana (esEntregaParcial true; los demás false). Hay una sola entrega parcial por semana, con tiempos flexibles y de poca carga.
- En el campo «instrucciones», escribe cada acción en su propio renglón y numerada («1. …», salto de línea, «2. …»), máximo 5 acciones por paso, una sola acción por renglón.
- Respeta el ritmo indicado: máximo 2 o 3 momentos de trabajo por día, o trabajo solo un día por medio si así se indica. Prefiere actividades cortas (de 3 a 5 ejercicios en vez de talleres extensos), ejemplos prácticos de modelado e instrucciones cortas con apoyos gráficos.
- Cada paso lleva el tipo de evidencia (foto, texto, audio, video o documento), una descripción breve de qué entrega, el canalEntrega de esa fase (por ejemplo «Foto del cuaderno por WhatsApp», «Audio de 1 minuto», «Documento en la plataforma») y el ajusteAplicado en esa fase (un ajuste razonable de los recibidos, dicho en pocas palabras).
- Los pasos deben construir progresivamente el producto integrado.
- evidenciasAprendizaje: una evidencia de aprendizaje por área (asignatura), articulada con su EBC/DBA priorizado y con el producto integrado.
- sustentacionModalidad: elige UNA de estas opciones la que mejor se ajuste a los ajustes recibidos y al estudiante: presencial, virtual, video, audio, entrevista (entrevista personalizada), guia_corta (guía corta escrita) o esquema (esquema o mapa de ideas). Prefiere video, audio, entrevista o esquema si los ajustes piden alternativas al escrito extenso.
- Si hay un texto de referencia, úsalo como base del contenido; no inventes citas ni enlaces.
- No supongas ni menciones diagnósticos, condiciones de salud ni nombres de personas; habla solo de lo pedagógico.
- Si se te pide una guía transversal, diseña UNA sola guía integrada alrededor del eje que cubra los criterios de todas las asignaturas listadas, con MENOS pasos y menos momentos en total que si se hicieran guías separadas (el propósito es reducir la carga académica). Cada paso empieza su título indicando a qué asignaturas sirve, con el formato «[Ciencias · Lengua] Título», y los criterios de evaluación deben cubrir cada asignatura (nómbrala al inicio de cada criterio).
- En notaAjustes explica al docente, en dos o tres frases, cómo aplicaste los ajustes.`;

/** Bloque que se añade al prompt cuando el estudiante no usa tecnología. */
export const BLOQUE_SIN_TECNOLOGIA = `PLAN SIN TECNOLOGÍA. El estudiante no tiene acceso a celular, computador ni internet; la guía se entrega IMPRESA. Reglas obligatorias:
- NUNCA propongas evidencias ni canales con foto, video, audio, código QR, enlaces, WhatsApp, correo ni plataformas. Deja los enlaces vacíos.
- El tipo de evidencia de cada paso es SOLO «texto» o «documento», entendidos en papel; en evidenciaDetalle indica que se resuelve «en hoja o cuaderno».
- canalEntrega, por ejemplo: «En físico al docente» o «Por medio del acudiente, en coordinación con el docente».
- sustentacionModalidad SOLO puede ser: presencial, entrevista, guia_corta o esquema (en papel u oral, presencial).
- INCLUYE dentro de las instrucciones de la guía todo el contenido necesario: lecturas cortas escritas completas, ejemplos resueltos y ejercicios con sus números y datos. NUNCA escribas «consulta en internet», «busca en» ni «mira el video».`;

export const ESQUEMA_GUIA = {
  type: 'object',
  additionalProperties: false,
  required: ['productoFinal', 'evidenciasAprendizaje', 'criteriosEvaluacion', 'pasos', 'preguntasSustentacion', 'sustentacionModalidad', 'notaAjustes'],
  properties: {
    productoFinal: { type: 'string' },
    evidenciasAprendizaje: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['asignatura', 'evidencia'],
        properties: { asignatura: { type: 'string' }, evidencia: { type: 'string' } },
      },
    },
    criteriosEvaluacion: { type: 'array', items: { type: 'string' } },
    pasos: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['titulo', 'instrucciones', 'momentos', 'evidencia', 'evidenciaDetalle', 'semana', 'esEntregaParcial', 'canalEntrega', 'ajusteAplicado'],
        properties: {
          semana: { type: 'integer' },
          esEntregaParcial: { type: 'boolean' },
          canalEntrega: { type: 'string' },
          ajusteAplicado: { type: 'string' },
          titulo: { type: 'string' },
          instrucciones: { type: 'string' },
          momentos: { type: 'integer' },
          evidencia: { type: 'string', enum: EVIDENCIAS },
          evidenciaDetalle: { type: 'string' },
        },
      },
    },
    preguntasSustentacion: { type: 'array', items: { type: 'string' } },
    sustentacionModalidad: { type: 'string', enum: MODALIDADES },
    notaAjustes: { type: 'string' },
  },
} as const;

function limpio(v: unknown, max: number): string {
  return typeof v === 'string' ? v.replace(/\s+\n/g, '\n').trim().slice(0, max) : '';
}

function semanasN(n: unknown): number {
  const v = Math.round(Number(n));
  return Number.isFinite(v) && v >= 1 ? Math.min(v, 8) : 1;
}

function tope(n: number): number {
  return Number.isFinite(n) && n >= 1 ? Math.min(Math.round(n), 8) : 4;
}

/** Mensaje de usuario con todo lo que la IA necesita (sin nombres de estudiante). */
export function construirPrompt(e: EntradaGuiaIA): string {
  const t = tope(e.topeDiario);
  const sem = semanasN(e.semanas);
  const tr = e.transversal && Array.isArray(e.transversal.asignaturas) && e.transversal.asignaturas.length ? e.transversal : null;
  const ajustes = (e.ajustes ?? []).map(a => limpio(a, MAX.corto)).filter(Boolean);
  const partes = [
    ...(e.sinTecnologia ? [BLOQUE_SIN_TECNOLOGIA] : []),
    `Asignatura: ${limpio(e.asignatura, 100)}`,
    `Grado: ${limpio(e.grado, 20)}`,
    `Periodo de trabajo en casa: del ${limpio(e.desde, 10)} al ${limpio(e.hasta, 10)}`,
    `Máximo de momentos de 25 minutos por día, sumando todas las asignaturas: ${t}. Por eso ningún paso debe superar ${Math.min(4, t)} momentos.`,
    `Semanas del periodo: ${sem}. Organiza las fases de la semana 1 a la ${sem}; cada semana termina con UNA entrega parcial (esEntregaParcial true en su último paso).`,
    e.ritmo === 'dia_por_medio'
      ? 'Ritmo: día por medio. El estudiante trabaja solo un día hábil de cada dos, con máximo 2 o 3 momentos ese día.'
      : 'Ritmo: diario, con máximo 2 o 3 momentos por día.',
    `Ajustes razonables que debes aplicar:\n${ajustes.length ? ajustes.map(a => `- ${a}`).join('\n') : '- (ninguno específico)'}`,
    ...(tr ? [
      `GUÍA TRANSVERSAL. Pregunta orientadora / problema del contexto: ${limpio(tr.eje, MAX.corto)}\nAsignaturas que debe integrar y sus criterios mínimos de promoción:\n${tr.asignaturas.map(a => `- ${limpio(a.nombre, 100)}: ${limpio(a.criteriosPromocion, MAX.largo) || '(no indicados)'}${limpio(a.aportes, MAX.largo) ? ` | Aportes del docente: ${limpio(a.aportes, MAX.largo)}` : ''}${limpio(a.ebcDba, MAX.largo) ? ` | EBC/DBA priorizado: ${limpio(a.ebcDba, MAX.largo)}` : ''}${limpio(a.evidenciaAprendizaje, MAX.largo) ? ` | Evidencia de aprendizaje esperada: ${limpio(a.evidenciaAprendizaje, MAX.largo)}` : ''}`).join('\n')}`,
    ] : [
    `Criterios mínimos de promoción en esta asignatura:\n${limpio(e.criteriosPromocion, MAX.largo) || '(no indicados)'}`,
    ]),
    `Temáticas que el docente quiere trabajar:\n${limpio(e.pedido?.tematicas, MAX.largo)}`,
    `Competencias o habilidades a desarrollar:\n${limpio(e.pedido?.competencias, MAX.largo)}`,
  ];
  const ref = limpio(e.pedido?.textoReferencia, MAX.referencia);
  if (ref) partes.push(`Texto o material de referencia del docente (úsalo como base):\n"""\n${ref}\n"""`);
  const ind = limpio(e.indicacion, MAX.corto);
  if (ind) partes.push(`El docente pidió otra versión con esta indicación: ${ind}`);
  partes.push('Devuelve la guía completa en el formato JSON indicado.');
  return partes.join('\n\n');
}

function lista(v: unknown, max: number, largoItem: number): string[] {
  return Array.isArray(v) ? v.map(x => limpio(x, largoItem)).filter(Boolean).slice(0, max) : [];
}

/** Valida y normaliza la respuesta de la IA a una Guia del contrato; null si no sirve. */
const EVIDENCIAS_PAPEL: EvidenciaTipo[] = ['texto', 'documento'];
const MODALIDADES_PRESENCIALES: ModalidadSustentacion[] = ['presencial', 'entrevista', 'guia_corta', 'esquema'];
const RE_URL = /\bhttps?:\/\/\S+|\bwww\.\S+/gi;

export function sanearGuia(bruto: unknown, topeDiario: number, semanas = 0, sinTecnologia = false): Guia | null {
  if (!bruto || typeof bruto !== 'object') return null;
  const o = bruto as Record<string, unknown>;
  const maxMomentos = Math.max(1, Math.min(4, tope(topeDiario)));
  const productoFinal = limpio(o.productoFinal, MAX.medio);
  const criterios = lista(o.criteriosEvaluacion, 4, MAX.medio);
  const preguntas = lista(o.preguntasSustentacion, 4, MAX.medio);
  const nSem = semanas >= 1 ? semanasN(semanas) : 0;
  const maxPasos = nSem ? Math.max(3, nSem * 3) : 7;
  const crudos = Array.isArray(o.pasos) ? o.pasos.slice(0, maxPasos) : [];
  const evidenciasAprendizaje = (Array.isArray(o.evidenciasAprendizaje) ? o.evidenciasAprendizaje : []).slice(0, 8).flatMap(x => {
    if (!x || typeof x !== 'object') return [];
    const r = x as Record<string, unknown>;
    const asignatura = limpio(r.asignatura, MAX.corto);
    const evidencia = limpio(r.evidencia, MAX.medio);
    return asignatura && evidencia ? [{ asignatura, evidencia }] : [];
  });
  const pasos: PasoGuia[] = [];
  for (const p of crudos) {
    if (!p || typeof p !== 'object') continue;
    const r = p as Record<string, unknown>;
    const titulo = limpio(r.titulo, MAX.corto);
    const instrucciones = sinTecnologia ? limpio(limpio(r.instrucciones, MAX.largo).replace(RE_URL, ''), MAX.largo) : limpio(r.instrucciones, MAX.largo);
    if (!titulo || !instrucciones) continue;
    const m = Math.round(Number(r.momentos));
    const sm = Math.round(Number(r.semana));
    let evidencia = EVIDENCIAS.includes(r.evidencia as EvidenciaTipo) ? (r.evidencia as EvidenciaTipo) : 'texto';
    if (sinTecnologia && !EVIDENCIAS_PAPEL.includes(evidencia)) evidencia = 'texto';
    pasos.push({
      id: `p${pasos.length + 1}`,
      titulo,
      instrucciones,
      momentos: Math.max(1, Math.min(maxMomentos, Number.isFinite(m) ? m : 1)),
      evidencia,
      evidenciaDetalle: limpio(r.evidenciaDetalle, MAX.medio),
      semana: Math.max(1, Math.min(nSem || 99, Number.isFinite(sm) ? sm : 1)),
      ...(limpio(r.canalEntrega, MAX.corto) ? { canalEntrega: limpio(r.canalEntrega, MAX.corto) } : {}),
      ...(limpio(r.ajusteAplicado, MAX.medio) ? { ajusteAplicado: limpio(r.ajusteAplicado, MAX.medio) } : {}),
      fecha: null,
      ...(sinTecnologia ? { enlaces: [] } : {}),
    });
  }
  // Orden por semana (estable) y ids; el último paso de cada semana es la entrega parcial.
  pasos.sort((x, y) => x.semana - y.semana);
  pasos.forEach((p, i) => { p.id = `p${i + 1}`; p.esEntregaParcial = i === pasos.length - 1 || pasos[i + 1].semana !== p.semana; });
  if (!productoFinal || !criterios.length || !pasos.length || !preguntas.length) return null;
  const nota = limpio(o.notaAjustes, MAX.medio);
  let modalidad = MODALIDADES.includes(o.sustentacionModalidad as ModalidadSustentacion) ? (o.sustentacionModalidad as ModalidadSustentacion) : 'presencial';
  if (sinTecnologia && !MODALIDADES_PRESENCIALES.includes(modalidad)) modalidad = 'presencial';
  return {
    productoFinal,
    ...(evidenciasAprendizaje.length ? { evidenciasAprendizaje } : {}),
    criteriosEvaluacion: criterios,
    pasos,
    sustentacion: { modalidad, fecha: null, hora: null, lugarOEnlace: '', preguntasGuia: preguntas },
    ...(nota ? { notaAjustes: nota } : {}),
  };
}
