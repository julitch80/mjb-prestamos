/**
 * Lectura de los archivos de Excel de las listas de centros de interes.
 *
 * Es el paso PREVIO a `cruzarCentros` (import-centros.ts): aqui no se busca a nadie en la
 * matricula ni se decide nada, solo se convierte la hoja en `FilaCentro[]`. Se separa
 * igual que `import-parse.ts` se separa de `import-matching.ts`, y por el mismo motivo:
 * este modulo no toca ExcelJS ni Firestore —recibe matrices de texto ya extraidas—, asi
 * que se prueba sin archivos y sin red.
 *
 * LO QUE MIDIERON LOS DOS ARCHIVOS REALES (2026-08-24, mañana 11 hojas / 287 filas y
 * tarde 10 hojas / 341 filas). Nada de esto es una suposicion:
 *
 *  1. **Una hoja por centro de interes**, y el nombre de la hoja NO sirve: Excel lo trunca
 *     a 31 caracteres (`Élite Digital El Código Invisib`) y a veces ni siquiera es el
 *     nombre (`Recuperado_Hoja1`, cuyo centro es `Música en el 'J'`). El nombre real esta
 *     en el TITULO de la fila 1, repetido en las cinco columnas por celdas combinadas.
 *  2. **Los encabezados no se asumen por posicion.** Estan en la fila 2 en los dos
 *     archivos, pero se BUSCAN, y las columnas se localizan por nombre. El orden es
 *     `El número | El grupo | Nombres | Apellidos`: los apellidos van DESPUES, que es al
 *     reves de casi todo lo demas del colegio, y confundirlos invierte todos los nombres
 *     sin que salte ningun error.
 *  3. **El nombre del lider viene dentro del titulo, con separadores inconsistentes**:
 *     `Escénicas- Doris Castrillón`, `"AL PING AL PONG: TENIS DE MESA" - Adolfo Arango`,
 *     `CUERPO Y MENTE EN ACCIÓN" (HAROLD GOMEZ)`, `VOLEIBOL` (sin lider ninguno). Se
 *     intenta extraer, pero ante la duda se deja VACIO y lo pide la pantalla: adivinar mal
 *     a quien se le asigna un centro es peor que preguntar.
 *  4. **El grupo del archivo no se cree.** En la hoja `CAPTURANDO PAISAJES` de la tarde,
 *     16 de 28 grupos estaban mal y sin patron. Aqui viaja LITERAL —es la evidencia— y es
 *     `cruzarCentros` quien ya sabe que solo sirve para desempatar.
 *
 * Los literales no se sanean nunca: el grupo llega como `6°1` (grado, U+00B0) o `10-1`, y
 * en la matricula la tarde se escribe `6º1` (ordinal, U+00BA). Convertir uno en otro aqui
 * seria destruir la unica prueba de lo que decia el archivo.
 */

import { jornadaDeNumeroDeGrado } from './grados';
import { slugGrupo } from './programas';
import type { FilaCentro } from './import-centros';
import type { Jornada } from './types';

/** Una hoja del libro, ya volcada a texto plano (usar `cell.text`, nunca `cell.value`). */
export interface HojaCruda {
  /** Nombre de la pestaña. Truncado a 31 caracteres por Excel: no sirve de nombre. */
  nombre: string;
  matriz: string[][];
}

export interface HojaCentro {
  /** Nombre de la pestaña, para que la coordinadora ubique la hoja en su archivo. */
  hoja: string;
  /** El titulo crudo de la fila 1, sin tocar. Es la evidencia de donde salio todo. */
  titulo: string;
  /** Nombre del centro: el titulo sin el lider ni la puntuacion colgante. */
  centro: string;
  /**
   * Nombre (no correo) del lider, o '' si no se pudo extraer con confianza. La pantalla
   * pide SIEMPRE el correo, porque el archivo no lo trae; esto solo es la pista.
   */
  lider: string;
  /** Indice (base 0) de la fila de encabezados dentro de la matriz. */
  filaEncabezados: number;
  filas: FilaCentro[];
  /** Problemas de esta hoja que conviene mirar. No impiden importar. */
  avisos: string[];
  /** true = no habia titulo y hubo que caer al nombre de la pestaña (truncado). */
  tituloDeLaHoja: boolean;
}

export interface HojaOmitida {
  hoja: string;
  motivo: string;
}

