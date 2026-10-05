// Lógica pura del codebase `classroom` (sin red ni Firebase): testeable aparte.

export const API_CLASSROOM = 'https://classroom.googleapis.com/v1';

export interface CursoCrudo { id?: string; name?: string; section?: string; alternateLink?: string }
export interface CursoResumen { id: string; nombre: string; seccion: string; anio?: number | null; alternateLink?: string }

/** Ruta de la lista de cursos activos donde la persona es profesora. */
export function urlCursosDelDocente(pageSize = 50): string {
  const q = new URLSearchParams({ teacherId: 'me', courseStates: 'ACTIVE', pageSize: String(pageSize) });
  return `/courses?${q.toString()}`;
}

/** Deja solo id, nombre y sección (nada más sale hacia el cliente). */
export function mapearCursos(crudos: CursoCrudo[] | undefined): CursoResumen[] {
  return (crudos ?? [])
    .filter((c) => !!c.id)
    .map((c) => ({ id: String(c.id), nombre: c.name ?? '', seccion: c.section ?? '', anio: extraerAnio(c.name ?? '', c.section ?? ''), alternateLink: c.alternateLink ?? '' }));
}

/** Clasifica el fallo al pedir el token de delegación de dominio. */
export function clasificarErrorToken(mensaje: string): 'sin-autorizacion' | 'otro' {
  return /unauthorized_client|access_denied|\b403\b|invalid_grant/i.test(mensaje) ? 'sin-autorizacion' : 'otro';
}

// ---------- Normalización y sugerencia de curso (se puede copiar al frontend) ----------

const RE_GRUPO = /(?<!\d)(6|7|8|9|10|11)[\s.\-°º]*[°º.\-\s][\s.\-°º]*([1-9])(?!\d)/g;

/** Minúsculas, sin acentos; «10-°3», «10°3», «10º3», «10.3» y «10 3» pasan a «10.3». */
export function normalizarNombre(texto: string): string {
  return String(texto ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(RE_GRUPO, (_m, g: string, n: string) => `${g}.${n}`)
    .replace(/\s+/g, ' ')
    .trim();
}

/** Token de grupo («10.3») dentro de un texto, o null. Sirve igual para «6º1» (tarde). */
export function extraerGrupo(texto: string): string | null {
  const m = /(?<!\d)(6|7|8|9|10|11)\.([1-9])(?!\d)/.exec(normalizarNombre(texto));
  return m ? `${m[1]}.${m[2]}` : null;
}

/** Año de 4 dígitos (2020-2039) en el nombre o, si no, en la sección; si no, null. */
export function extraerAnio(nombre: string, seccion = ''): number | null {
  for (const t of [nombre, seccion]) {
    const m = /(?<!\d)(20[23]\d)(?!\d)/.exec(String(t ?? ''));
    if (m) return Number(m[1]);
  }
  return null;
}

/**
 * Mejor curso para (grupo, asignatura) o null. Exige el mismo grupo; entre los que cumplen:
 * 1) palabra de la asignatura en el nombre, 2) año actual, luego sin año. Años anteriores
 * al actual se descartan (nunca se prefieren). Empate: el primero de la lista.
 */
export function sugerirCurso(
  grupo: string, asignatura: string,
  cursos: Array<{ id: string; nombre: string; seccion?: string; anio?: number | null }>,
  anioActual: number,
): string | null {
  const g = extraerGrupo(grupo);
  if (!g) return null;
  const VACIAS = new Set(['del', 'las', 'los', 'con']);
  const palabras = normalizarNombre(asignatura).split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !VACIAS.has(w));
  let mejor: { id: string; puntos: number } | null = null;
  for (const c of cursos) {
    if (extraerGrupo(c.nombre) !== g) continue;
    const anio = c.anio !== undefined ? c.anio : extraerAnio(c.nombre, c.seccion ?? '');
    if (anio != null && anio < anioActual) continue;
    // La asignatura se busca SOLO en el nombre del curso (la sección suele ser el área,
    // p. ej. «Ciencias Naturales», y hacía coincidir «Ciencias Sociales» con Física).
    // Deben coincidir TODAS sus palabras, por las 4 primeras letras («Mate» ≈ «Matemáticas»),
    // así «Educación Física» no se confunde con un curso de Física.
    const tokens = normalizarNombre(c.nombre).split(/[^a-z0-9]+/).filter((t) => t.length >= 3);
    if (!palabras.length || !palabras.every((w) => tokens.some((t) => t.slice(0, 4) === w.slice(0, 4)))) continue;
    const puntos = anio === anioActual ? 2 : anio == null ? 1 : 0;
    if (!mejor || puntos > mejor.puntos) mejor = { id: c.id, puntos };
  }
  return mejor ? mejor.id : null;
}

/** Clave segura (sin '.') del mapa de vínculos: «grupo|asignatura» con puntos codificados. */
export function claveVinculo(grupo: string, asignatura: string): string {
  return `${grupo}|${asignatura}`.replace(/\./g, '_');
}

/** Valida grupo/asignatura: texto no vacío de hasta 40 caracteres sin saltos de línea ni '/'. */
export function textoValido(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0 && v.length <= 40 && !/[\n\r/]/.test(v);
}

export const RE_CORREO_DOMINIO = /^[^@\s]+@iemanueljbetancur\.edu\.co$/;

