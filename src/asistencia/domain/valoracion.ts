/**
 * Valoracion del centro de interes — logica pura.
 *
 * EL PROBLEMA QUE RESUELVE, en palabras de Julian (2026-09-10): al terminar el semestre
 * cada lider valora a sus inscritos, pero quien DIGITA en el Master es el director de
 * grupo. Los 33 de 11-2 estan repartidos en seis centros, asi que el director espera a que
 * seis lideres llenen un Drive, consolida a mano y despues digita. Esto reemplaza el Drive
 * y la consolidacion.
 *
 * ⚠️ LOS NIVELES SON LOS NUMEROS DEL MASTER, NO UNA TRADUCCION. Se guarda 2, 3 o 4 —lo que
 * de verdad se digita— y no 'basico' | 'alto' | 'superior'. Las palabras y los colores son
 * como se ve en pantalla; el numero es el dato. Asi el Excel no traduce nada, que es donde
 * se cuelan los errores que acaban en el boletin de un estudiante.
 *
 * NO EXISTE "BAJO": el centro de interes no se reprueba (Julian, 2026-09-10).
 */

import type { CodigoIndicador, ConfigValoracion, EstadoValoracion, NivelValoracion, ValoracionEstudiante } from './types';
import { compararEstudiantes } from './nombres';

/**
 * Los cuatro niveles, con el numero que se digita en el Master.
 *
 * `colorToken` es semantico, nunca un color literal (contrato, seccion 5): el mismo
 * criterio que las marcas de asistencia en `marks.ts`.
 */
export const NIVELES: {
  nivel: NivelValoracion;
  label: string;
  colorToken: 'warning' | 'info' | 'success' | 'purple';
  /** Se digita hoy en el Master. Ver `PLAN_DE_APOYO`. */
  seDigita: boolean;
  /** Lleva codigos de indicador. */
  llevaCodigos: boolean;
}[] = [
  { nivel: 1, label: 'Plan de apoyo', colorToken: 'warning', seDigita: false, llevaCodigos: false },
  { nivel: 2, label: 'Básico',        colorToken: 'info',    seDigita: true,  llevaCodigos: true },
  { nivel: 3, label: 'Alto',          colorToken: 'success', seDigita: true,  llevaCodigos: true },
  { nivel: 4, label: 'Superior',      colorToken: 'purple',  seDigita: true,  llevaCodigos: true },
];

/**
 * Plan de apoyo (1) esta a medio definir A PROPOSITO.
 *
 * Julian, 2026-09-10: "por ahora no se digita, pero deja abierta la posibilidad con el
 * numero 1. Mas adelante determinamos con el equipo si lo mantenemos. Este no tiene codigos
 * y no se bien como sera la valoracion, asi que dejemoslo solo hasta ahi."
 *
 * Consecuencia practica, y por eso esta escrito aqui: el estudiante en plan de apoyo SI se
 * puede marcar y SI aparece en el Excel, pero con la casilla de valoracion VACIA y en una
 * lista aparte. Si saliera mezclado con los demas y con la casilla vacia, el director lo
 * digitaria en blanco sin darse cuenta.
 */
export const PLAN_DE_APOYO: NivelValoracion = 1;

export function nivelDe(nivel: NivelValoracion) {
  return NIVELES.find((n) => n.nivel === nivel);
}

export function esNivelValido(n: unknown): n is NivelValoracion {
  return n === 1 || n === 2 || n === 3 || n === 4;
}

/** Cuantos codigos caben. Son las columnas C1..C4 de la plantilla del Master. */
export const MAX_CODIGOS = 4;

/**
 * Rango de los indicadores en el Master. Julian, 2026-09-11: "todavia no tengo certeza del
 * rango de numeros, pero funciona asi bajo esa logica".
 *
 * Por eso esto AVISA Y NO BLOQUEA. Un rango inventado que rechace un codigo legitimo deja
 * al lider sin poder valorar y sin entender por que; un aviso le hace mirar dos veces y
 * seguir. Cuando el rango se confirme, se puede endurecer aqui y en un solo sitio.
 */
export const RANGO_INDICADORES = { desde: 610, hasta: 690 };

/** Aviso —no error— si el codigo se sale de lo esperado. `null` si esta bien. */
export function avisoDeCodigo(codigo: number): string | null {
  if (!Number.isInteger(codigo)) return 'El código debe ser un número entero.';
  if (codigo < 100 || codigo > 999) return 'Los indicadores del Máster son de tres dígitos.';
  if (codigo < RANGO_INDICADORES.desde || codigo > RANGO_INDICADORES.hasta) {
    return `Fuera del rango habitual (${RANGO_INDICADORES.desde}–${RANGO_INDICADORES.hasta}). Verifíquelo en el Máster antes de seguir.`;
  }
  return null;
}

