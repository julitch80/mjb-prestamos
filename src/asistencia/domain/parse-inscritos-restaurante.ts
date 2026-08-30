/**
 * Lectura de la lista OFICIAL de inscritos al restaurante / vaso de leche, y su cruce
 * contra la matricula.
 *
 * Logica PURA: no toca ExcelJS ni Firestore. Recibe matrices de texto ya extraidas (la
 * pantalla las saca del archivo) y devuelve filas, igual que `parse-centros.ts`. Asi se
 * prueba sin un .xlsx de verdad y sin red.
 *
 * QUE ES ESTA LISTA Y QUE NO ES. No controla el acceso: no decide quien puede pasar por
 * la fila. Existe SOLO para poder contrastar despues quien uso el servicio y quien no
 * (ver la cabecera de la seccion "Restaurante" en `types.ts`). Por eso aqui no hay
 * ninguna validacion de cupo ni nada que rechace a nadie.
 *
 * FORMATO ESPERADO DEL ARCHIVO — y por que se busca en vez de asumirse:
 *
 *   Nadie ha visto todavia el archivo real que entrega el colegio, asi que NADA se da por
 *   supuesto. Lo unico que se exige es que en algun sitio de las primeras 8 filas de la
 *   hoja haya una fila de ENCABEZADOS con:
 *
 *     - una columna de nombres  — su titulo contiene «nombre»    ('Nombres', 'Nombre del estudiante')
 *     - una columna de apellidos — su titulo contiene «apellido»  ('Apellidos', 'Apellidos del estudiante')
 *     - opcionalmente una de grupo — «grupo» o «grado»            ('El grupo', 'Grado', 'Grupo')
 *
 *   Si no hay dos columnas separadas se acepta UNA SOLA columna con el nombre completo
 *   ('Estudiante', 'Apellidos y nombres', 'Alumno'), porque muchas listas del colegio
 *   vienen asi. Y si no se reconoce nada, la hoja se omite CON SU MOTIVO y la pantalla lo
 *   dice: es preferible avisar que adivinar la posicion de las columnas.
 *
 *   Las columnas se localizan por NOMBRE, nunca por posicion, y por el mismo motivo que
 *   en `parse-centros.ts`: en las listas reales del colegio los apellidos unas veces van
 *   antes y otras despues, y confundirlos invierte todos los nombres sin que salte ningun
 *   error.
 *
 * Los literales NO se sanean nunca: el grupo llega como '6°1' (grado, U+00B0), '6º1'
 * (ordinal, U+00BA) o '10-1', y la 'º' es justamente lo que distingue la jornada en MJB.
 * Convertir uno en otro aqui destruiria la unica prueba de lo que decia el archivo.
 */

import { cruzarCentros, type FilaCentro } from './import-centros';
import { inscritoRestauranteId } from './restaurante';
import type { HojaCruda } from './parse-centros';
import type {
  CandidatoPendiente,
  InscritoRestaurante,
  Sede,
  ServicioRestaurante,
  Student,
} from './types';

/** Como se nombra cada servicio en pantalla. El colegio los llama asi. */
export const ETIQUETA_SERVICIO: Record<ServicioRestaurante, string> = {
  vaso_leche: 'Vaso de leche',
  restaurante: 'Restaurante',
};

// ---------------------------------------------------------------------------
//  Lo que se saca del archivo
// ---------------------------------------------------------------------------

/** Una fila de la lista oficial, tal cual venia. */
export interface FilaInscrito {
  /** El grupo que dice el archivo. NO se cree: manda la matricula. Es evidencia. */
  grupoArchivo: string;
  nombres: string;
  apellidos: string;
}

export interface HojaInscritos {
  hoja: string;
  /** Indice (base 0) de la fila de encabezados dentro de la matriz. */
  filaEncabezados: number;
  filas: FilaInscrito[];
  /**
   * true = no habia columnas separadas y se leyo el nombre completo de una sola. El
   * nombre entero viaja en `apellidos` y `nombres` queda vacio, igual que hace
   * `aplicarDecisiones` en centros: el cruce compara la concatenacion de los dos campos,
   * asi que el resultado es identico y no hay que adivinar donde acaba el apellido.
   */
  nombreCombinado: boolean;
  /** Problemas de esta hoja que conviene mirar. No impiden importar. */
  avisos: string[];
}

export interface HojaOmitidaInscritos {
  hoja: string;
  motivo: string;
}

