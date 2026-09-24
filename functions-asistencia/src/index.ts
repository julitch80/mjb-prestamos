/**
 * Cloud Functions del modulo de asistencia — codebase `asistencia`.
 *
 * ⛔ Se despliegan SOLO con `firebase deploy --only functions:asistencia`.
 * Un `--only functions` sin acotar borraria las funciones de los demas codebases,
 * incluidas las blocking functions de MJB que restringen el acceso al dominio
 * institucional. Borrarlas no tumba la app: la deja abierta a cualquier cuenta.
 *
 * Aqui vive lo que NO puede vivir en el cliente:
 *  - el HMAC del documento de identidad (el secreto jamas baja al navegador);
 *  - el archivado del historial de correcciones (garantia server-side);
 *  - la rotacion anual de tokens QR;
 *  - el mantenimiento de `gradoActual`, del que dependen las reglas para reconocer al
 *    director de grupo.
 */

import { randomBytes, createHmac } from 'node:crypto';
import { initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { onDocumentUpdated, onDocumentWritten } from 'firebase-functions/v2/firestore';
import { defineSecret } from 'firebase-functions/params';

import {
  actualizacionDeFicha,
  bloqueosDeImportacion,
  diferenciasDeImportacion,
  planImport,
  summarizePlan,
  VERSION_IMPORTACION,
  type IncomingRow,
} from '../../src/asistencia/domain/import-matching';
import { normalizarSexo, normalizarTipoDocumento, type CampoFicha } from '../../src/asistencia/domain/import-parse';
import { enrollmentId } from '../../src/asistencia/domain/ids';
import { construirCensoDeSesion } from '../../src/asistencia/domain/evasion';
import type { DocType, Session, Student } from '../../src/asistencia/domain/types';
import { setGlobalOptions } from 'firebase-functions/v2';
import {
  avisoVencido,
  desenmascararFirma,
  enlaceDeAviso,
  enmascararFirma,
  leerFragmento,
  motivosParaFamilias,
  MOTIVO_HABLAR,
  ETIQUETA_HABLAR,
  primerCelular,
  primerNombreDe,
  rutaSoporte,
  URL_BASE_AVISOS_POR_DEFECTO,
  validarRespuesta,
  vencimientoDesde,
  type AvisoInasistencia,
  type SoporteAviso,
} from '../../src/asistencia/domain/avisos';
import { mensajeAvisoConEnlace } from '../../src/asistencia/domain/sms';
import { nombreCompleto, nombresDePila } from '../../src/asistencia/domain/nombres';
import { jornadaDeGrado, sessionId } from '../../src/asistencia/domain/ids';
import { findMark, isJustified } from '../../src/asistencia/domain/marks';
import { MOTIVOS_SEMILLA, type MotivoFamilia } from '../../src/asistencia/domain/permanencia';
import { claveDeAvisos, firmaValida, firmarAviso, nuevoIdDeAviso } from './firma-aviso';
import { decodificarSoporte } from './soporte-aviso';

// Techo de copias simultáneas por función (23-sep-2026). Si alguien las ataca con
// muchas solicitudes, se frenan aquí en vez de multiplicarse y cobrar por uso. Con
// 80 solicitudes por copia (2.ª generación), 10 copias atienden de sobra al colegio.
setGlobalOptions({ maxInstances: 10 });

initializeApp();
const db = getFirestore();
const REGION = 'us-central1';

/**
 * Secreto del HMAC:  firebase functions:secrets:set DOC_HASH_KEY
 * Si se pierde o cambia, TODOS los docHash dejan de emparejar y la siguiente
 * importacion veria a todos los estudiantes como nuevos.
 */
const DOC_HASH_KEY = defineSecret('DOC_HASH_KEY');

async function requireRole(
  auth: { token?: { email?: string } } | undefined,
  roles: string[],
): Promise<string> {
  const email = auth?.token?.email?.toLowerCase();
  if (!email) throw new HttpsError('unauthenticated', 'Sesion no valida.');
  const snap = await db.doc(`users/${email}`).get();
  if (!snap.exists || snap.data()?.active !== true) {
    throw new HttpsError('permission-denied', 'Usuario no registrado o inactivo.');
  }
  const role = snap.data()?.role as string;
  if (!roles.includes(role)) {
    throw new HttpsError('permission-denied', `Requiere rol: ${roles.join(' o ')}.`);
  }
  return email;
}

/** Token opaco del QR: 16 bytes. No contiene ningun dato personal. */
const newQrToken = () => randomBytes(16).toString('base64url');

function hashDoc(secret: string, raw: string): string {
  const normalizado = (raw ?? '').replace(/\D+/g, '');
  return normalizado ? createHmac('sha256', secret).update(normalizado).digest('hex') : '';
}

/**
 * Autoridad sobre un grado+sede para crear una ficha a mano (fuera de la importacion).
 *
 * No es lo mismo que `requireRole`: "director de grupo" no es un `role` de `users`, es
 * una condicion derivada — un `docente` cuyo `slotId` aparece en
 * `asistenciaConfig/directores.mapa[grado]`. Se replica aqui la misma logica que evaluan
 * las reglas de Firestore para editar una ficha (`asisIsDirectorOf`,
 * `asisCoordinaSede`), porque esta funcion usa el Admin SDK y las reglas no la alcanzan.
 */
async function requireAutoridadSobreGrado(
  auth: { token?: { email?: string } } | undefined,
  grado: string,
  sede: string,
): Promise<string> {
  const email = auth?.token?.email?.toLowerCase();
  if (!email) throw new HttpsError('unauthenticated', 'Sesion no valida.');
  const userSnap = await db.doc(`users/${email}`).get();
  if (!userSnap.exists || userSnap.data()?.active !== true) {
    throw new HttpsError('permission-denied', 'Usuario no registrado o inactivo.');
  }
  const user = userSnap.data()!;
  const role = user.role as string;

  if (role === 'superusuario') return email;

  if (role === 'coordinador') {
    const autoridad = await db.doc('asistenciaConfig/autoridadSede').get();
    const correos = ((autoridad.data()?.mapa ?? {}) as Record<string, string[]>)[sede] ?? [];
    if (correos.includes(email)) return email;
    throw new HttpsError('permission-denied', 'No coordina esa sede.');
  }

  const directores = await db.doc('asistenciaConfig/directores').get();
  const mapa = (directores.data()?.mapa ?? {}) as Record<string, string>;
  if (mapa[grado] && mapa[grado] === user.slotId) return email;

  throw new HttpsError('permission-denied', 'No dirige ese grupo ni coordina esa sede.');
}

/**
 * Operaciones de una ficha nueva completa: estudiante, token QR y matricula. Comun a la
 * importacion masiva y a la creacion manual desde la planilla — es el mismo hecho
 * ("existe un estudiante nuevo") con dos orígenes distintos.
 */
function opsNuevaFicha(
  input: {
    nombres: string;
    apellidos: string;
    docHash: string;
    docNumber: string;
    docType: DocType;
    acudiente: string;
    parentesco: string;
    telefonos: string[];
    grado: string;
    sede: Student['sede'];
    /** Del listado ampliado. Solo llegan aqui los que traen valor (`sinVacios`). */
    extra?: Partial<Student>;
  },
  anio: number,
  fechaHoy: string,
): { studentId: string; ops: ((b: FirebaseFirestore.WriteBatch) => void)[] } {
  const studentId = db.collection('asistenciaStudents').doc().id;
  const token = newQrToken();
  const estudiante: Student = {
    // Primero los opcionales, para que ninguno pueda pisar un campo de identidad.
    ...(input.extra ?? {}),
    studentId,
    nombres: input.nombres,
    apellidos: input.apellidos,
    docHash: input.docHash,
    docNumber: input.docNumber,
    docType: input.docType,
    acudiente: input.acudiente,
    parentesco: input.parentesco,
    telefonos: input.telefonos,
    fotoPath: null,
    qrToken: token,
    sede: input.sede,
    gradoActual: input.grado,
    activo: true,
  };
  const eid = enrollmentId(studentId, anio, 1);
  return {
    studentId,
    ops: [
      (b) => b.set(db.doc(`asistenciaStudents/${studentId}`), estudiante),
      (b) => b.set(db.doc(`asistenciaQrTokens/${token}`), { token, studentId, anio, activo: true }),
      (b) =>
        b.set(db.doc(`asistenciaEnrollments/${eid}`), {
          studentId, anio, grado: input.grado, seq: 1, sede: input.sede, desde: fechaHoy, hasta: null,
        }),
    ],
  };
}

function fechaDeHoy(): string {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
}

async function commitInChunks(ops: ((b: FirebaseFirestore.WriteBatch) => void)[]) {
  for (let i = 0; i < ops.length; i += 450) {
    const batch = db.batch();
    for (const op of ops.slice(i, i + 450)) op(batch);
    await batch.commit();
  }
}

const audit = (entry: Record<string, unknown>) =>
  db.collection('auditLogs').add({ modulo: 'asistencia', ...entry, executedAt: FieldValue.serverTimestamp() });

// ---------------------------------------------------------------------------
//  Importacion de estudiantes desde Master2000
// ---------------------------------------------------------------------------

interface ImportPayload {
  anio: number;
  /** El documento viaja en claro SOLO aqui, en transito TLS. Nunca se persiste. */
  rows: {
    nombres: string;
    apellidos: string;
    docNumber: string;
    docType: string | null;
    grado: string;
    acudiente: string;
    parentesco: string;
    telefonos: string[];
    primerNombre?: string;
    primerApellido?: string;
    matricula?: string;
    sexo?: string | null;
    fechaNacimiento?: string;
    direccion?: string;
    barrio?: string;
    correoAcudiente?: string;
  }[];
  /**
   * Los campos que el archivo trae. Lo que no esta aqui NO se escribe en las fichas
   * existentes. Una pantalla anterior al 2026-09-16 no lo manda: en ese caso se asume el
   * juego de campos que esa pantalla siempre enviaba, que es lo que hacia la funcion
   * antes — con la diferencia de que ya no se escribe ningun valor vacio.
   */
  camposPresentes?: CampoFicha[];
  dryRun: boolean;
  fileName: string;
}

const CAMPOS_PANTALLA_ANTERIOR: CampoFicha[] = [
  'nombres', 'apellidos', 'docType', 'acudiente', 'parentesco', 'telefonos',
];

/** Quita vacios: el Admin SDK rechaza `undefined`, y un '' no debe llegar a una ficha nueva. */
function sinVacios(o: Record<string, unknown>): Partial<Student> {
  const r: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) {
    if (v === undefined || v === null) continue;
    if (typeof v === 'string' && v.trim() === '') continue;
    r[k] = typeof v === 'string' ? v.trim() : v;
  }
  return r as Partial<Student>;
}

