/**
 * Restaurante — vaso de leche y restaurante. Logica pura del servicio de alimentacion.
 *
 * LA DECISION QUE MANDA (ver la cabecera de la seccion "Restaurante" en types.ts): esto
 * NO es asistencia y NO restringe. La lista oficial de inscritos no decide quien puede
 * pasar; existe solo para poder CONTRASTAR al final. Por eso aqui no hay ninguna funcion
 * que valide "puede pasar": un registro de alguien que no esta inscrito no es un error,
 * es justo el dato que el proveedor necesita ver.
 *
 * Lo que se le entrega al proveedor son dos cosas: quienes fueron y cuantas veces, y el
 * contraste contra la lista oficial. Nada de tasas ni denominadores — no existe el
 * "deberia haber pasado".
 */

import { gradoSortKey, jornadaDeGrado } from './ids';
import type {
  InscritoRestaurante,
  RegistroRestaurante,
  Sede,
  ServicioRestaurante,
} from './types';

// ---------------------------------------------------------------------------
//  Ids deterministas
// ---------------------------------------------------------------------------

/** Caracteres que Firestore no admite en un id de documento. Igual que en ids.ts. */
const INVALID_ID = /\//;

/** Valida un fragmento antes de usarlo como parte de un id. */
function assertUsableInId(part: string, campo: string): string {
  const v = (part ?? '').trim();
  if (!v) throw new Error(`${campo} vacio: no se puede construir el id`);
  if (INVALID_ID.test(v)) throw new Error(`${campo} contiene '/', prohibido en un id de Firestore: ${v}`);
  if (v === '.' || v === '..') throw new Error(`${campo} no puede ser '.' ni '..'`);
  if (/^__.*__$/.test(v)) throw new Error(`${campo} no puede tener el patron __algo__: ${v}`);
  return v;
}

/**
 * Un paso por el servicio: `central_vaso_leche_2026-08-27_est_0412`.
 *
 * DETERMINISTA A PROPOSITO. En la fila del refrigerio es normal escanear dos veces al
 * mismo estudiante (el lector pita, nadie oye, se vuelve a pasar). Con el id calculado
 * el segundo escaneo sobrescribe el primero y el conteo sigue en 1; con un id aleatorio
 * serian dos documentos, y el reporte cuenta documentos: el proveedor recibiria una
 * comida de mas que nadie sirvio.
 *
 * El SERVICIO forma parte de la identidad porque el mismo estudiante puede pasar el
 * mismo dia por los dos: el vaso de leche es del primer descanso y el restaurante del
 * final de la jornada. Son dos pasos reales y deben contar dos veces.
 *
 * La SEDE tambien, por la misma razon que en `sessionId`: hoy los studentId no se
 * repiten entre sedes, pero eso es una convencion que nadie garantiza por escrito.
 */
export function registroRestauranteId(
  sede: string,
  servicio: ServicioRestaurante,
  fecha: string,
  studentId: string,
): string {
  assertUsableInId(sede, 'sede');
  assertUsableInId(servicio, 'servicio');
  assertUsableInId(fecha, 'fecha');
  assertUsableInId(studentId, 'studentId');
  return `${sede}_${servicio}_${fecha}_${studentId}`;
}

/**
 * La inscripcion oficial: `2026_central_est_0412`.
 *
 * EL SERVICIO NO VA EN EL ID, y es una decision, no un olvido (la ruta esta fijada asi
 * en types.ts). Consecuencia: un estudiante tiene UNA inscripcion por anio y sede. Si el
 * colegio lo sube en las dos listas de Excel, la segunda carga sobrescribe a la primera
 * en vez de crear dos documentos, y ese estudiante queda como inscrito en el servicio de
 * la carga mas reciente.
 *
 * Se acepta porque la inscripcion NO restringe: aunque quede registrado en el servicio
 * "equivocado", puede pasar por los dos igual, y el contraste lo mostrara como
 * "inscritos que usaron el otro servicio" — visible, no perdido. Un id por servicio
 * habria hecho el contraste mas fino a cambio de dejar que un mismo estudiante ocupara
 * dos cupos oficiales sin que nadie lo notara al cargar el Excel.
 */
