// Consultas de las familias desde la agenda pública (sin login). Lógica PURA compartida por la
// página, el panel y las funciones (functions-plancasa). Las consultas viven en
// `planesCasaConsultas` y SOLO se leen/escriben por callables (las reglas niegan todo acceso directo).

export const COL_CONSULTAS = 'planesCasaConsultas';
export const TIPOS_CONSULTA = ['pedagogica', 'tecnica'] as const;
export type TipoConsulta = typeof TIPOS_CONSULTA[number];
export type EstadoConsulta = 'pendiente' | 'respondida';

export const MAX_TEXTO_CONSULTA = 1000;
export const MAX_CONTACTO = 120;
export const MAX_RESPUESTA = 2000;
/** Consultas por día y por token. */
export const TOPE_DIARIO_CONSULTAS = 5;

export const ETIQUETA_CONSULTA: Record<TipoConsulta, { titulo: string; icono: string; ayuda: string }> = {
  pedagogica: { titulo: 'Consulta pedagógica', icono: '💬', ayuda: 'Dudas sobre la guía, las entregas o la sustentación.' },
  tecnica: { titulo: 'Consulta técnica', icono: '🛠️', ayuda: 'La agenda no carga, no se puede subir un archivo o no ve su guía.' },
};

/** Documento guardado en planesCasaConsultas/{id}. */
export interface ConsultaPlan {
  id: string;
  token: string;
  planId?: string;
  primerNombre?: string;
  grupo?: string;
  tipo: TipoConsulta;
  texto: string;
  contacto: string;
  creada: number;
  estado: EstadoConsulta;
  respuesta?: string;
  respondidaPor?: string;
  respondidaEn?: number;
}

/** Lo que ve la familia de cada consulta suya (sin token ni datos internos). */
export interface ConsultaFamilia {
  id: string; tipo: TipoConsulta; texto: string; creada: number; estado: EstadoConsulta; respuesta?: string; respondidaEn?: number;
}

export interface EntradaEnviarConsulta { token: string; tipo: TipoConsulta; texto: string; contacto?: string }
export interface SalidaEnviarConsulta { ok: boolean; error?: string }
export interface SalidaMisConsultas { ok: boolean; consultas?: ConsultaFamilia[]; error?: string }
export interface SalidaListarConsultas { ok: boolean; consultas?: ConsultaPlan[]; error?: string }
export interface EntradaResponderConsulta { id: string; respuesta: string }

export const esTipoConsulta = (t: unknown): t is TipoConsulta => t === 'pedagogica' || t === 'tecnica';
export const tokenValido = (t: unknown): t is string => typeof t === 'string' && /^[A-Za-z0-9_-]{20,200}$/.test(t);

export function validarConsulta(e: { tipo?: unknown; texto?: unknown; contacto?: unknown }):
  { ok: true; tipo: TipoConsulta; texto: string; contacto: string } | { ok: false; error: string } {
  if (!esTipoConsulta(e.tipo)) return { ok: false, error: 'Tipo de consulta inválido.' };
  const texto = String(e.texto ?? '').trim();
  if (!texto) return { ok: false, error: 'Escriba su consulta.' };
  if (texto.length > MAX_TEXTO_CONSULTA) return { ok: false, error: `La consulta es muy larga (máximo ${MAX_TEXTO_CONSULTA} caracteres).` };
  const contacto = String(e.contacto ?? '').trim();
  if (contacto.length > MAX_CONTACTO) return { ok: false, error: 'El dato de contacto es demasiado largo.' };
  return { ok: true, tipo: e.tipo, texto, contacto };
}

export function cupoConsultas(enviadasHoy: number): { ok: true } | { ok: false; error: string } {
  return enviadasHoy >= TOPE_DIARIO_CONSULTAS
    ? { ok: false, error: `Ya se enviaron ${TOPE_DIARIO_CONSULTAS} consultas hoy. Intente de nuevo mañana.` }
    : { ok: true };
}

/** Tipos que puede ver/responder alguien: el equipo ve las pedagógicas, el superusuario todas. */
export function tiposVisibles(esSuper: boolean, esEquipo: boolean): TipoConsulta[] {
  if (esSuper) return ['pedagogica', 'tecnica'];
  return esEquipo ? ['pedagogica'] : [];
}

export function validarRespuesta(r: unknown): { ok: true; texto: string } | { ok: false; error: string } {
  const texto = String(r ?? '').trim();
  if (!texto) return { ok: false, error: 'Escriba la respuesta.' };
  if (texto.length > MAX_RESPUESTA) return { ok: false, error: `La respuesta es muy larga (máximo ${MAX_RESPUESTA} caracteres).` };
  return { ok: true, texto };
}