export const importStudents = onCall(
  {
    region: REGION,
    secrets: [DOC_HASH_KEY],
    cors: true,
    // El colegio entero son ~690 filas de bachillerato en una sola pasada: eso son unas
    // 2.000 escrituras en cinco lotes, mas la lectura de todas las fichas existentes para
    // emparejar. Con los 60 s por defecto la importacion completa queda al filo, y el
    // cliente solo recibe un "internal" sin explicacion.
    //
    // El limite alto NO significa que tarde: una importacion de un grupo suelto sigue
    // tardando segundos. Solo evita que la del colegio entero muera a mitad de camino,
    // que es el escenario malo — deja datos escritos a medias.
    timeoutSeconds: 540,
    memory: '512MiB',
  },
  async (request) => {
    const email = await requireRole(request.auth, ['superusuario']);
    const payload = request.data as ImportPayload;
    if (!Array.isArray(payload?.rows) || payload.rows.length === 0) {
      throw new HttpsError('invalid-argument', 'El archivo no trae filas.');
    }

    const secret = DOC_HASH_KEY.value();
    const presentes: CampoFicha[] = Array.isArray(payload.camposPresentes)
      ? payload.camposPresentes
      : CAMPOS_PANTALLA_ANTERIOR;
    const incoming: IncomingRow[] = payload.rows.map((r) => ({
      nombres: (r.nombres ?? '').trim(),
      apellidos: (r.apellidos ?? '').trim(),
      docHash: hashDoc(secret, r.docNumber),
      // Se normaliza igual que antes de hashear, para que el numero guardado y el hash
      // provengan exactamente del mismo string y no discrepen por un punto o un guion.
      docNumber: (r.docNumber ?? '').replace(/\D+/g, ''),
      // Se vuelve a normalizar aqui aunque la pantalla ya lo haga: el servidor no confia
      // en que el cliente mande "RC" y no "R.C.".
      docType: normalizarTipoDocumento(r.docType ?? ''),
      // El grado se conserva LITERAL: la 'º' distingue la jornada.
      grado: (r.grado ?? '').trim(),
      acudiente: (r.acudiente ?? '').trim(),
      parentesco: (r.parentesco ?? '').trim(),
      telefonos: (r.telefonos ?? []).filter(Boolean),
      primerNombre: r.primerNombre,
      primerApellido: r.primerApellido,
      matricula: r.matricula,
      sexo: normalizarSexo(r.sexo ?? ''),
      // Solo ISO completo: la pantalla ya convirtio el dd/mm/aaaa del Master.
      fechaNacimiento: /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(r.fechaNacimiento ?? '')
        ? r.fechaNacimiento
        : undefined,
      direccion: r.direccion,
      barrio: r.barrio,
      correoAcudiente: r.correoAcudiente,
    }));

    const existentes = (await db.collection('asistenciaStudents').get()).docs.map(
      (d) => d.data() as Student,
    );
    const plan = planImport(incoming, existentes);
    const resumen = summarizePlan(plan);

    // La comparacion ficha por ficha se calcula SIEMPRE, no solo en la previsualizacion: al
    // confirmar se vuelve a calcular sobre los datos de ESE momento, y si algo se sale de lo
    // esperado la funcion se niega a escribir aunque la pantalla lo haya permitido. La
    // pantalla es una comodidad; el freno de verdad es este.
    const porId = new Map(existentes.map((s) => [s.studentId, s]));
    const diferencias = diferenciasDeImportacion(plan.updates, porId, presentes);
    const bloqueos = bloqueosDeImportacion(diferencias);

    if (payload.dryRun) {
      return {
        dryRun: true,
        version: VERSION_IMPORTACION,
        diferencias,
        bloqueos,
        resumen,
        revisiones: plan.reviews.map((r) => ({
          nombres: r.row.nombres,
          apellidos: r.row.apellidos,
          motivo: r.reason,
          candidatos: r.candidateIds,
        })),
      };
    }

    if (bloqueos.length > 0) {
      await audit({
        action: 'importStudents', executedBy: email, fileName: payload.fileName ?? null,
        anio: payload.anio, resumen, status: 'bloqueada', bloqueos,
      });
      throw new HttpsError('failed-precondition', `No se importó nada. ${bloqueos.join(' ')}`);
    }

    const ops: ((b: FirebaseFirestore.WriteBatch) => void)[] = [];
    const fechaHoy = fechaDeHoy();

    for (const c of plan.creates) {
      // La importacion es hoy solo de sede central (alcance v1, bachillerato).
      const { ops: nuevos } = opsNuevaFicha(
        {
          ...c.row,
          // Una ficha nueva si necesita un tipo: sin dato, 'otro' y no un 'TI' supuesto.
          docType: c.row.docType ?? 'otro',
          sede: 'central',
          extra: sinVacios({
            primerNombre: c.row.primerNombre,
            primerApellido: c.row.primerApellido,
            matricula: c.row.matricula,
            sexo: c.row.sexo,
            fechaNacimiento: c.row.fechaNacimiento,
            direccion: c.row.direccion,
            barrio: c.row.barrio,
            correoAcudiente: c.row.correoAcudiente?.toLowerCase(),
          }),
        },
        payload.anio,
        fechaHoy,
      );
      ops.push(...nuevos);
    }

    for (const u of plan.updates) {
      // Lo que el archivo no trae no se toca, y un vacio no borra. Toda la regla vive en
      // `actualizacionDeFicha`, probada en tests/import-matching.test.ts. NUNCA el
      // docHash ni el qrToken.
      //
      // Hasta el 2026-09-16 aqui se escribian acudiente y telefonos SIEMPRE: importar el
      // listado para Guardianes, que no los trae, habria vaciado todas las fichas.
      const cambios = actualizacionDeFicha(u.row, presentes);
      if (Object.keys(cambios).length === 0) continue;
      ops.push((b) => b.update(db.doc(`asistenciaStudents/${u.studentId}`), cambios));
    }

    for (const r of plan.reviews) {
      ops.push((b) =>
        b.set(db.collection('asistenciaImportReviews').doc(), {
          nombres: r.row.nombres, apellidos: r.row.apellidos, grado: r.row.grado,
          motivo: r.reason, candidatos: r.candidateIds, resuelto: false,
          fileName: payload.fileName ?? null, createdAt: FieldValue.serverTimestamp(),
        }),
      );
    }

    await commitInChunks(ops);
    await audit({ action: 'importStudents', executedBy: email, fileName: payload.fileName ?? null, anio: payload.anio, resumen, status: 'ok' });
    return { dryRun: false, version: VERSION_IMPORTACION, resumen };
  },
);

