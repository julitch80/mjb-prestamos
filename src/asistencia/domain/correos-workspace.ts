/**
 * Emparejamiento de los correos institucionales de estudiantes desde el export de
 * usuarios de Google Workspace. Diseño: `docs/importar-correos-workspace.md`.
 *
 * El correo NO está en el Máster: vive solo en Workspace. Lo necesita el enlace de
 * descargos del observador y cualquier aviso futuro.
 *
 * ⚠️ `import-matching.ts` dice «JAMÁS emparejar por nombre automáticamente», y aquí se
 * empareja por nombre. No es una contradicción, y la diferencia es lo que hay que leer:
 * no se compara un nombre con otro parecido, se construye una LLAVE EXACTA con el patrón
 * del colegio (`primernombre.primerapellido`) y se aparta todo lo que no sea inequívoco.
 * Tres reglas lo hacen seguro:
 *
 *  1. La colisión se detecta en NUESTRA lista, no en Workspace. Si dos estudiantes del
 *     colegio producen la misma llave, NINGUNO se empareja solo — ni siquiera el que
 *     tiene la cuenta con el patrón normal. Los homónimos son justo los que se salen del
 *     patrón, y no hay forma de saber cuál es cuál sin alguien que los conozca.
 *  2. Solo se usan direcciones que existen en el archivo. Nunca una calculada: un correo
 *     inventado se pierde, o le llega a otra persona.
 *  3. Nada se aplica sin previsualización.
 *
 * Y lo que la máquina no decide, no lo escribe: `confirmar` y `colision` quedan para que
 * los resuelva el director de grupo, que sabe cuál Juan Pérez es el suyo.
 */

import { nombresDePila, normalizar } from './nombres';

export const DOMINIO_INSTITUCIONAL = 'iemanueljbetancur.edu.co';

// ---------------------------------------------------------------------------
//  CSV
// ---------------------------------------------------------------------------

/**
 * Lector de CSV (RFC 4180): comillas, comillas dobladas y saltos de línea dentro de un
 * campo. Se escribe aquí y no se agrega una librería: son treinta líneas, y el export de
 * Workspace trae nombres con comas que un `split(',')` partiría en dos columnas.
 */
export function leerCsv(texto: string): string[][] {
  const filas: string[][] = [];
  let fila: string[] = [];
  let campo = '';
  let comillas = false;
  // El BOM de UTF-8 que agrega Google al principio arruinaría el primer encabezado.
  const s = texto.replace(/^﻿/, '');

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (comillas) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          campo += '"';
          i++;
        } else {
          comillas = false;
        }
      } else {
        campo += c;
      }
      continue;
    }
    if (c === '"') comillas = true;
    else if (c === ',') {
      fila.push(campo);
      campo = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      fila.push(campo);
      filas.push(fila);
      fila = [];
      campo = '';
    } else {
      campo += c;
    }
  }
  if (campo !== '' || fila.length > 0) {
    fila.push(campo);
    filas.push(fila);
  }
  return filas.filter((f) => f.some((x) => x.trim() !== ''));
}

// ---------------------------------------------------------------------------
//  El export de Workspace
// ---------------------------------------------------------------------------

export interface CuentaWorkspace {
  correo: string;
  nombre: string;
  apellido: string;
  /** `Status` = Active. Una suspendida empareja, pero con advertencia. */
  activa: boolean;
  /** Tal como viene (`Never logged in` incluido). No se guarda en la ficha: envejece en horas. */
  ultimoAcceso: string;
}

export class ExportNoReconocido extends Error {}

/**
 * Google escribe los encabezados con un sufijo entre corchetes que cambia según la
 * versión (`Email Address [Required]`). Se compara sin él.
 */
function encabezado(s: string): string {
  return s.replace(/\[.*?\]/g, '').trim().toLowerCase();
}

export function leerExportWorkspace(matriz: string[][]): CuentaWorkspace[] {
  if (matriz.length === 0) throw new ExportNoReconocido('El archivo está vacío.');
  const enc = matriz[0].map(encabezado);
  const col = (nombre: string) => enc.indexOf(nombre);
  const iCorreo = col('email address');
  if (iCorreo < 0) {
    throw new ExportNoReconocido(
      'No se encontró la columna «Email Address». ¿Es la descarga de usuarios de la ' +
        'Consola de administración de Google, en formato CSV?',
    );
  }
  const iNombre = col('first name');
  const iApellido = col('last name');
  const iEstado = col('status');
  const iAcceso = col('last sign in');

  const cuentas: CuentaWorkspace[] = [];
  for (const f of matriz.slice(1)) {
    const correo = (f[iCorreo] ?? '').trim().toLowerCase();
    if (!correo.includes('@')) continue;
    cuentas.push({
      correo,
      nombre: iNombre >= 0 ? (f[iNombre] ?? '').trim() : '',
      apellido: iApellido >= 0 ? (f[iApellido] ?? '').trim() : '',
      // Sin columna de estado no se puede afirmar que esté suspendida: se da por activa.
      activa: iEstado < 0 || (f[iEstado] ?? '').trim().toLowerCase() === 'active',
      ultimoAcceso: iAcceso >= 0 ? (f[iAcceso] ?? '').trim() : '',
    });
  }
  return cuentas;
}

