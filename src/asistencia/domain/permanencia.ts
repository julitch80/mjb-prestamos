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

import { censoEsFiable } from './evasion';
import { tipoDeTelefono } from './telefonos';
import type { CensoDia, ContactResult, FamilyContact, Sede } from './types';

// ---------------------------------------------------------------------------
//  3.1 Resultado del contacto — catálogo FIJO
// ---------------------------------------------------------------------------

/**
 * La distinción que importa: `no_contesto` es una familia que no atiende y escala;
 * `numero_equivocado` y `numero_fuera_servicio` son una ficha desactualizada — eso se
 * corrige, no se escala. Tratarlos igual era lo que inflaba el conteo de "intentos".
 */
export type ResultadoContacto = ContactResult;

export type PersonaContactada = NonNullable<FamilyContact['personaContactada']>;

export const PERSONA_CONTACTADA_ETIQUETA: Record<PersonaContactada, string> = {
  acudiente: 'El acudiente',
  otro_familiar: 'Otro familiar',
  estudiante: 'El estudiante',
  otra_persona: 'Otra persona',
};

export const RESULTADO_ETIQUETA: Record<ResultadoContacto, string> = {
  contesto: 'Contestó',
  no_contesto: 'No contestó',
  numero_equivocado: 'Número equivocado',
  numero_fuera_servicio: 'Número fuera de servicio',
  buzon: 'Buzón / no recibe llamadas',
  pendiente: 'Pendiente por llamar',
};

/** Resultados que prueban que al menos una línea existe: timbró o entró a buzón. */
const RESULTADOS_DE_LINEA_VIVA: ResultadoContacto[] = ['contesto', 'no_contesto', 'buzon'];

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
  /** Días de inasistencia dentro de la ventana que abren un caso. */
  diasParaAbrirCaso: number;
  /**
   * Tamaño de la ventana, en DÍAS CON CENSO del grupo — no en días de calendario. El
   * patrón real del colegio son faltas dispersas, no seguidas: «5 en 15 días hábiles».
   * Contar en días con censo evita que una semana de vacaciones cuente como asistencia.
   */
  ventanaDiasHabiles: number;
  /** Días consecutivos que lo abren aunque no se llegue al acumulado. */
  diasConsecutivosParaAbrirCaso: number;
  /** Intentos de contacto sin éxito tras los cuales el caso escala igual. */
  intentosSinExitoParaEscalar: number;
  /** Días desde el último contacto efectivo, con las faltas siguiendo, para escalar. */
  diasSinContactoParaEscalar: number;
  /**
   * Días sin ningún seguimiento tras los cuales un caso abierto se marca como vencido.
   * Ocho por defecto, como en la gestión del riesgo de MJB; lo ajusta la institución.
   */
  diasSinSeguimientoParaAlerta: number;
  /** Sello de autoría que exige `asisAuthorStamp()`. Los nombres son los del resto
   *  del módulo; cambiarlos haría que la regla rechace toda escritura. */
  ultimaEscrituraPor?: string;
  ultimaEscrituraEn?: number;
}

