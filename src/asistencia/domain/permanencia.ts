/**
 * Permanencia escolar — el paso de la observación en prosa a información que se puede
 * contar, y de ahí al reporte a Guardianes de la Permanencia.
 *
 * Diseño en `docs/reporte-guardianes-permanencia.md`. Lógica pura: qué escala, qué
 * justifica y qué es una ficha desactualizada son reglas de negocio, no de pantalla.
 *
 * Alcance de esta primera vuelta: BACHILLERATO (Julián, 2026-09-15). Transición y
 * primaria entran cuando su notación de grado esté definida; nada de lo que hay aquí
 * depende del grado, así que entrarán sin tocar este archivo.
 */

import type { ContactResult, FamilyContact } from './types';

// ---------------------------------------------------------------------------
//  3.1 Resultado del contacto — catálogo FIJO
// ---------------------------------------------------------------------------

/**
 * La distinción que importa: `no_contesto` es una familia que no atiende y escala;
 * `numero_equivocado` y `numero_fuera_servicio` son una ficha desactualizada — eso se
 * corrige, no se escala. Tratarlos igual era lo que inflaba el conteo de "intentos".
 */
export type ResultadoContacto = ContactResult;

export const RESULTADO_ETIQUETA: Record<ResultadoContacto, string> = {
  contesto: 'Contestó',
  no_contesto: 'No contestó',
  numero_equivocado: 'Número equivocado',
  numero_fuera_servicio: 'Número fuera de servicio',
  buzon: 'Buzón / no recibe llamadas',
  pendiente: 'Pendiente por llamar',
};

/** Resultados que significan "el teléfono de la ficha ya no sirve". */
const RESULTADOS_DE_FICHA_MALA: ResultadoContacto[] = [
  'numero_equivocado',
  'numero_fuera_servicio',
];

// ---------------------------------------------------------------------------
//  3.3 Gestiones realizadas — catálogo FIJO, marcable
// ---------------------------------------------------------------------------

export type TipoGestion =
  | 'verificacion_asistencia'
  | 'llamada'
  | 'segunda_llamada'
  | 'mensaje'
  | 'citacion'
  | 'entrevista_acudiente'
  | 'visita_domiciliaria'
  | 'remision_orientacion'
  | 'remision_comisaria'
  | 'reporte_simat'
  | 'reporte_guardianes';

export const GESTION_ETIQUETA: Record<TipoGestion, string> = {
  verificacion_asistencia: 'Verificación de asistencia',
  llamada: 'Llamada telefónica',
  segunda_llamada: 'Segunda llamada',
  mensaje: 'Mensaje de texto o WhatsApp',
  citacion: 'Citación escrita al acudiente',
  entrevista_acudiente: 'Entrevista con el acudiente',
  visita_domiciliaria: 'Visita domiciliaria',
  remision_orientacion: 'Remisión a orientación escolar',
  remision_comisaria: 'Remisión a comisaría de familia o ICBF',
  reporte_simat: 'Reporte en SIMAT',
  reporte_guardianes: 'Reporte a Guardianes de la Permanencia',
};

export interface Gestion {
  tipo: TipoGestion;
  fecha: string; // AAAA-MM-DD
  realizadaPor: string; // correo en minúsculas
  nota?: string;
}

// ---------------------------------------------------------------------------
//  3.2 Qué dijo la familia — catálogo AUTOGESTIONABLE
// ---------------------------------------------------------------------------

/**
 * Una opción del catálogo que administra la coordinación. Las dos banderas son lo que
 * la vuelve útil y no decorativa; las escoge quien crea la opción, porque es una
 * decisión pedagógica.
 */
export interface MotivoFamilia {
  id: string;
  etiqueta: string;
  /** Baja lógica. Una opción NUNCA se borra: los casos viejos la referencian. */
  activo: boolean;
  /** Explica la inasistencia (incapacidad con soporte, traslado): NO escala. */
  justifica: boolean;
  /** Apunta a vulneración de derechos: escala YA, sin esperar ningún umbral. */
  factorDeRiesgo: boolean;
  creadoPor?: string;
  creadoEn?: number;
}

