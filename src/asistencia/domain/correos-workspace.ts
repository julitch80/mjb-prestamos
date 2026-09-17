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
 *  4. **La cuenta tiene que ser de ESTE estudiante, no solo tener su llave.** Agregada el
 *     2026-09-16, al ver 2.443 cuentas sin dueño en el export real: la regla 1 solo ve a
 *     los estudiantes que están en la aplicación (bachillerato de la central), pero
 *     Workspace tiene también a los de las otras sedes, primaria y exalumnos. Un Juan
 *     Pérez único en nuestra lista puede tener su llave ocupada por OTRO Juan Pérez. Por
 *     eso, antes de llamar algo automático, se exige que el nombre con que se creó la
 *     cuenta no contradiga la ficha, y que no existan variantes numeradas de la llave
 *     (`juan.perez2`), que delatan un homónimo en Workspace.
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
  /** Por qué no es automático, dicho para una persona. Solo en `confirmar` y `colision`. */
  motivo: string | null;
  /** Cuentas del archivo que podrían ser suyas: la llave y sus variantes numeradas, con
   *  el nombre con que se crearon. Es lo que necesita quien resuelve. */
  candidatas: { correo: string; nombreCuenta: string }[];
  /**
   * Qué tan bien coincide el nombre de la cuenta propuesta con la ficha. Se guarda para
   * poder CONTAR cuántos automáticos coinciden solo en parte: una cuenta creada solo con
   * «Juan Pérez» no descarta a otro Juan Pérez que no esté en la aplicación. `null` si no
   * hay cuenta propuesta.
   */
  concordancia: ConcordanciaNombre | null;
  /** El nombre con que se creó la cuenta propuesta, para mostrarlo al revisar. */
  nombreCuentaPropuesta: string | null;
}

export interface PlanCorreos {
  filas: FilaPlanCorreo[];
  /** Cuentas del archivo que no quedaron asignadas a nadie: estudiantes de otras sedes y
   *  de primaria, exalumnos, docentes y cuentas administrativas. Ahí cae también la cuenta
   *  desviada de un homónimo. */
  cuentasSinDueno: CuentaWorkspace[];
  conteo: Record<EstadoCorreo, number>;
}

/** Palabras de un nombre, normalizadas: "Londoño-López" -> ["LONDONO", "LOPEZ"]. */
function palabras(s: string): string[] {
  return normalizar(s)
    .replace(/[^A-Z\s-]/g, '')
    .split(/[\s-]+/)
    .filter(Boolean);
}

export type ConcordanciaNombre = 'completo' | 'compatible' | 'falta_apellido' | 'contradice' | 'sin_datos';

/** Cuántas veces aparece cada palabra. «PÉREZ PÉREZ» son DOS, no una. */
function contar(ps: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const p of ps) m.set(p, (m.get(p) ?? 0) + 1);
  return m;
}

/** ¿`b` trae cada palabra de `a` al menos tantas veces como `a`? */
function cubre(b: Map<string, number>, a: Map<string, number>): boolean {
  return [...a].every(([p, n]) => (b.get(p) ?? 0) >= n);
}

/**
 * ¿El nombre con que se creó la cuenta es el de este estudiante?
 *
 *  - `contradice`: la cuenta tiene una palabra que la ficha no tiene, O LA TIENE MÁS VECES.
 *    «Juan Pérez Ruiz» contra «PÉREZ GÓMEZ, JUAN» es otra persona. Y «Esteban Pérez Pérez»
 *    contra «PÉREZ CONTRERAS, ESTEBAN» también: su segundo apellido es Pérez.
 *  - `completo`: la cuenta trae todas las palabras de la ficha, con sus repeticiones. Es lo
 *    único que distingue a dos homónimos.
 *  - `falta_apellido`: no contradice, pero le falta un apellido («Samuel Monroy» para
 *    «MONROY GÓMEZ, SAMUEL»). NO se aplica solo: no descarta a otro Samuel Monroy que no
 *    esté en la aplicación.
 *  - `compatible`: trae los dos apellidos y le falta solo algún nombre de pila («Lorena
 *    López Aguilar» para «LÓPEZ AGUILAR, LORENA MARÍA»). Los apellidos son lo que separa
 *    a una persona de otra con el mismo nombre; el segundo nombre no.
 *  - `sin_datos`: el archivo no trae nombre para la cuenta.
 *
 * Por qué se cuentan repeticiones (2026-09-16): la primera versión comparaba CONJUNTOS de
 * palabras. Para un conjunto, «PÉREZ PÉREZ» es solo «PÉREZ», y la cuenta de Esteban Pérez
 * Pérez pasó como de Esteban Pérez Contreras. Lo vio Julián mirando la lista de parciales.
 *
 * Una diferencia de escritura («Kamila» y «Camila») cuenta como contradicción. Es
 * conservador a propósito: lo peor que pasa es que una persona lo confirme; lo contrario
 * es mandarle el correo a otro menor.
 */
export function concordanciaNombre(
  cuenta: Pick<CuentaWorkspace, 'nombre' | 'apellido'>,
  e: Pick<EstudianteParaCorreo, 'nombres' | 'apellidos'>,
): ConcordanciaNombre {
  const deCuenta = palabras(`${cuenta.nombre} ${cuenta.apellido}`);
  if (deCuenta.length === 0) return 'sin_datos';
  const enCuenta = contar(deCuenta);
  const enFicha = contar(palabras(`${nombresDePila(e.apellidos, e.nombres)} ${e.apellidos}`));

  if (!cubre(enFicha, enCuenta)) return 'contradice';
  if (cubre(enCuenta, enFicha)) return 'completo';
  return cubre(enCuenta, contar(palabras(e.apellidos))) ? 'compatible' : 'falta_apellido';
}

function escaparRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function planCorreos(
  estudiantes: EstudianteParaCorreo[],
  cuentas: CuentaWorkspace[],
  dominio = DOMINIO_INSTITUCIONAL,
): PlanCorreos {
  const porCorreo = new Map(cuentas.map((c) => [c.correo, c]));
  const activos = estudiantes.filter((e) => e.activo);
  const llaves = new Map(activos.map((e) => [e.studentId, llavesDe(e)]));

  /** La llave y sus variantes numeradas que existen en el archivo: `juan.perez`,
   *  `juan.perez2`, `juan.perez.3`. Más de una delata un homónimo en Workspace. */
  const variantesDe = (llave: string): CuentaWorkspace[] => {
    const re = new RegExp(`^${escaparRegex(llave)}(?:[._-]?\\d+)?@${escaparRegex(dominio)}$`);
    return cuentas.filter((c) => re.test(c.correo)).sort((a, b) => a.correo.localeCompare(b.correo));
  };
  const nombreDe = (c: CuentaWorkspace) => `${c.nombre} ${c.apellido}`.trim();

  // Regla 1: quién reclama cada llave, EN NUESTRA LISTA.
  const reclamantes = new Map<string, Set<string>>();
  for (const [id, { llaves: ls }] of llaves) {
    for (const l of ls) {
      const set = reclamantes.get(l) ?? new Set<string>();
      set.add(id);
      reclamantes.set(l, set);
    }
  }
  const porId = new Map(activos.map((e) => [e.studentId, e]));

  const filas: FilaPlanCorreo[] = [];
  const asignadas = new Set<string>();

  for (const e of activos) {
    const { llaves: ls, compuesto } = llaves.get(e.studentId)!;
    const candidatas = ls.flatMap(variantesDe);
    const base = {
      studentId: e.studentId,
      nombre: `${e.apellidos} ${nombresDePila(e.apellidos, e.nombres)}`.trim(),
      grado: e.gradoActual,
      llavesProbadas: ls,
      compuesto,
      protegidoManual: e.correoOrigen === 'manual',
      candidatas: candidatas.map((c) => ({ correo: c.correo, nombreCuenta: nombreDe(c) })),
    };

    let estado: EstadoCorreo;
    let correo: string | null = null;
    let motivo: string | null = null;
    let concordanciaPropuesta: ConcordanciaNombre | null = null;

    const existentes = ls.map((l) => `${l}@${dominio}`).filter((c) => porCorreo.has(c));
    const rivales = [...new Set(ls.flatMap((l) => [...(reclamantes.get(l) ?? [])]))].filter(
      (id) => id !== e.studentId,
    );

    if (rivales.length > 0) {
      // Homónimo en NUESTRA lista. Nunca automático. Pero si entre la llave y sus
      // variantes hay EXACTAMENTE UNA cuenta cuyo nombre completo es el de este
      // estudiante —y no el de ninguno de sus homónimos—, se sugiere para confirmar.
      const suyas = candidatas.filter(
        (c) =>
          concordanciaNombre(c, e) === 'completo' &&
          rivales.every((r) => concordanciaNombre(c, porId.get(r)!) !== 'completo'),
      );
      if (suyas.length === 1) {
        estado = 'confirmar';
        correo = suyas[0].correo;
        motivo = `Homónimo en el colegio. Se sugiere por el nombre completo de la cuenta («${nombreDe(suyas[0])}»).`;
      } else {
        estado = 'colision';
        motivo = `Otro estudiante del colegio produce la misma llave (${ls.join(', ')}).`;
      }
    } else if (existentes.length === 0) {
      estado = 'sin_cuenta';
    } else if (existentes.length > 1) {
      estado = 'colision';
      motivo = 'Existen varias de las cuentas posibles de su apellido compuesto.';
    } else {
      correo = existentes[0];
      const cuenta = porCorreo.get(correo)!;
      const concordancia = concordanciaNombre(cuenta, e);
      const variantes = ls.flatMap(variantesDe);

      if (compuesto) {
        estado = 'confirmar';
        motivo = 'Apellido compuesto: una sola de las formas posibles existe.';
      } else if (variantes.length > 1) {
        // Regla 4, segunda mitad: `juan.perez` y `juan.perez2` a la vez.
        estado = 'confirmar';
        motivo = `Hay ${variantes.length} cuentas con esa llave en Workspace (${variantes
          .map((v) => v.correo.split('@')[0])
          .join(', ')}): puede ser de otro estudiante con el mismo nombre.`;
      } else if (concordancia === 'contradice') {
        estado = 'confirmar';
        motivo = `El nombre de la cuenta («${nombreDe(cuenta)}») no coincide con la ficha.`;
      } else if (concordancia === 'falta_apellido') {
        estado = 'confirmar';
        motivo = `La cuenta no trae los dos apellidos («${nombreDe(cuenta)}»): puede ser de otra persona con el mismo nombre y el mismo primer apellido.`;
      } else if (concordancia === 'sin_datos') {
        estado = 'confirmar';
        motivo = 'El archivo no trae el nombre de la cuenta: no se puede comprobar de quién es.';
      } else {
        estado = cuenta.activa ? 'automatico' : 'cuenta_inactiva';
      }
      concordanciaPropuesta = concordancia;
    }

    if (correo && concordanciaPropuesta === null) {
      concordanciaPropuesta = concordanciaNombre(porCorreo.get(correo)!, e);
    }

    if (correo) asignadas.add(correo);
    filas.push({
      ...base,
      estado,
      correo,
      motivo,
      concordancia: concordanciaPropuesta,
      nombreCuentaPropuesta: correo ? nombreDe(porCorreo.get(correo)!) : null,
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