export function inscritoRestauranteId(anio: number, sede: string, studentId: string): string {
  if (!Number.isInteger(anio) || anio < 2000 || anio > 2100) {
    throw new Error(`anio fuera de rango: ${anio}`);
  }
  assertUsableInId(sede, 'sede');
  assertUsableInId(studentId, 'studentId');
  return `${anio}_${sede}_${studentId}`;
}

// ---------------------------------------------------------------------------
//  Resumen por estudiante
// ---------------------------------------------------------------------------

export interface ResumenEstudianteRestaurante {
  studentId: string;
  /** Grado LITERAL, sin sanear: '9.1' es manana y '6º1' es tarde. */
  grado: string;
  sede: Sede;
  /** Pasos por el refrigerio del primer descanso. */
  vasoLeche: number;
  /** Pasos por el menu del final de la jornada. */
  restaurante: number;
  /** vasoLeche + restaurante. Es lo que factura el proveedor. */
  total: number;
  /** Servicio de la lista oficial, o `null` si no esta inscrito en ninguno. */
  inscritoEn: ServicioRestaurante | null;
}

/**
 * Un registro anulado no existe para ningun conteo. Se conserva el documento (baja
 * logica, como en todo el modulo) precisamente para poder auditar despues por que la
 * cifra bajo, pero la cifra ya no lo incluye.
 */
function cuenta(r: RegistroRestaurante): boolean {
  return r.anulado !== true;
}

/**
 * Una inscripcion dada de baja no es lista oficial. Si se dejara contar, un estudiante
 * retirado del programa aparecería como "inscrito que nunca uso el servicio" y el
 * proveedor leeria un cupo desperdiciado que ya no existe.
 */
function inscripcionVigente(i: InscritoRestaurante): boolean {
  return i.activo === true;
}

/**
 * Indexa la lista oficial por studentId. Como el id no lleva el servicio (ver
 * `inscritoRestauranteId`), dos filas del mismo estudiante son la misma inscripcion
 * cargada dos veces: gana la mas reciente por `cargadoEn`. Se desempata por nombre de
 * servicio para que el resultado no dependa del orden en que Firestore devolvio los
 * documentos — dos ejecuciones sobre los mismos datos deben dar el mismo reporte.
 */
function indexarInscritos(inscritos: InscritoRestaurante[]): Map<string, InscritoRestaurante> {
  const porEstudiante = new Map<string, InscritoRestaurante>();
  for (const i of inscritos) {
    if (!inscripcionVigente(i)) continue;
    const previo = porEstudiante.get(i.studentId);
    if (
      !previo ||
      i.cargadoEn > previo.cargadoEn ||
      (i.cargadoEn === previo.cargadoEn && i.servicio > previo.servicio)
    ) {
      porEstudiante.set(i.studentId, i);
    }
  }
  return porEstudiante;
}

/**
 * Una fila por cada estudiante que aparezca en CUALQUIERA de los dos lados: paso alguna
 * vez, o esta en la lista oficial, o las dos cosas. Los tres casos importan — el que
 * paso sin estar inscrito tanto como el inscrito que nunca aparecio.
 *
 * El grado y la sede se toman del registro mas reciente cuando lo hay: el registro los
 * lleva denormalizados y refleja donde estaba el estudiante ese dia, mientras que la
 * lista oficial se cargo a principio de anio y puede haber quedado atras si cambio de
 * grupo.
 *
 * Orden estable por grado y luego studentId: la pantalla y el export deben ver siempre
 * lo mismo.
 */