/**
 * Semilla tomada de lo que el colegio ya escribe a mano en su Excel — no es un
 * catálogo inventado. La taxonomía definitiva la aprueba la institución.
 */
export const MOTIVOS_SEMILLA: MotivoFamilia[] = [
  { id: 'salud', etiqueta: 'Situación de salud', activo: true, justifica: false, factorDeRiesgo: false },
  { id: 'incapacidad', etiqueta: 'Incapacidad médica con soporte', activo: true, justifica: true, factorDeRiesgo: false },
  { id: 'calamidad', etiqueta: 'Calamidad familiar', activo: true, justifica: true, factorDeRiesgo: false },
  { id: 'viaje', etiqueta: 'Viaje', activo: true, justifica: false, factorDeRiesgo: false },
  { id: 'cambio_domicilio', etiqueta: 'Cambio de domicilio', activo: true, justifica: false, factorDeRiesgo: false },
  { id: 'economica', etiqueta: 'Dificultad económica', activo: true, justifica: false, factorDeRiesgo: true },
  { id: 'transporte', etiqueta: 'Problema de transporte', activo: true, justifica: false, factorDeRiesgo: false },
  { id: 'cuida_familiar', etiqueta: 'Cuida a un familiar', activo: true, justifica: false, factorDeRiesgo: true },
  { id: 'trabajando', etiqueta: 'Está trabajando', activo: true, justifica: false, factorDeRiesgo: true },
  { id: 'no_quiere_volver', etiqueta: 'No quiere volver', activo: true, justifica: false, factorDeRiesgo: true },
  { id: 'convivencia', etiqueta: 'Conflicto de convivencia en el colegio', activo: true, justifica: false, factorDeRiesgo: true },
  { id: 'maternidad', etiqueta: 'Embarazo, maternidad o paternidad', activo: true, justifica: false, factorDeRiesgo: true },
  { id: 'consumo', etiqueta: 'Consumo de sustancias', activo: true, justifica: false, factorDeRiesgo: true },
  { id: 'seguridad', etiqueta: 'Situación de seguridad en el barrio', activo: true, justifica: false, factorDeRiesgo: true },
  { id: 'traslado', etiqueta: 'Se trasladó a otra institución', activo: true, justifica: true, factorDeRiesgo: false },
  { id: 'sin_informacion', etiqueta: 'Sin información', activo: true, justifica: false, factorDeRiesgo: false },
];

/**
 * `asistenciaConfig/permanencia`. Umbrales y catálogos viven en UN documento a
 * propósito: así hay una sola excepción en las reglas (la de la rectora) y una sola
 * pantalla de configuración. Ver §4.3 del diseño.
 */
export interface PermanenciaConfig {
  motivos: MotivoFamilia[];
  /** Días de inasistencia acumulados en el periodo que abren un caso. */
  diasParaAbrirCaso: number;
  /** Días consecutivos que lo abren aunque no se llegue al acumulado. */
  diasConsecutivosParaAbrirCaso: number;
  /** Intentos de contacto sin éxito tras los cuales el caso escala igual. */
  intentosSinExitoParaEscalar: number;
  /** Sello de autoría que exige `asisAuthorStamp()`. Los nombres son los del resto
   *  del módulo; cambiarlos haría que la regla rechace toda escritura. */
  ultimaEscrituraPor?: string;
  ultimaEscrituraEn?: number;
}

export const PERMANENCIA_CONFIG_POR_DEFECTO: PermanenciaConfig = {
  motivos: MOTIVOS_SEMILLA,
  diasParaAbrirCaso: 5,
  diasConsecutivosParaAbrirCaso: 3,
  intentosSinExitoParaEscalar: 3,
};

// ---------------------------------------------------------------------------
//  Catálogo: leer, ofrecer, desactivar
// ---------------------------------------------------------------------------

