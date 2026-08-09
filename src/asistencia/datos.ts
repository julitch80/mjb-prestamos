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
  /**
   * El coordinador TAMBIEN tiene que acotar, y por sede. Estaba sin filtro, y por eso su
   * planilla fallaba entera con permission-denied: la regla solo le permite las sesiones
   * de las sedes donde tiene autoridad, y Firestore rechaza la consulta completa si no
   * puede demostrar de antemano que TODO el resultado sera legible.
   *
   * El sintoma era enganoso: al fallar la consulta no llegaban sesiones, y la pantalla
   * ofrecia "Abrir la primera sesion" como si el colegio no tuviera ninguna.
   */
  | { tipo: 'coordinador'; sede: string };

export async function leerSesiones(
  alcance: AlcanceLectura,
  filtro: { subjectId?: string; desde?: string; hasta?: string } = {},
): Promise<Session[]> {
  if (!(await listo())) return [];

  const cons: QueryConstraint[] = [];
  if (alcance.tipo === 'docente') cons.push(where('slotId', '==', alcance.slotId));
  if (alcance.tipo === 'director') cons.push(where('grado', '==', alcance.grado));
  if (alcance.tipo === 'coordinador') cons.push(where('sede', '==', alcance.sede));
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

/**
 * Llegadas tarde a la institución de una sede en un rango.
 * OJO: no es el `retraso` de clase. Otra autoridad y otra unidad temporal.
 */
export async function leerLlegadasTarde(input: {
  sede: string;
  desde: string;
  hasta: string;
}): Promise<LateArrival[]> {
  if (!(await listo())) return [];
  return aLista<LateArrival>(
    await getDocs(
      query(
        collection(baseDatos(), 'asistenciaLateArrivals'),
        where('sede', '==', input.sede),
        where('fecha', '>=', input.desde),
        where('fecha', '<=', input.hasta),
      ),
    ),
  );
}

/**
 * Resuelve el codigo QR de un estudiante.
 *
 * Consulta SOLO por `qrToken` y comprueba la sede despues, en memoria. Podria filtrarse
 * por las dos cosas a la vez, pero eso exigiria un indice compuesto — y un indice que
 * falta no devuelve vacio: revienta la consulta con un error que parece de permisos. Ya
 * nos costo una tarde. Con un solo campo, el indice es automatico.
 *
 * Devuelve `null` si el codigo no corresponde a nadie, y lanza si el estudiante existe
 * pero es de otra sede: son dos situaciones distintas y quien registra necesita
 * distinguirlas. Un codigo desconocido puede ser un QR ajeno al colegio; un estudiante de
 * otra sede es un caso real que hay que resolver de otra manera.
 */
export async function buscarPorQrToken(
  sede: string,
  token: string,
): Promise<{ estudiante: Student | null; otraSede: boolean }> {
  if (!(await listo()) || !token.trim()) return { estudiante: null, otraSede: false };
  const encontrados = aLista<Student>(
    await getDocs(
      query(collection(baseDatos(), 'asistenciaStudents'), where('qrToken', '==', token.trim())),
    ),
  );
  const e = encontrados.find((x) => x.activo) ?? null;
  if (!e) return { estudiante: null, otraSede: false };
  if (e.sede !== sede) return { estudiante: null, otraSede: true };
  return { estudiante: e, otraSede: false };
}

/** Busca estudiantes por apellido o nombre dentro de una sede. */
export async function buscarEstudiantes(sede: string, texto: string): Promise<Student[]> {
  if (!(await listo()) || texto.trim().length < 2) return [];
  // Firestore no hace búsqueda por subcadena. A escala de una sede (unos cientos de
  // estudiantes) filtrar en memoria es más simple y más barato que montar un índice de
  // búsqueda, y el resultado es inmediato porque la caché offline ya los tiene.
  const todos = aLista<Student>(
    await getDocs(
      query(collection(baseDatos(), 'asistenciaStudents'), where('sede', '==', sede)),
    ),
  );
  const t = texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
  return todos
    .filter((e) => e.activo)
    .filter((e) =>
      `${e.apellidos} ${e.nombres}`
        .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .includes(t),
    )
    .slice(0, 12);
}

/**
 * Registra una llegada tarde. Id determinista por (estudiante, día): un segundo
 * registro el mismo día es rechazado por el servidor, no por una validación que se
 * pueda olvidar.
 */
export async function registrarLlegadaTarde(input: {
  studentId: string;
  grado: string;
  sede: string;
  fecha: string;
  horaLlegada: string;
  bloqueIngreso: number;
  estado: 'sin_justificar' | 'pendiente_verificacion';
}): Promise<void> {
  const autor = await exigirAutor();
  const id = `${input.studentId}_${input.fecha}`;
  const ref = doc(baseDatos(), 'asistenciaLateArrivals', id);

  const existente = await getDoc(ref);
  if (existente.exists()) {
    const prev = existente.data() as LateArrival;
    throw new ConflictoError(
      `Ya tiene llegada tarde registrada hoy a las ${prev.horaLlegada}, por ${prev.registradoPor}.`,
    );
  }

  await setDoc(ref, {
    lateArrivalId: id,
    ...input,
    motivo: null,
    observacion: null,
    registradoPor: autor,
    registradoEn: serverTimestamp(),
    resueltoPor: null,
    resueltoEn: null,
  });
}

/** Cierra la verificación: la excusa se aprueba o se descarta. */
export async function resolverLlegadaTarde(
  lateArrivalId: string,
  estado: 'sin_justificar' | 'pendiente_verificacion' | 'justificada',
  motivo: string | null,
  observacion: string | null,
): Promise<void> {
  const autor = await exigirAutor();
  await updateDoc(doc(baseDatos(), 'asistenciaLateArrivals', lateArrivalId), {
    estado,
    motivo,
    observacion,
    resueltoPor: autor,
    resueltoEn: serverTimestamp(),
  });
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

export interface MiCuenta {
  correo: string;
  /**
   * Si el documento `users/{correo}` EXISTE. Se distingue de "existe pero inactivo"
   * porque son fallas distintas: una es una cuenta que nadie creo (o creada con otra
   * combinacion de mayusculas, que para Firestore es otro documento), la otra es una
   * cuenta desactivada a proposito.
   */
  existe: boolean;
  /** El puesto TAL COMO LO VE EL SERVIDOR. Puede diferir del que resuelve la interfaz. */
  slotId: string | null;
  rol: string | null;
  activo: boolean;
}

/**
 * Lee la propia cuenta de Firestore.
 *
 * POR QUE EXISTE: el puesto (`slotId`) se resuelve en DOS sitios. La interfaz lo saca de
 * la lista estatica de MJB; las reglas, de este documento. Cuando el campo esta vacio,
 * la app ofrece "Tomar foto" y el servidor la rechaza — y el docente se queda sin
 * entender nada, porque en pantalla todo indica que si es el director.
 *
 * Esto trae el valor del servidor para poder ENSENAR la discrepancia en vez de deducirla.
 * Nadie deberia tener que abrir la consola de Firebase para saber por que no puede
 * trabajar.
 */
export async function leerMiCuenta(): Promise<MiCuenta | null> {
  if (!(await listo())) return null;
  const correo = await exigirAutor();
  const snap = await getDoc(doc(baseDatos(), 'users', correo));
  if (!snap.exists()) return { correo, existe: false, slotId: null, rol: null, activo: false };
  const d = snap.data();
  return {
    correo,
    existe: true,
    slotId: (d.slotId as string | null) ?? null,
    rol: (d.role as string | null) ?? null,
    activo: d.active === true,
  };
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
  cambios: {
    acudiente?: string;
    parentesco?: string;
    telefonos?: string[];
    fotoPath?: string | null;
  },
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

  // ⚠️ NO comprobar la existencia con un getDoc previo.
  //
  // La regla de lectura evalua `resource.data.slotId`, y en un documento que NO EXISTE
  // `resource` es null: la regla revienta y devuelve permission-denied. Es decir, el
  // intento de comprobar si la sesion existe fallaba SIEMPRE cuando no existia, que es
  // justo el caso normal al abrir la primera del dia. El error que veia el docente
  // hablaba de permisos y no tenia nada que ver con permisos.
  //
  // Se escribe directo: si el documento ya existe, la escritura falla y AHI si se lee,
  // porque a esas alturas el documento existe y la regla puede evaluarse.
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
  } catch (e) {
    // O la sesión ya existía (la abrió otro, o el mismo docente antes), o de verdad no
    // tiene permiso. Se distingue leyendo: si el documento existe y puede leerlo, se
    // reutiliza; si no, el error original es el bueno.
    const otra = await getDoc(ref).catch(() => null);
    if (otra?.exists()) return otra.data() as Session;
    throw e;
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

/**
 * Llena de golpe las casillas VACÍAS de una sesión con la misma marca.
 *
 * Es el flujo real del docente: "hoy vinieron casi todos" → llenar asistencia y corregir
 * los tres que faltaron; o al principio del año → llenar ausencia y pasar uno por uno,
 * que obliga a mirarles la cara mientras los conoce.
 *
 * SOLO toca las vacías, nunca pisa lo ya marcado. Si sobreescribiera, un toque
 * accidental borraría el trabajo de media clase, y además cada sobreescritura contaría
 * como corrección en el historial.
 *
 * Va en UNA sola escritura con rutas de campo puntuales para los 33 estudiantes: una
 * evaluación de regla en vez de 33, que es justamente para lo que existe el modelo de
 * un documento por sesión con los estudiantes dentro.
 */
export async function llenarColumna(
  sessionIdDoc: string,
  studentIds: string[],
  estado: MarkCode,
): Promise<number> {
  const autor = await exigirAutor();
  const ref = doc(baseDatos(), 'asistenciaSessions', sessionIdDoc);

  const actual = await getDoc(ref);
  if (!actual.exists()) throw new Error('La sesión ya no existe.');
  const yaMarcados = (actual.data().estudiantes ?? {}) as Record<string, unknown>;

  const vacios = studentIds.filter((id) => !yaMarcados[id]);
  if (vacios.length === 0) return 0;

  const cambios: Record<string, unknown> = {
    ultimaEscrituraPor: autor,
    ultimaEscrituraEn: serverTimestamp(),
  };
  for (const id of vacios) {
    cambios[`estudiantes.${id}.estado`] = estado;
    cambios[`estudiantes.${id}.registradoPor`] = autor;
    cambios[`estudiantes.${id}.registradoEn`] = serverTimestamp();
    cambios[`estudiantes.${id}.motivo`] = null;
    cambios[`estudiantes.${id}.observacion`] = null;
    cambios[`estudiantes.${id}.modificadoPor`] = null;
    cambios[`estudiantes.${id}.modificadoEn`] = null;
  }

  await updateDoc(ref, cambios);
  return vacios.length;
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

