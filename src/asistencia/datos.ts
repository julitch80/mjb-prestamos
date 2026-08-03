/**
 * Acceso a Firestore del modulo de asistencia.
 *
 * Concentra aqui TODAS las lecturas y escrituras para que las tres reglas que impone el
 * despliegue no dependan de que cada pantalla se acuerde de ellas:
 *
 *  1. `await esperarAuth()` antes de la primera lectura. Al recargar, el store
 *     persistido conoce al usuario cientos de milisegundos antes de que
 *     `auth.currentUser` exista; en ese hueco toda lectura falla en silencio.
 *
 *  2. Las consultas van SIEMPRE filtradas. Firestore rechaza la consulta entera si no
 *     puede probar que todo el resultado sera legible, aunque el usuario tuviera
 *     derecho a cada documento por separado. Un docente consulta por su `slotId`; un
 *     director, por su `grado`; el coordinador puede consultar sin acotar.
 *
 *  3. Las escrituras al mapa `estudiantes` usan RUTAS DE CAMPO PUNTUALES. Reemplazar el
 *     mapa completo borraria el trabajo de otro docente que este marcando a la vez.
 *
 * El autor de toda escritura sale de `exigirAutor()`, nunca del store (modo "Ver como").
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type QueryConstraint,
} from 'firebase/firestore';

import { db, esperarAuth } from '../lib/firebase';
import { sessionId as construirSessionId } from './domain/ids';
import type { MarkCode } from './domain/marks';
import type { Enrollment, LateArrival, Session, Student } from './domain/types';
import { exigirAutor } from './identidad';

/** El servidor rechazo la escritura porque alguien sincronizo primero. */
export class ConflictoError extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'ConflictoError';
  }
}

function baseDatos() {
  if (!db) throw new Error('Firebase no está configurado en esta instalación.');
  return db;
}

/** Toda lectura pasa por aquí: garantiza que la sesión de Firebase ya se resolvió. */
async function listo(): Promise<boolean> {
  return esperarAuth();
}

function aLista<T>(snap: { docs: { data: () => unknown }[] }): T[] {
  return snap.docs.map((d) => d.data() as T);
}

/**
 * Cómo se acota la consulta de sesiones. No es una preferencia: sin el filtro correcto
 * la consulta entera es rechazada.
 */
export type AlcanceLectura =
  | { tipo: 'docente'; slotId: string }
  | { tipo: 'director'; grado: string }
  | { tipo: 'coordinador' };

export async function leerSesiones(
  alcance: AlcanceLectura,
  filtro: { subjectId?: string; desde?: string; hasta?: string } = {},
): Promise<Session[]> {
  if (!(await listo())) return [];

  const cons: QueryConstraint[] = [];
  if (alcance.tipo === 'docente') cons.push(where('slotId', '==', alcance.slotId));
  if (alcance.tipo === 'director') cons.push(where('grado', '==', alcance.grado));
  if (filtro.subjectId) cons.push(where('subjectId', '==', filtro.subjectId));
  if (filtro.desde) cons.push(where('fecha', '>=', filtro.desde));
  if (filtro.hasta) cons.push(where('fecha', '<=', filtro.hasta));

  const snap = await getDocs(query(collection(baseDatos(), 'asistenciaSessions'), ...cons));
  return aLista<Session>(snap);
}

/** Estudiantes con matrícula vigente en un grado. */
export async function leerGrupo(
  grado: string,
): Promise<{ estudiantes: Student[]; matriculas: Enrollment[] }> {
  if (!(await listo())) return { estudiantes: [], matriculas: [] };

  const matriculas = aLista<Enrollment>(
    await getDocs(
      query(
        collection(baseDatos(), 'asistenciaEnrollments'),
        where('grado', '==', grado),
        where('hasta', '==', null),
      ),
    ),
  );

  const fichas = await Promise.all(
    matriculas.map((m) => getDoc(doc(baseDatos(), 'asistenciaStudents', m.studentId))),
  );

  const estudiantes = fichas
    .filter((f) => f.exists())
    .map((f) => f.data() as Student)
    .filter((e) => e.activo)
    .sort((a, b) =>
      `${a.apellidos} ${a.nombres}`.localeCompare(`${b.apellidos} ${b.nombres}`),
    );

  return { estudiantes, matriculas };
}