/** Lo que se le ofrece a alguien que registra HOY: solo lo activo, en orden alfabético. */
export function motivosVigentes(motivos: MotivoFamilia[]): MotivoFamilia[] {
  return motivos
    .filter((m) => m.activo)
    .slice()
    .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, 'es'));
}

/**
 * Etiqueta para MOSTRAR un registro viejo. Busca también entre las desactivadas: un
 * caso de marzo no puede quedarse sin motivo porque en agosto alguien retiró la opción.
 * Si el id no existe en absoluto, se dice en pantalla en vez de mostrar un hueco.
 */
export function etiquetaDeMotivo(
  motivos: MotivoFamilia[],
  id: string | null | undefined,
): string {
  if (!id) return 'Sin motivo registrado';
  const m = motivos.find((x) => x.id === id);
  return m ? m.etiqueta : `Motivo retirado (${id})`;
}

/** Baja lógica, nunca borrado. Devuelve el catálogo nuevo; no muta el recibido. */
export function desactivarMotivo(motivos: MotivoFamilia[], id: string): MotivoFamilia[] {
  return motivos.map((m) => (m.id === id ? { ...m, activo: false } : m));
}

/**
 * Valida una opción nueva antes de guardarla. Reactivar una desactivada es un caso
 * legítimo y frecuente —se retiró por error—, así que no se trata como duplicado: se
 * informa para que la pantalla ofrezca reactivarla en vez de crear un id gemelo.
 */
export function validarMotivoNuevo(
  motivos: MotivoFamilia[],
  etiqueta: string,
): { ok: true; id: string } | { ok: false; error: string; reactivar?: string } {
  const limpia = etiqueta.trim().replace(/\s+/g, ' ');
  if (limpia.length < 3) return { ok: false, error: 'La opción necesita al menos 3 caracteres.' };
  if (limpia.length > 60) return { ok: false, error: 'La opción no puede pasar de 60 caracteres.' };

  const id = idDesdeEtiqueta(limpia);
  const gemela = motivos.find(
    (m) => m.id === id || comparable(m.etiqueta) === comparable(limpia),
  );
  if (gemela) {
    return gemela.activo
      ? { ok: false, error: `Ya existe una opción igual: «${gemela.etiqueta}».` }
      : {
          ok: false,
          error: `«${gemela.etiqueta}» ya existe pero está desactivada.`,
          reactivar: gemela.id,
        };
  }
  return { ok: true, id };
}

function comparable(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

function idDesdeEtiqueta(etiqueta: string): string {
  return comparable(etiqueta)
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
}

// ---------------------------------------------------------------------------
//  Lo que se calcula sobre el historial de contactos (columnas 24 a 26 del Excel)
// ---------------------------------------------------------------------------

export interface ResumenContactos {
  /** Intentos REALES: no cuenta los pendientes ni los que fallaron por ficha mala. */
  intentos: number;
  /** Cuántas veces se habló de verdad con la familia. */
  efectivos: number;
  /** Fecha del último contacto efectivo, o `null` si nunca se habló con nadie. */
  ultimoEfectivo: string | null;
  /**
   * El teléfono de la ficha no sirve. Antes de escalar a nadie hay que conseguir otro:
   * reportar a la Policía a una familia a la que nunca se pudo llamar sería indefendible.
   */
  fichaDesactualizada: boolean;
}

export function resumirContactos(contactos: FamilyContact[]): ResumenContactos {
  const r = contactos.map((c) => c.resultado);
  const efectivos = contactos.filter((c) => c.resultado === 'contesto');
  const ordenados = efectivos.slice().sort((a, b) => a.fecha.localeCompare(b.fecha));
  return {
    intentos: r.filter((x) => x !== 'pendiente' && !RESULTADOS_DE_FICHA_MALA.includes(x)).length,
    efectivos: efectivos.length,
    ultimoEfectivo: ordenados.length ? ordenados[ordenados.length - 1].fecha : null,
    fichaDesactualizada:
      r.length > 0 &&
      r.some((x) => RESULTADOS_DE_FICHA_MALA.includes(x)) &&
      !r.includes('contesto'),
  };
}

/** Las gestiones como las imprime el informe: en orden, con fecha. Eso es evidencia. */
export function gestionesParaInforme(gestiones: Gestion[]): string[] {
  return gestiones
    .slice()
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.tipo.localeCompare(b.tipo))
    .map((g) => {
      const base = `${g.fecha} · ${GESTION_ETIQUETA[g.tipo]}`;
      return g.nota?.trim() ? `${base} — ${g.nota.trim()}` : base;
    });
}

