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
  deleteField,
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
import { httpsCallable } from 'firebase/functions';

import { db, esperarAuth, functions } from '../lib/firebase';
import { sessionId as construirSessionId } from './domain/ids';
import type { MarkCode } from './domain/marks';
import type {
  AlertConfig,
  ColumnaDireccion,
  DireccionGrupo,
  Enrollment,
  Event,
  EventMemberSource,
  EventSession,
  LateArrival,
  Session,
  Student,
  ValorCelda,
} from './domain/types';
import { ALERT_CONFIG_POR_DEFECTO } from './domain/alertas';
import { exigirAutor } from './identidad';
import { registrarEnvio } from './sincronizacion';

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
   *
   * `jornada` es OPCIONAL a proposito: solo los coordinadores de central que aparecen en
   * `autoridadSede.soloJornada` estan acotados; el resto sigue con la sede completa. Si
   * viene, la regla (`asisCoordinaJornada`) exige el campo `jornada` del documento — sin
   * este filtro Firestore rechaza la consulta ENTERA, no la recorta.
   */
  | { tipo: 'coordinador'; sede: string; jornada?: 'manana' | 'tarde' }
  /**
   * Rectora y cargos de apoyo (PTA, apoyo): LEEN todo, no escriben nada. Se acota por
   * SEDE para no traerse el colegio entero de una vez, aunque la regla
   * (`asisIsRectora()` / `asisConsultaAmpliada()`) no dependa de ningun campo del
   * documento — a diferencia del coordinador, aqui el filtro es solo por volumen, no
   * porque Firestore lo exija.
   */
  | { tipo: 'consulta'; sede: string };