export function resumenPorEstudiante(
  registros: RegistroRestaurante[],
  inscritos: InscritoRestaurante[],
): ResumenEstudianteRestaurante[] {
  const oficiales = indexarInscritos(inscritos);
  const filas = new Map<string, ResumenEstudianteRestaurante>();
  /** Fecha del registro con el que se fijo grado/sede de cada fila. */
  const frescura = new Map<string, string>();

  for (const [studentId, i] of oficiales) {
    filas.set(studentId, {
      studentId,
      grado: i.grado,
      sede: i.sede,
      vasoLeche: 0,
      restaurante: 0,
      total: 0,
      inscritoEn: i.servicio,
    });
  }

  for (const r of registros) {
    if (!cuenta(r)) continue;
    let fila = filas.get(r.studentId);
    if (!fila) {
      fila = {
        studentId: r.studentId,
        grado: r.grado,
        sede: r.sede,
        vasoLeche: 0,
        restaurante: 0,
        total: 0,
        inscritoEn: null,
      };
      filas.set(r.studentId, fila);
    }
    if (r.servicio === 'vaso_leche') fila.vasoLeche++;
    else fila.restaurante++;
    fila.total++;

    // 'YYYY-MM-DD' ordena como cadena igual que el calendario, asi que no hace falta
    // convertirlo a Date (que ademas se corre un dia en Colombia; ver ids.ts).
    const anterior = frescura.get(r.studentId);
    if (anterior === undefined || r.fecha >= anterior) {
      fila.grado = r.grado;
      fila.sede = r.sede;
      frescura.set(r.studentId, r.fecha);
    }
  }

  return [...filas.values()].sort(
    (a, b) =>
      gradoSortKey(a.grado).localeCompare(gradoSortKey(b.grado)) ||
      a.studentId.localeCompare(b.studentId),
  );
}

// ---------------------------------------------------------------------------
//  Contraste con la lista oficial — el reporte del proveedor
// ---------------------------------------------------------------------------

export interface FilaContraste {
  studentId: string;
  grado: string;
  sede: Sede;
  /** Servicio en el que figura en la lista oficial, si figura. */
  inscritoEn: ServicioRestaurante | null;
  vasoLeche: number;
  restaurante: number;
  total: number;
  /** Veces que uso el servicio en el que esta inscrito. 0 si no esta inscrito. */
  usosServicioInscrito: number;
  /** Veces que uso el servicio en el que NO esta inscrito. */
  usosOtroServicio: number;
}

export interface ContrasteRestaurante {
  /** Inscritos que usaron el servicio en el que figuran. */
  inscritosQueUsaron: FilaContraste[];
  /** Inscritos que no aparecieron por ningun servicio. */
  inscritosQueNuncaUsaron: FilaContraste[];
  /**
   * Los que pasaron sin figurar en ninguna lista. Es el grupo que interesa: la comida
   * que sobra se entrega igual, y esto es lo unico que deja constancia de a quien.
   */
  usaronSinEstarInscritos: FilaContraste[];
  /** Inscritos en un servicio que solo usaron el otro. */
  inscritosQueUsaronOtroServicio: FilaContraste[];
  /**
   * Los mismos numeros que las listas, para encabezados y tarjetas. La pantalla necesita
   * las dos cosas y recalcular longitudes en cada render es como se cuelan las
   * discrepancias entre el titular y la tabla.
   */
  conteos: {
    inscritosTotal: number;
    inscritosQueUsaron: number;
    inscritosQueNuncaUsaron: number;
    usaronSinEstarInscritos: number;
    inscritosQueUsaronOtroServicio: number;
    /** Comidas servidas, sin anulados. Es la cifra que se cruza con el proveedor. */
    usosTotales: number;
    usosVasoLeche: number;
    usosRestaurante: number;
    /** Personas distintas que pasaron, inscritas o no. Nunca es igual a `usosTotales`. */
    estudiantesQuePasaron: number;
  };
}

/**
 * El reporte que pidio el proveedor.
 *
 * Los cuatro grupos son MUTUAMENTE EXCLUYENTES a proposito: cada estudiante cae en uno
 * solo, y los tres de inscritos suman exactamente `inscritosTotal`. Si un inscrito
 * pudiera salir a la vez en "uso" y en "uso el otro servicio", el que lea el reporte
 * sumaria filas y le saldrian mas personas de las que hay.
 *
 * Un inscrito que uso su servicio Y ademas el otro cuenta como "uso" (lo esperado ya
 * ocurrio); sus pasos por el otro servicio quedan igualmente visibles en
 * `usosOtroServicio` de su fila, no se pierden.
 */