export interface ArchivoCentros {
  hojas: HojaCentro[];
  /** Todas las filas de todas las hojas, en orden de aparicion. */
  filas: FilaCentro[];
  hojasOmitidas: HojaOmitida[];
  /**
   * Jornada que insinuan los grados del archivo, o null si no hay mayoria clara. Sirve
   * para preseleccionar que juego de decisiones se aplica; la pantalla deja cambiarla.
   */
  jornadaSugerida: Jornada | null;
}

export class ArchivoCentrosNoReconocido extends Error {}

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
  grupo: number;
  nombres: number;
  apellidos: number;
}

/**
 * Localiza las columnas por NOMBRE, no por posicion.
 *
 * Se exige encontrar nombres Y apellidos: una hoja con solo una de las dos daria filas a
 * medias que despues no cruzarian con nadie y llenarian la bandeja de `no_encontrado`.
 */
function columnasDe(fila: string[]): Columnas | null {
  let grupo = -1;
  let nombres = -1;
  let apellidos = -1;
  fila.forEach((celda, i) => {
    const n = normalizarEncabezado(celda);
    if (!n) return;
    if (apellidos < 0 && n.includes('APELLIDO')) apellidos = i;
    else if (nombres < 0 && n.includes('NOMBRE')) nombres = i;
    if (grupo < 0 && n.includes('GRUPO')) grupo = i;
  });
  if (nombres < 0 || apellidos < 0) return null;
  return { grupo, nombres, apellidos };
}

// ---------------------------------------------------------------------------
//  Titulo y lider
// ---------------------------------------------------------------------------

/** Comillas que aparecen en los titulos reales, por pares. */
const PARES_COMILLAS: [string, string][] = [
  ['"', '"'],
  ['“', '”'],
  ["'", "'"],
];

/**
 * Palabras que un nombre propio no lleva. Si aparecen, lo que hay detras del separador no
 * es una persona sino la segunda mitad del titulo (`La chispa adecuada - Electricidad en
 * el hogar`), y entonces no se propone lider.
 */
const PALABRAS_NO_NOMBRE = new Set([
  'DE', 'DEL', 'LA', 'LAS', 'EL', 'LOS', 'Y', 'E', 'O', 'U', 'EN', 'PARA', 'POR', 'CON',
  'UN', 'UNA', 'UNOS', 'UNAS', 'AL', 'QUE', 'SU', 'SUS', 'MI', 'TU', 'NUESTRO', 'A',
]);

function palabras(s: string): string[] {
  return s.split(/\s+/).filter(Boolean);
}

/**
 * ¿Esto parece el nombre de una persona?
 *
 * Deliberadamente ESTRECHO. Un falso negativo cuesta que la pantalla pida el nombre (que
 * es lo que hace de todas formas con el correo); un falso positivo asigna el centro de una
 * profesora a otra, y eso no se descubre hasta que alguien no puede pasar lista.
 */
function pareceNombreDePersona(bruto: string): boolean {
  const s = bruto.replace(/\s+/g, ' ').trim();
  if (!s || s.length > 40) return false;
  if (/\d/.test(s)) return false;
  const ps = palabras(s);
  if (ps.length < 1 || ps.length > 4) return false;
  for (const p of ps) {
    if (p.length < 2) return false;
    if (!/^[\p{L}]+$/u.test(p)) return false;
    if (PALABRAS_NO_NOMBRE.has(normalizarEncabezado(p))) return false;
  }
  return true;
}

/**
 * Quita la puntuacion colgante y las comillas DESPAREJADAS.
 *
 * Las parejas se respetan a proposito: `"AL PING AL PONG: TENIS DE MESA"` y
 * `Música en el 'J'` se llaman asi, con comillas incluidas. La que sobra es la suelta que
 * quedo al partir el titulo (`TRAZO VIVO"`, `“ÁGORA 2.0`).
 */
function limpiarNombreCentro(bruto: string): string {
  let t = (bruto ?? '').replace(/\s+/g, ' ').trim();
  t = t.replace(/^[\s\-–—.,;:]+/, '').replace(/[\s\-–—.,;:]+$/, '');

  for (const [abre, cierra] of PARES_COMILLAS) {
    const cuenta = (c: string) => t.split(c).length - 1;
    const desparejada = abre === cierra ? cuenta(abre) % 2 === 1 : cuenta(abre) !== cuenta(cierra);
    if (!desparejada) continue;
    if (t.startsWith(abre) && cuenta(abre) > cuenta(cierra)) t = t.slice(abre.length);
    else if (t.endsWith(cierra)) t = t.slice(0, -cierra.length);
    else if (t.startsWith(abre)) t = t.slice(abre.length);
    t = t.trim();
  }

  return t.replace(/^[\s\-–—.,;:]+/, '').replace(/[\s\-–—.,;:]+$/, '');
}