// ---------------------------------------------------------------------------
//  La decisión: ¿esto escala?
// ---------------------------------------------------------------------------

export type NivelPermanencia = 'ninguno' | 'seguimiento' | 'reportable';

export interface DecisionEscalamiento {
  nivel: NivelPermanencia;
  /** Frase que se le muestra a quien mira el caso. Nunca un código. */
  razon: string;
}

/**
 * Regla de negocio completa, en un solo lugar. El orden de las preguntas NO es
 * arbitrario y es lo que hay que leer:
 *
 *  1. Un factor de riesgo escala de inmediato, aunque falte un solo día. Esperar a un
 *     umbral de días cuando la familia ya dijo "está trabajando" es perder justamente
 *     el tiempo que importa.
 *  2. Un motivo que justifica no escala nunca, por muchos días que sean.
 *  3. Si el teléfono de la ficha no sirve, el caso NO se reporta: se corrige la ficha.
 *  4. Solo entonces cuentan los umbrales.
 */
export function decidirEscalamiento(input: {
  motivoId: string | null;
  config: PermanenciaConfig;
  diasAcumulados: number;
  diasConsecutivos: number;
  contactos: FamilyContact[];
}): DecisionEscalamiento {
  const { config, diasAcumulados, diasConsecutivos } = input;
  const motivo = input.motivoId
    ? (config.motivos.find((m) => m.id === input.motivoId) ?? null)
    : null;

  if (motivo?.factorDeRiesgo) {
    return {
      nivel: 'reportable',
      razon: `La familia reportó «${motivo.etiqueta}»: es un factor de riesgo y escala de inmediato.`,
    };
  }
  if (motivo?.justifica) {
    return { nivel: 'ninguno', razon: `La inasistencia está explicada: «${motivo.etiqueta}».` };
  }

  const resumen = resumirContactos(input.contactos);
  if (resumen.fichaDesactualizada) {
    return {
      nivel: 'seguimiento',
      razon: 'El teléfono de la ficha no sirve. Hay que conseguir otro antes de escalar.',
    };
  }

  if (diasConsecutivos >= config.diasConsecutivosParaAbrirCaso) {
    return { nivel: 'reportable', razon: `${diasConsecutivos} días seguidos sin asistir.` };
  }
  if (diasAcumulados >= config.diasParaAbrirCaso) {
    return {
      nivel: 'reportable',
      razon: `${diasAcumulados} días de inasistencia acumulados en el periodo.`,
    };
  }
  if (resumen.intentos >= config.intentosSinExitoParaEscalar && resumen.efectivos === 0) {
    return {
      nivel: 'reportable',
      razon: `${resumen.intentos} intentos de contacto sin lograr hablar con la familia.`,
    };
  }
  if (diasAcumulados > 0) {
    return {
      nivel: 'seguimiento',
      razon: `${diasAcumulados} días de inasistencia, todavía bajo el umbral.`,
    };
  }
  return { nivel: 'ninguno', razon: 'Sin inasistencias en el periodo.' };
}

// ---------------------------------------------------------------------------
//  Contactabilidad — ¿por dónde se puede avisar a cada familia?
// ---------------------------------------------------------------------------

