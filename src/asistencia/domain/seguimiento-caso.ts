/**
 * El seguimiento de un caso de permanencia (2026-09-17).
 *
 * Calca la lógica de la gestión del riesgo de MJB —cada seguimiento termina en una decisión:
 * programar el siguiente o cerrar— y corrige tres huecos que allá quedaron:
 *
 *  1. Allá la fecha programada no dispara nada: la alerta solo cuenta días desde el último
 *     seguimiento. Aquí también vence si la fecha programada pasa sin hacerse.
 *  2. Allá no hay responsable. Aquí cada seguimiento programado dice a quién le toca.
 *  3. Allá el seguimiento es una nota libre. Aquí tiene TIPO y los campos que pide el formato
 *     de Guardianes de la Permanencia (§6 y §8), para que el informe salga lleno.
 *
 * Cada seguimiento es un documento aparte, en la subcolección `seguimientos` del caso, y las
 * reglas NO dejan editarlo ni borrarlo. Corregir es AGREGAR una corrección (`corrigeA`) que
 * reemplaza al original en pantalla; el original queda. Así la rectora puede ajustar lo que
 * le presentan (Julián, 2026-09-17) sin que nadie pierda lo que escribió.
 */

import {
  ESTADOS_ABIERTOS,
  type CasoPermanencia,
  type EstadoCaso,
  type EstadoCierre,
  type PermanenciaConfig,
} from './permanencia';
import type { FamilyContact } from './types';

export type TipoSeguimiento = 'visita' | 'dialogo' | 'articulacion' | 'mesa' | 'observacion';

export const TIPO_SEGUIMIENTO_ETIQUETA: Record<TipoSeguimiento, string> = {
  visita: 'Visita domiciliaria',
  dialogo: 'Diálogo con el estudiante',
  articulacion: 'Articulación interinstitucional',
  mesa: 'Mesa de permanencia',
  observacion: 'Observación o recomendación',
};

/** «Otras estrategias» del formato del Distrito (§6), como casillas. */
export type ApoyoArticulacion = 'psicosocial' | 'apoyo_economico' | 'programas_distritales';

export const APOYO_ETIQUETA: Record<ApoyoArticulacion, string> = {
  psicosocial: 'Acompañamiento psicosocial',
  apoyo_economico: 'Gestión de apoyos económicos',
  programas_distritales: 'Articulación con programas distritales',
};

/**
 * En qué termina un seguimiento.
 *  - `programar`: el caso sigue, con fecha y responsable para el siguiente.
 *  - `no_ubicado`: igual que programar, pero el estudiante no aparece. Estado del Distrito.
 *  - `cerrar`: se acabó, con el estado final.
 *  - `ninguna`: no decide nada. Es lo único que puede el director de grupo —participa porque
 *    coordinación se lo remitió, pero el rumbo del caso lo decide coordinación— y lo que
 *    llevan las correcciones.
 */
export type DecisionSeguimiento = 'programar' | 'no_ubicado' | 'cerrar' | 'ninguna';

/**
 * A quién le toca el próximo seguimiento. Un PUESTO, no una persona: el contrato del módulo
 * ya lo manda así («puesto ≠ persona»), porque la persona cambia y el puesto queda.
 */
export type ResponsableSeguimiento = 'coordinacion' | 'rectoria' | 'director' | 'orientacion';

export const RESPONSABLE_ETIQUETA: Record<ResponsableSeguimiento, string> = {
  coordinacion: 'Coordinación',
  rectoria: 'Rectoría',
  director: 'Director de grupo',
  orientacion: 'Orientación escolar',
};

/** Los campos que cambian según el tipo. Todos opcionales: se validan con `validarSeguimiento`. */
export interface CamposSeguimiento {
  // Visita domiciliaria
  direccionVisitada?: string;
  seEncontroEstudiante?: boolean | null;
  personaQueRecibe?: string;
  // Diálogo con el estudiante
  lugar?: string;
  manifestaciones?: string;
  // Articulación interinstitucional
  entidades?: string;
  acciones?: string;
  apoyos?: ApoyoArticulacion[];
  // Mesa de permanencia
  recomendaciones?: string;
  estrategias?: string;
  // Todos
  observaciones?: string;
}

export interface BorradorSeguimiento extends CamposSeguimiento {
  tipo: TipoSeguimiento;
  /** AAAA-MM-DD: cuándo ocurrió, que puede ser antes de cuando se registra. */
  fecha: string;
  decision: DecisionSeguimiento;
  proximaFecha?: string | null;
  responsable?: ResponsableSeguimiento | null;
  estadoFinal?: EstadoCierre | null;
}

export interface SeguimientoCaso extends BorradorSeguimiento {
  seguimientoId: string;
  casoId: string;
  /** Si es una corrección, el id del seguimiento ORIGINAL que corrige. */
  corrigeA?: string | null;
  autor: string;
  /** Hora del servidor, en milisegundos. */
  creadoEn: number;
}