/**
 * Parte el titulo en (centro, lider). `lider` va vacio cuando no hay o cuando lo que hay
 * no se sostiene.
 *
 * Se prueba primero el parentesis final y despues el ULTIMO guion, en ese orden, porque
 * hay titulos con guion dentro del propio nombre del centro
 * (`La chispa adecuada - Electricidad en el hogar - Uriel López`) y el ultimo es el unico
 * que separa siempre.
 */
export function separarTituloYLider(titulo: string): { centro: string; lider: string } {
  const t = (titulo ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return { centro: '', lider: '' };

  const conParentesis = t.match(/^(.*?)[\s\-–—]*\(([^()]*)\)\s*$/);
  if (conParentesis && pareceNombreDePersona(conParentesis[2])) {
    return {
      centro: limpiarNombreCentro(conParentesis[1]),
      lider: conParentesis[2].replace(/\s+/g, ' ').trim(),
    };
  }

  const corte = Math.max(t.lastIndexOf('-'), t.lastIndexOf('–'), t.lastIndexOf('—'));
  if (corte > 0) {
    const cola = t.slice(corte + 1).trim();
    if (pareceNombreDePersona(cola)) {
      return { centro: limpiarNombreCentro(t.slice(0, corte)), lider: cola };
    }
  }

  return { centro: limpiarNombreCentro(t), lider: '' };
}

// ---------------------------------------------------------------------------
//  Lectura de una hoja
// ---------------------------------------------------------------------------

/** Hasta que fila se busca el encabezado. En los dos archivos reales esta en la 2. */
const MAX_FILAS_ENCABEZADO = 8;

function tituloDeLaMatriz(matriz: string[][], hasta: number): string {
  for (let i = 0; i < hasta; i++) {
    for (const celda of matriz[i] ?? []) {
      const t = (celda ?? '').trim();
      if (t) return t;
    }
  }
  return '';
}

export function leerHojaCentro(hoja: HojaCruda): HojaCentro | HojaOmitida {
  const matriz = hoja.matriz ?? [];

  let filaEncabezados = -1;
  let columnas: Columnas | null = null;
  for (let i = 0; i < Math.min(matriz.length, MAX_FILAS_ENCABEZADO); i++) {
    const c = columnasDe(matriz[i] ?? []);
    if (c) {
      filaEncabezados = i;
      columnas = c;
      break;
    }
  }

  if (!columnas) {
    return {
      hoja: hoja.nombre,
      motivo:
        'No se encontró la fila de encabezados (se buscaron columnas de «Nombres» y ' +
        '«Apellidos» en las primeras 8 filas). La hoja se omite entera.',
    };
  }

  const avisos: string[] = [];
  const crudo = tituloDeLaMatriz(matriz, filaEncabezados);
  const tituloDeLaHoja = crudo === '';
  const titulo = tituloDeLaHoja ? hoja.nombre : crudo;
  if (tituloDeLaHoja) {
    avisos.push(
      'La hoja no trae título: se usa el nombre de la pestaña, que Excel trunca a 31 ' +
        'caracteres. Revise el nombre del centro antes de importar.',
    );
  }

  const { centro, lider } = separarTituloYLider(titulo);
  if (!centro) {
    return {
      hoja: hoja.nombre,
      motivo: `El título «${titulo}» no deja ningún nombre de centro utilizable.`,
    };
  }
  if (!lider) {
    avisos.push('No se pudo leer el nombre del líder en el título: hay que indicarlo.');
  }

  const filas: FilaCentro[] = [];
  let sinNombre = 0;
  let sinGrupo = 0;
  for (let i = filaEncabezados + 1; i < matriz.length; i++) {
    const f = matriz[i] ?? [];
    const nombres = (f[columnas.nombres] ?? '').trim();
    const apellidos = (f[columnas.apellidos] ?? '').trim();
    // Las filas totalmente vacias son la cola en blanco del archivo, no un error.
    if (!nombres && !apellidos) {
      if (f.some((c) => (c ?? '').trim() !== '')) sinNombre += 1;
      continue;
    }
    // El grupo viaja LITERAL: '6°1', '10-1'. No se sanea (regla del cruce).
    const grupoArchivo = columnas.grupo >= 0 ? (f[columnas.grupo] ?? '').trim() : '';
    if (!grupoArchivo) sinGrupo += 1;
    filas.push({ centro, grupoArchivo, nombres, apellidos });
  }

  if (sinNombre > 0) {
    avisos.push(`${sinNombre} fila(s) con datos pero sin nombre: se descartan.`);
  }
  if (sinGrupo > 0) {
    avisos.push(
      `${sinGrupo} fila(s) sin grupo. No impide cruzarlas —manda la matrícula—, pero el ` +
        'grupo es lo único que desempata a dos estudiantes con el mismo nombre.',
    );
  }
  if (filas.length === 0) {
    return { hoja: hoja.nombre, motivo: 'La hoja no tiene ninguna fila con nombre.' };
  }

  return { hoja: hoja.nombre, titulo, centro, lider, filaEncabezados, filas, avisos, tituloDeLaHoja };
}

function esOmitida(x: HojaCentro | HojaOmitida): x is HojaOmitida {
  return (x as HojaOmitida).motivo !== undefined;
}

/**
 * Lee el libro entero. Una hoja rota se OMITE con su motivo en vez de tumbar el archivo:
 * perder una de once hojas y saberlo es mejor que no poder importar las diez buenas.
 */
export function leerArchivoCentros(hojas: HojaCruda[]): ArchivoCentros {
  const buenas: HojaCentro[] = [];
  const hojasOmitidas: HojaOmitida[] = [];

  for (const h of hojas) {
    const r = leerHojaCentro(h);
    if (esOmitida(r)) hojasOmitidas.push(r);
    else buenas.push(r);
  }

  if (buenas.length === 0) {
    throw new ArchivoCentrosNoReconocido(
      'Ninguna hoja del archivo tiene la forma esperada: un título en la primera fila y ' +
        'los encabezados «El grupo | Nombres del estudiante | Apellidos del estudiante». ' +
        '¿Es la lista de centros de interés?',
    );
  }

  const filas = buenas.flatMap((h) => h.filas);
  return { hojas: buenas, filas, hojasOmitidas, jornadaSugerida: jornadaDeFilas(filas) };
}

// ---------------------------------------------------------------------------
//  Jornada
// ---------------------------------------------------------------------------

/** Numero de grado que insinua el literal del archivo, o null. Solo para orientar. */
function numeroDeGrado(grupoArchivo: string): number | null {
  const m = (grupoArchivo ?? '').trim().match(/^(\d{1,2})\D*(\d{1,2})$/);
  return m ? Number(m[1]) : null;
}

/**
 * Jornada mayoritaria de los grados del archivo.
 *
 * Es una SUGERENCIA para preseleccionar el juego de decisiones ya tomadas, y por eso pide
 * mayoria amplia (dos tercios): los grados del archivo estan mal a menudo —16 de 28 en una
 * sola hoja— y no se puede colgar nada firme de ellos.
 */
export function jornadaDeFilas(filas: FilaCentro[]): Jornada | null {
  let manana = 0;
  let tarde = 0;
  for (const f of filas) {
    const n = numeroDeGrado(f.grupoArchivo);
    if (n === null) continue;
    try {
      if (jornadaDeNumeroDeGrado(n) === 'tarde') tarde += 1;
      else manana += 1;
    } catch {
      // Fuera de 6..11 no se deduce nada. No es un error aqui: es que no aporta.
    }
  }
  const total = manana + tarde;
  if (total === 0) return null;
  if (manana / total >= 2 / 3) return 'manana';
  if (tarde / total >= 2 / 3) return 'tarde';
  return null;
}

// ---------------------------------------------------------------------------
//  Decisiones ya tomadas
// ---------------------------------------------------------------------------

/**
 * Forma de `domain/decisiones-centros-2026-2.ts`. Se declara aqui —en vez de importar el
 * seed— para que el dominio no dependa de una carpeta de scripts que no viaja con el
 * modulo cuando se monte dentro de MJB.
 */
export interface DecisionCentro {
  nombreArchivo: string;
  accion: 'ubicar' | 'excluir' | 'quitar_de_centro';
  nombreMatricula?: string;
  grado?: string;
  centroQueSale?: string;
  motivo: string;
}

export interface DecisionAplicada {
  decision: DecisionCentro;
  /** Cuantas filas del archivo toco. 0 = la decision ya no aplica a este archivo. */
  filas: number;
}

export interface ResultadoDecisiones {
  filas: FilaCentro[];
  aplicadas: DecisionAplicada[];
  /** Decisiones que no encontraron ninguna fila: o es otro archivo, o ya se corrigio. */
  sinUsar: DecisionCentro[];
}

/** Clave de comparacion de nombres. Sin tildes, sin puntuacion, mayusculas. */
function clave(s: string): string {
  return (s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function nombreDeFila(f: FilaCentro): string {
  return `${(f.apellidos ?? '').trim()} ${(f.nombres ?? '').trim()}`.trim();
}

/**
 * Aplica las decisiones que Julian YA tomo, ANTES de cruzar contra la matricula.
 *
 * Existe para no volver a preguntar lo mismo: preguntar dos veces lo ya respondido es la
 * forma mas rapida de que nadie confie en la bandeja de pendientes.
 *
 *  - `excluir`: la fila desaparece. No estaba en esa jornada.
 *  - `quitar_de_centro`: desaparece SOLO en ese centro; sigue en el otro.
 *  - `ubicar`: la fila se reescribe con el nombre y el grado de la MATRICULA. Al cruzar,
 *    ese nombre coincide literalmente y sale resuelto en vez de pendiente. Si aun asi no
 *    cruzara, degrada a un pendiente de `ortografia` con la propuesta ya marcada — se
 *    resuelve a un clic, nunca se pierde.
 *
 * El nombre completo va entero en `apellidos` y `nombres` queda vacio a proposito: la
 * decision trae "APELLIDOS NOMBRES" en un solo campo, y partirlo por el espacio seria
 * adivinar donde acaba el segundo apellido. `cruzarCentros` compara la concatenacion de
 * los dos campos, asi que el resultado es identico y no se inventa nada.
 */
export function aplicarDecisiones(
  filas: FilaCentro[],
  decisiones: DecisionCentro[],
): ResultadoDecisiones {
  const usos = new Map<DecisionCentro, number>();
  const salida: FilaCentro[] = [];

  for (const fila of filas) {
    const nombre = clave(nombreDeFila(fila));
    const centro = clave(fila.centro);
    let quitar = false;
    let reemplazo: FilaCentro | null = null;

    for (const d of decisiones) {
      if (clave(d.nombreArchivo) !== nombre) continue;

      if (d.accion === 'excluir') {
        quitar = true;
      } else if (d.accion === 'quitar_de_centro') {
        const sale = clave(d.centroQueSale ?? '');
        if (!sale || !centro.startsWith(sale)) continue;
        quitar = true;
      } else {
        const nombreMatricula = (d.nombreMatricula ?? '').trim();
        if (!nombreMatricula) continue;
        reemplazo = {
          ...fila,
          apellidos: nombreMatricula,
          nombres: '',
          grupoArchivo: (d.grado ?? fila.grupoArchivo).trim(),
        };
      }

      usos.set(d, (usos.get(d) ?? 0) + 1);
      if (quitar) break;
    }

    if (quitar) continue;
    salida.push(reemplazo ?? fila);
  }

  const aplicadas: DecisionAplicada[] = [];
  const sinUsar: DecisionCentro[] = [];
  for (const d of decisiones) {
    const n = usos.get(d) ?? 0;
    if (n > 0) aplicadas.push({ decision: d, filas: n });
    else sinUsar.push(d);
  }
  return { filas: salida, aplicadas, sinUsar };
}

// ---------------------------------------------------------------------------
//  Los identificadores de los centros
// ---------------------------------------------------------------------------

/**
 * `grupoId` de cada centro, en el orden en que aparecen las filas.
 *
 * Reproduce EXACTAMENTE lo que hace `cruzarCentros` por dentro (`slugGrupo` con el
 * conjunto de slugs ya usados, en orden de aparicion) porque la pantalla necesita el
 * mapa completo para crear los grupos, y `cruzarCentros` no lo devuelve. Hay una prueba
 * que compara las dos salidas: si algun dia divergen, salta ahi y no en produccion.
 *
 * Es deterministico sobre el mismo archivo, que es lo que hace que reimportar ACTUALICE
 * en vez de duplicar.
 */
export function grupoIdsPorCentro(filas: FilaCentro[]): Map<string, string> {
  const porCentro = new Map<string, string>();
  const usados = new Set<string>();
  for (const f of filas) {
    if (porCentro.has(f.centro)) continue;
    const id = slugGrupo(f.centro, usados);
    usados.add(id);
    porCentro.set(f.centro, id);
  }
  return porCentro;
}