// ---------------------------------------------------------------------------
//  La llave
// ---------------------------------------------------------------------------

/** "LONDOÑO" -> "londono". Reutiliza el normalizador de `nombres.ts`. */
export function parteDeLlave(s: string): string {
  return normalizar(s)
    .toLowerCase()
    .replace(/[^a-z]/g, '');
}

/** Partículas con las que empieza un apellido compuesto. Las de dos palabras primero. */
const PARTICULAS = ['DE LA', 'DE LOS', 'DE LAS', 'DEL', 'DE', 'LA', 'LAS', 'LOS', 'SAN', 'SANTA', 'VAN', 'VON', 'DA', 'DI', 'MC', 'MAC'];

export interface EstudianteParaCorreo {
  studentId: string;
  nombres: string;
  apellidos: string;
  gradoActual: string;
  activo: boolean;
  primerNombre?: string;
  primerApellido?: string;
  correoInstitucional?: string;
  correoOrigen?: 'workspace' | 'manual';
}

/**
 * Las llaves posibles de un estudiante. Una sola en el caso normal; varias cuando el
 * apellido empieza por partícula, porque no sabemos si el colegio escribe «De la Rosa»
 * como `delarosa`, `rosa` o `de`. No se adivina: se generan las tres y el archivo dice
 * cuál existe.
 *
 * El primer nombre sale de `nombresDePila`, no del campo crudo: el Máster escribe en
 * NOMBRES el nombre completo con los apellidos delante ("ARBOLEDA ASPRILLA SAMANTHA").
 */
export function llavesDe(e: EstudianteParaCorreo): { llaves: string[]; compuesto: boolean } {
  const nombre = parteDeLlave(
    (e.primerNombre || nombresDePila(e.apellidos, e.nombres)).trim().split(/\s+/)[0] ?? '',
  );
  const apellidosNorm = normalizar(e.primerApellido && !esCompuesto(e.apellidos) ? e.primerApellido : e.apellidos);
  if (!nombre || !apellidosNorm) return { llaves: [], compuesto: false };

  const particula = PARTICULAS.find((p) => apellidosNorm === p || apellidosNorm.startsWith(p + ' '));
  if (!particula) {
    return { llaves: [`${nombre}.${parteDeLlave(apellidosNorm.split(' ')[0])}`], compuesto: false };
  }

  const resto = apellidosNorm.slice(particula.length).trim().split(' ');
  const palabra = resto[0] ?? '';
  const candidatas = [
    parteDeLlave(particula + palabra), // delarosa
    parteDeLlave(palabra), // rosa
    parteDeLlave(particula.split(' ')[0]), // de
  ].filter(Boolean);
  return {
    llaves: [...new Set(candidatas)].map((a) => `${nombre}.${a}`),
    compuesto: true,
  };
}

function esCompuesto(apellidos: string): boolean {
  const n = normalizar(apellidos);
  return PARTICULAS.some((p) => n === p || n.startsWith(p + ' '));
}

// ---------------------------------------------------------------------------
//  El plan
// ---------------------------------------------------------------------------

export type EstadoCorreo = 'automatico' | 'confirmar' | 'colision' | 'sin_cuenta' | 'cuenta_inactiva';

export interface FilaPlanCorreo {
  studentId: string;
  nombre: string;
  grado: string;
  estado: EstadoCorreo;
  /** El correo propuesto. Solo en `automatico`, `confirmar` y `cuenta_inactiva`. */
  correo: string | null;
  /** Las llaves que se probaron. Es lo que se muestra cuando algo no cuadra. */
  llavesProbadas: string[];
  /** Apellido con partícula: se lista aparte para aprender la convención del colegio. */
  compuesto: boolean;
  /** La ficha ya tiene este mismo correo: aplicar no cambia nada. */
  sinCambios: boolean;
  /** El correo lo puso a mano un director. La importación no lo pisa. */
  protegidoManual: boolean;
}