export const PERMANENCIA_CONFIG_POR_DEFECTO: PermanenciaConfig = {
  motivos: MOTIVOS_SEMILLA,
  diasParaAbrirCaso: 5,
  ventanaDiasHabiles: 15,
  diasConsecutivosParaAbrirCaso: 3,
  intentosSinExitoParaEscalar: 3,
  diasSinContactoParaEscalar: 10,
  diasSinSeguimientoParaAlerta: 8,
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
   * Ningún teléfono de la ficha sirve. Antes de escalar a nadie hay que conseguir otro:
   * reportar a la Policía a una familia a la que nunca se pudo llamar sería indefendible.
   *
   * Un número equivocado NO basta para declararla desactualizada: si otra llamada timbró
   * —contestaran o no, o entrara a buzón— esa línea existe, y la ficha tiene al menos un
   * teléfono que sirve. Lo detectó una prueba de la etapa 3 (2026-09-16): la versión
   * anterior dejaba en «alerta» a una familia que simplemente no contesta.
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
      r.some((x) => RESULTADOS_DE_FICHA_MALA.includes(x)) &&
      !r.some((x) => RESULTADOS_DE_LINEA_VIVA.includes(x)),
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
//  Etapa 3 — de dónde salen los días de inasistencia
// ---------------------------------------------------------------------------

export interface InasistenciaEstudiante {
  /** Fechas en las que no vino, dentro de la ventana. */
  fechasEnVentana: string[];
  /** Días seguidos sin venir, contando hacia atrás desde el censo más reciente. */
  rachaActual: number;
  ultimaInasistencia: string | null;
  /**
   * Cuántos censos fiables hay del grupo en la ventana. CERO no significa que vino todos
   * los días: significa que nadie pasó lista. La pantalla tiene que decir «sin datos»,
   * nunca «sin inasistencias».
   */
  diasConCenso: number;
}

/**
 * Los días sin venir de cada estudiante, desde el censo de la tercera hora.
 *
 * El censo es la fuente correcta y no las planillas: es el que dice quién NO VINO AL
 * COLEGIO, no quién faltó a una clase. Y es legible por cualquier cuenta activa porque no
 * lleva motivos ni observaciones.
 *
 * Dos límites que conviene conocer:
 *  - `noVinieron` junta la falta y la falta con excusa de la planilla. Es correcto para
 *    este conteo —el estudiante no asistió— y lo que evita que una excusa escale es el
 *    MOTIVO que registra quien llama, no la marca.
 *  - Un censo sin marcas (nadie pasó lista) se descarta con `censoEsFiable`. Contarlo
 *    haría asistir a todo un grupo que nadie verificó.
 *
 * `autorizados` no cuenta como inasistencia: decisión de Julián (2026-09-09), la ausencia
 * con autorización no se reporta en ninguna situación.
 */
export function inasistenciasDesdeCensos(
  censos: CensoDia[],
  estudiantes: { studentId: string; gradoActual: string }[],
  ventanaDiasHabiles: number,
): Map<string, InasistenciaEstudiante> {
  const porGrado = new Map<string, CensoDia[]>();
  for (const c of censos) {
    if (!censoEsFiable(c)) continue;
    const lista = porGrado.get(c.grado) ?? [];
    lista.push(c);
    porGrado.set(c.grado, lista);
  }
  // Más reciente primero. Si el mismo día llegaron dos censos del grupo (no debería), se
  // queda el primero: el id es `${fecha}_${grado}`, así que en la base no pueden coexistir.
  for (const [g, lista] of porGrado) {
    const vistos = new Set<string>();
    porGrado.set(
      g,
      lista
        .sort((a, b) => b.fecha.localeCompare(a.fecha))
        .filter((c) => (vistos.has(c.fecha) ? false : (vistos.add(c.fecha), true)))
        .slice(0, ventanaDiasHabiles),
    );
  }

  const r = new Map<string, InasistenciaEstudiante>();
  for (const e of estudiantes) {
    const ventana = porGrado.get(e.gradoActual) ?? [];
    const noVino = (c: CensoDia) => c.noVinieron.includes(e.studentId) && !c.autorizados.includes(e.studentId);

    let racha = 0;
    for (const c of ventana) {
      if (!noVino(c)) break;
      racha += 1;
    }
    const fechas = ventana.filter(noVino).map((c) => c.fecha);
    r.set(e.studentId, {
      fechasEnVentana: [...fechas].sort(),
      rachaActual: racha,
      ultimaInasistencia: fechas[0] ?? null,
      diasConCenso: ventana.length,
    });
  }
  return r;
}

/**
 * El motivo que cuenta es el MÁS RECIENTE registrado desde el comienzo de las faltas de
 * la ventana. Una incapacidad de marzo no explica las faltas de septiembre, y sin este
 * corte bastaría una excusa vieja para callar un caso nuevo para siempre.
 */
export function motivoVigente(contactos: FamilyContact[], desde: string | null): string | null {
  if (!desde) return null;
  const conMotivo = contactos
    .filter((c) => c.motivoFamilia && c.fecha >= desde)
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || (b.llamadoEn ?? 0) - (a.llamadoEn ?? 0));
  return conMotivo[0]?.motivoFamilia ?? null;
}