/**
 * Insumos del reporte de tercera hora — §4.1 del modelo de datos.
 *
 * La consulta va acotada por SEDE obligatoriamente: desde que el coordinador quedó
 * acotado, Firestore rechaza la consulta entera si no puede probar que todo el
 * resultado será legible. Por eso es un reporte POR SEDE, no uno del colegio entero.
 * El índice que lo sostiene es `sede + fecha + jornada + bloque`.
 */
export async function leerInsumosTerceraHora(input: {
  sede: string;
  fecha: string;
  jornada: 'manana' | 'tarde';
}): Promise<{ sesiones: Session[]; llegadas: LateArrival[]; estudiantes: Student[] }> {
  if (!(await listo())) return { sesiones: [], llegadas: [], estudiantes: [] };

  const sesiones = aLista<Session>(
    await getDocs(
      query(
        collection(baseDatos(), 'asistenciaSessions'),
        where('sede', '==', input.sede),
        where('fecha', '==', input.fecha),
        where('jornada', '==', input.jornada),
        where('bloque', '==', 3),
      ),
    ),
  );

  const llegadas = aLista<LateArrival>(
    await getDocs(
      query(
        collection(baseDatos(), 'asistenciaLateArrivals'),
        where('sede', '==', input.sede),
        where('fecha', '==', input.fecha),
      ),
    ),
  );

  // Solo se piden las fichas de quienes aparecen ausentes: traer el colegio entero para
  // mostrar veinte nombres sería un gasto sin sentido.
  const ausentes = new Set<string>();
  for (const s of sesiones) {
    for (const [id, m] of Object.entries(s.estudiantes ?? {})) {
      if (m.estado.startsWith('ausencia') || m.estado === 'evasion') ausentes.add(id);
    }
  }
  const fichas = await Promise.all(
    [...ausentes].map((id) => getDoc(doc(baseDatos(), 'asistenciaStudents', id))),
  );

  return {
    sesiones,
    llegadas,
    estudiantes: fichas.filter((f) => f.exists()).map((f) => f.data() as Student),
  };
}

/** Registra una llamada o aviso a la familia. Un solo historial para todos los motivos. */
export async function registrarContacto(input: {
  studentId: string;
  grado: string;
  sede: string;
  fecha: string;
  motivoContacto: string;
  telefonoUsado: string;
  resultado: 'contesto' | 'no_contesto' | 'pendiente';
  observacion: string;
}): Promise<void> {
  const autor = await exigirAutor();
  const ref = doc(collection(baseDatos(), 'asistenciaFamilyContacts'));
  await setDoc(ref, {
    contactId: ref.id,
    ...input,
    llamadoPor: autor,
    llamadoEn: serverTimestamp(),
  });
}

/**
 * Mapa grado -> slotId del director, desde `asistenciaConfig/directores`.
 *
 * Es el mismo documento espejo que consultan las reglas. Se lee aquí solo para no
 * ofrecer botones que el servidor rechazaría; quien decide sigue siendo la regla.
 * El mapa va anidado bajo `mapa` porque un grado de mañana como `9.1` chocaría con la
 * notación de rutas de campo de Firestore.
 */
export async function leerDirectores(): Promise<Record<string, string>> {
  if (!(await listo())) return {};
  const snap = await getDoc(doc(baseDatos(), 'asistenciaConfig', 'directores'));
  return snap.exists() ? ((snap.data().mapa ?? {}) as Record<string, string>) : {};
}

export async function leerEstudiante(studentId: string): Promise<Student | null> {
  if (!(await listo())) return null;
  const snap = await getDoc(doc(baseDatos(), 'asistenciaStudents', studentId));
  return snap.exists() ? (snap.data() as Student) : null;
}

/**
 * Edita los datos de contacto de la ficha.
 *
 * Ni se intentan los campos que las reglas blindan: `docHash`, `qrToken`, `gradoActual`
 * y `sede`. Enviarlos haría fallar la escritura entera, y de todos modos no le
 * corresponde al cliente cambiarlos — `gradoActual` es de lo que depende que las reglas
 * reconozcan al director de grupo.
 */