export interface PlanCorreos {
  filas: FilaPlanCorreo[];
  /** Cuentas del archivo que no quedaron asignadas a nadie. Ahí cae la cuenta desviada
   *  de un homónimo, y también los docentes: es lo esperado. */
  cuentasSinDueno: CuentaWorkspace[];
  conteo: Record<EstadoCorreo, number>;
}

export function planCorreos(
  estudiantes: EstudianteParaCorreo[],
  cuentas: CuentaWorkspace[],
  dominio = DOMINIO_INSTITUCIONAL,
): PlanCorreos {
  const porCorreo = new Map(cuentas.map((c) => [c.correo, c]));
  const activos = estudiantes.filter((e) => e.activo);
  const llaves = new Map(activos.map((e) => [e.studentId, llavesDe(e)]));

  // Regla 1: quién reclama cada llave, EN NUESTRA LISTA. Una llave reclamada por dos
  // estudiantes no se le da a ninguno.
  const reclamantes = new Map<string, Set<string>>();
  for (const [id, { llaves: ls }] of llaves) {
    for (const l of ls) {
      const set = reclamantes.get(l) ?? new Set<string>();
      set.add(id);
      reclamantes.set(l, set);
    }
  }

  const filas: FilaPlanCorreo[] = [];
  const asignadas = new Set<string>();

  for (const e of activos) {
    const { llaves: ls, compuesto } = llaves.get(e.studentId)!;
    const base = {
      studentId: e.studentId,
      nombre: `${e.apellidos} ${nombresDePila(e.apellidos, e.nombres)}`.trim(),
      grado: e.gradoActual,
      llavesProbadas: ls,
      compuesto,
      protegidoManual: e.correoOrigen === 'manual',
    };

    // Regla 2: solo direcciones que existen en el archivo.
    const existentes = ls.map((l) => `${l}@${dominio}`).filter((c) => porCorreo.has(c));
    const disputada = ls.some((l) => (reclamantes.get(l)?.size ?? 0) > 1);

    let estado: EstadoCorreo;
    let correo: string | null = null;

    if (disputada) {
      estado = 'colision';
    } else if (existentes.length === 0) {
      estado = 'sin_cuenta';
    } else if (existentes.length > 1) {
      // Dos de las candidatas de un apellido compuesto existen: no se escoge.
      estado = 'colision';
    } else {
      correo = existentes[0];
      const cuenta = porCorreo.get(correo)!;
      if (compuesto) estado = 'confirmar';
      else estado = cuenta.activa ? 'automatico' : 'cuenta_inactiva';
    }

    if (correo) asignadas.add(correo);
    filas.push({
      ...base,
      estado,
      correo,
      sinCambios: Boolean(correo && e.correoInstitucional === correo),
    });
  }

  const conteo: Record<EstadoCorreo, number> = {
    automatico: 0,
    confirmar: 0,
    colision: 0,
    sin_cuenta: 0,
    cuenta_inactiva: 0,
  };
  for (const f of filas) conteo[f.estado] += 1;

  return {
    filas,
    cuentasSinDueno: cuentas.filter((c) => !asignadas.has(c.correo)),
    conteo,
  };
}

/**
 * Lo que la importación escribe sin preguntar: `automatico` y `cuenta_inactiva`, nada
 * más. `confirmar` y `colision` esperan a una persona. Y nunca se pisa un correo que un
 * director puso a mano, ni se reescribe lo que ya está igual — así aplicar dos veces no
 * cambia nada la segunda.
 */
export function escriturasDelPlan(
  plan: PlanCorreos,
  fecha: string,
): { studentId: string; cambios: Record<string, unknown> }[] {
  return plan.filas
    .filter((f) => (f.estado === 'automatico' || f.estado === 'cuenta_inactiva') && f.correo)
    .filter((f) => !f.protegidoManual && !f.sinCambios)
    .map((f) => ({
      studentId: f.studentId,
      cambios: {
        correoInstitucional: f.correo,
        correoVerificadoEn: fecha,
        correoOrigen: 'workspace',
        correoCuentaActiva: f.estado === 'automatico',
      },
    }));
}

/**
 * La dirección que le correspondería a quien no tiene cuenta, para que quien administra
 * Workspace la cree con el mismo criterio y la próxima importación la empareje sola.
 * Solo si la llave es única e inequívoca: a un compuesto o a un homónimo no se le
 * sugiere nada, porque la sugerencia sería una adivinanza.
 */
export function correoSugerido(f: FilaPlanCorreo, dominio = DOMINIO_INSTITUCIONAL): string {
  if (f.compuesto || f.llavesProbadas.length !== 1) return '';
  return `${f.llavesProbadas[0]}@${dominio}`;
}
