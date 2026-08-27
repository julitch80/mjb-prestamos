/**
 * Reparto del mosaico de fotos del grupo en hojas de papel OFICIO.
 *
 * Esto no es una pantalla: es la caratula del observador fisico que reposa todo el año
 * en coordinacion. Se imprime UNA vez. Por eso la geometria se calcula en milimetros de
 * papel y no en pixeles: lo que hay que garantizar es que la ultima fila no se corte al
 * salir de la impresora, y eso no se puede comprobar mirando el monitor.
 *
 * OFICIO EN COLOMBIA = 216 x 330 mm. NO es el "legal" estadounidense (216 x 356). Es un
 * error facil y caro: 26 mm de mas hacen que el navegador reescale la hoja y la ultima
 * fila de ovalos se vaya al borde.
 *
 * Todo aqui es puro y sin React a proposito, para poder demostrar con tests que 41
 * estudiantes —el grupo mas grande del colegio— caben, y en cuantas hojas.
 */

/** Hoja oficio colombiana, en milimetros. */
export const HOJA_OFICIO_MM = { ancho: 216, alto: 330 } as const;

/** Margen de impresion, igual en los cuatro lados (`@page { margin }`). */
export const MARGEN_MM = 10;

/**
 * Altura reservada al encabezado (escudo + grupo + director + año) en CADA hoja.
 * Va en todas porque la segunda hoja tambien se archiva suelta: sin encabezado nadie
 * sabria de que grupo es.
 */
export const ALTO_ENCABEZADO_MM = 30;

/** Alto/ancho del ovalo. Mayor que 1 = elipse vertical, que es como es un rostro. */
export const RELACION_OVALO = 1.3;

/** Renglon del nombre debajo de cada ovalo. */
export const ALTO_NOMBRE_MM = 7;

/** Aire entre celdas, horizontal y vertical. */
export const SEPARACION_MM = 2;

/**
 * Limites de la busqueda de rejilla. Menos de 3 columnas da fotos absurdamente grandes;
 * mas de 8 da rostros que no se distinguen en papel, que es justo lo que el mosaico
 * tiene que permitir hacer.
 */
export const COLUMNAS_MIN = 3;
export const COLUMNAS_MAX = 8;

export interface Rejilla {
  columnas: number;
  filas: number;
  /** `columnas * filas`. Cuantos estudiantes entran en UNA hoja. */
  porPagina: number;
  /** Ancho de la celda —y del ovalo— en mm. */
  anchoCeldaMm: number;
  /** Alto del ovalo en mm (sin el renglon del nombre). */
  altoOvaloMm: number;
  /** Alto total de la celda: ovalo + nombre + separacion. */
  altoCeldaMm: number;
}

export interface Pagina<T> {
  /** 1..total. Se imprime como "Hoja 1 de 2". */
  numero: number;
  total: number;
  items: T[];
}

/** Espacio util dentro de los margenes, descontando el encabezado. */
function areaUtil(): { ancho: number; alto: number } {
  return {
    ancho: HOJA_OFICIO_MM.ancho - 2 * MARGEN_MM,
    alto: HOJA_OFICIO_MM.alto - 2 * MARGEN_MM - ALTO_ENCABEZADO_MM,
  };
}

/** La rejilla que resulta de fijar el numero de columnas. */
export function rejillaDeColumnas(columnas: number): Rejilla {
  if (!Number.isInteger(columnas) || columnas < 1) {
    throw new Error('El numero de columnas debe ser un entero de 1 o mas.');
  }
  const util = areaUtil();
  const anchoCeldaMm = (util.ancho - (columnas - 1) * SEPARACION_MM) / columnas;
  const altoOvaloMm = anchoCeldaMm * RELACION_OVALO;
  const altoCeldaMm = altoOvaloMm + ALTO_NOMBRE_MM + SEPARACION_MM;
  // La ultima fila no necesita su separacion inferior: por eso se le devuelve una.
  const filas = Math.max(1, Math.floor((util.alto + SEPARACION_MM) / altoCeldaMm));
  return {
    columnas,
    filas,
    porPagina: columnas * filas,
    anchoCeldaMm,
    altoOvaloMm,
    altoCeldaMm,
  };
}

/**
 * Elige la rejilla para un grupo de `total` estudiantes.
 *
 * Criterio: LAS FOTOS MAS GRANDES QUE PERMITAN METERLOS A TODOS EN UNA SOLA HOJA. Es
 * decir, el menor numero de columnas cuya capacidad alcance. Poner siempre 8 columnas
 * "por si acaso" desperdiciaria media hoja y daria rostros diminutos; poner siempre 5
 * mandaria a un grupo de 41 a una segunda hoja con seis fotos sueltas.
 *
 * Si ni con `COLUMNAS_MAX` caben (no ocurre hoy: el grupo mas grande tiene 41 y caben
 * 42 a 7 columnas), se toma la rejilla de mayor capacidad y el reparto usa varias hojas.
 */
export function rejillaPara(total: number): Rejilla {
  const candidatas: Rejilla[] = [];
  for (let c = COLUMNAS_MIN; c <= COLUMNAS_MAX; c++) candidatas.push(rejillaDeColumnas(c));

  const cabeTodo = candidatas.find((r) => r.porPagina >= total);
  if (cabeTodo) return cabeTodo;

  return candidatas.reduce((mejor, r) => (r.porPagina > mejor.porPagina ? r : mejor));
}

/**
 * Corta la lista en hojas de `porPagina`.
 *
 * Con la lista vacia devuelve CERO hojas, no una hoja en blanco: la pantalla usa eso
 * para no ofrecer imprimir. Gastar una hoja oficio en un encabezado sin fotos es
 * exactamente lo que hay que evitar.
 */
export function repartirEnPaginas<T>(items: T[], porPagina: number): Pagina<T>[] {
  if (!Number.isInteger(porPagina) || porPagina < 1) {
    throw new Error('La capacidad por pagina debe ser un entero de 1 o mas.');
  }
  if (items.length === 0) return [];

  const total = Math.ceil(items.length / porPagina);
  const paginas: Pagina<T>[] = [];
  for (let i = 0; i < total; i++) {
    paginas.push({
      numero: i + 1,
      total,
      items: items.slice(i * porPagina, (i + 1) * porPagina),
    });
  }
  return paginas;
}

/** Atajo: elige la rejilla segun el tamaño del grupo y reparte de una vez. */
export function mosaicoDe<T>(items: T[]): { rejilla: Rejilla; paginas: Pagina<T>[] } {
  const rejilla = rejillaPara(items.length);
  return { rejilla, paginas: repartirEnPaginas(items, rejilla.porPagina) };
}

/**
 * Cuantas fotos faltan. Se dice ANTES de imprimir porque hoy la jornada de la tarde no
 * tiene ninguna: un mosaico de 6º saldria con cuarenta ovalos vacios y nadie se entera
 * hasta que la hoja sale de la impresora.
 */
export function faltantesDeFoto<T>(items: T[], tieneFoto: (item: T) => boolean): number {
  return items.reduce((n, item) => (tieneFoto(item) ? n : n + 1), 0);
}