// ---------------------------------------------------------------------------
//  Alta manual de un estudiante desde la planilla (no viene de Master2000)
// ---------------------------------------------------------------------------

interface NuevoEstudianteManualPayload {
  nombres: string;
  apellidos: string;
  docNumber: string;
  docType: string;
  grado: string;
  sede: string;
  acudiente: string;
  parentesco: string;
  telefonos: string[];
  anio: number;
}

// `invoker: 'public'` es OBLIGATORIO: sin declararlo explícito, Cloud Run deja
// el servicio en "Requiere autenticación" (IAM) en vez de acceso público — la
// petición del navegador nunca llega al código (que sí exige por dentro estar
// autenticado), Cloud Run la rechaza antes con un error genérico. Mismo
// problema y misma causa que en mjb-prestamos/functions/src/index.ts
// (replaceTeacher), detectado el 10 de agosto de 2026 al desplegar el
// codebase asistencia por primera vez en mjb-prestamos.
export const crearEstudianteManual = onCall(
  { region: REGION, secrets: [DOC_HASH_KEY], cors: true, invoker: 'public' },
  async (request) => {
    const payload = request.data as NuevoEstudianteManualPayload;
    if (!payload?.grado?.trim() || !payload?.sede?.trim()) {
      throw new HttpsError('invalid-argument', 'Falta el grado o la sede.');
    }
    const email = await requireAutoridadSobreGrado(request.auth, payload.grado.trim(), payload.sede.trim());

    const nombres = (payload.nombres ?? '').trim();
    const apellidos = (payload.apellidos ?? '').trim();
    const docNumber = (payload.docNumber ?? '').replace(/\D+/g, '');
    if (!nombres || !apellidos) {
      throw new HttpsError('invalid-argument', 'Nombres y apellidos son obligatorios.');
    }
    if (!docNumber) {
      throw new HttpsError('invalid-argument', 'El numero de documento es obligatorio.');
    }

    const secret = DOC_HASH_KEY.value();
    const docHash = hashDoc(secret, docNumber);

    // Misma identidad que usa la importacion: el hash es la persona. Si ya existe, no se
    // crea un duplicado — puede ser un estudiante que ya esta en otro grado o sede y hay
    // que trasladarlo, no darlo de alta otra vez.
    const existente = await db
      .collection('asistenciaStudents')
      .where('docHash', '==', docHash)
      .limit(1)
      .get();
    if (!existente.empty) {
      const d = existente.docs[0].data() as Student;
      throw new HttpsError(
        'already-exists',
        `Ya existe una ficha con ese documento: ${d.nombres} ${d.apellidos} (${d.gradoActual}, ${d.sede}). No se creó una nueva.`,
      );
    }

    const { studentId, ops } = opsNuevaFicha(
      {
        nombres,
        apellidos,
        docHash,
        docNumber,
        docType: (['RC', 'TI', 'CC', 'PPT'].includes(payload.docType) ? payload.docType : 'otro') as DocType,
        acudiente: (payload.acudiente ?? '').trim(),
        parentesco: (payload.parentesco ?? '').trim(),
        telefonos: (payload.telefonos ?? []).filter(Boolean),
        grado: payload.grado.trim(),
        sede: payload.sede.trim() as Student['sede'],
      },
      payload.anio,
      fechaDeHoy(),
    );

    await commitInChunks(ops);
    await audit({
      action: 'crearEstudianteManual',
      executedBy: email,
      studentId,
      grado: payload.grado,
      sede: payload.sede,
      status: 'ok',
    });
    return { studentId };
  },
);