/**
 * Un teléfono fijo NO recibe mensajes de texto ni WhatsApp: solo llamadas. Esa sola
 * diferencia decide si a una familia se le puede avisar por escrito —con constancia y
 * sin ocupar a nadie— o si hay que marcarle.
 *
 * Por eso este conteo existe antes que cualquier envío: el ahorro de llamadas que puede
 * dar un aviso automático es, como mucho, del tamaño del grupo `movil`.
 */
export type Contactabilidad = 'movil' | 'solo_fijo' | 'sin_telefono';

export const CONTACTABILIDAD_ETIQUETA: Record<Contactabilidad, string> = {
  movil: 'Tiene celular',
  solo_fijo: 'Solo teléfono fijo',
  sin_telefono: 'Sin teléfono utilizable',
};

/**
 * Basta UN celular para poder avisar. Se mira toda la lista de teléfonos, no el
 * primero: muchas fichas traen el fijo de la casa de primero y el celular después.
 *
 * `tipoDeTelefono` se recibe por parámetro en vez de importarse para que esta regla se
 * pueda probar sin depender de la numeración colombiana, que ya tiene sus propias
 * pruebas en `telefonos.test.ts`. Un número que no se reconoce NO se cuenta como
 * utilizable: un dato basura que se contara como contacto es peor que no tener dato,
 * porque nadie iría a buscar el bueno.
 */
export function contactabilidadDe(
  telefonos: string[],
  tipoDeTelefono: (t: string) => 'movil' | 'fijo' | 'desconocido',
): Contactabilidad {
  const tipos = telefonos.map(tipoDeTelefono);
  if (tipos.includes('movil')) return 'movil';
  if (tipos.includes('fijo')) return 'solo_fijo';
  return 'sin_telefono';
}

export interface FilaContactabilidad {
  grado: string;
  total: number;
  movil: number;
  soloFijo: number;
  sinTelefono: number;
  /** Porcentaje con celular, redondeado. Es el número que decide si avisar sirve. */
  porcentajeMovil: number;
}

export interface ResumenContactabilidad {
  porGrado: FilaContactabilidad[];
  total: FilaContactabilidad;
}

/**
 * Solo estudiantes activos: un retirado no se contacta y contarlo desinflaría el
 * porcentaje sin que nadie entienda por qué.
 */
export function resumirContactabilidad(
  estudiantes: { gradoActual: string; telefonos: string[]; activo: boolean }[],
  tipoDeTelefono: (t: string) => 'movil' | 'fijo' | 'desconocido',
): ResumenContactabilidad {
  const porGrado = new Map<string, FilaContactabilidad>();
  const total: FilaContactabilidad = {
    grado: 'TOTAL',
    total: 0,
    movil: 0,
    soloFijo: 0,
    sinTelefono: 0,
    porcentajeMovil: 0,
  };

  for (const e of estudiantes) {
    if (!e.activo) continue;
    const fila =
      porGrado.get(e.gradoActual) ??
      {
        grado: e.gradoActual,
        total: 0,
        movil: 0,
        soloFijo: 0,
        sinTelefono: 0,
        porcentajeMovil: 0,
      };
    const c = contactabilidadDe(e.telefonos ?? [], tipoDeTelefono);
    fila.total += 1;
    total.total += 1;
    if (c === 'movil') {
      fila.movil += 1;
      total.movil += 1;
    } else if (c === 'solo_fijo') {
      fila.soloFijo += 1;
      total.soloFijo += 1;
    } else {
      fila.sinTelefono += 1;
      total.sinTelefono += 1;
    }
    porGrado.set(e.gradoActual, fila);
  }

  const pct = (f: FilaContactabilidad) =>
    f.total === 0 ? 0 : Math.round((f.movil / f.total) * 100);
  const filas = [...porGrado.values()].sort((a, b) => a.grado.localeCompare(b.grado, 'es'));
  for (const f of filas) f.porcentajeMovil = pct(f);
  total.porcentajeMovil = pct(total);

  return { porGrado: filas, total };
}