function diasEntre(desde: string, hasta: string): number {
  const a = Date.UTC(+desde.slice(0, 4), +desde.slice(5, 7) - 1, +desde.slice(8, 10));
  const b = Date.UTC(+hasta.slice(0, 4), +hasta.slice(5, 7) - 1, +hasta.slice(8, 10));
  return Math.round((b - a) / 86_400_000);
}

// ---------------------------------------------------------------------------
//  La decisión: ¿en qué nivel está este estudiante?
// ---------------------------------------------------------------------------

/**
 * Tres niveles además de «ninguno», para que el reporte no se infle (§4.2 del diseño):
 *  - `seguimiento`: faltas bajo el umbral. Lo mira el director; no sale en ningún reporte.
 *  - `alerta`: cruzó un umbral. Coordinación tiene que gestionar: llamar, citar.
 *  - `candidato`: se agotó la gestión interna y el riesgo persiste, o hay un factor de
 *    riesgo. Es el que aparece propuesto al generar el reporte a Guardianes.
 */
export type NivelPermanencia = 'ninguno' | 'seguimiento' | 'alerta' | 'candidato';

export const NIVEL_ETIQUETA: Record<NivelPermanencia, string> = {
  ninguno: 'Sin novedad',
  seguimiento: 'Seguimiento',
  alerta: 'Alerta',
  candidato: 'Candidato a reporte',
};

export interface DecisionEscalamiento {
  nivel: NivelPermanencia;
  /** Frase que se le muestra a quien mira el caso. Nunca un código. */
  razon: string;
}

/**
 * La regla de negocio completa, en un solo lugar. El orden de las preguntas NO es
 * arbitrario y es lo que hay que leer:
 *
 *  1. Un factor de riesgo es candidato de inmediato, aunque falte un solo día. Esperar
 *     un umbral cuando la familia ya dijo «está trabajando» es perder justo el tiempo que
 *     importa.
 *  2. Un motivo que justifica no escala nunca, por muchos días que sean.
 *  3. Sin faltas no hay nada. Bajo el umbral, seguimiento.
 *  4. Con el umbral cruzado y el teléfono de la ficha malo: alerta, y NUNCA candidato.
 *     Reportar a la Policía a una familia a la que nunca se pudo llamar sería indefendible;
 *     lo que toca es conseguir otro número.
 *  5. Candidato si la gestión se agotó: N intentos sin lograr hablar, o la familia dejó de
 *     responder hace días y las faltas siguieron.
 *  6. Lo demás con el umbral cruzado: alerta.
 */
export function decidirEscalamiento(input: {
  motivoId: string | null;
  config: PermanenciaConfig;
  diasAcumulados: number;
  diasConsecutivos: number;
  contactos: FamilyContact[];
  ultimaInasistencia?: string | null;
  hoy?: string;
}): DecisionEscalamiento {
  const { config, diasAcumulados, diasConsecutivos } = input;
  const motivo = input.motivoId
    ? (config.motivos.find((m) => m.id === input.motivoId) ?? null)
    : null;

  if (motivo?.factorDeRiesgo) {
    return {
      nivel: 'candidato',
      razon: `La familia reportó «${motivo.etiqueta}»: es un factor de riesgo y escala de inmediato.`,
    };
  }
  if (motivo?.justifica) {
    return { nivel: 'ninguno', razon: `La inasistencia está explicada: «${motivo.etiqueta}».` };
  }
  if (diasAcumulados === 0 && diasConsecutivos === 0) {
    return { nivel: 'ninguno', razon: 'Sin inasistencias en la ventana.' };
  }

  const porRacha = diasConsecutivos >= config.diasConsecutivosParaAbrirCaso;
  const porAcumulado = diasAcumulados >= config.diasParaAbrirCaso;
  if (!porRacha && !porAcumulado) {
    return {
      nivel: 'seguimiento',
      razon: `${diasAcumulados} día(s) de inasistencia, todavía bajo el umbral.`,
    };
  }
  const umbral = porRacha
    ? `${diasConsecutivos} días seguidos sin asistir`
    : `${diasAcumulados} días de inasistencia en los últimos ${config.ventanaDiasHabiles} días de clase`;

  const resumen = resumirContactos(input.contactos);
  if (resumen.fichaDesactualizada) {
    return {
      nivel: 'alerta',
      razon: `${umbral}. El teléfono de la ficha no sirve: hay que conseguir otro antes de escalar.`,
    };
  }

  if (resumen.intentos >= config.intentosSinExitoParaEscalar && resumen.efectivos === 0) {
    return {
      nivel: 'candidato',
      razon: `${umbral}, y ${resumen.intentos} intentos de contacto sin lograr hablar con la familia.`,
    };
  }

  if (
    resumen.ultimoEfectivo &&
    input.hoy &&
    input.ultimaInasistencia &&
    input.ultimaInasistencia > resumen.ultimoEfectivo &&
    diasEntre(resumen.ultimoEfectivo, input.hoy) >= config.diasSinContactoParaEscalar
  ) {
    return {
      nivel: 'candidato',
      razon: `${umbral}. La familia no ha vuelto a responder desde el ${resumen.ultimoEfectivo} y las faltas siguieron.`,
    };
  }

  return {
    nivel: 'alerta',
    razon: resumen.efectivos > 0 ? `${umbral}. Hay contacto con la familia: seguir gestionando.` : `${umbral}. Todavía sin contacto con la familia.`,
  };
}