/**
 * Valida la lista de codigos de UN nivel. Devuelve el motivo del rechazo en espanol claro
 * —lo lee un docente— o null.
 *
 * Esto SI bloquea, a diferencia de `avisoDeCodigo`: aqui no se trata de un numero dudoso
 * sino de una lista que el Master no podria importar.
 */
export function validarCodigosDeNivel(codigos: CodigoIndicador[]): string | null {
  if (codigos.length === 0) return 'Cada nivel necesita al menos un indicador.';
  if (codigos.length > MAX_CODIGOS) {
    return `Caben ${MAX_CODIGOS} indicadores como máximo: son las columnas C1 a C${MAX_CODIGOS} del Máster.`;
  }
  if (codigos.some((c) => !c.texto.trim())) {
    return 'Cada indicador necesita su texto, no solo el número: es lo que el docente reconoce.';
  }
  const numeros = codigos.map((c) => c.codigo);
  if (new Set(numeros).size !== numeros.length) {
    return 'Hay un indicador repetido en este nivel.';
  }
  return null;
}

/** Los codigos que le tocan a un nivel segun la configuracion del centro. */
export function codigosDelNivel(
  config: ConfigValoracion | null,
  nivel: NivelValoracion,
): CodigoIndicador[] {
  if (!config || !nivelDe(nivel)?.llevaCodigos) return [];
  return config.porNivel?.[String(nivel) as '2' | '3' | '4'] ?? [];
}

/**
 * ¿El centro ya puede valorar? Falta configurar los codigos de algun nivel que los lleva.
 *
 * Se comprueba ANTES de dejar valorar y no despues: los codigos se copian a la valoracion
 * en el momento de ponerla (ver `nuevaValoracion`), asi que valorar sin configurar dejaria
 * treinta registros sin indicadores que habria que rehacer uno por uno.
 */
export function nivelesSinConfigurar(config: ConfigValoracion | null): NivelValoracion[] {
  return NIVELES.filter((n) => n.llevaCodigos && codigosDelNivel(config, n.nivel).length === 0)
    .map((n) => n.nivel);
}

export function valoracionId(programaId: string, grupoId: string, studentId: string): string {
  // El GRUPO va en el id, no solo el programa. Mientras haya estudiantes inscritos en dos
  // centros —quedan casos pendientes de que la coordinacion decida—, un id sin el grupo
  // haria que el segundo lider PISARA la valoracion del primero sin que nadie se entere.
  // Asi cada centro escribe la suya y el director las ve las dos (ver `consolidarGrupo`).
  return `${programaId}_${grupoId}_${studentId}`;
}

/**
 * La valoracion lista para guardar.
 *
 * Los codigos y sus TEXTOS se copian aqui desde la configuracion, no se referencian. Dos
 * razones: el director no puede leer la configuracion del centro —no es docente de el—, y
 * un registro academico debe decir que se certifico ese dia aunque el catalogo cambie el
 * año entrante. Es el mismo criterio de la foto fija de los inscritos.
 */
export function nuevaValoracion(input: {
  programaId: string;
  grupoId: string;
  studentId: string;
  grado: string;
  sede: string;
  nivel: NivelValoracion;
  config: ConfigValoracion | null;
}): Omit<ValoracionEstudiante, 'valoradoPor' | 'valoradoEn' | 'modificadoPor' | 'modificadoEn'> {
  const codigos = codigosDelNivel(input.config, input.nivel);
  return {
    valoracionId: valoracionId(input.programaId, input.grupoId, input.studentId),
    programaId: input.programaId,
    grupoId: input.grupoId,
    studentId: input.studentId,
    grado: input.grado,
    sede: input.sede as ValoracionEstudiante['sede'],
    nivel: input.nivel,
    codigos: codigos.map((c) => c.codigo),
    indicadores: codigos.map((c) => c.texto.trim()),
  };
}

// ---------------------------------------------------------------------------
//  Entrega y desbloqueo
// ---------------------------------------------------------------------------

export type PuedeValorar =
  | { puede: true }
  | { puede: false; motivo: string };