/** Los campos de texto que una corrección puede cambiar. La decisión no se corrige. */
export const CAMPOS_CORREGIBLES: (keyof CamposSeguimiento)[] = [
  'direccionVisitada',
  'seEncontroEstudiante',
  'personaQueRecibe',
  'lugar',
  'manifestaciones',
  'entidades',
  'acciones',
  'apoyos',
  'recomendaciones',
  'estrategias',
  'observaciones',
];

const lleno = (s?: string | null) => Boolean(s && s.trim());

/**
 * ¿Se puede guardar? Devuelve el primer problema, en palabras, o `null`. Pide lo mínimo que
 * hace útil cada tipo en el informe: una visita sin decir si se encontró al estudiante no le
 * sirve al Distrito; un cierre sin explicación no le sirve a nadie.
 */
export function validarSeguimiento(b: BorradorSeguimiento, hoy: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.fecha)) return 'Falta la fecha.';
  if (b.fecha > hoy) return 'La fecha no puede ser futura: se registra lo que ya pasó.';

  switch (b.tipo) {
    case 'visita':
      if (b.seEncontroEstudiante === undefined || b.seEncontroEstudiante === null)
        return 'Indique si se encontró al estudiante.';
      break;
    case 'dialogo':
      if (!lleno(b.manifestaciones)) return 'Escriba qué manifestó el estudiante.';
      break;
    case 'articulacion':
      if (!lleno(b.entidades)) return 'Escriba con qué entidades se articuló.';
      break;
    case 'mesa':
      if (!lleno(b.recomendaciones)) return 'Escriba las recomendaciones de la mesa.';
      break;
    case 'observacion':
      if (!lleno(b.observaciones)) return 'Escriba la observación.';
      break;
  }

  if (b.decision === 'programar' || b.decision === 'no_ubicado') {
    if (!b.proximaFecha) return 'Falta la fecha del próximo seguimiento.';
    if (b.proximaFecha < hoy) return 'El próximo seguimiento no puede quedar en el pasado.';
    if (!b.responsable) return 'Falta quién hace el próximo seguimiento.';
  }
  if (b.decision === 'cerrar') {
    if (!b.estadoFinal) return 'Falta con qué estado se cierra el caso.';
    if (!lleno(b.observaciones)) return 'Para cerrar, escriba en observaciones por qué se cierra.';
  }
  return null;
}

/**
 * Lo que el seguimiento le cambia al caso. `null` si no le cambia nada (el director, una
 * corrección). Un caso cerrado que recibe `programar` se REABRE: queda en gestión y se borra
 * quién lo cerró, porque ya no está cerrado; el seguimiento que lo reabrió es la constancia.
 */
export function efectoEnCaso(
  caso: Pick<CasoPermanencia, 'estado'>,
  b: BorradorSeguimiento,
  autor: string,
  hoy: string,
): Partial<CasoPermanencia> | null {
  switch (b.decision) {
    case 'programar':
      return {
        estado: caso.estado === 'no_ubicado' ? 'no_ubicado' : 'en_gestion',
        proximoSeguimiento: b.proximaFecha ?? null,
        responsableSeguimiento: b.responsable ?? null,
        ...(ESTADOS_ABIERTOS.includes(caso.estado) ? {} : { cerradoPor: null, cerradoEn: null, motivoCierre: null }),
      };
    case 'no_ubicado':
      return {
        estado: 'no_ubicado',
        proximoSeguimiento: b.proximaFecha ?? null,
        responsableSeguimiento: b.responsable ?? null,
      };
    case 'cerrar':
      return {
        estado: b.estadoFinal as EstadoCaso,
        proximoSeguimiento: null,
        responsableSeguimiento: null,
        cerradoPor: autor,
        cerradoEn: hoy,
        motivoCierre: b.observaciones?.trim() ?? null,
      };
    default:
      return null;
  }
}

/** Un seguimiento como se muestra: con su última corrección aplicada, si la tiene. */
export interface SeguimientoVigente extends SeguimientoCaso {
  /** Quién y cuándo lo corrigió por última vez. `null` si nunca se corrigió. */
  corregido: { por: string; en: number } | null;
  /** Las versiones anteriores, de la más vieja a la más nueva. Para el historial. */
  versionesAnteriores: SeguimientoCaso[];
}

/**
 * Aplica las correcciones: cada original se muestra con los campos de su corrección más
 * reciente, y lo demás (tipo, fecha, decisión, autor original) queda como estaba. Ordenados
 * por fecha y hora de registro, del más viejo al más nuevo: es una línea de tiempo.
 */