export interface EvaluacionPermanencia extends DecisionEscalamiento {
  studentId: string;
  inasistencia: InasistenciaEstudiante;
  motivoId: string | null;
}

/** Evalúa un estudiante con todo lo que la pantalla ya cargó. */
export function evaluarEstudiante(input: {
  studentId: string;
  inasistencia: InasistenciaEstudiante;
  contactos: FamilyContact[];
  config: PermanenciaConfig;
  hoy: string;
}): EvaluacionPermanencia {
  const { inasistencia: ina } = input;
  const motivoId = motivoVigente(input.contactos, ina.fechasEnVentana[0] ?? null);
  return {
    studentId: input.studentId,
    inasistencia: ina,
    motivoId,
    ...decidirEscalamiento({
      motivoId,
      config: input.config,
      diasAcumulados: ina.fechasEnVentana.length,
      diasConsecutivos: ina.rachaActual,
      contactos: input.contactos,
      ultimaInasistencia: ina.ultimaInasistencia,
      hoy: input.hoy,
    }),
  };
}

/** Candidatos primero, después alertas; entre iguales, el que más ha faltado. */
export function ordenarPorGravedad<T extends EvaluacionPermanencia>(lista: T[]): T[] {
  const peso: Record<NivelPermanencia, number> = { candidato: 0, alerta: 1, seguimiento: 2, ninguno: 3 };
  return [...lista].sort(
    (a, b) =>
      peso[a.nivel] - peso[b.nivel] ||
      b.inasistencia.rachaActual - a.inasistencia.rachaActual ||
      b.inasistencia.fechasEnVentana.length - a.inasistencia.fechasEnVentana.length,
  );
}

// ---------------------------------------------------------------------------
//  El caso: lo que SÍ se guarda
// ---------------------------------------------------------------------------

export type EstadoCaso =
  | 'abierto'
  | 'en_gestion'
  | 'reportado'
  /** Sigue abierto: a pesar de las visitas no se ha localizado. Estado propio del Distrito. */
  | 'no_ubicado'
  | 'cerrado_reintegro'
  | 'cerrado_traslado'
  | 'cerrado_retiro'
  | 'cerrado_otro';

export const ESTADOS_ABIERTOS: EstadoCaso[] = ['abierto', 'en_gestion', 'reportado', 'no_ubicado'];

/** Los estados con que se CIERRA un caso. */
export type EstadoCierre = 'cerrado_reintegro' | 'cerrado_traslado' | 'cerrado_retiro' | 'cerrado_otro';
export const ESTADOS_CIERRE: EstadoCierre[] = ['cerrado_reintegro', 'cerrado_retiro', 'cerrado_traslado', 'cerrado_otro'];

/**
 * Cómo se llama cada estado en el reporte de Guardianes de la Permanencia (§9 del formato).
 * El Distrito no distingue «abierto», «en gestión» ni «reportado»: para él los tres son un
 * estudiante ubicado con acciones en curso.
 */