export async function leerSesiones(
  alcance: AlcanceLectura,
  filtro: { subjectId?: string; desde?: string; hasta?: string } = {},
): Promise<Session[]> {
  if (!(await listo())) return [];

  const cons: QueryConstraint[] = [];
  if (alcance.tipo === 'docente') cons.push(where('slotId', '==', alcance.slotId));
  if (alcance.tipo === 'director') cons.push(where('grado', '==', alcance.grado));
  if (alcance.tipo === 'coordinador') {
    cons.push(where('sede', '==', alcance.sede));
    if (alcance.jornada) cons.push(where('jornada', '==', alcance.jornada));
  }
  if (alcance.tipo === 'consulta') cons.push(where('sede', '==', alcance.sede));
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
 * Llegadas tarde de un GRADO, para el panel del estudiante.
 *
 * Se acota por `grado` y no por `sede` porque es lo que la regla le permite al director
 * de grupo: `asisIsDirectorOf(resource.data.grado)`. Con el filtro por sede, un director
 * que no es coordinador veria la consulta rechazada entera — no vacia, rechazada.
 *
 * El indice `(grado, fecha)` ya esta desplegado. Si algun dia se anade otra condicion
 * aqui, hay que anadir tambien su indice: sin el, Firestore no devuelve vacio, falla.
 */
export async function leerLlegadasTardePorGrado(input: {
  grado: string;
  desde: string;
  hasta: string;
}): Promise<LateArrival[]> {
  if (!(await listo())) return [];
  return aLista<LateArrival>(
    await getDocs(
      query(
        collection(baseDatos(), 'asistenciaLateArrivals'),
        where('grado', '==', input.grado),
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

/**
 * Busca estudiantes por apellido o nombre dentro de una sede.
 *
 * Por defecto SOLO activos: es lo que quiere un docente pasando lista. Pero desde que
 * existe el boton de retirar (`activo: false`), un retirado se vuelve INALCANZABLE si
 * este filtro no se pudiera relajar - no hay otra puerta a su ficha, y reintegrarlo exige
 * poder abrirla primero. `incluirInactivos` queda apagado por defecto para no mezclar, en
 * la busqueda de todos los dias, a alguien que ya no esta en el colegio.
 */
export async function buscarEstudiantes(
  sede: string,
  texto: string,
  incluirInactivos = false,
): Promise<Student[]> {
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
    .filter((e) => e.activo || incluirInactivos)
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

/**
 * Mapa sede -> correos con autoridad de coordinacion, desde
 * `asistenciaConfig/autoridadSede`. Es el mismo documento espejo que evalua
 * `asisCoordinaSede` en las reglas (ver `rules/asistencia.rules`): se lee aqui solo para
 * no ofrecer, en la ficha del estudiante, un boton de "registrar llamada" que el
 * servidor le va a negar a un coordinador de otra sede.
 */
export async function leerAutoridadSede(): Promise<Record<string, string[]>> {
  if (!(await listo())) return {};
  const snap = await getDoc(doc(baseDatos(), 'asistenciaConfig', 'autoridadSede'));
  return snap.exists() ? ((snap.data().mapa ?? {}) as Record<string, string[]>) : {};
}

export interface AutoridadSedeCompleta {
  /** sede -> correos con autoridad de coordinacion. Mismo mapa que `leerAutoridadSede`. */
  mapa: Record<string, string[]>;
  /** sede -> jornada -> correos limitados a esa jornada dentro de esa sede. Solo se usa
   *  hoy en central, pero el documento no lo restringe. */
  soloJornada: Record<string, Record<string, string[]>>;
}

/**
 * Version completa de `leerAutoridadSede()`: trae tambien `soloJornada`, que la version
 * corta no expone porque las pantallas normales no la necesitan (`leerAlcanceUsuario` ya
 * la resuelve para la cuenta que entro). El diagnostico de permisos si la necesita:
 * tiene que reproducir esa misma resolucion para una cuenta AJENA, no la propia.
 */
export async function leerAutoridadSedeCompleta(): Promise<AutoridadSedeCompleta> {
  if (!(await listo())) return { mapa: {}, soloJornada: {} };
  const snap = await getDoc(doc(baseDatos(), 'asistenciaConfig', 'autoridadSede'));
  if (!snap.exists()) return { mapa: {}, soloJornada: {} };
  const d = snap.data();
  return {
    mapa: (d.mapa ?? {}) as Record<string, string[]>,
    soloJornada: (d.soloJornada ?? {}) as Record<string, Record<string, string[]>>,
  };
}

export interface CuentaDiagnostico {
  correo: string;
  /** Si el documento `users/{correo}` EXISTE. Ver el mismo campo en `MiCuenta`. */
  existe: boolean;
  role: string | null;
  active: boolean;
  slotId: string | null;
  /** Bandera de solo-consulta (rectora, PTA, apoyo). Vive en el propio documento de
   *  usuario, no en un espejo aparte — ver el comentario de `leerAlcanceUsuario`. */
  asistenciaConsulta: boolean;
}

/**
 * Lee la cuenta de OTRA persona, para el diagnostico de permisos del superusuario.
 *
 * Es el mismo documento que `leerMiCuenta()`, pero aquel usa `exigirAutor()` porque
 * siempre lee la cuenta de quien esta conectado; aqui el correo lo escribe el
 * superusuario a mano, para averiguar que veria OTRA persona.
 */
export async function leerCuentaPorCorreo(correo: string): Promise<CuentaDiagnostico> {
  const normalizado = correo.trim().toLowerCase();
  const vacia: CuentaDiagnostico = {
    correo: normalizado,
    existe: false,
    role: null,
    active: false,
    slotId: null,
    asistenciaConsulta: false,
  };
  if (!(await listo()) || !normalizado) return vacia;
  const snap = await getDoc(doc(baseDatos(), 'users', normalizado));
  if (!snap.exists()) return vacia;
  const d = snap.data();
  return {
    correo: normalizado,
    existe: true,
    role: (d.role as string | null) ?? null,
    active: d.active === true,
    slotId: (d.slotId as string | null) ?? null,
    asistenciaConsulta: d.asistenciaConsulta === true,
  };
}

export interface AlcanceUsuario {
  /** Solo lectura ampliada: rectora o cargo de apoyo (PTA, apoyo). No registra nada. */
  soloConsulta: boolean;
  /** Jornada a la que esta limitado un coordinador de central, o null si manda en toda
   *  la sede (el resto de sedes, y el coordinador de central que no aparece en
   *  `soloJornada`). */
  jornadaLimitada: 'manana' | 'tarde' | null;
}

/**
 * Que le toca leer al usuario actual, resuelto contra los DOS documentos espejo que
 * tambien consultan las reglas: `asistenciaConfig/consultaAmpliada` (cargos de apoyo) y
 * `asistenciaConfig/autoridadSede` (jornada del coordinador). Evita ofrecer una consulta
 * que el servidor va a rechazar, o filtrar de mas a quien no le corresponde.
 *
 * Si alguno de los dos documentos AUN no existe (colegio recien arrancado, nadie lo ha
 * creado todavia), no revienta: un documento de configuracion sin crear no puede dejar
 * a nadie sin planilla, asi que se cae en los valores por defecto (nadie ampliado, nadie
 * limitado).
 */
export async function leerAlcanceUsuario(sede: string): Promise<AlcanceUsuario> {
  const porDefecto: AlcanceUsuario = { soloConsulta: false, jornadaLimitada: null };
  if (!(await listo())) return porDefecto;
  const correo = await exigirAutor();

  // La bandera de "solo consulta" vive en `users/{correo}`, NO en un documento espejo
  // aparte. Esa decision se tomo del lado de las reglas y por seguridad: la restriccion
  // tambien entra en `asisCanRecord()`, que se evalua en cada marca de asistencia, y
  // hacerla depender de un documento que puede faltar dejaria al colegio entero sin poder
  // pasar lista (un error en una regla es una denegacion). Ver `asisConsultaAmpliada` en
  // rules/asistencia.rules.
  const [cuentaSnap, autoridadSnap] = await Promise.all([
    getDoc(doc(baseDatos(), 'users', correo)),
    getDoc(doc(baseDatos(), 'asistenciaConfig', 'autoridadSede')),
  ]);

  const soloConsulta = cuentaSnap.exists() && cuentaSnap.data().asistenciaConsulta === true;

  // La restriccion de jornada va POR SEDE, no por persona: la misma coordinadora que solo
  // lleva la manana de central coordina Gustavo Rodas entera, tarde incluida. Leerla como
  // una propiedad de la persona le borraria siete grupos que si le corresponden.
  const porSede = autoridadSnap.exists()
    ? ((autoridadSnap.data().soloJornada ?? {}) as Record<string, Record<string, string[]>>)
    : {};
  const deEstaSede = porSede[sede] ?? {};
  const jornadaLimitada: 'manana' | 'tarde' | null = (deEstaSede.manana ?? []).includes(correo)
    ? 'manana'
    : (deEstaSede.tarde ?? []).includes(correo)
      ? 'tarde'
      : null;

  return { soloConsulta, jornadaLimitada };
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

/**
 * Umbrales de alerta institucionales (`asistenciaConfig/alertas`).
 *
 * `read: if isActiveUser()` en las reglas: cualquier docente activo puede leerlos, para
 * saber contra que umbral se mide su racha o su porcentaje. Si el documento no existe
 * todavia (colegio recien arrancado, nadie lo ha guardado), se cae en el valor por
 * defecto en vez de fallar — el modulo no puede quedar sin alertas solo porque nadie
 * abrio la pantalla de configuracion.
 */
export async function leerConfigAlertas(): Promise<AlertConfig> {
  if (!(await listo())) return ALERT_CONFIG_POR_DEFECTO;
  const snap = await getDoc(doc(baseDatos(), 'asistenciaConfig', 'alertas'));
  return snap.exists() ? (snap.data() as AlertConfig) : ALERT_CONFIG_POR_DEFECTO;
}

/**
 * Guarda los umbrales. La regla solo lo permite a superusuario o coordinador
 * (`docId == 'alertas' && asisIsCoordinador()`): es institucional, no de cada docente.
 */
export async function guardarConfigAlertas(config: AlertConfig): Promise<void> {
  await exigirAutor();
  await setDoc(doc(baseDatos(), 'asistenciaConfig', 'alertas'), config);
}

/**
 * Alta de un estudiante que NO viene de Master2000: se registra directo desde la
 * planilla. Pasa por la Cloud Function `crearEstudianteManual` porque el hash del
 * documento se calcula con una clave que solo existe ahí — así, si este mismo
 * estudiante aparece en una futura importación, el sistema lo reconoce como la misma
 * persona en vez de duplicarlo.
 *
 * La función rechaza la creación (error `already-exists`) si el documento ya pertenece
 * a otro estudiante: puede ser alguien que ya está en otro grado o sede.
 */
export async function crearEstudianteManual(input: {
  nombres: string;
  apellidos: string;
  docNumber: string;
  docType: string;
  grado: string;
  sede: string;
  acudiente: string;
  parentesco: string;
  telefonos: string[];
}): Promise<{ studentId: string }> {
  if (!functions) throw new Error('Firebase no está configurado en esta instalación.');
  const llamar = httpsCallable(functions, 'crearEstudianteManual');
  const resultado = await llamar({ ...input, anio: new Date().getFullYear() });
  return resultado.data as { studentId: string };
}

export async function leerEstudiante(studentId: string): Promise<Student | null> {
  if (!(await listo())) return null;
  const snap = await getDoc(doc(baseDatos(), 'asistenciaStudents', studentId));
  return snap.exists() ? (snap.data() as Student) : null;
}

/**
 * Edita los datos de contacto de la ficha, y tambien la baja/alta logica (`activo`).
 *
 * Ni se intentan los campos que las reglas blindan: `docHash`, `qrToken`, `gradoActual`,
 * `sede` y `docNumber`. Enviarlos haría fallar la escritura entera, y de todos modos no
 * le corresponde al cliente cambiarlos — `gradoActual` es de lo que depende que las
 * reglas reconozcan al director de grupo.
 *
 * `activo: false` es un RETIRO, no un borrado: el estudiante deja de contar en planillas
 * y conteos (ver el filtro `.filter((e) => e.activo)` en `leerGrupo` y
 * `buscarEstudiantes`), pero el documento y su historial de sesiones quedan intactos, y
 * `activo: true` lo reintegra sin perder nada.
 *
 * ⚠️ A PROPOSITO no cierra la matricula (`Enrollment.hasta`) aunque el modelo la
 * contemple: las reglas de `asistenciaEnrollments` solo dejan escribir a coordinacion y
 * al superusuario, nunca al director de grupo. Si este metodo intentara cerrarla, la
 * escritura fallaria entera justo para quien mas usa este boton (el director). Cerrar la
 * matricula, si algun dia hace falta, es tarea de otra pantalla con otra autoridad.
 */
export async function actualizarFicha(
  studentId: string,
  cambios: {
    acudiente?: string;
    parentesco?: string;
    telefonos?: string[];
    fotoPath?: string | null;
    activo?: boolean;
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

  // Con la cache local este getDoc se resuelve del telefono sin tocar la red. Pero SIN
  // red y sin ese documento en cache, fallaria — y es mejor seguir asumiendo "primera
  // vez" (queda con autoria de registro) que dejar la marca sin escribirse por un dato
  // que solo sirve para decidir que campo de autoria llenar.
  let yaTenia = false;
  try {
    const previo = await getDoc(ref);
    yaTenia = Boolean(previo.exists() && (previo.data().estudiantes ?? {})[studentId]);
  } catch {
    yaTenia = false;
  }

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

  // La promesa de updateDoc es el acuse del SERVIDOR, no la escritura local: con la
  // cache activada el cambio ya quedo aplicado en el cliente antes de esta linea.
  // Esperarla aqui dejaria la pantalla colgada sin señal mientras no haya conexion.
  registrarEnvio(updateDoc(ref, cambios));
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
 *
 * Quien ya tiene marca sale de `yaMarcados` — lo que la pantalla ya tiene cargado en
 * memoria — y no de un `getDoc` al servidor: pedirlo aquí obligaría a esperar una
 * respuesta que sin señal no llega, para averiguar algo que la propia planilla visible
 * ya sabe.
 */
export async function llenarColumna(
  sessionIdDoc: string,
  studentIds: string[],
  estado: MarkCode,
  yaMarcados: Record<string, unknown>,
): Promise<number> {
  const autor = await exigirAutor();
  const ref = doc(baseDatos(), 'asistenciaSessions', sessionIdDoc);

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

  // Mismo motivo que en `marcarEstudiante`: esta promesa es el acuse del servidor, y
  // esperarla dejaria colgado el boton de "llenar columna" sin señal.
  registrarEnvio(updateDoc(ref, cambios));
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

// ---------- Eventos: grupos temporales ----------
//
// A diferencia del resto del modulo, aqui la autoridad es la lista `docentes` del propio
// evento, no el puesto (`slotId`) ni la sede. Ver rules/asistencia.rules, "Eventos: grupos
// temporales", para el porque.

/**
 * Eventos en los que participa el usuario.
 *
 * La regla solo permite leer si `callerEmail() in resource.data.docentes`, asi que el
 * filtro `array-contains` es OBLIGATORIO: sin el, Firestore rechaza la consulta entera
 * con permission-denied, no devuelve vacio.
 *
 * Se ordena por `desde` descendente EN MEMORIA, no en la consulta: pedirle a Firestore
 * que ordene exigiria un indice compuesto (array-contains + orderBy), y un indice que
 * falta no devuelve vacio — revienta la consulta con un error que parece de permisos. Ya
 * nos costo una tarde en este proyecto con `buscarPorQrToken`.
 */
export async function leerMisEventos(): Promise<Event[]> {
  if (!(await listo())) return [];
  const correo = await exigirAutor();
  const eventos = aLista<Event>(
    await getDocs(
      query(collection(baseDatos(), 'asistenciaEvents'), where('docentes', 'array-contains', correo)),
    ),
  );
  return eventos.sort((a, b) => (a.desde < b.desde ? 1 : a.desde > b.desde ? -1 : 0));
}

/** Crea un evento nuevo. El creador queda dentro de `docentes`: la regla lo exige. */
export async function crearEvento(input: {
  nombre: string;
  sede: string;
  desde: string;
  hasta: string;
  miembros: string[];
  origenMiembros: EventMemberSource;
}): Promise<Event> {
  const autor = await exigirAutor();
  const ref = doc(collection(baseDatos(), 'asistenciaEvents'));
  const nuevo = {
    eventId: ref.id,
    nombre: input.nombre,
    sede: input.sede,
    desde: input.desde,
    hasta: input.hasta,
    creadoPor: autor,
    docentes: [autor],
    miembros: input.miembros,
    origenMiembros: input.origenMiembros,
    creadoEn: serverTimestamp(),
    activo: true,
  };
  await setDoc(ref, nuevo);
  return { ...nuevo, creadoEn: Date.now() } as Event;
}

/**
 * Comparte el evento. Solo el creador puede: la regla lo impone
 * (`callerEmail() == resource.data.creadoPor` es la unica via para cambiar `docentes`).
 *
 * Recibe la lista COMPLETA, no un correo a añadir, porque tambien sirve para quitar a
 * alguien. Normaliza a minusculas y deduplica porque la identidad del modulo es el
 * correo en minusculas; y la regla exige que el creador siga dentro de la lista.
 */
export async function compartirEvento(eventId: string, correos: string[]): Promise<void> {
  const autor = await exigirAutor();
  const normalizados = [...new Set(correos.map((c) => c.trim().toLowerCase()))];
  if (!normalizados.includes(autor)) normalizados.push(autor);
  await updateDoc(doc(baseDatos(), 'asistenciaEvents', eventId), { docentes: normalizados });
}

/**
 * Refresca la foto fija de integrantes. Accion manual y explicita: `miembros` no se
 * recalcula solo, ver el comentario en `domain/types.ts` sobre por que es una foto fija.
 */
export async function actualizarIntegrantes(eventId: string, miembros: string[]): Promise<void> {
  await exigirAutor();
  await updateDoc(doc(baseDatos(), 'asistenciaEvents', eventId), { miembros });
}

/**
 * Elimina el evento y TODAS sus sesiones, de verdad y para siempre.
 *
 * Pasa por Cloud Function y no por `deleteDoc` por dos razones que no son de comodidad:
 * las reglas dicen `allow delete: if false` en todo el modulo —asi ningun error del
 * cliente puede destruir datos por accidente—, y borrar un documento en Firestore NO
 * borra su subcoleccion: las sesiones quedarian huerfanas, invisibles pero presentes.
 * El servidor las borra en cascada y deja constancia en la auditoria.
 *
 * Solo el creador. La funcion rechaza a los demas con un mensaje que se puede mostrar.
 */
export async function eliminarEvento(eventId: string): Promise<{ sesionesBorradas: number }> {
  if (!functions) throw new Error('Firebase no está configurado en esta instalación.');
  const llamar = httpsCallable(functions, 'eliminarEvento');
  const r = await llamar({ eventId });
  return r.data as { sesionesBorradas: number };
}

export interface ResumenBorradoCruce {
  dryRun: boolean;
  total: number;
  primera: string | null;
  ultima: string | null;
}

/**
 * Borra las SESIONES de un cruce grado+asignatura. No toca estudiantes ni matriculas.
 *
 * Con `dryRun: true` no borra nada: devuelve cuantas sesiones hay y entre que fechas.
 * La interfaz DEBE llamar primero asi y enseñar el resultado antes de confirmar — es
 * irreversible y sobre produccion, y una cifra a la vista es lo unico que distingue
 * "borre la planilla de prueba" de "borre el periodo entero de un grupo real".
 */
export async function borrarSesionesDeCruce(input: {
  grado: string;
  subjectId: string;
  dryRun: boolean;
}): Promise<ResumenBorradoCruce> {
  if (!functions) throw new Error('Firebase no está configurado en esta instalación.');
  const llamar = httpsCallable(functions, 'borrarSesionesDeCruce');
  const r = await llamar(input);
  return r.data as ResumenBorradoCruce;
}

/** Baja logica. Nunca se borra. */
export async function desactivarEvento(eventId: string): Promise<void> {
  await exigirAutor();
  await updateDoc(doc(baseDatos(), 'asistenciaEvents', eventId), { activo: false });
}

/**
 * Sesiones de un evento. Sin filtro extra: la regla las hace legibles por estar dentro de
 * la ruta del evento (`asisEnEvento(eventId)` mira al documento padre, no a un campo
 * propio de la sesion), asi que la consulta es demostrable sin `where` ni indice.
 */
export async function leerSesionesEvento(eventId: string): Promise<EventSession[]> {
  if (!(await listo())) return [];
  return aLista<EventSession>(
    await getDocs(collection(baseDatos(), 'asistenciaEvents', eventId, 'sesiones')),
  );
}

/**
 * Abre la sesion del evento para una fecha, o devuelve la existente. El id es la propia
 * `fecha`, determinista, igual que en `abrirSesion`.
 *
 * Se escribe DIRECTO, sin comprobar antes si existe. Aqui un getDoc previo si seria
 * seguro —la regla mira al evento padre, no a campos del propio documento, asi que no
 * revienta sobre un documento inexistente como le pasaba a `abrirSesion`—, pero seria una
 * lectura de mas en cada apertura para no averiguar nada: el id es determinista, asi que
 * si dos docentes del evento abren la misma fecha a la vez es el MISMO documento.
 *
 * Si la escritura falla, ENTONCES se lee, para distinguir "ya existia" (se reutiliza) de
 * "no tiene permiso" (se propaga el error original, que es el bueno).
 */
export async function abrirSesionEvento(eventId: string, fecha: string): Promise<EventSession> {
  const autor = await exigirAutor();
  const ref = doc(baseDatos(), 'asistenciaEvents', eventId, 'sesiones', fecha);

  const nueva = {
    eventId,
    fecha,
    estudiantes: {},
    ultimaEscrituraPor: autor,
    ultimaEscrituraEn: serverTimestamp(),
  };

  try {
    await setDoc(ref, nueva);
  } catch (e) {
    const otra = await getDoc(ref).catch(() => null);
    if (otra?.exists()) return otra.data() as EventSession;
    throw e;
  }
  return { ...nueva, ultimaEscrituraEn: Date.now() } as EventSession;
}

/**
 * Marca a UN estudiante en la sesion del evento. Mismo patron que `marcarEstudiante`:
 * rutas de campo puntuales para que dos docentes que comparten el evento no se pisen, y
 * la autoria original (`registradoPor`/`registradoEn`) es inmutable una vez puesta.
 */
export async function marcarEnEvento(
  eventId: string,
  fecha: string,
  studentId: string,
  estado: MarkCode,
): Promise<void> {
  const autor = await exigirAutor();
  const ref = doc(baseDatos(), 'asistenciaEvents', eventId, 'sesiones', fecha);
  const base = `estudiantes.${studentId}`;

  const previo = await getDoc(ref);
  const yaTenia = Boolean(previo.exists() && (previo.data().estudiantes ?? {})[studentId]);

  const cambios: Record<string, unknown> = {
    [`${base}.estado`]: estado,
    [`${base}.motivo`]: null,
    [`${base}.observacion`]: null,
    // La regla exige `asisAuthorStamp()`, que valida estos dos campos en toda escritura.
    ultimaEscrituraPor: autor,
    ultimaEscrituraEn: serverTimestamp(),
  };

  if (yaTenia) {
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
 * Universo de estudiantes de una sede, para armar los integrantes de un evento. Es el
 * `candidatos` que consume `resolverIntegrantes` de `domain/eventos.ts`.
 *
 * Solo activos: uno dado de baja no debe poder elegirse en un evento nuevo.
 */
export async function leerEstudiantesDeSede(sede: string): Promise<Student[]> {
  if (!(await listo())) return [];
  const todos = aLista<Student>(
    await getDocs(query(collection(baseDatos(), 'asistenciaStudents'), where('sede', '==', sede))),
  );
  return todos.filter((e) => e.activo);
}

// ---------- Direccion de grupo: el cuaderno del director ----------
//
// NO es asistencia y no se cruza con ella: columnas que el propio director define
// (cuotas, equipos de aseo, requisitos). SOLO el director del grado accede — ni
// coordinacion, ni rectora, ni superusuario (`asisIsDirectorOf`, ver
// rules/asistencia.rules). El año va como SUBCOLECCION para que el `{grado}` venga en
// la RUTA y la regla lo resuelva sin mirar campos del documento.

export async function leerDireccionGrupo(grado: string, anio: number): Promise<DireccionGrupo | null> {
  if (!(await listo())) return null;
  const snap = await getDoc(doc(baseDatos(), 'asistenciaDireccionGrupo', grado, 'anios', String(anio)));
  return snap.exists() ? (snap.data() as DireccionGrupo) : null;
}

/**
 * Devuelve el cuaderno del año, y solo lo crea si de verdad no existe.
 *
 * ⚠️ AQUI SE LEE ANTES DE ESCRIBIR, Y NO ES NEGOCIABLE. Es lo contrario de lo que hacen
 * `abrirSesion` y `abrirSesionEvento`, a proposito.
 *
 * Aquellas escriben directo porque sus REGLAS rechazan sobrescribir un documento que ya
 * existe: la identidad de una sesion es inmutable, asi que un `setDoc` sobre una sesion
 * viva rebota. Aqui esa proteccion no existe —la regla del cuaderno solo comprueba quien
 * pregunta—, asi que un `setDoc` incondicional PASA y reemplaza el documento entero.
 *
 * Eso fue exactamente lo que ocurrio el 2026-08-12: el director creaba sus columnas, se
 * guardaban bien, y al volver a entrar la pantalla las borraba sola. No es que no se
 * guardara; es que se destruia al abrir.
 *
 * Leer primero aqui es ademas SEGURO, que es lo que lo hace posible: la regla es
 * `asisIsDirectorOf(grado)` con el grado en la RUTA, sin mirar `resource`, asi que leer
 * un documento inexistente no revienta la evaluacion como si pasaba en `abrirSesion`.
 */
export async function abrirDireccionGrupo(grado: string, anio: number): Promise<DireccionGrupo> {
  const autor = await exigirAutor();
  const ref = doc(baseDatos(), 'asistenciaDireccionGrupo', grado, 'anios', String(anio));

  const existente = await getDoc(ref);
  if (existente.exists()) return existente.data() as DireccionGrupo;

  const nuevo = {
    grado,
    anio,
    columnas: [],
    valores: {},
    ultimaEscrituraPor: autor,
    ultimaEscrituraEn: serverTimestamp(),
  };
  await setDoc(ref, nuevo);
  return { ...nuevo, ultimaEscrituraEn: Date.now() } as DireccionGrupo;
}

/**
 * Reemplaza el arreglo de columnas (añadir, quitar, reordenar, renombrar).
 *
 * `columnas` SI se reemplaza entero, a diferencia de `valores`: es una lista corta que
 * solo el unico director del grado toca, no un mapa por estudiante donde dos escrituras
 * simultaneas puedan pisarse.
 *
 * `valores` opcional: quitar una columna debe llevarse sus valores en la MISMA
 * escritura, o quedan huerfanos ocupando el documento sin que ninguna columna los
 * muestre ni los cuente.
 */
export async function guardarColumnas(
  grado: string,
  anio: number,
  columnas: ColumnaDireccion[],
  valores?: DireccionGrupo['valores'],
): Promise<void> {
  const autor = await exigirAutor();
  const ref = doc(baseDatos(), 'asistenciaDireccionGrupo', grado, 'anios', String(anio));

  const cambios: Record<string, unknown> = {
    columnas,
    ultimaEscrituraPor: autor,
    ultimaEscrituraEn: serverTimestamp(),
  };
  if (valores !== undefined) cambios.valores = valores;

  // Mismo motivo que en `marcarEstudiante`: esta promesa es el acuse del SERVIDOR, y
  // esperarla dejaria la pantalla de columnas colgada sin señal.
  registrarEnvio(updateDoc(ref, cambios));
}

/**
 * Escribe UNA casilla. `null` la borra (vuelve a "sin asignar").
 *
 * Ruta de campo puntual (`valores.est_0412.col_3`), nunca el mapa `valores` completo:
 * misma razon que en las sesiones de clase, aunque aqui solo escriba un director por
 * grado — el patron se mantiene porque tambien protege contra dos pestañas abiertas del
 * mismo director pisandose entre si.
 *
 * `deleteField()` y no `valor: null`: un `null` literal seria un valor legitimo y
 * distinto de "sin asignar" (ver el comentario de `ValorCelda` en `domain/types.ts`) —
 * escribirlo dejaria la casilla contando como "0 puntos puestos" en vez de vacia.
 */
export async function marcarCelda(
  grado: string,
  anio: number,
  studentId: string,
  columnaId: string,
  valor: ValorCelda | null,
): Promise<void> {
  const autor = await exigirAutor();
  const ref = doc(baseDatos(), 'asistenciaDireccionGrupo', grado, 'anios', String(anio));
  const campo = `valores.${studentId}.${columnaId}`;

  const cambios: Record<string, unknown> = {
    [campo]: valor === null ? deleteField() : valor,
    ultimaEscrituraPor: autor,
    ultimaEscrituraEn: serverTimestamp(),
  };

  // Mismo motivo que en `marcarEstudiante`: la promesa de `updateDoc` es el acuse del
  // servidor, no la escritura local; esperarla aqui dejaria la casilla muerta sin señal.
  registrarEnvio(updateDoc(ref, cambios));
}