export function seguimientosVigentes(todos: SeguimientoCaso[]): SeguimientoVigente[] {
  const originales = todos.filter((s) => !s.corrigeA);
  const correccionesDe = new Map<string, SeguimientoCaso[]>();
  for (const s of todos) {
    if (!s.corrigeA) continue;
    const l = correccionesDe.get(s.corrigeA) ?? [];
    l.push(s);
    correccionesDe.set(s.corrigeA, l);
  }
  return originales
    .map((o) => {
      const cs = (correccionesDe.get(o.seguimientoId) ?? []).sort((a, b) => a.creadoEn - b.creadoEn);
      const ultima = cs[cs.length - 1];
      if (!ultima) return { ...o, corregido: null, versionesAnteriores: [] };
      const campos: Partial<CamposSeguimiento> = {};
      for (const k of CAMPOS_CORREGIBLES) {
        if (k in ultima) (campos as Record<string, unknown>)[k] = ultima[k];
      }
      return {
        ...o,
        ...campos,
        corregido: { por: ultima.autor, en: ultima.creadoEn },
        versionesAnteriores: [o, ...cs.slice(0, -1)],
      };
    })
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.creadoEn - b.creadoEn);
}

/** Días enteros entre dos fechas AAAA-MM-DD. */
function diasEntre(desde: string, hasta: string): number {
  const a = Date.UTC(+desde.slice(0, 4), +desde.slice(5, 7) - 1, +desde.slice(8, 10));
  const b = Date.UTC(+hasta.slice(0, 4), +hasta.slice(5, 7) - 1, +hasta.slice(8, 10));
  return Math.round((b - a) / 86_400_000);
}

export interface AlertaSeguimiento {
  vencido: boolean;
  razon: string | null;
  /** Días desde lo último que se hizo en el caso (o desde que se abrió). */
  diasSinSeguimiento: number;
  /** AAAA-MM-DD de lo último que se hizo, para mostrarlo. */
  ultimaActuacion: string;
}

/**
 * ¿El caso está desatendido? Dos maneras de estarlo, y cualquiera basta:
 *
 *  1. Se programó un seguimiento y la fecha pasó sin que se hiciera nada desde entonces.
 *  2. Lleva `diasSinSeguimientoParaAlerta` días sin ninguna actuación.
 *
 * Cuenta como actuación cualquier seguimiento original —las correcciones no, que corregir un
 * texto no es atender el caso—, cualquier llamada a la familia registrada desde la apertura
 * —una llamada también es seguimiento, y no se le debe pedir a coordinación que la escriba dos
 * veces— y las gestiones del modelo anterior, que vivían en un arreglo dentro del caso. Sin
 * estas últimas, un caso abierto antes del 2026-09-17 cuya última actuación fue una gestión
 * aparecería vencido sin estarlo (lo advirtió la otra pestaña al publicar).
 */
export function alertaDeSeguimiento(input: {
  caso: Pick<CasoPermanencia, 'estado' | 'fechaApertura' | 'proximoSeguimiento' | 'responsableSeguimiento'> & {
    gestiones?: CasoPermanencia['gestiones'];
  };
  seguimientos: SeguimientoCaso[];
  contactos: FamilyContact[];
  config: Pick<PermanenciaConfig, 'diasSinSeguimientoParaAlerta'>;
  hoy: string;
}): AlertaSeguimiento {
  const { caso, hoy } = input;
  const fechas = [
    caso.fechaApertura,
    ...input.seguimientos.filter((s) => !s.corrigeA).map((s) => s.fecha),
    ...input.contactos.filter((c) => c.fecha >= caso.fechaApertura).map((c) => c.fecha),
    ...(caso.gestiones ?? []).map((g) => g.fecha),
  ];
  const ultimaActuacion = fechas.reduce((a, b) => (b > a ? b : a));
  const diasSinSeguimiento = Math.max(0, diasEntre(ultimaActuacion, hoy));

  if (!ESTADOS_ABIERTOS.includes(caso.estado)) {
    return { vencido: false, razon: null, diasSinSeguimiento, ultimaActuacion };
  }

  const programado = caso.proximoSeguimiento;
  if (programado && hoy > programado && ultimaActuacion < programado) {
    const quien = caso.responsableSeguimiento
      ? ` (le correspondía a ${RESPONSABLE_ETIQUETA[caso.responsableSeguimiento as ResponsableSeguimiento]?.toLowerCase() ?? caso.responsableSeguimiento})`
      : '';
    return {
      vencido: true,
      razon: `El seguimiento programado para el ${programado} no se hizo${quien}.`,
      diasSinSeguimiento,
      ultimaActuacion,
    };
  }

  if (diasSinSeguimiento >= input.config.diasSinSeguimientoParaAlerta) {
    return {
      vencido: true,
      razon: `${diasSinSeguimiento} días sin seguimiento.`,
      diasSinSeguimiento,
      ultimaActuacion,
    };
  }
  return { vencido: false, razon: null, diasSinSeguimiento, ultimaActuacion };
}