/**
 * ¿El lider puede escribir ahora mismo?
 *
 * Julian, 2026-09-10: "el lider si puede corregir despues de entregar, pero debe ser
 * autorizado por coordinacion... Esta autorizacion y apertura se puede dar para un rango de
 * tiempo determinado."
 *
 * El plazo se comprueba TAMBIEN EN EL SERVIDOR (ver rules/asistencia.rules). Esto de aqui
 * es para no ofrecerle al lider una casilla que el servidor va a rechazar; no es el candado.
 */
export function puedeValorar(estado: EstadoValoracion | null, ahora: number): PuedeValorar {
  if (!estado?.entregado) return { puede: true };
  const hasta = estado.reabiertoHasta ?? 0;
  if (hasta > ahora) return { puede: true };
  return {
    puede: false,
    motivo:
      hasta > 0
        ? 'El plazo de corrección se venció. Pida a coordinación que lo reabra.'
        : 'Ya entregó este centro. Para corregir, pida a coordinación que lo reabra.',
  };
}

// ---------------------------------------------------------------------------
//  Lo que ve el lider: su avance
// ---------------------------------------------------------------------------

export interface AvanceCentro {
  total: number;
  valorados: number;
  faltan: number;
  /** Cuantos en cada nivel, para el resumen de abajo. */
  porNivel: Record<NivelValoracion, number>;
}

export function avanceDelCentro(
  studentIds: string[],
  valoraciones: ValoracionEstudiante[],
): AvanceCentro {
  const porId = new Map(valoraciones.map((v) => [v.studentId, v]));
  const porNivel = { 1: 0, 2: 0, 3: 0, 4: 0 } as Record<NivelValoracion, number>;
  let valorados = 0;
  for (const id of studentIds) {
    const v = porId.get(id);
    if (!v) continue;
    valorados++;
    porNivel[v.nivel] += 1;
  }
  return { total: studentIds.length, valorados, faltan: studentIds.length - valorados, porNivel };
}

// ---------------------------------------------------------------------------
//  Lo que ve la coordinacion: quien entrego y quien no
// ---------------------------------------------------------------------------

export interface SeguimientoCentro {
  grupoId: string;
  nombre: string;
  lider: string;
  inscritos: number;
  valorados: number;
  entregado: boolean;
  /** Reabierto y todavia dentro del plazo: puede seguir escribiendo. */
  reabiertoVigente: boolean;
  reabiertoHasta: number | null;
}

export interface SeguimientoPrograma {
  centros: SeguimientoCentro[];
  entregados: number;
  total: number;
  /** Inscripciones sin valoracion en todo el programa. */
  faltan: number;
}

/**
 * El estado de la entrega en los veintiun centros, para la coordinacion del programa.
 *
 * ORDEN A PROPOSITO: primero los que NO han entregado, y entre esos primero los que menos
 * han valorado. Es la lista de a quien hay que ir a buscar, y por eso no va alfabetica:
 * ordenada por nombre, el centro que no ha empezado se esconde en la mitad.
 *
 * `entregado` y `valorados` son cosas distintas y las dos importan: un centro puede tener a
 * los treinta valorados y no haber entregado —entonces falta un clic—, y otro puede haber
 * entregado con la mitad sin valorar, que es peor y hay que verlo.
 */
export function seguimientoDePrograma(
  centros: { grupoId: string; nombre: string; lider: string; miembros?: string[] }[],
  valoraciones: ValoracionEstudiante[],
  estados: Map<string, EstadoValoracion | null>,
  ahora: number,
): SeguimientoPrograma {
  const porGrupo = new Map<string, Set<string>>();
  for (const v of valoraciones) {
    if (!porGrupo.has(v.grupoId)) porGrupo.set(v.grupoId, new Set());
    porGrupo.get(v.grupoId)!.add(v.studentId);
  }

  const filas: SeguimientoCentro[] = centros.map((c) => {
    const estado = estados.get(c.grupoId) ?? null;
    const hasta = estado?.reabiertoHasta ?? null;
    // Solo cuentan las valoraciones de estudiantes que SIGUEN inscritos: si a uno lo
    // trasladaron de centro, su valoracion vieja no puede hacer que el centro parezca
    // mas adelantado de lo que esta.
    const inscritos = c.miembros ?? [];
    const puestas = porGrupo.get(c.grupoId) ?? new Set<string>();
    return {
      grupoId: c.grupoId,
      nombre: c.nombre,
      lider: c.lider,
      inscritos: inscritos.length,
      valorados: inscritos.filter((id) => puestas.has(id)).length,
      entregado: estado?.entregado === true,
      reabiertoVigente: estado?.entregado === true && (hasta ?? 0) > ahora,
      reabiertoHasta: hasta,
    };
  });

  filas.sort((a, b) => {
    if (a.entregado !== b.entregado) return a.entregado ? 1 : -1;
    const faltanA = a.inscritos - a.valorados;
    const faltanB = b.inscritos - b.valorados;
    if (faltanA !== faltanB) return faltanB - faltanA;
    return a.nombre.localeCompare(b.nombre, 'es');
  });

  return {
    centros: filas,
    entregados: filas.filter((f) => f.entregado).length,
    total: filas.length,
    faltan: filas.reduce((s, f) => s + (f.inscritos - f.valorados), 0),
  };
}