export async function actualizarFicha(
  studentId: string,
  cambios: { acudiente?: string; telefonos?: string[]; fotoPath?: string | null },
): Promise<void> {
  await exigirAutor();
  await updateDoc(doc(baseDatos(), 'asistenciaStudents', studentId), cambios);
}

/**
 * Crea la sesión si no existe. El id es determinista, así que si la planilla y otro
 * origen la crean a la vez, es el mismo documento: el segundo la reutiliza en vez de
 * duplicarla.
 */
export async function abrirSesion(input: {
  sede: Session['sede'];
  grado: string;
  jornada: Session['jornada'];
  fecha: string;
  bloque: number;
  subjectId: string;
  slotId: string;
}): Promise<Session> {
  const autor = await exigirAutor();
  const id = construirSessionId(input.sede, input.grado, input.fecha, input.bloque);
  const ref = doc(baseDatos(), 'asistenciaSessions', id);

  const existente = await getDoc(ref);
  if (existente.exists()) return existente.data() as Session;

  const nueva = {
    sessionId: id,
    ...input,
    createdBy: autor,
    createdAt: serverTimestamp(),
    closed: false,
    closedBy: null,
    closedAt: null,
    estudiantes: {},
    ultimaEscrituraPor: autor,
    ultimaEscrituraEn: serverTimestamp(),
  };

  try {
    await setDoc(ref, nueva);
  } catch {
    // Perdió la carrera contra otro dispositivo: la sesión ya existe, se reutiliza.
    const otra = await getDoc(ref);
    if (otra.exists()) return otra.data() as Session;
    throw new Error('No fue posible abrir la sesión de clase.');
  }
  return { ...nueva, createdAt: Date.now(), ultimaEscrituraEn: Date.now() } as Session;
}

/**
 * Marca a UN estudiante con rutas de campo puntuales.
 *
 * Así dos docentes que tocan estudiantes distintos de la misma sesión no se pisan:
 * Firestore fusiona por campo. Reemplazar el mapa completo sería el error clásico.
 */
export async function marcarEstudiante(
  sessionIdDoc: string,
  studentId: string,
  estado: MarkCode,
  extra: { motivo?: string | null; observacion?: string | null } = {},
): Promise<void> {
  const autor = await exigirAutor();
  const ref = doc(baseDatos(), 'asistenciaSessions', sessionIdDoc);
  const base = `estudiantes.${studentId}`;

  const previo = await getDoc(ref);
  const yaTenia = Boolean(
    previo.exists() && (previo.data().estudiantes ?? {})[studentId],
  );

  const cambios: Record<string, unknown> = {
    [`${base}.estado`]: estado,
    [`${base}.motivo`]: extra.motivo ?? null,
    [`${base}.observacion`]: extra.observacion ?? null,
    ultimaEscrituraPor: autor,
    ultimaEscrituraEn: serverTimestamp(),
  };

  if (yaTenia) {
    // Corrección: la autoría original es inmutable; queda quién la modificó, y la
    // Cloud Function archiva el valor anterior en el historial.
    cambios[`${base}.modificadoPor`] = autor;
    cambios[`${base}.modificadoEn`] = serverTimestamp();
  } else {
    cambios[`${base}.registradoPor`] = autor;
    cambios[`${base}.registradoEn`] = serverTimestamp();
    cambios[`${base}.modificadoPor`] = null;
    cambios[`${base}.modificadoEn`] = null;
  }

  await updateDoc(ref, cambios);
}

/** Cierre manual y explícito. Las casillas vacías NO se convierten en nada. */
export async function cerrarSesion(sessionIdDoc: string): Promise<void> {
  const autor = await exigirAutor();
  await updateDoc(doc(baseDatos(), 'asistenciaSessions', sessionIdDoc), {
    closed: true,
    closedBy: autor,
    closedAt: serverTimestamp(),
    ultimaEscrituraPor: autor,
    ultimaEscrituraEn: serverTimestamp(),
  });
}