/**
 * Entrega a las 23:59 de Bogotá (UTC-5, sin horario de verano) expresada en UTC, que es lo
 * que exige Classroom en dueDate/dueTime: siempre cae al día siguiente a las 04:59.
 */
export function fechaEntregaClassroom(fecha: string): { dueDate: { year: number; month: number; day: number }; dueTime: { hours: number; minutes: number } } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);
  if (!m) throw new Error('Fecha inválida: ' + fecha);
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + 1));
  return {
    dueDate: { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() },
    dueTime: { hours: 4, minutes: 59 },
  };
}

// ---------- 4.1: de Classroom a MJB ----------

/** Jornada por la notación del grupo: ordinal («6º1») = tarde; punto («10.1») = mañana. */
export function jornadaDeGrupo(grupo: string): 'tarde' | 'manana' {
  return String(grupo ?? '').includes('º') ? 'tarde' : 'manana';
}

/**
 * Inversa de fechaEntregaClassroom: dueDate+dueTime (UTC) -> 'YYYY-MM-DD' en hora de Bogotá
 * (UTC-5). Sin dueDate devuelve null; sin dueTime se toma 00:00 UTC.
 */
export function fechaDesdeClassroom(
  dueDate?: { year?: number; month?: number; day?: number } | null,
  dueTime?: { hours?: number; minutes?: number } | null,
): string | null {
  if (!dueDate || !dueDate.year || !dueDate.month || !dueDate.day) return null;
  const ms = Date.UTC(dueDate.year, dueDate.month - 1, dueDate.day, dueTime?.hours ?? 0, dueTime?.minutes ?? 0) - 5 * 3600 * 1000;
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
}

export interface MaterialCrudo {
  link?: { url?: string; title?: string };
  driveFile?: { driveFile?: { title?: string; alternateLink?: string } };
  youtubeVideo?: { title?: string; alternateLink?: string };
  form?: { formUrl?: string; title?: string };
}

/** Materiales como {titulo,url} (enlace, Drive, YouTube, formulario), máximo 10. */
export function extraerMateriales(materiales: MaterialCrudo[] | undefined): Array<{ titulo: string; url: string }> {
  const salida: Array<{ titulo: string; url: string }> = [];
  for (const m of materiales ?? []) {
    const par = m?.link ? { titulo: m.link.title, url: m.link.url }
      : m?.driveFile?.driveFile ? { titulo: m.driveFile.driveFile.title, url: m.driveFile.driveFile.alternateLink }
      : m?.youtubeVideo ? { titulo: m.youtubeVideo.title, url: m.youtubeVideo.alternateLink }
      : m?.form ? { titulo: m.form.title, url: m.form.formUrl }
      : null;
    if (par?.url) salida.push({ titulo: par.titulo || par.url, url: par.url });
    if (salida.length >= 10) break;
  }
  return salida;
}

export interface CourseWorkCrudo {
  id?: string; title?: string; description?: string; state?: string; workType?: string;
  alternateLink?: string; associatedWithDeveloper?: boolean; creationTime?: string; updateTime?: string;
  dueDate?: { year?: number; month?: number; day?: number }; dueTime?: { hours?: number; minutes?: number };
  materials?: MaterialCrudo[];
}

/** Motivo para NO traer la tarea como pendiente, o null si se debe traer. */
export function debeIgnorar(cw: CourseWorkCrudo, existeEnClassroomTareas: boolean): string | null {
  if (cw.associatedWithDeveloper === true) return 'creada-por-mjb';
  if (existeEnClassroomTareas) return 'ya-enlazada';
  if (cw.state !== 'PUBLISHED') return 'no-publicada';
  if (cw.workType && !['ASSIGNMENT', 'SHORT_ANSWER_QUESTION', 'MULTIPLE_CHOICE_QUESTION'].includes(cw.workType)) return 'tipo-no-soportado';
  return null;
}

// ---------- 4.1 (sondeo): revisión periódica de Classroom ----------

/**
 * ¿La tarea se creó en Classroom a partir del momento del vínculo? Evita traer tareas viejas
 * del curso. `creationTime` es RFC 3339 de Classroom; sin fecha válida (o sin vínculo) no entra.
 */
export function dentroDeVentana(creationTime: string | undefined, vinculadoEnMillis: number | null | undefined): boolean {
  if (!creationTime || vinculadoEnMillis == null || !Number.isFinite(vinculadoEnMillis)) return false;
  const t = Date.parse(creationTime);
  return Number.isFinite(t) && t >= vinculadoEnMillis;
}

/** Ruta de la lista de tareas publicadas de un curso, las modificadas más recientemente primero. */
export function urlCourseWorkPublicadas(courseId: string, pageSize = 30): string {
  return `/courses/${courseId}/courseWork?courseWorkStates=PUBLISHED&orderBy=${encodeURIComponent('updateTime desc')}&pageSize=${pageSize}`;
}

/** ¿Hay que reescribir el pendiente? Solo si no existe o su updateTime de Classroom cambió. */
export function cambioReal(updateTimePrevio: string | undefined | null, updateTimeNuevo: string | undefined): boolean {
  return !updateTimePrevio || updateTimePrevio !== (updateTimeNuevo ?? '');
}
