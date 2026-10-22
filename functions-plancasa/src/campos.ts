// Lógica pura de «Sugerir con IA» para los formularios del docente: esquemas, prompt y saneamiento.

export type ModoCampos = 'asignatura' | 'pedido';
export interface EntradaCampos {
  modo: ModoCampos; preguntaOrientadora?: string; asignaturas: string[]; grado: string;
  ajustes?: string[]; existentes?: Record<string, string>;
}

export const CLAVES_ASIGNATURA = ['criteriosPromocion', 'ebcDba', 'evidenciaAprendizaje', 'aportes'] as const;
export const CLAVES_PEDIDO = ['tematicas', 'competencias', 'textoReferencia'] as const;

export const SISTEMA_CAMPOS = `Eres un asesor curricular colombiano que ayuda a docentes a diligenciar un plan de trabajo en casa para un estudiante con ajustes razonables.
Reglas:
- Español de Colombia, claro y conciso: 2 a 4 líneas por campo.
- Currículo colombiano: Estándares Básicos de Competencias (EBC) y Derechos Básicos de Aprendizaje (DBA) del MEN. Cita el área y el grupo de grados, por ejemplo «EBC Ciencias Naturales 10.°–11.°»; NUNCA inventes códigos ni numeraciones exactas de DBA.
- Si hay pregunta orientadora, todo debe alinearse con ella.
- Adapta a los ajustes: pocas actividades, cortas, realizables desde casa con materiales cotidianos.
- Lo que el docente ya escribió se respeta: no lo contradigas; complétalo con coherencia.
- No incluyas nombres de estudiantes ni diagnósticos o condiciones de salud.
- Son borradores que el docente revisará: sé concreto y evita relleno.`;

const DESCRIPCION: Record<string, string> = {
  criteriosPromocion: 'qué debe demostrar el estudiante para aprobar la asignatura (mínimos esenciales)',
  ebcDba: 'una competencia esencial EBC/DBA priorizada para el área, citando área y grupo de grados',
  evidenciaAprendizaje: 'evidencia observable de aprendizaje esperada en el área',
  aportes: 'temáticas que la guía de trabajo debe cubrir en esta asignatura',
  tematicas: 'temáticas a trabajar en la guía',
  competencias: 'competencias o habilidades a desarrollar',
  textoReferencia: 'texto, lectura o recurso de referencia sugerido (sin inventar enlaces; describe el tipo de lectura)',
};

export function clavesDe(modo: ModoCampos): readonly string[] {
  return modo === 'pedido' ? CLAVES_PEDIDO : CLAVES_ASIGNATURA;
}

export function esquemaCampos(modo: ModoCampos) {
  const claves = clavesDe(modo);
  return {
    type: 'object',
    additionalProperties: false,
    required: [...claves],
    properties: Object.fromEntries(claves.map(k => [k, { type: 'string' }])),
  };
}

function limpio(v: unknown, max: number): string {
  return typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

export function construirPromptCampos(e: EntradaCampos): string {
  const modo: ModoCampos = e.modo === 'pedido' ? 'pedido' : 'asignatura';
  const asigs = (Array.isArray(e.asignaturas) ? e.asignaturas : []).map(a => limpio(a, 100)).filter(Boolean).slice(0, 12);
  const ajustes = (Array.isArray(e.ajustes) ? e.ajustes : []).map(a => limpio(a, 300)).filter(Boolean).slice(0, 20);
  const ex = e.existentes && typeof e.existentes === 'object' ? e.existentes : {};
  const claves = clavesDe(modo);
  const existentes = Object.entries(ex).map(([k, v]) => [limpio(k, 60), limpio(v, 600)] as const).filter(([k, v]) => k && v).slice(0, 12);
  return [
    `Grado: ${limpio(e.grado, 20)}`,
    modo === 'asignatura'
      ? `Asignatura: ${asigs[0] ?? ''}`
      : `Asignaturas que integra la guía: ${asigs.join(', ')}`,
    `Pregunta orientadora: ${limpio(e.preguntaOrientadora, 400) || '(no hay)'}`,
    `Ajustes razonables:\n${ajustes.length ? ajustes.map(a => `- ${a}`).join('\n') : '- (ninguno específico)'}`,
    `Lo que el docente ya escribió (respétalo):\n${existentes.length ? existentes.map(([k, v]) => `- ${k}: ${v}`).join('\n') : '- (nada)'}`,
    `Redacta una propuesta para estos campos:\n${claves.map(k => `- ${k}: ${DESCRIPCION[k]}`).join('\n')}`,
  ].join('\n\n');
}

/** Devuelve solo las claves esperadas, como texto limpio; null si no queda ninguna con contenido. */
export function sanearCampos(bruto: unknown, modo: ModoCampos): Record<string, string> | null {
  if (!bruto || typeof bruto !== 'object') return null;
  const r = bruto as Record<string, unknown>;
  const out: Record<string, string> = {};
  let alguno = false;
  for (const k of clavesDe(modo)) {
    const v = typeof r[k] === 'string' ? (r[k] as string).replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, 900) : '';
    out[k] = v;
    if (v) alguno = true;
  }
  return alguno ? out : null;
}
