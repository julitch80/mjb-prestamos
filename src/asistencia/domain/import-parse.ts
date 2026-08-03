/**
 * Lectura del archivo de Master2000 — el paso previo al emparejamiento.
 *
 * Aqui viven las dos cosas que el archivo REAL rompio cuando lo inspeccionamos
 * (2026-07-31, export de 1246 filas de toda la institucion):
 *
 *  1. **Los encabezados NO estan en la primera fila.** Las cinco primeras son membrete
 *     del colegio. Hay que BUSCAR la fila que contenga `NRODOCUMENTO`, nunca asumir.
 *  2. **Las celdas vienen como texto enriquecido.** `cell.value` devuelve un objeto y al
 *     convertirlo a cadena da `[object Object]`. Hay que leer `cell.text`.
 *
 * Y una tercera que no es un defecto sino una realidad: **las columnas cambian** segun
 * lo que el superusuario elija en el asistente de listados. Por eso el mapeo es por
 * NOMBRE de columna y no por posicion, y se sugiere automaticamente pero se puede
 * corregir a mano antes de importar.
 *
 * Este modulo no toca Firestore ni ExcelJS: recibe una matriz de texto ya extraida.
 * Asi se prueba sin archivos y sin red.
 */

export type CampoDestino =
  | 'docNumber'
  | 'apellidos'
  | 'nombres'
  | 'grado'
  | 'grupo'
  | 'acudiente'
  | 'afinidad'
  | 'telefono1'
  | 'telefono2'
  | 'email'
  | 'ignorar';

/** Nombres de columna vistos en los exports reales, por campo destino. */
const ALIAS: Record<Exclude<CampoDestino, 'ignorar'>, string[]> = {
  docNumber: ['NRODOCUMENTO', 'DOCUMENTO', 'IDENTIFICACION', 'NUMERODOCUMENTO'],
  apellidos: ['APELLIDOS'],
  nombres: ['NOMBRES'],
  grado: ['GRADO'],
  grupo: ['GRUPO'],
  acudiente: ['NOMBREACUDIENTE', 'ACUDIENTE'],
  afinidad: ['AFINIDAD', 'PARENTESCO'],
  // Los dos telefonos cambian de nombre entre exports: en uno vino
  // TELMOVILFAMILIARCERCANO y en otro TELEFONOACUDIENTE.
  telefono1: ['TELMOVILACUDIENTE', 'CELULARACUDIENTE'],
  telefono2: ['TELEFONOACUDIENTE', 'TELMOVILFAMILIARCERCANO', 'TELEFONOFAMILIARCERCANO'],
  email: ['EMAILACUDIENTE', 'CORREOACUDIENTE', 'EMAIL'],
};