// ---------------------------------------------------------------------------
//  Borrado — el UNICO camino por el que algo desaparece de verdad
// ---------------------------------------------------------------------------
//
// Las reglas de Firestore dicen `allow delete: if false` en TODAS las colecciones del
// modulo, y asi se quedan. El borrado vive aqui, en el Admin SDK, por dos razones:
//
//  1. Ningun error de programacion en el cliente puede destruir datos por accidente. No
//     existe un camino desde el navegador que borre; solo existe pedirlo por aqui.
//  2. Todo borrado queda en `auditLogs` con quien lo hizo, cuando y cuanto borro. Un
//     `allow delete` en las reglas no deja rastro de nada.

/**
 * Elimina un evento y TODAS sus sesiones.
 *
 * `recursiveDelete` no es un lujo: en Firestore borrar un documento NO borra sus
 * subcolecciones. Sin esto, las sesiones del evento quedarian huerfanas —invisibles en
 * la interfaz, pero presentes en la base de datos y accesibles por ruta directa—, que es
 * justo lo contrario de lo que pide quien borra un evento con datos de menores.
 *
 * Solo el CREADOR. Un evento se comparte para registrar, no para destruir: si cualquiera
 * de la lista pudiera borrarlo, el trabajo de todos dependeria del peor criterio del
 * grupo. Es la misma logica del candado que impide cambiar la lista de docentes.
 */