// ---------------------------------------------------------------------------
//  Lo que ve el director: sus 33, vengan del centro que vengan
// ---------------------------------------------------------------------------

export interface FilaConsolidada {
  studentId: string;
  apellidos: string;
  nombres: string;
  /** La valoracion, o null si su lider todavia no la puso. */
  valoracion: ValoracionEstudiante | null;
  /** Nombre del centro, cuando se conoce. */
  centro: string | null;
  /**
   * DOS valoraciones para el mismo estudiante: esta inscrito en dos centros y los dos
   * lideres lo valoraron. No se escoge una — se enseñan las dos y que lo resuelva quien
   * sabe. Vacio en el caso normal.
   */
  duplicadas: ValoracionEstudiante[];
  /**
   * Se SABE que no esta inscrito en ningun centro: no hay nada que esperar de el.
   *
   * Solo puede ser cierto cuando quien llama conoce las inscripciones. El DIRECTOR no las
   * conoce —no puede leer los centros ajenos, y no debe—, asi que para el esto es siempre
   * falso y la fila se queda en "sin valoracion", sin afirmar de mas. Ver `consolidarGrupo`.
   */
  sinCentro: boolean;
}

/**
 * Cruza los estudiantes del grupo con lo que hayan escrito los lideres.
 *
 * `nombreDeCentro` traduce grupoId -> nombre cuando el director puede conocerlo; si no,
 * la fila sale sin centro y no pasa nada: lo que el director necesita para digitar es el
 * numero y los codigos.
 */
export function consolidarGrupo(
  estudiantes: { studentId: string; apellidos: string; nombres: string }[],
  valoraciones: ValoracionEstudiante[],
  /**
   * Quien esta inscrito en algun centro, si se sabe.
   *
   * `null` = NO SE SABE, y es el caso del director de grupo: las reglas no le dejan leer
   * los centros de sus estudiantes. Entonces no se puede distinguir "su lider no lo ha
   * valorado" de "no esta en ningun centro", y la pantalla NO debe inventarse cual es:
   * dice "sin valoracion" y ya. Para el director la accion es la misma en los dos casos
   * —preguntarle a la coordinacion del programa—, asi que la distincion es comoda, no
   * imprescindible.
   */
  inscritos: Set<string> | null,
  nombreDeCentro?: (grupoId: string) => string | null,
): FilaConsolidada[] {
  const porEstudiante = new Map<string, ValoracionEstudiante[]>();
  for (const v of valoraciones) {
    const lista = porEstudiante.get(v.studentId);
    if (lista) lista.push(v);
    else porEstudiante.set(v.studentId, [v]);
  }

  return [...estudiantes].sort(compararEstudiantes).map((e) => {
    const suyas = porEstudiante.get(e.studentId) ?? [];
    const principal = suyas[0] ?? null;
    return {
      studentId: e.studentId,
      apellidos: e.apellidos,
      nombres: e.nombres,
      valoracion: principal,
      centro: principal && nombreDeCentro ? nombreDeCentro(principal.grupoId) : null,
      duplicadas: suyas.length > 1 ? suyas : [],
      sinCentro: inscritos !== null && !inscritos.has(e.studentId),
    };
  });
}

export interface ResumenConsolidado {
  total: number;
  valorados: number;
  /** Inscritos en algun centro a los que todavia les falta la valoracion. */
  pendientes: number;
  sinCentro: number;
  conDuplicado: number;
  planDeApoyo: number;
}

export function resumirConsolidado(filas: FilaConsolidada[]): ResumenConsolidado {
  return {
    total: filas.length,
    valorados: filas.filter((f) => f.valoracion).length,
    pendientes: filas.filter((f) => !f.valoracion && !f.sinCentro).length,
    sinCentro: filas.filter((f) => f.sinCentro).length,
    conDuplicado: filas.filter((f) => f.duplicadas.length > 0).length,
    planDeApoyo: filas.filter((f) => f.valoracion?.nivel === PLAN_DE_APOYO).length,
  };
}