export const ESTADO_DISTRITO: Record<EstadoCaso, string> = {
  abierto: 'Ubicado en proceso',
  en_gestion: 'Ubicado en proceso',
  reportado: 'Ubicado en proceso',
  no_ubicado: 'No ubicado',
  cerrado_reintegro: 'Ubicado y reintegrado',
  cerrado_retiro: 'Retiro formal',
  cerrado_traslado: 'Otro: trasladado a otra institución',
  cerrado_otro: 'Otro',
};

export const ESTADO_CASO_ETIQUETA: Record<EstadoCaso, string> = {
  abierto: 'Abierto',
  en_gestion: 'En gestión',
  reportado: 'Reportado',
  no_ubicado: 'No ubicado',
  cerrado_reintegro: 'Cerrado: se reintegró',
  cerrado_traslado: 'Cerrado: trasladado',
  cerrado_retiro: 'Cerrado: retiro formal',
  cerrado_otro: 'Cerrado: otro',
};

/**
 * `asistenciaCasosPermanencia/{casoId}`. Las alertas NO se guardan —se calculan, y así
 * siempre dicen la verdad de hoy—; el caso sí, porque es el expediente de la gestión
 * humana. Ver §5 del diseño.
 */
export interface CasoPermanencia {
  casoId: string;
  studentId: string;
  grado: string;
  sede: Sede;
  anio: number;
  /** AAAA-MM-DD. Forma parte del id. */
  fechaApertura: string;
  /** La razón que dio el sistema al abrirlo, congelada: explica por qué existe el caso. */
  criterioQueLoAbrio: string;
  nivel: NivelPermanencia;
  estado: EstadoCaso;
  motivoFamilia: string | null;
  factorDeRiesgo: string | null;
  descripcion: string;
  gestiones: Gestion[];
  abiertoPor: string;
  ultimaEscrituraPor: string;
  ultimaEscrituraEn: number;
  cerradoPor?: string | null;
  cerradoEn?: string | null;
  motivoCierre?: string | null;
  /** AAAA-MM-DD. El próximo seguimiento programado; si se pasa sin hacerse, hay alerta. */
  proximoSeguimiento?: string | null;
  /** A quién le toca ese seguimiento. Ver `RESPONSABLE_ETIQUETA` en seguimiento-caso.ts. */
  responsableSeguimiento?: string | null;
  /**
   * Coordinación le pidió al director del grupo que participe. SOLO así el director ve el
   * caso: por su cuenta no entra (Julián, 2026-09-17). Las reglas lo leen tal cual.
   */
  remitidoDirector?: boolean;
  remitidoPor?: string | null;
  remitidoEn?: string | null;
  remisionNota?: string | null;
}

/**
 * Determinista a propósito: si dos coordinadores abren la pantalla el mismo día, los dos
 * intentan crear EL MISMO documento, y la transacción deja pasar solo al primero. Un id
 * aleatorio abriría dos casos para el mismo estudiante.
 */
export function casoId(studentId: string, fechaApertura: string): string {
  return `${studentId}_${fechaApertura}`;
}

/**
 * Qué casos hay que abrir hoy: alerta o candidato, y SIN un caso abierto. Un estudiante
 * con un caso en gestión no recibe otro — recibe seguimiento en el que ya tiene.
 */
export function casosPorAbrir(
  evaluaciones: EvaluacionPermanencia[],
  casosExistentes: Pick<CasoPermanencia, 'studentId' | 'estado'>[],
): EvaluacionPermanencia[] {
  const conCasoAbierto = new Set(
    casosExistentes.filter((c) => ESTADOS_ABIERTOS.includes(c.estado)).map((c) => c.studentId),
  );
  return evaluaciones.filter(
    (e) => (e.nivel === 'alerta' || e.nivel === 'candidato') && !conCasoAbierto.has(e.studentId),
  );
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

// ---------------------------------------------------------------------------
//  Edad — la pide la ficha de identificación del reporte
// ---------------------------------------------------------------------------

/**
 * Edad cumplida en una fecha, ambas ISO `AAAA-MM-DD`. Se compara como texto de mes y
 * día, no con milisegundos: restar fechas en JavaScript mete la zona horaria y el día
 * del cumpleaños puede salir con un año menos según la hora del servidor.
 * `null` si la fecha de nacimiento no existe o no es válida.
 */
export function edadEn(fechaNacimiento: string | undefined, hoy: string): number | null {
  const n = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fechaNacimiento ?? '');
  const h = /^(\d{4})-(\d{2})-(\d{2})$/.exec(hoy);
  if (!n || !h) return null;
  let edad = Number(h[1]) - Number(n[1]);
  if (`${h[2]}-${h[3]}` < `${n[2]}-${n[3]}`) edad -= 1;
  return edad >= 0 ? edad : null;
}

