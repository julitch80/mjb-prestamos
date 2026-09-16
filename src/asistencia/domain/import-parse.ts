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
 * Desde el 2026-09-16 el archivo puede traer SOLO una parte de los datos (el listado
 * para Guardianes trae sexo, matricula y direccion, pero NO acudiente ni telefonos,
 * porque esos ya estan en la aplicacion). Por eso existe `camposPresentes`: lo que el
 * archivo no trae no se toca. Ver `actualizacionDeFicha` en import-matching.ts.
 *
 * Este modulo no toca Firestore ni ExcelJS: recibe una matriz de texto ya extraida.
 * Asi se prueba sin archivos y sin red.
 */

import type { DocType } from './types';

export type CampoDestino =
  | 'docNumber'
  | 'tipoDocumento'
  | 'apellidos'
  | 'nombres'
  | 'apellido1'
  | 'apellido2'
  | 'nombre1'
  | 'nombre2'
  | 'grado'
  | 'grupo'
  | 'matricula'
  | 'sexo'
  | 'fechaNacimiento'
  | 'direccion'
  | 'barrio'
  | 'acudiente'
  | 'afinidad'
  | 'telefono1'
  | 'telefono2'
  | 'email'
  | 'ignorar';

/** Nombres de columna vistos en los exports reales, por campo destino. */
const ALIAS: Record<Exclude<CampoDestino, 'ignorar'>, string[]> = {
  docNumber: ['NRODOCUMENTO', 'DOCUMENTO', 'IDENTIFICACION', 'NUMERODOCUMENTO'],
  tipoDocumento: ['TIPODOCUMENTO', 'TIPODOC'],
  apellidos: ['APELLIDOS'],
  nombres: ['NOMBRES'],
  // El asistente de listados ofrece el nombre partido en cuatro. Es preferible: partir
  // "RODRIGUEZ ARENAS CELESTE" es adivinar donde terminan los apellidos, y eso falla
  // justo con los compuestos.
  apellido1: ['APELLIDO1', 'PRIMERAPELLIDO'],
  apellido2: ['APELLIDO2', 'SEGUNDOAPELLIDO'],
  nombre1: ['NOMBRE1', 'PRIMERNOMBRE'],
  nombre2: ['NOMBRE2', 'SEGUNDONOMBRE'],
  grado: ['GRADO'],
  grupo: ['GRUPO'],
  matricula: ['MATRICULA', 'CODIGOMATRICULA'],
  sexo: ['SEXO', 'GENERO'],
  fechaNacimiento: ['FNACIMIENTO', 'FECHANACIMIENTO'],
  direccion: ['DIRECCIONALUMNO', 'DIRECCION'],
  barrio: ['BARRIO'],
  acudiente: ['NOMBREACUDIENTE', 'ACUDIENTE'],
  afinidad: ['AFINIDAD', 'PARENTESCO'],
  // Los dos telefonos cambian de nombre entre exports: en uno vino
  // TELMOVILFAMILIARCERCANO y en otro TELEFONOACUDIENTE.
  telefono1: ['TELMOVILACUDIENTE', 'CELULARACUDIENTE'],
  telefono2: ['TELEFONOACUDIENTE', 'TELMOVILFAMILIARCERCANO', 'TELEFONOFAMILIARCERCANO'],
  email: ['EMAILACUDIENTE', 'CORREOACUDIENTE', 'EMAIL'],
  // COMUNA no tiene destino a proposito: todas las sedes estan en la comuna 80 y el
  // Master la trae de tres formas distintas ("80", "COMUNA 80", vacia). Se ignora.
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

// ---------------------------------------------------------------------------
//  Qué trae el archivo
// ---------------------------------------------------------------------------

/**
 * Los campos de la FICHA que este archivo puede actualizar. Es la otra mitad de la
 * regla "lo que el archivo no trae no se toca": el servidor solo escribe lo que esta
 * lista declara.
 *
 * Los nombres cuentan como presentes si viene la columna completa (APELLIDOS) o su
 * version partida (APELLIDO1). Los telefonos, si viene cualquiera de los dos.
 */
export type CampoFicha =
  | 'nombres'
  | 'apellidos'
  | 'primerNombre'
  | 'primerApellido'
  | 'docType'
  | 'matricula'
  | 'sexo'
  | 'fechaNacimiento'
  | 'direccion'
  | 'barrio'
  | 'acudiente'
  | 'parentesco'
  | 'telefonos'
  | 'correoAcudiente';

export function camposPresentes(mapeo: CampoDestino[]): CampoFicha[] {
  const hay = (c: CampoDestino) => mapeo.includes(c);
  const presentes: CampoFicha[] = [];
  if (hay('nombres') || hay('nombre1')) presentes.push('nombres');
  if (hay('apellidos') || hay('apellido1')) presentes.push('apellidos');
  if (hay('nombre1')) presentes.push('primerNombre');
  if (hay('apellido1')) presentes.push('primerApellido');
  if (hay('tipoDocumento')) presentes.push('docType');
  if (hay('matricula')) presentes.push('matricula');
  if (hay('sexo')) presentes.push('sexo');
  if (hay('fechaNacimiento')) presentes.push('fechaNacimiento');
  if (hay('direccion')) presentes.push('direccion');
  if (hay('barrio')) presentes.push('barrio');
  if (hay('acudiente')) presentes.push('acudiente');
  if (hay('afinidad')) presentes.push('parentesco');
  if (hay('telefono1') || hay('telefono2')) presentes.push('telefonos');
  if (hay('email')) presentes.push('correoAcudiente');
  return presentes;
}

// ---------------------------------------------------------------------------
//  Normalizaciones de los campos nuevos
// ---------------------------------------------------------------------------

/**
 * El Master escribe "R.C.", "T.I.", "C.C." con puntos. Antes de esto, la pantalla
 * mandaba `TI` para TODOS los estudiantes, fuera cual fuera su documento — un error que
 * se veia en la ficha de cualquier niño de sexto con registro civil.
 */
export function normalizarTipoDocumento(raw: string): DocType | null {
  const t = (raw ?? '').toUpperCase().replace(/[^A-Z]/g, '');
  if (!t) return null;
  if (t === 'RC' || t === 'REGISTROCIVIL') return 'RC';
  if (t === 'TI' || t === 'TARJETADEIDENTIDAD') return 'TI';
  if (t === 'CC' || t === 'CEDULA' || t === 'CEDULADECIUDADANIA') return 'CC';
  if (t === 'PPT' || t === 'PERMISOPORPROTECCIONTEMPORAL') return 'PPT';
  return 'otro';
}

export type Sexo = 'F' | 'M' | 'otro';

export function normalizarSexo(raw: string): Sexo | null {
  const t = (raw ?? '').trim().toUpperCase();
  if (!t) return null;
  if (t === 'F' || t.startsWith('FEM')) return 'F';
  if (t === 'M' || t.startsWith('MAS')) return 'M';
  return 'otro';
}

/**
 * Fecha del Master (`19/01/2021`) a ISO (`2021-01-19`). Se acepta tambien ISO directo.
 * Devuelve `null` si no es una fecha real: un 31/02 no se "corrige" al 3 de marzo, se
 * avisa. Una fecha de nacimiento inventada es peor que una vacia, porque la edad que se
 * reporta a Guardianes sale de aqui.
 */
export function normalizarFecha(raw: string): string | null {
  const t = (raw ?? '').trim();
  if (!t) return null;
  let d: number, m: number, a: number;
  const dmy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(t);
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(t);
  if (dmy) {
    d = Number(dmy[1]);
    m = Number(dmy[2]);
    a = Number(dmy[3]);
  } else if (iso) {
    a = Number(iso[1]);
    m = Number(iso[2]);
    d = Number(iso[3]);
  } else {
    return null;
  }
  const f = new Date(Date.UTC(a, m - 1, d));
  if (f.getUTCFullYear() !== a || f.getUTCMonth() !== m - 1 || f.getUTCDate() !== d) return null;
  return `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Une partes de un nombre saltando las vacias: "MARIA" + "" = "MARIA", sin espacio colgado. */
function unir(...partes: string[]): string {
  return partes
    .map((p) => p.trim())
    .filter(Boolean)
    .join(' ');
}

// ---------------------------------------------------------------------------
//  Aplicar el mapeo
// ---------------------------------------------------------------------------

export interface FilaCruda {
  docNumber: string;
  docType: DocType | null;
  apellidos: string;
  nombres: string;
  /** Solo si el archivo trae el nombre partido. Es lo que usa el emparejamiento con
   *  los correos de Workspace (primer nombre + primer apellido). */
  primerNombre: string;
  primerApellido: string;
  grado: string;
  grupo: string;
  matricula: string;
  sexo: Sexo | null;
  /** ISO `AAAA-MM-DD`, o vacio si no vino o no era una fecha real. */
  fechaNacimiento: string;
  direccion: string;
  barrio: string;
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

    const fechaCruda = val('fechaNacimiento');
    const fechaNacimiento = normalizarFecha(fechaCruda);
    if (fechaCruda && !fechaNacimiento) {
      avisos.push({
        fila: numeroFila,
        motivo: `Fecha de nacimiento no válida («${fechaCruda}»): no se importa`,
      });
    }

    const telefonos = [val('telefono1'), val('telefono2')].filter(Boolean);

    // La columna completa manda si viene; si no, se compone con las partidas.
    const apellidos = val('apellidos') || unir(val('apellido1'), val('apellido2'));
    const nombres = val('nombres') || unir(val('nombre1'), val('nombre2'));

    filas.push({
      docNumber,
      docType: normalizarTipoDocumento(val('tipoDocumento')),
      apellidos,
      nombres,
      primerNombre: val('nombre1'),
      primerApellido: val('apellido1'),
      // El grado y el grupo viajan LITERALES; la traducción a la notación de la app
      // (6º3, 11.2) la hace grados.ts, no este parser.
      grado: val('grado'),
      grupo: val('grupo'),
      matricula: val('matricula'),
      sexo: normalizarSexo(val('sexo')),
      fechaNacimiento: fechaNacimiento ?? '',
      direccion: val('direccion'),
      barrio: val('barrio'),
      acudiente: val('acudiente'),
      afinidad: val('afinidad'),
      telefonos,
      email: val('email'),
    });
  });

  return { filas, avisos };
}