export interface ArchivoInscritos {
  hojas: HojaInscritos[];
  /** Todas las filas de todas las hojas, en orden de aparicion. */
  filas: FilaInscrito[];
  hojasOmitidas: HojaOmitidaInscritos[];
}

export class ArchivoInscritosNoReconocido extends Error {}

// ---------------------------------------------------------------------------
//  Encabezados
// ---------------------------------------------------------------------------

function normalizarEncabezado(s: string): string {
  return (s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

interface Columnas {
  /** -1 = la hoja no trae grupo. No impide nada: manda la matricula. */
  grupo: number;
  /** -1 solo en modo combinado. */
  nombres: number;
  /** En modo combinado, la columna del nombre completo. */
  apellidos: number;
  combinado: boolean;
}

/** Titulos con los que puede empezar una columna de nombre completo. */
const INICIO_NOMBRE = /^(NOMBRE|APELLIDO|ESTUDIANTE|ALUMNO)/;

function columnaGrupo(fila: string[]): number {
  for (let i = 0; i < fila.length; i++) {
    const n = normalizarEncabezado(fila[i]);
    if (n && (n.includes('GRUPO') || n.includes('GRADO'))) return i;
  }
  return -1;
}

/**
 * Columnas SEPARADAS de nombres y apellidos. Se mira «apellido» primero porque un titulo
 * como 'Apellidos y nombres del estudiante' es UNA sola columna con todo dentro, y darla
 * por la de nombres dejaria los apellidos sin leer.
 */
function columnasSeparadas(fila: string[]): Columnas | null {
  let nombres = -1;
  let apellidos = -1;
  fila.forEach((celda, i) => {
    const n = normalizarEncabezado(celda);
    if (!n) return;
    if (apellidos < 0 && n.includes('APELLIDO')) apellidos = i;
    else if (nombres < 0 && n.includes('NOMBRE')) nombres = i;
  });
  if (nombres < 0 || apellidos < 0) return null;
  return { grupo: columnaGrupo(fila), nombres, apellidos, combinado: false };
}

/**
 * Una sola columna con el nombre completo.
 *
 * Se exige que el titulo EMPIECE por «nombre», «apellido», «estudiante» o «alumno», y no
 * solo que lo contenga, para no confundir el titulo de la hoja con un encabezado: un
 * 'LISTA DE INSCRITOS - NOMBRES' en una celda combinada de la fila 1 llenaria la lista de
 * basura y ademas se comeria la fila de encabezados de verdad, que esta debajo.
 */
function columnaCombinada(fila: string[]): Columnas | null {
  for (let i = 0; i < fila.length; i++) {
    const n = normalizarEncabezado(fila[i]);
    if (n && INICIO_NOMBRE.test(n)) {
      return { grupo: columnaGrupo(fila), nombres: -1, apellidos: i, combinado: true };
    }
  }
  return null;
}

/** Hasta que fila se busca el encabezado. */
const MAX_FILAS_ENCABEZADO = 8;

/**
 * Busca la fila de encabezados en la ventana inicial de la hoja.
 *
 * DOS PASADAS, y el orden importa: primero se busca en toda la ventana una fila con las
 * dos columnas separadas, y solo si no aparece ninguna se acepta una columna combinada.
 * Al reves, un titulo de la fila 1 que diga 'NOMBRES DE LOS INSCRITOS' se tomaria por
 * encabezado y la fila de encabezados real —la que si separa nombres y apellidos— pasaria
 * a leerse como si fuera un estudiante.
 */
function localizarEncabezados(matriz: string[][]): { fila: number; columnas: Columnas } | null {
  const hasta = Math.min(matriz.length, MAX_FILAS_ENCABEZADO);
  for (let i = 0; i < hasta; i++) {
    const c = columnasSeparadas(matriz[i] ?? []);
    if (c) return { fila: i, columnas: c };
  }
  for (let i = 0; i < hasta; i++) {
    const c = columnaCombinada(matriz[i] ?? []);
    if (c) return { fila: i, columnas: c };
  }
  return null;
}

/**
 * ¿Esta fila de datos es en realidad otro encabezado repetido?
 *
 * Las listas del colegio suelen repetir la cabecera al empezar cada grupo. Si se colara,
 * se intentaria cruzar a un estudiante llamado «Apellidos» contra la matricula y saldria
 * un no encontrado que nadie entiende.
 */
function pareceEncabezadoRepetido(nombres: string, apellidos: string): boolean {
  const n = normalizarEncabezado(`${apellidos} ${nombres}`);
  return n !== '' && INICIO_NOMBRE.test(n) && !/\d/.test(n);
}

// ---------------------------------------------------------------------------
//  Lectura de una hoja
// ---------------------------------------------------------------------------

export function leerHojaInscritos(hoja: HojaCruda): HojaInscritos | HojaOmitidaInscritos {
  const matriz = hoja.matriz ?? [];
  const encontrado = localizarEncabezados(matriz);

  if (!encontrado) {
    return {
      hoja: hoja.nombre,
      motivo:
        'No se encontró la fila de encabezados (se buscaron columnas de «Nombres» y ' +
        '«Apellidos», o una sola de «Estudiante», en las primeras 8 filas). La hoja se ' +
        'omite entera.',
    };
  }

  const { fila: filaEncabezados, columnas } = encontrado;
  const avisos: string[] = [];
  if (columnas.combinado) {
    avisos.push(
      'La hoja no separa nombres y apellidos: se lee el nombre completo de una sola ' +
        'columna. No afecta al cruce, que compara el nombre entero.',
    );
  }
  if (columnas.grupo < 0) {
    avisos.push(
      'La hoja no trae columna de grupo. No impide cruzar —manda la matrícula—, pero el ' +
        'grupo es lo único que desempata a dos estudiantes con el mismo nombre.',
    );
  }

  const filas: FilaInscrito[] = [];
  let sinNombre = 0;
  let sinGrupo = 0;
  let encabezadosRepetidos = 0;

  for (let i = filaEncabezados + 1; i < matriz.length; i++) {
    const f = matriz[i] ?? [];
    const nombres = columnas.nombres >= 0 ? (f[columnas.nombres] ?? '').trim() : '';
    const apellidos = (f[columnas.apellidos] ?? '').trim();

    // Las filas totalmente vacias son la cola en blanco del archivo, no un error.
    if (!nombres && !apellidos) {
      if (f.some((c) => (c ?? '').trim() !== '')) sinNombre += 1;
      continue;
    }
    if (pareceEncabezadoRepetido(nombres, apellidos)) {
      encabezadosRepetidos += 1;
      continue;
    }

    // El grupo viaja LITERAL: '6°1', '10-1'. No se sanea (regla del cruce).
    const grupoArchivo = columnas.grupo >= 0 ? (f[columnas.grupo] ?? '').trim() : '';
    if (columnas.grupo >= 0 && !grupoArchivo) sinGrupo += 1;
    filas.push({ grupoArchivo, nombres, apellidos });
  }

  if (sinNombre > 0) avisos.push(`${sinNombre} fila(s) con datos pero sin nombre: se descartan.`);
  if (sinGrupo > 0) avisos.push(`${sinGrupo} fila(s) sin grupo.`);
  if (encabezadosRepetidos > 0) {
    avisos.push(`${encabezadosRepetidos} fila(s) que repetían el encabezado: se saltan.`);
  }
  if (filas.length === 0) {
    return { hoja: hoja.nombre, motivo: 'La hoja no tiene ninguna fila con nombre.' };
  }

  return {
    hoja: hoja.nombre,
    filaEncabezados,
    filas,
    nombreCombinado: columnas.combinado,
    avisos,
  };
}

function esOmitida(x: HojaInscritos | HojaOmitidaInscritos): x is HojaOmitidaInscritos {
  return (x as HojaOmitidaInscritos).motivo !== undefined;
}

/**
 * Lee el libro entero. Una hoja rota se OMITE con su motivo en vez de tumbar el archivo:
 * perder una hoja y saberlo es mejor que no poder cargar las demas. Es la misma decision
 * que en `leerArchivoCentros`.
 */
export function leerArchivoInscritos(hojas: HojaCruda[]): ArchivoInscritos {
  const buenas: HojaInscritos[] = [];
  const hojasOmitidas: HojaOmitidaInscritos[] = [];

  for (const h of hojas) {
    const r = leerHojaInscritos(h);
    if (esOmitida(r)) hojasOmitidas.push(r);
    else buenas.push(r);
  }

  if (buenas.length === 0) {
    throw new ArchivoInscritosNoReconocido(
      'Ninguna hoja del archivo tiene la forma esperada: una fila de encabezados con ' +
        '«Nombres» y «Apellidos» (o una sola columna con el nombre completo) y, si la ' +
        'hay, «Grupo». ¿Es la lista oficial de inscritos?',
    );
  }

  return { hojas: buenas, filas: buenas.flatMap((h) => h.filas), hojasOmitidas };
}

// ---------------------------------------------------------------------------
//  Cruce contra la matricula
// ---------------------------------------------------------------------------

/** Una fila que si se pudo ubicar en la matricula. */
export interface UbicadoInscrito {
  studentId: string;
  /** El nombre tal cual venia en el archivo, sin sanear: es la evidencia. */
  nombreArchivo: string;
  grupoArchivo: string;
  /** El grado de la MATRICULA, literal. Es el que vale y el que se guarda. */
  gradoMatricula: string;
  /** true = el archivo decía otro grado. Solo se informa; no cambia nada. */
  gradoDistinto: boolean;
}

export type MotivoNoUbicado = 'no_encontrado' | 'homonimo' | 'ortografia';

/**
 * Una fila que NO se pudo ubicar sola. No se descarta: viaja con sus candidatos para que
 * la pantalla los enseñe y una persona decida. Es la cuarta regla del cruce.
 */
export interface NoUbicadoInscrito {
  /** Posicion de la fila dentro del archivo. Clave estable para la pantalla. */
  indice: number;
  nombreArchivo: string;
  grupoArchivo: string;
  motivo: MotivoNoUbicado;
  candidatos: CandidatoPendiente[];
  /** La propuesta del cruce, si la sostiene. `null` = no hay ninguna. */
  sugerido: string | null;
  /** true = una persona ya eligió a quién corresponde esta fila en la vista previa. */
  resuelto: boolean;
}

/** Lo que se va a escribir: un `InscritoRestaurante` al que le falta la firma de quien carga. */
export type BorradorInscrito = Omit<InscritoRestaurante, 'cargadoPor' | 'cargadoEn'>;

export interface ResultadoInscritos {
  /** Listos para `guardarInscritosRestaurante`. Uno por estudiante, sin repetidos. */
  inscritos: BorradorInscrito[];
  ubicados: UbicadoInscrito[];
  noUbicados: NoUbicadoInscrito[];
  /**
   * De `noUbicados`, los que siguen sin decidir. Es el numero que se enseña en la vista
   * previa: uno ya resuelto a mano no puede seguir contando como pendiente, o el titular
   * diria que faltan casos que ya no faltan.
   */
  sinResolver: number;
  /** Filas del archivo que traian a un estudiante ya ubicado por otra fila. */
  repetidos: number;
}

export interface OpcionesInscritos {
  sede: Sede;
  anio: number;
  servicio: ServicioRestaurante;
}

/**
 * Nombre del "centro" ficticio con el que se invoca el cruce de centros de interes.
 * Nunca se guarda en ningun sitio: solo existe porque `cruzarCentros` agrupa por centro.
 */
const CENTRO_FICTICIO = 'inscritos-restaurante';

/**
 * Cruza la lista oficial contra la matricula.
 *
 * REUTILIZA `cruzarCentros` en vez de reimplementar el emparejamiento, y es una decision:
 * ese criterio ya se midio contra los dos archivos reales de centros de interes
 * (`docs/modelo-centros-interes.md`) y ya sabe las tres reglas de oro —manda la
 * matricula, se busca en TODO el colegio, el grado solo desempata homonimos—. Una segunda
 * copia de la distancia de Levenshtein y de los umbrales seria la que se quedaria sin el
 * proximo arreglo.
 *
 * Se le pasa `exclusivo: false` a proposito: alli sirve para impedir que un estudiante
 * este en dos centros a la vez, y aqui no hay dos listas compitiendo —es una sola— asi
 * que una fila repetida no es un conflicto que decidir, solo una fila repetida. Se cuenta
 * en `repetidos` y se escribe una sola inscripcion.
 *
 * `aceptados` son las decisiones que YA tomo la persona en la vista previa: fila del
 * archivo (por indice) -> studentId. Sin eso, un nombre mal escrito no se podria inscribir
 * nunca sin corregir el Excel. Nada entra por parecido: el cruce propone, la persona firma.
 */
export function cruzarInscritos(
  filas: FilaInscrito[],
  matricula: Student[],
  opciones: OpcionesInscritos,
  aceptados: Map<number, string> = new Map(),
): ResultadoInscritos {
  const { sede, anio, servicio } = opciones;

  const comoCentro: FilaCentro[] = filas.map((f) => ({
    centro: CENTRO_FICTICIO,
    grupoArchivo: f.grupoArchivo,
    nombres: f.nombres,
    apellidos: f.apellidos,
  }));

  const cruce = cruzarCentros(comoCentro, matricula, {
    programaId: CENTRO_FICTICIO,
    exclusivo: false,
  });

  const ubicados: UbicadoInscrito[] = cruce.resueltos.map((r) => ({
    studentId: r.studentId,
    nombreArchivo: r.nombreArchivo,
    grupoArchivo: r.grupoArchivo,
    gradoMatricula: r.gradoMatricula,
    gradoDistinto: r.gradoDistinto,
  }));

  // El indice de cada pendiente dentro del archivo: `cruzarCentros` no lo devuelve, pero
  // conserva el orden y el nombre del archivo. Se busca la fila por nombre, saltando las
  // ya usadas, para que dos filas con el mismo nombre no compartan la misma casilla de
  // decision — si la compartieran, aceptar una aceptaria la otra sin que nadie lo viera.
  const usados = new Set<number>();
  const indiceDe = (nombreArchivo: string): number => {
    for (let i = 0; i < comoCentro.length; i++) {
      if (usados.has(i)) continue;
      const nombre = `${(comoCentro[i].apellidos ?? '').trim()} ${(comoCentro[i].nombres ?? '').trim()}`.trim();
      if (nombre === nombreArchivo) {
        usados.add(i);
        return i;
      }
    }
    return -1;
  };

  const noUbicados: NoUbicadoInscrito[] = cruce.pendientes
    // `duplicado` no puede salir con `exclusivo: false`, pero si algun dia saliera no
    // seria un caso de identidad y no tiene sentido preguntarlo aqui.
    .filter((p) => p.tipo !== 'duplicado')
    .map((p) => ({
      indice: indiceDe(p.nombreArchivo),
      nombreArchivo: p.nombreArchivo,
      grupoArchivo: p.grupoArchivo,
      motivo: p.tipo as MotivoNoUbicado,
      candidatos: p.candidatos,
      sugerido: p.sugerido,
      resuelto: false,
    }));

  // Grado de cada estudiante de la matricula: el que se guarda es SIEMPRE el de la
  // matricula, nunca el del archivo (regla 1 del cruce).
  const gradoDe = new Map(matricula.map((e) => [e.studentId, e.gradoActual]));

  const inscritos: BorradorInscrito[] = [];
  const yaInscrito = new Set<string>();
  let repetidos = 0;

  const anotar = (studentId: string): void => {
    const grado = gradoDe.get(studentId);
    // Un studentId que no esta en la matricula que se paso no se puede inscribir: no hay
    // grado que denormalizar y el reporte lo mostraria sin grupo.
    if (grado === undefined) return;
    if (yaInscrito.has(studentId)) {
      repetidos += 1;
      return;
    }
    yaInscrito.add(studentId);
    inscritos.push({
      inscritoId: inscritoRestauranteId(anio, sede, studentId),
      studentId,
      grado,
      sede,
      anio,
      servicio,
      activo: true,
    });
  };

  for (const u of ubicados) anotar(u.studentId);
  let sinResolver = 0;
  for (const n of noUbicados) {
    const elegido = aceptados.get(n.indice);
    if (elegido) {
      anotar(elegido);
      n.resuelto = true;
    } else {
      sinResolver += 1;
    }
  }

  return { inscritos, ubicados, noUbicados, sinResolver, repetidos };
}

/** Resumen para el titular de la vista previa. */
export function resumirInscritos(r: ResultadoInscritos): {
  inscribiria: number;
  sinResolver: number;
  repetidos: number;
  /** Solo los que siguen sin decidir: los ya resueltos a mano no son un problema. */
  porMotivo: Record<MotivoNoUbicado, number>;
} {
  const porMotivo: Record<MotivoNoUbicado, number> = {
    no_encontrado: 0,
    homonimo: 0,
    ortografia: 0,
  };
  for (const n of r.noUbicados) {
    if (!n.resuelto) porMotivo[n.motivo] += 1;
  }
  return {
    inscribiria: r.inscritos.length,
    sinResolver: r.sinResolver,
    repetidos: r.repetidos,
    porMotivo,
  };
}