// ─────────────────────────── «Hay que llamar» ───────────────────────────

/**
 * Cuántos días seguidos sin venir bastan para que la llamada no pueda esperar. Dos: el
 * segundo día seguido ya no es un imprevisto. Está por debajo del umbral que ABRE un caso
 * (`diasConsecutivosParaAbrirCaso`, 3 por defecto) a propósito: la llamada llega antes que el
 * expediente.
 */
export const RACHA_PARA_LLAMAR = 2;

export interface PrioridadLlamada {
  /** Esta familia hay que llamarla sí o sí, aunque exista otro canal de aviso. */
  llamar: boolean;
  /** Por qué, en palabras para coordinación. Vacío si `llamar` es falso. */
  motivos: string[];
  /** Para ordenar la lista: más alto, más arriba. */
  peso: number;
}

/**
 * ¿Esta inasistencia exige una llamada, o puede esperar a otro canal? Criterios acordados con
 * Julián (2026-09-17), del más grave al menos:
 *
 *  1. Tiene un caso de permanencia abierto.
 *  2. La última causa que dio la familia es un factor de riesgo.
 *  3. Está en alerta o es candidato a reporte.
 *  4. Lleva `RACHA_PARA_LLAMAR` días seguidos o más sin venir.
 *  5. No hay otro canal: el acudiente no tiene celular registrado (sin celular tampoco podrá
 *     verificar una respuesta por mensaje de texto), o el teléfono de la ficha ya falló.
 *
 * Todavía NO incluye «no respondió al correo en el plazo»: ese canal no existe aún. Cuando
 * exista, entra aquí como un criterio más.
 *
 * Esto ORDENA el trabajo; no quita a nadie de la lista. Hoy, sin canal de correo, a todas las
 * familias de «no ingresaron» se las sigue llamando: la marca dice por quién empezar.
 */
export function prioridadDeLlamada(input: {
  evaluacion: EvaluacionPermanencia | null;
  casoAbierto: CasoPermanencia | null;
  config: PermanenciaConfig;
  telefonos: string[];
  contactos: FamilyContact[];
}): PrioridadLlamada {
  const motivos: string[] = [];
  let peso = 0;
  const { evaluacion: ev, config } = input;

  if (input.casoAbierto) {
    motivos.push(`Tiene un caso de permanencia ${ESTADO_CASO_ETIQUETA[input.casoAbierto.estado].toLowerCase()}.`);
    peso += 100;
  }

  const motivo = ev?.motivoId ? config.motivos.find((m) => m.id === ev.motivoId) : undefined;
  if (motivo?.factorDeRiesgo) {
    motivos.push(`La familia reportó «${motivo.etiqueta}», que es un factor de riesgo.`);
    peso += 80;
  } else if (ev && (ev.nivel === 'candidato' || ev.nivel === 'alerta')) {
    motivos.push(`${NIVEL_ETIQUETA[ev.nivel]}: ${ev.razon}`);
    peso += ev.nivel === 'candidato' ? 60 : 40;
  }

  const racha = ev?.inasistencia.rachaActual ?? 0;
  if (racha >= RACHA_PARA_LLAMAR) {
    motivos.push(`${racha} días seguidos sin venir.`);
    peso += 20 + racha;
  }

  if (resumirContactos(input.contactos).fichaDesactualizada) {
    motivos.push('El teléfono de la ficha ya falló: hay que conseguir otro número.');
    peso += 10;
  } else if (!input.telefonos.some((t) => tipoDeTelefono(t) === 'movil')) {
    motivos.push(
      input.telefonos.length > 0
        ? 'El acudiente no tiene celular registrado, solo fijo: no hay otro canal de aviso.'
        : 'El acudiente no tiene ningún teléfono registrado.',
    );
    peso += 10;
  }

  return { llamar: motivos.length > 0, motivos, peso };
}