export function contrasteConListaOficial(
  registros: RegistroRestaurante[],
  inscritos: InscritoRestaurante[],
): ContrasteRestaurante {
  const resumen = resumenPorEstudiante(registros, inscritos);

  const inscritosQueUsaron: FilaContraste[] = [];
  const inscritosQueNuncaUsaron: FilaContraste[] = [];
  const usaronSinEstarInscritos: FilaContraste[] = [];
  const inscritosQueUsaronOtroServicio: FilaContraste[] = [];

  let usosVasoLeche = 0;
  let usosRestaurante = 0;
  let estudiantesQuePasaron = 0;
  let inscritosTotal = 0;

  for (const r of resumen) {
    const usosServicioInscrito =
      r.inscritoEn === 'vaso_leche' ? r.vasoLeche : r.inscritoEn === 'restaurante' ? r.restaurante : 0;
    const usosOtroServicio = r.inscritoEn === null ? 0 : r.total - usosServicioInscrito;

    const fila: FilaContraste = {
      studentId: r.studentId,
      grado: r.grado,
      sede: r.sede,
      inscritoEn: r.inscritoEn,
      vasoLeche: r.vasoLeche,
      restaurante: r.restaurante,
      total: r.total,
      usosServicioInscrito,
      usosOtroServicio,
    };

    usosVasoLeche += r.vasoLeche;
    usosRestaurante += r.restaurante;
    if (r.total > 0) estudiantesQuePasaron++;
    if (r.inscritoEn !== null) inscritosTotal++;

    if (r.inscritoEn === null) {
      // Sin inscripcion y sin pasos no existe: nadie lo pone en una lista de la nada.
      if (r.total > 0) usaronSinEstarInscritos.push(fila);
    } else if (usosServicioInscrito > 0) {
      inscritosQueUsaron.push(fila);
    } else if (r.total > 0) {
      inscritosQueUsaronOtroServicio.push(fila);
    } else {
      inscritosQueNuncaUsaron.push(fila);
    }
  }

  return {
    inscritosQueUsaron,
    inscritosQueNuncaUsaron,
    usaronSinEstarInscritos,
    inscritosQueUsaronOtroServicio,
    conteos: {
      inscritosTotal,
      inscritosQueUsaron: inscritosQueUsaron.length,
      inscritosQueNuncaUsaron: inscritosQueNuncaUsaron.length,
      usaronSinEstarInscritos: usaronSinEstarInscritos.length,
      inscritosQueUsaronOtroServicio: inscritosQueUsaronOtroServicio.length,
      usosTotales: usosVasoLeche + usosRestaurante,
      usosVasoLeche,
      usosRestaurante,
      estudiantesQuePasaron,
    },
  };
}

// ---------------------------------------------------------------------------
//  Agrupacion por grado
// ---------------------------------------------------------------------------

export interface GrupoPorGrado<T> {
  /**
   * Grado LITERAL, tal como vino. '9.1' y '6º1' son DOS grupos distintos, de jornadas
   * distintas, y quitar la `º` para "normalizar" los fundiria en uno solo: un bug
   * silencioso que aparece semanas despues con cifras de la jornada equivocada.
   */
  grado: string;
  jornada: 'manana' | 'tarde';
  filas: T[];
}

/**
 * Agrupa cualquiera de las listas del reporte por grado, en el orden en que se leen los
 * grupos en el colegio (manana antes que tarde, y dentro de cada jornada por numero).
 * Generica porque la pantalla agrupa tanto el resumen como cada grupo del contraste, y
 * duplicar la funcion es como una de las dos copias se queda sin el arreglo.
 */
export function porGrado<T extends { grado: string }>(filas: T[]): GrupoPorGrado<T>[] {
  const grupos = new Map<string, GrupoPorGrado<T>>();
  for (const fila of filas) {
    let g = grupos.get(fila.grado);
    if (!g) {
      g = { grado: fila.grado, jornada: jornadaDeGrado(fila.grado), filas: [] };
      grupos.set(fila.grado, g);
    }
    g.filas.push(fila);
  }
  return [...grupos.values()].sort((a, b) =>
    gradoSortKey(a.grado).localeCompare(gradoSortKey(b.grado)),
  );
}
