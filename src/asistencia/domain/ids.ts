/**
 * Identificadores del modulo — docs/modelo-datos-asistencia.md, seccion 3.
 *
 * REGLA QUE NO SE NEGOCIA: el grado se conserva LITERAL. `6º1` no se convierte en
 * `6-1`. La `º` es lo que distingue la jornada de la tarde de la de la manana (`9.1`),
 * y borrarla es un bug silencioso que aparece semanas despues, cuando el modulo empieza
 * a mostrar grupos de la jornada equivocada.
 *
 * Los ids de documento de Firestore aceptan UTF-8. Lo unico prohibido es `/`, los
 * nombres `.` y `..`, y el patron `__algo__`.
 *
 * Los ids son deterministas: dos personas que registran lo mismo producen el MISMO id.
 * Sobre eso descansa que no aparezcan sesiones duplicadas.
 */

/** Caracteres que Firestore no admite en un id de documento. */
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

/** Jornada derivada de la notacion del grado, tal como lo hace la app anfitriona. */
export function jornadaDeGrado(grado: string): 'manana' | 'tarde' {
  return grado.includes('º') ? 'tarde' : 'manana';
}

/**
 * Sesion = sede + grado + fecha + bloque.
 * Ej.: `central_6º1_2026-08-14_3`, `gustavo_rodas_1º1_2026-08-14_2`.
 *
 * La SEDE forma parte de la identidad a proposito. Hoy los grados no se repiten entre
 * sedes porque el ultimo digito las distingue (Gustavo Rodas usa 1 y 2, La Finquita
 * usa 3), pero eso es una convencion implicita que nadie garantiza: el dia que Gustavo
 * Rodas abra un tercer grupo de primero, dos sedes se pisarian los registros. Incluirla
 * ahora cuesta nada; anadirla con datos cargados obliga a migrar.
 */
export function sessionId(
  sede: string,
  grado: string,
  fecha: string,
  bloque: number,
): string {
  assertUsableInId(sede, 'sede');
  assertUsableInId(grado, 'grado');
  assertUsableInId(fecha, 'fecha');
  // Hasta seis bloques por jornada en la sede central. Primaria tiene menos (la tarde
  // de Gustavo Rodas tiene cinco), lo cual cabe sin cambios. Si alguna sede llegara a
  // tener mas de seis, hay que ampliar tambien la regla de Firestore.
  if (!Number.isInteger(bloque) || bloque < 1 || bloque > 6) {
    throw new Error(`bloque fuera de rango 1..6: ${bloque}`);
  }
  return `${sede}_${grado}_${fecha}_${bloque}`;
}

/** Una llegada tarde por estudiante y dia. */
export function lateArrivalId(studentId: string, fecha: string): string {
  return `${assertUsableInId(studentId, 'studentId')}_${assertUsableInId(fecha, 'fecha')}`;
}

/** Matricula: el seq permite varias por anio (cambio de grupo a mitad de anio). */
export function enrollmentId(studentId: string, anio: number, seq: number): string {
  return `${assertUsableInId(studentId, 'studentId')}_${anio}_${seq}`;
}

export function periodId(anio: number, numero: number): string {
  return `${anio}_${numero}`;
}

export function subjectConfigId(
  anio: number,
  periodo: number,
  grado: string,
  subjectId: string,
): string {
  assertUsableInId(grado, 'grado');
  return `${anio}_${periodo}_${grado}_${assertUsableInId(subjectId, 'subjectId')}`;
}

/**
 * Clave normalizada para ordenar o agrupar, cuando hace falta comparar grados sin la
 * notacion. NUNCA sustituye al grado literal: se guarda aparte y el original se
 * conserva en su propio campo.
 */
export function gradoSortKey(grado: string): string {
  const m = grado.match(/^(\d+)[.º](\d+)$/);
  if (!m) return grado;
  const jornada = grado.includes('º') ? '2' : '1'; // manana ordena antes que tarde
  return `${jornada}_${m[1].padStart(2, '0')}_${m[2].padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
//  Fechas — siempre locales, nunca UTC
// ---------------------------------------------------------------------------

/**
 * `new Date('2026-04-13')` y `new Date('2026-04-13T00:00:00')` terminan
 * interpretandose como UTC en Node, y en Colombia (UTC-5) devuelven el dia ANTERIOR.
 * Un corrimiento de un dia aqui significa faltas atribuidas a la fecha equivocada.
 */
export function dateFromKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(key: string, days: number): string {
  const d = dateFromKey(key);
  d.setDate(d.getDate() + days);
  return toDateKey(d);
}

/** 1 = lunes ... 7 = domingo. */
export function dayOfWeekOf(key: string): number {
  const js = dateFromKey(key).getDay();
  return js === 0 ? 7 : js;
}