// `invoker: 'public'` es OBLIGATORIO en funciones nuevas: ver la nota junto a
// crearEstudianteManual mas arriba. Sin esto, la primera vez que se despliega
// esta funcion Cloud Run la deja en "Requiere autenticacion" (IAM) y el
// navegador nunca llega al codigo.
export const eliminarEvento = onCall({ region: REGION, cors: true, invoker: 'public' }, async (request) => {
  const email = await requireRole(request.auth, ['docente', 'coordinador', 'superusuario']);
  const { eventId } = request.data as { eventId: string };
  if (!eventId) throw new HttpsError('invalid-argument', 'Falta el evento.');

  const ref = db.doc(`asistenciaEvents/${eventId}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Ese evento ya no existe.');

  const evento = snap.data()!;
  if (evento.creadoPor !== email) {
    throw new HttpsError(
      'permission-denied',
      'Solo quien creó el evento puede eliminarlo. Puede pedirle que lo haga, o salirse de la lista.',
    );
  }

  // Se cuenta ANTES de borrar: despues no hay a que preguntarle, y el registro de
  // auditoria sin la magnitud de lo borrado no sirve para reconstruir que paso.
  const sesiones = await ref.collection('sesiones').count().get();

  await db.recursiveDelete(ref);
  await audit({
    action: 'eliminarEvento',
    executedBy: email,
    eventId,
    nombre: evento.nombre ?? null,
    sesionesBorradas: sesiones.data().count,
    integrantes: (evento.miembros as string[] | undefined)?.length ?? 0,
    status: 'ok',
  });
  return { sesionesBorradas: sesiones.data().count };
});

/**
 * Borra las SESIONES de un cruce grado+asignatura. No toca estudiantes ni matriculas.
 *
 * Para que existe: durante el desarrollo se registraron planillas de prueba sobre
 * estudiantes reales. Esas marcas son falsas y no deben quedarse — no por espacio, sino
 * porque son datos de asistencia inventados sobre menores identificables.
 *
 * NO borra el grupo. Un grupo no es un objeto que se pueda borrar: es el conjunto de
 * estudiantes matriculados, y esas fichas son reales. Ademas volverian en la siguiente
 * importacion de Master2000, asi que borrarlas no lograria nada y perderia las fotos.
 *
 * `dryRun` es obligatorio en la practica: la interfaz debe llamar primero sin borrar,
 * enseñar cuantas sesiones y de que fechas, y solo entonces confirmar. Es una operacion
 * irreversible sobre produccion y no se lanza a ciegas.
 */
// `invoker: 'public'` es OBLIGATORIO en funciones nuevas: misma razon que en
// eliminarEvento, arriba.
export const borrarSesionesDeCruce = onCall({ region: REGION, cors: true, invoker: 'public' }, async (request) => {
  const email = await requireRole(request.auth, ['superusuario']);
  const { grado, subjectId, dryRun } = request.data as {
    grado: string;
    subjectId: string;
    dryRun: boolean;
  };
  if (!grado || !subjectId) {
    throw new HttpsError('invalid-argument', 'Hacen falta el grado y la asignatura.');
  }

  const encontradas = await db
    .collection('asistenciaSessions')
    .where('grado', '==', grado)
    .where('subjectId', '==', subjectId)
    .get();

  const fechas = encontradas.docs.map((d) => d.data().fecha as string).sort();
  const resumen = {
    total: encontradas.size,
    primera: fechas[0] ?? null,
    ultima: fechas[fechas.length - 1] ?? null,
  };

  if (dryRun) return { dryRun: true, ...resumen };

  // Una por una con recursiveDelete y no un batch: cada sesion arrastra su subcoleccion
  // `historial`, que un `batch.delete()` dejaria huerfana.
  for (const d of encontradas.docs) await db.recursiveDelete(d.ref);

  await audit({
    action: 'borrarSesionesDeCruce',
    executedBy: email,
    grado,
    subjectId,
    ...resumen,
    status: 'ok',
  });
  return { dryRun: false, ...resumen };
});

// ---------------------------------------------------------------------------
//  Rotacion anual de tokens QR (el studentId NO cambia: el historico se conserva)
// ---------------------------------------------------------------------------

export const regenerateQrTokens = onCall({ region: REGION, cors: true }, async (request) => {
  const email = await requireRole(request.auth, ['superusuario']);
  const { anio } = request.data as { anio: number };
  if (!anio) throw new HttpsError('invalid-argument', 'Falta el anio lectivo.');

  const estudiantes = await db.collection('asistenciaStudents').where('activo', '==', true).get();
  const ops: ((b: FirebaseFirestore.WriteBatch) => void)[] = [];
  for (const doc of estudiantes.docs) {
    const anterior = doc.data().qrToken as string | undefined;
    const token = newQrToken();
    if (anterior) ops.push((b) => b.update(db.doc(`asistenciaQrTokens/${anterior}`), { activo: false }));
    ops.push((b) => b.set(db.doc(`asistenciaQrTokens/${token}`), { token, studentId: doc.id, anio, activo: true }));
    ops.push((b) => b.update(doc.ref, { qrToken: token }));
  }
  await commitInChunks(ops);
  await audit({ action: 'regenerateQrTokens', executedBy: email, anio, count: estudiantes.size, status: 'ok' });
  return { rotados: estudiantes.size };
});

// ---------------------------------------------------------------------------
//  Cambio de grado (mantiene matriculas y gradoActual coherentes)
// ---------------------------------------------------------------------------

export const changeStudentGrade = onCall({ region: REGION, cors: true }, async (request) => {
  const email = await requireRole(request.auth, ['superusuario', 'coordinador']);
  const { studentId, nuevoGrado, desde, anio, sede } = request.data as {
    studentId: string; nuevoGrado: string; desde: string; anio: number;
    sede: 'central' | 'gustavo_rodas' | 'la_finquita';
  };
  if (!studentId || !nuevoGrado || !desde) {
    throw new HttpsError('invalid-argument', 'Faltan datos del cambio de grado.');
  }

  const vigentes = await db
    .collection('asistenciaEnrollments')
    .where('studentId', '==', studentId)
    .where('hasta', '==', null)
    .get();

  const batch = db.batch();
  let seq = 1;
  for (const d of vigentes.docs) {
    // `hasta` es exclusivo: el dia del cambio pertenece ya al grado nuevo.
    batch.update(d.ref, { hasta: desde });
    seq = Math.max(seq, (d.data().seq ?? 1) + 1);
  }
  const eid = enrollmentId(studentId, anio, seq);
  batch.set(db.doc(`asistenciaEnrollments/${eid}`), {
    studentId, anio, grado: nuevoGrado, seq, sede, desde, hasta: null,
  });
  // Campo del que dependen las reglas para reconocer al director de grupo.
  batch.update(db.doc(`asistenciaStudents/${studentId}`), { gradoActual: nuevoGrado });

  await batch.commit();
  await audit({ action: 'changeStudentGrade', executedBy: email, studentId, nuevoGrado, desde, status: 'ok' });
  return { ok: true, enrollmentId: eid };
});

// ---------------------------------------------------------------------------
//  Historial de correcciones (garantia server-side)
// ---------------------------------------------------------------------------

/**
 * Archiva el valor ANTERIOR de cada marca corregida dentro del mapa `estudiantes`.
 *
 * Vive en el servidor a proposito: si dependiera del cliente, una correccion sin rastro
 * seria trivial — y el rastro es justo lo que protege ante una disputa de una familia.
 */
export const onSessionUpdated = onDocumentUpdated(
  { region: REGION, document: 'asistenciaSessions/{sessionId}' },
  async (event) => {
    const before = event.data?.before;
    const after = event.data?.after;
    if (!before || !after) return;

    const antes = (before.data()?.estudiantes ?? {}) as Record<string, { estado?: string }>;
    const despues = (after.data()?.estudiantes ?? {}) as Record<string, { estado?: string }>;
    const autor = (after.data()?.ultimaEscrituraPor as string) ?? null;

    const entradas = Object.entries(despues)
      .filter(([id, m]) => antes[id]?.estado !== undefined && antes[id]?.estado !== m.estado)
      .map(([id, m]) => ({
        studentId: id,
        estadoAnterior: antes[id]?.estado ?? null,
        estadoNuevo: m.estado ?? null,
        cambiadoPor: autor,
        cambiadoEn: FieldValue.serverTimestamp(),
      }));

    if (entradas.length === 0) return;
    const batch = db.batch();
    for (const e of entradas) batch.set(before.ref.collection('historial').doc(), e);
    await batch.commit();
  },
);

function archivador(coleccion: string) {
  return onDocumentUpdated(
    { region: REGION, document: `${coleccion}/{docId}` },
    async (event) => {
      const before = event.data?.before;
      const after = event.data?.after;
      if (!before || !after) return;
      await before.ref.collection('historial').add({
        anterior: before.data(),
        cambiadoPor: after.data()?.resueltoPor ?? after.data()?.registradoPor ?? null,
        cambiadoEn: FieldValue.serverTimestamp(),
      });
    },
  );
}

export const onLateArrivalUpdated = archivador('asistenciaLateArrivals');
export const onStudentUpdated = archivador('asistenciaStudents');



// ---------------------------------------------------------------------------
//  Censo de la tercera hora — el insumo de la alerta de evasion (2026-09-09)
// ---------------------------------------------------------------------------

/**
 * Publica el censo del dia de un grupo cada vez que se escribe su sesion de BLOQUE 3.
 *
 * POR QUE EN EL SERVIDOR, y no en el cliente que pasa esa lista:
 *
 *  1. QUIEN LO LEE NO PUEDE LEER LA FUENTE. Un docente de quinta hora no puede abrir la
 *     planilla de tercera de ese grupo —cada marca lleva `motivo` (salud, calamidad) y
 *     `observacion`, informacion de salud de menores—. El censo es el resumen sin nada de
 *     eso, y por eso si puede leerlo cualquier docente activo.
 *  2. SI LO ESCRIBIERA EL CLIENTE SE PODRIA FALSIFICAR. Un censo inventado para un grado
 *     ajeno sembraria alertas de evasion sobre estudiantes que ni vinieron ese dia, y el
 *     coordinador saldria a buscar a alguien que esta en su casa.
 *
 * La regla la calcula `construirCensoDeSesion` (domain/evasion.ts), la MISMA funcion que
 * usan las pruebas: quien la cambie cambia las dos a la vez.
 *
 * ⚠️ SI HAY DOS SESIONES DE BLOQUE 3 PARA EL MISMO GRADO (un docente que abrio la columna
 * con la asignatura equivocada), gana la ultima escrita. Por eso el censo guarda
 * `sessionId`: un censo raro se puede rastrear hasta la planilla que lo produjo en vez de
 * quedar como un misterio.
 */
export const onSesionBloque3 = onDocumentWritten(
  { region: REGION, document: 'asistenciaSessions/{sessionId}' },
  async (event) => {
    const after = event.data?.after;
    // Sesion borrada: no se toca el censo. Las sesiones no se borran desde la aplicacion
    // (`allow delete: if false`), asi que esto solo pasaria por consola, y en ese caso es
    // preferible dejar el censo del dia que vaciarlo sin que nadie se entere.
    if (!after?.exists) return;

    const sesion = { sessionId: after.id, ...after.data() } as Session;
    if (sesion.bloque !== 3) return;

    const censo = construirCensoDeSesion(sesion);
    await db
      .collection('asistenciaCensoDia')
      .doc(censo.censoId)
      .set({ ...censo, actualizadoEn: FieldValue.serverTimestamp() });
  },
);

// ---------------------------------------------------------------------------
//  Avisos de inasistencia por mensaje de texto (2026-09-23)
// ---------------------------------------------------------------------------
//
// Ver `domain/avisos.ts` para las decisiones. Aqui, lo que no puede vivir en el cliente:
//  - comprobar que de verdad corresponde avisar (ausente sin justificar en el bloque 3,
//    sin llegada tarde, con celular), sin fiarse de la lista que manda la pantalla;
//  - la firma del enlace, cuya clave no baja nunca al navegador;
//  - la hora y el autor de cada paso, que salen del servidor y del token de sesion;
//  - la pagina publica, que no tiene sesion: solo puede hablar con estas funciones.
//
// Nada de esto lo escribe el cliente: las reglas de `asistenciaAvisos` son de solo
// lectura. El registro que vale como soporte es la subcoleccion `eventos`, a la que
// solo se le AGREGAN documentos; los campos de resumen del aviso (`estado`,
// `enviadoPor`, `respuesta`) son una comodidad para consultar y los deriva el servidor.

/**
 * Coordinador de la sede, y en central de esa jornada si esta acotado (la misma logica
 * que `asisCoordinaJornada` en las reglas). El superusuario NO: sus acciones no son
 * atribuibles a una persona, y avisar a una familia es una actuacion con autor.
 *
 * Recibe el correo YA validado por `requireRole`, que cada funcion llama en su primera
 * linea: la sesion se verifica antes de mirar los datos, para que a quien no tiene
 * cuenta no se le conteste nada sobre ellos («Datos incompletos», «Ese aviso no
 * existe»). Los identificadores no se pueden adivinar, pero no hay por que dar pistas.
 */
async function exigirCoordinaJornada(email: string, sede: string, jornada: string): Promise<void> {
  const autoridad = await exigirCoordinaSede(email, sede);
  const otra = jornada === 'manana' ? 'tarde' : 'manana';
  const soloOtra =
    ((autoridad.soloJornada ?? {}) as Record<string, Record<string, string[]>>)[sede]?.[otra] ?? [];
  if (soloOtra.includes(email)) throw new HttpsError('permission-denied', 'No coordina esa jornada.');
}

/**
 * Coordinador de la sede, sin mirar la jornada: la misma condicion que la regla de
 * lectura de `asistenciaAvisos` (`asisCoordinaSede`). Para LEER; para actuar sobre un
 * aviso se exige ademas la jornada (`exigirCoordinaJornada`).
 */
async function exigirCoordinaSede(email: string, sede: string): Promise<Record<string, unknown>> {
  const autoridad = (await db.doc('asistenciaConfig/autoridadSede').get()).data() ?? {};
  const correos = ((autoridad.mapa ?? {}) as Record<string, string[]>)[sede] ?? [];
  if (!correos.includes(email)) throw new HttpsError('permission-denied', 'No coordina esa sede.');
  return autoridad;
}

async function urlBaseDeAvisos(): Promise<string> {
  const cfg = (await db.doc('asistenciaConfig/avisos').get()).data();
  const url = typeof cfg?.urlBase === 'string' ? cfg.urlBase.trim() : '';
  // Solo https: un enlace sin cifrar a una pagina de datos de menores no sale nunca.
  return url.startsWith('https://') ? url : URL_BASE_AVISOS_POR_DEFECTO;
}

async function motivosDeFamilias(): Promise<{ id: string; etiqueta: string; admiteSoporte: boolean }[]> {
  const cfg = (await db.doc('asistenciaConfig/permanencia').get()).data();
  const motivos = (cfg?.motivos as MotivoFamilia[] | undefined) ?? MOTIVOS_SEMILLA;
  return motivosParaFamilias(motivos);
}

/**
 * Freno por direccion IP para las dos funciones publicas. Vive en la memoria de cada
 * copia de la funcion, asi que no es exacto (con 10 copias como techo, alguien podria
 * hacer hasta diez veces el limite), pero no hace falta que lo sea: la firma de 72 bits
 * no se adivina a fuerza de intentos. Esto es para que nadie use la funcion de martillo.
 */
const LIMITE_POR_IP = 30;
const VENTANA_IP_MS = 10 * 60_000;
const intentosPorIp = new Map<string, { n: number; desde: number }>();
function frenarPorIp(ip: string | undefined): void {
  const clave = ip || 'sin_ip';
  const ahora = Date.now();
  const r = intentosPorIp.get(clave);
  if (!r || ahora - r.desde > VENTANA_IP_MS) {
    intentosPorIp.set(clave, { n: 1, desde: ahora });
    return;
  }
  r.n += 1;
  if (r.n > LIMITE_POR_IP) {
    throw new HttpsError('resource-exhausted', 'Demasiados intentos. Intente más tarde.');
  }
}

/**
 * Un solo error para "enlace mal formado", "firma incorrecta" y "aviso inexistente". Si
 * se distinguieran, la respuesta le diria a quien prueba enlaces al azar cuales ids
 * existen.
 */
const enlaceNoValido = () => new HttpsError('not-found', 'Este enlace no es válido.');

async function avisoDesdeEnlace(data: unknown, docHashKey: string) {
  const d = (data ?? {}) as { avisoId?: unknown; firma?: unknown };
  const partes =
    typeof d.avisoId === 'string' && typeof d.firma === 'string'
      ? leerFragmento(`${d.avisoId}.${d.firma}`)
      : null;
  if (!partes) throw enlaceNoValido();
  if (!firmaValida(claveDeAvisos(docHashKey), partes.avisoId, partes.firma)) throw enlaceNoValido();
  const ref = db.doc(`asistenciaAvisos/${partes.avisoId}`);
  const snap = await ref.get();
  if (!snap.exists) throw enlaceNoValido();
  return { ref, aviso: snap.data() as AvisoInasistencia };
}

async function llegoTarde(studentId: string, fecha: string): Promise<boolean> {
  const q = await db
    .collection('asistenciaLateArrivals')
    .where('studentId', '==', studentId)
    .where('fecha', '==', fecha)
    .limit(1)
    .get();
  return !q.empty;
}

type RechazoCreacion = 'ficha' | 'jornada' | 'sin_celular' | 'no_ausente' | 'llego_tarde';

type ResultadoCreacion =
  | { studentId: string; avisoId: string; telefono: string; texto: string; nuevo: boolean }
  | { studentId: string; rechazo: RechazoCreacion };

/** El texto completo de un aviso ya creado, con su firma recalculada. */
function textoDeAviso(clave: Buffer, aviso: AvisoInasistencia): string {
  return desenmascararFirma(aviso.textoRegistrado, aviso.avisoId, firmarAviso(clave, aviso.avisoId));
}

/**
 * Prepara (o recupera) los avisos del dia y devuelve el texto de cada mensaje, ya con su
 * enlace. Llamarla dos veces con los mismos estudiantes devuelve los MISMOS avisos: asi
 * se reanuda la cola si coordinacion recarga la pagina a mitad de camino.
 */
export const crearAvisosInasistencia = onCall(
  { region: REGION, cors: true, invoker: 'public', secrets: [DOC_HASH_KEY] },
  async (request) => {
    const email = await requireRole(request.auth, ['coordinador']);
    const d = (request.data ?? {}) as {
      sede?: unknown;
      fecha?: unknown;
      jornada?: unknown;
      studentIds?: unknown;
    };
    const sede = typeof d.sede === 'string' ? d.sede : '';
    const fecha = typeof d.fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.fecha) ? d.fecha : '';
    const jornada = d.jornada === 'manana' || d.jornada === 'tarde' ? d.jornada : '';
    const studentIds = Array.isArray(d.studentIds)
      ? d.studentIds.filter((x): x is string => typeof x === 'string')
      : [];
    if (!sede || !fecha || !jornada) {
      throw new HttpsError('invalid-argument', 'Faltan la sede, la fecha o la jornada.');
    }
    if (studentIds.length === 0 || studentIds.length > 120) {
      throw new HttpsError('invalid-argument', 'Lista de estudiantes vacía o demasiado larga.');
    }

    await exigirCoordinaJornada(email, sede, jornada);
    const clave = claveDeAvisos(DOC_HASH_KEY.value());
    const urlBase = await urlBaseDeAvisos();
    const resultados: ResultadoCreacion[] = [];

    for (const studentId of [...new Set(studentIds)]) {
      // Uno por estudiante y dia. El indice es un documento solo del servidor (las reglas
      // lo niegan por el catch-all): su `create` falla si ya existe, y eso es lo que
      // impide que dos coordinadores con la pantalla abierta dupliquen el aviso.
      const indiceRef = db.doc(`asistenciaAvisosPorDia/${fecha}_${studentId}`);
      const indice = await indiceRef.get();
      if (indice.exists) {
        const existente = (await db.doc(`asistenciaAvisos/${indice.data()!.avisoId}`).get()).data() as
          | AvisoInasistencia
          | undefined;
        if (existente) {
          resultados.push({
            studentId,
            avisoId: existente.avisoId,
            telefono: existente.telefono,
            texto: textoDeAviso(clave, existente),
            nuevo: false,
          });
          continue;
        }
      }

      const est = (await db.doc(`asistenciaStudents/${studentId}`).get()).data() as Student | undefined;
      if (!est || est.activo === false || est.sede !== sede) {
        resultados.push({ studentId, rechazo: 'ficha' });
        continue;
      }
      const grado = est.gradoActual;
      if (jornadaDeGrado(grado) !== jornada) {
        resultados.push({ studentId, rechazo: 'jornada' });
        continue;
      }
      const telefono = primerCelular(est.telefonos ?? []);
      if (!telefono) {
        resultados.push({ studentId, rechazo: 'sin_celular' });
        continue;
      }
      // Ausente en el bloque 3 y sin justificar: la misma condicion del reporte de
      // tercera hora (`construirReporteTerceraHora`), comprobada otra vez aqui.
      const sesion = (await db.doc(`asistenciaSessions/${sessionId(sede, grado, fecha, 3)}`).get()).data() as
        | Session
        | undefined;
      const marca = sesion?.estudiantes?.[studentId];
      if (!marca || !findMark(marca.estado)?.isAbsence || isJustified(marca.estado)) {
        resultados.push({ studentId, rechazo: 'no_ausente' });
        continue;
      }
      if (await llegoTarde(studentId, fecha)) {
        resultados.push({ studentId, rechazo: 'llego_tarde' });
        continue;
      }

      const avisoId = nuevoIdDeAviso();
      const firma = firmarAviso(clave, avisoId);
      const texto = mensajeAvisoConEnlace(nombreCompleto(est), enlaceDeAviso(urlBase, avisoId, firma));
      const ahora = Date.now();
      const aviso: AvisoInasistencia = {
        avisoId,
        studentId,
        grado,
        sede: est.sede,
        jornada,
        fecha,
        telefono,
        primerNombre: primerNombreDe(nombresDePila(est.apellidos, est.nombres)),
        textoRegistrado: enmascararFirma(texto, firma),
        estado: 'creado',
        creadoPor: email,
        creadoEnMs: ahora,
        expiraEnMs: vencimientoDesde(ahora),
        enviadoPor: null,
        enviadoEnMs: null,
        respuesta: null,
      };

      try {
        await db.runTransaction(async (tx) => {
          tx.create(indiceRef, { avisoId, creadoEn: FieldValue.serverTimestamp() });
          const ref = db.doc(`asistenciaAvisos/${avisoId}`);
          tx.create(ref, { ...aviso, creadoEn: FieldValue.serverTimestamp() });
          tx.create(ref.collection('eventos').doc(), {
            tipo: 'creado',
            por: email,
            enMs: ahora,
            en: FieldValue.serverTimestamp(),
          });
        });
        resultados.push({ studentId, avisoId, telefono, texto, nuevo: true });
      } catch {
        // Otro coordinador lo creo en el mismo instante: se devuelve el suyo.
        const otro = (await indiceRef.get()).data();
        const existente = otro
          ? ((await db.doc(`asistenciaAvisos/${otro.avisoId}`).get()).data() as AvisoInasistencia | undefined)
          : undefined;
        if (!existente) throw new HttpsError('aborted', 'No fue posible preparar el aviso. Intente de nuevo.');
        resultados.push({
          studentId,
          avisoId: existente.avisoId,
          telefono: existente.telefono,
          texto: textoDeAviso(clave, existente),
          nuevo: false,
        });
      }
    }
    return { resultados };
  },
);

/**
 * Lo que coordinacion declara al tocar enviar: "salio" o "no salio". La aplicacion no
 * puede saber si el mensaje de verdad se envio (eso lo dice el celular), y por eso esto
 * es la constancia declarada, con autor y hora del servidor.
 */
export const marcarEnvioAviso = onCall({ region: REGION, cors: true, invoker: 'public' }, async (request) => {
  const email = await requireRole(request.auth, ['coordinador']);
  const d = (request.data ?? {}) as { avisoId?: unknown; evento?: unknown };
  const evento = d.evento === 'enviado' || d.evento === 'no_salio' ? d.evento : null;
  if (typeof d.avisoId !== 'string' || !evento) throw new HttpsError('invalid-argument', 'Datos incompletos.');
  const ref = db.doc(`asistenciaAvisos/${d.avisoId}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Ese aviso no existe.');
  const aviso = snap.data() as AvisoInasistencia;
  await exigirCoordinaJornada(email, aviso.sede, aviso.jornada);
  const ahora = Date.now();

  await db.runTransaction(async (tx) => {
    const actual = (await tx.get(ref)).data() as AvisoInasistencia;
    tx.create(ref.collection('eventos').doc(), {
      tipo: evento,
      por: email,
      enMs: ahora,
      en: FieldValue.serverTimestamp(),
    });
    // Si la familia ya respondio, el resumen no retrocede: el evento queda en el
    // historial, pero el aviso sigue "respondido".
    if (actual.estado === 'respondido') return;
    if (evento === 'enviado') {
      tx.update(ref, {
        estado: 'enviado',
        enviadoPor: actual.enviadoPor ?? email,
        enviadoEnMs: actual.enviadoEnMs ?? ahora,
      });
    } else {
      tx.update(ref, { estado: 'no_salio' });
    }
  });
  return { ok: true };
});

/**
 * La pagina publica abre el enlace. NO ESCRIBE NADA y no gasta el enlace: los
 * programas de mensajeria y los antivirus abren los enlaces para revisarlos antes que la
 * persona, y si abrir la pagina contara como uso, la familia encontraria un enlace ya
 * usado sin haber hecho nada.
 */
export const consultarAviso = onCall(
  { region: REGION, cors: true, invoker: 'public', secrets: [DOC_HASH_KEY] },
  async (request) => {
    frenarPorIp(request.rawRequest?.ip);
    const { aviso } = await avisoDesdeEnlace(request.data, DOC_HASH_KEY.value());
    const base = { primerNombre: aviso.primerNombre, fecha: aviso.fecha };
    if (aviso.respuesta) return { ...base, estado: 'respondido' as const };
    if (avisoVencido(aviso, Date.now())) return { ...base, estado: 'vencido' as const };
    // Llego despues de que salio el aviso: se le dice a la familia, en vez de pedirle
    // que explique una inasistencia que no fue.
    if (await llegoTarde(aviso.studentId, aviso.fecha)) {
      return { ...base, estado: 'ingreso_registrado' as const };
    }
    const motivos = await motivosDeFamilias();
    return {
      ...base,
      estado: 'abierto' as const,
      motivos: [...motivos, { id: MOTIVO_HABLAR, etiqueta: ETIQUETA_HABLAR, admiteSoporte: false }],
    };
  },
);

/**
 * La respuesta de la familia. Una sola por aviso; queda como evento sin autor humano.
 *
 * Puede traer la foto del soporte (`soporte: { tipo, datosBase64 }`), solo en las causas
 * que la admiten. Orden: se valida todo lo que se puede ANTES de subir el archivo (para
 * no guardar fotos de avisos vencidos o ya respondidos), se sube, y la transaccion vuelve
 * a validar. Si en ese instante otra respuesta gano la carrera, la foto recien subida se
 * borra: no puede quedar un dato de salud de un menor sin aviso que lo explique.
 */
export const responderAviso = onCall(
  { region: REGION, cors: true, invoker: 'public', secrets: [DOC_HASH_KEY] },
  async (request) => {
    frenarPorIp(request.rawRequest?.ip);
    const { ref, aviso } = await avisoDesdeEnlace(request.data, DOC_HASH_KEY.value());
    const datos = (request.data ?? {}) as { motivoId?: unknown; soporte?: unknown };
    const motivoId = typeof datos.motivoId === 'string' ? datos.motivoId : '';
    const permitidos = await motivosDeFamilias();
    const conSoporte = datos.soporte !== undefined && datos.soporte !== null;
    const ahora = Date.now();

    const previo = validarRespuesta(aviso, motivoId, permitidos, ahora, conSoporte);
    if (previo) throw new HttpsError('failed-precondition', previo);

    let soporte: SoporteAviso | null = null;
    if (conSoporte) {
      const archivo = decodificarSoporte(datos.soporte);
      if ('rechazo' in archivo) throw new HttpsError('invalid-argument', archivo.rechazo);
      const ruta = rutaSoporte(aviso.fecha, aviso.avisoId, archivo.tipo);
      await getStorage()
        .bucket()
        .file(ruta)
        .save(archivo.buf, {
          resumable: false,
          contentType: archivo.tipo,
          metadata: { cacheControl: 'private, no-store' },
        });
      soporte = { ruta, tipo: archivo.tipo, bytes: archivo.buf.length, enMs: ahora };
    }

    const rechazo = await db.runTransaction(async (tx) => {
      const actual = (await tx.get(ref)).data() as AvisoInasistencia;
      const r = validarRespuesta(actual, motivoId, permitidos, ahora, conSoporte);
      if (r) return r;
      tx.update(ref, { estado: 'respondido', respuesta: { motivoId, enMs: ahora }, soporte });
      tx.create(ref.collection('eventos').doc(), {
        tipo: 'respuesta',
        por: null,
        motivoId,
        conSoporte: soporte !== null,
        enMs: ahora,
        en: FieldValue.serverTimestamp(),
      });
      return null;
    });
    if (rechazo) {
      if (soporte) await getStorage().bucket().file(soporte.ruta).delete({ ignoreNotFound: true });
      throw new HttpsError('failed-precondition', rechazo);
    }
    return { ok: true };
  },
);

/**
 * El visor del soporte para coordinacion. El archivo NO tiene enlace publico ni regla de
 * Storage que lo deje leer: sale solo por aqui, despues de comprobar que quien lo pide
 * coordina la sede. Y cada vez que alguien lo abre queda un evento con su nombre: es un
 * dato de salud de un menor, y tiene que saberse quien lo vio.
 */
export const verSoporteAviso = onCall({ region: REGION, cors: true, invoker: 'public' }, async (request) => {
  const email = await requireRole(request.auth, ['coordinador']);
  const avisoId = (request.data as { avisoId?: unknown } | undefined)?.avisoId;
  if (typeof avisoId !== 'string') throw new HttpsError('invalid-argument', 'Datos incompletos.');
  const ref = db.doc(`asistenciaAvisos/${avisoId}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Ese aviso no existe.');
  const aviso = snap.data() as AvisoInasistencia;
  await exigirCoordinaSede(email, aviso.sede);
  if (!aviso.soporte) throw new HttpsError('not-found', 'Este aviso no tiene soporte.');

  const [contenido] = await getStorage().bucket().file(aviso.soporte.ruta).download();
  await ref.collection('eventos').add({
    tipo: 'soporte_visto',
    por: email,
    enMs: Date.now(),
    en: FieldValue.serverTimestamp(),
  });
  return { tipo: aviso.soporte.tipo, datosBase64: contenido.toString('base64') };
});