function normalizarEncabezado(s: string): string {
  return (s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

export interface ArchivoLeido {
  /** Indice (base 0) de la fila de encabezados dentro de la matriz. */
  filaEncabezados: number;
  encabezados: string[];
  /** Filas de datos, ya sin el membrete ni los encabezados. */
  filas: string[][];
}

export class ArchivoNoReconocido extends Error {}

/**
 * Localiza la fila de encabezados y separa los datos.
 * `matriz` es el contenido de la hoja como texto plano (usar `cell.text`).
 */
export function leerArchivo(matriz: string[][]): ArchivoLeido {
  const clave = normalizarEncabezado('NRODOCUMENTO');
  const alternativas = ALIAS.docNumber.map(normalizarEncabezado);

  for (let i = 0; i < Math.min(matriz.length, 20); i++) {
    const fila = matriz[i] ?? [];
    const hay = fila.some((c) => {
      const n = normalizarEncabezado(c);
      return n === clave || alternativas.includes(n);
    });
    if (!hay) continue;
    return {
      filaEncabezados: i,
      encabezados: fila.map((c) => (c ?? '').trim()),
      // Se descartan las filas totalmente vacias (los exports traen colas en blanco).
      filas: matriz.slice(i + 1).filter((f) => f.some((c) => (c ?? '').trim() !== '')),
    };
  }

  throw new ArchivoNoReconocido(
    'No se encontró la fila de encabezados. Se buscó una columna de documento ' +
      '(NRODOCUMENTO o equivalente) en las primeras 20 filas. ¿Es un listado de ' +
      'estudiantes de Master2000?',
  );
}

/**
 * Propone a qué campo va cada columna. Es una SUGERENCIA: el superusuario la confirma
 * o la corrige antes de importar, porque las columnas cambian entre exports.
 */
export function sugerirMapeo(encabezados: string[]): CampoDestino[] {
  const usados = new Set<CampoDestino>();
  return encabezados.map((e) => {
    const n = normalizarEncabezado(e);
    if (!n) return 'ignorar';
    for (const [campo, alias] of Object.entries(ALIAS) as [
      Exclude<CampoDestino, 'ignorar'>,
      string[],
    ][]) {
      // Una columna repetida (CONTADOR aparece 5 veces por celdas combinadas) no debe
      // reclamar dos veces el mismo destino.
      if (usados.has(campo)) continue;
      if (alias.map(normalizarEncabezado).includes(n)) {
        usados.add(campo);
        return campo;
      }
    }
    return 'ignorar';
  });
}

export interface FilaCruda {
  docNumber: string;
  apellidos: string;
  nombres: string;
  grado: string;
  grupo: string;
  acudiente: string;
  afinidad: string;
  telefonos: string[];
  email: string;
}

export interface AvisoFila {
  fila: number;
  motivo: string;
}

/**
 * Aplica el mapeo. Devuelve las filas y los avisos de calidad.
 *
 * Los avisos NO detienen la importación: la decide el superusuario viendo la
 * previsualización. Existen porque en el archivo real aparecieron documentos de 2 y 6
 * dígitos, que son errores de digitación en Master2000 y no se detectan solos — el
 * emparejamiento los aceptaría como personas válidas y crearía fantasmas.
 */
export function aplicarMapeo(
  archivo: ArchivoLeido,
  mapeo: CampoDestino[],
): { filas: FilaCruda[]; avisos: AvisoFila[] } {
  const idx = (campo: CampoDestino) => mapeo.indexOf(campo);
  const iDoc = idx('docNumber');
  if (iDoc < 0) {
    throw new ArchivoNoReconocido('El mapeo no asigna ninguna columna al documento.');
  }

  const filas: FilaCruda[] = [];
  const avisos: AvisoFila[] = [];
  const vistos = new Map<string, number>();

  archivo.filas.forEach((f, i) => {
    const numeroFila = archivo.filaEncabezados + 2 + i; // 1-based, como lo ve el usuario
    const val = (campo: CampoDestino) => {
      const j = idx(campo);
      return j >= 0 ? (f[j] ?? '').trim() : '';
    };

    const docNumber = val('docNumber').replace(/\D+/g, '');
    if (!docNumber) {
      avisos.push({ fila: numeroFila, motivo: 'Sin documento legible' });
    } else if (docNumber.length < 6 || docNumber.length > 11) {
      avisos.push({
        fila: numeroFila,
        motivo: `Documento de ${docNumber.length} dígitos: probable error de digitación`,
      });
    }

    if (docNumber) {
      const antes = vistos.get(docNumber);
      if (antes) {
        avisos.push({ fila: numeroFila, motivo: `Documento repetido (ya venía en la fila ${antes})` });
      } else {
        vistos.set(docNumber, numeroFila);
      }
    }

    const telefonos = [val('telefono1'), val('telefono2')].filter(Boolean);

    filas.push({
      docNumber,
      apellidos: val('apellidos'),
      nombres: val('nombres'),
      // El grado y el grupo viajan LITERALES; la traducción a la notación de la app
      // (6º3, 11.2) la hace grados.ts, no este parser.
      grado: val('grado'),
      grupo: val('grupo'),
      acudiente: val('acudiente'),
      afinidad: val('afinidad'),
      telefonos,
      email: val('email'),
    });
  });

  return { filas, avisos };
}
