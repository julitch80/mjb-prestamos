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
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { defineSecret } from 'firebase-functions/params';

import { planImport, summarizePlan, type IncomingRow } from '../../src/asistencia/domain/import-matching';
import { enrollmentId } from '../../src/asistencia/domain/ids';
import type { DocType, Student } from '../../src/asistencia/domain/types';

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
  },
  anio: number,
  fechaHoy: string,
): { studentId: string; ops: ((b: FirebaseFirestore.WriteBatch) => void)[] } {
  const studentId = db.collection('asistenciaStudents').doc().id;
  const token = newQrToken();
  const estudiante: Student = {
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
    docType: string;
    grado: string;
    acudiente: string;
    parentesco: string;
    telefonos: string[];
  }[];
  dryRun: boolean;
  fileName: string;
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
    const incoming: IncomingRow[] = payload.rows.map((r) => ({
      nombres: (r.nombres ?? '').trim(),
      apellidos: (r.apellidos ?? '').trim(),
      docHash: hashDoc(secret, r.docNumber),
      // Se normaliza igual que antes de hashear, para que el numero guardado y el hash
      // provengan exactamente del mismo string y no discrepen por un punto o un guion.
      docNumber: (r.docNumber ?? '').replace(/\D+/g, ''),
      docType: (['RC', 'TI', 'CC', 'PPT'].includes(r.docType) ? r.docType : 'otro') as DocType,
      // El grado se conserva LITERAL: la 'º' distingue la jornada.
      grado: (r.grado ?? '').trim(),
      acudiente: (r.acudiente ?? '').trim(),
      parentesco: (r.parentesco ?? '').trim(),
      telefonos: (r.telefonos ?? []).filter(Boolean),
    }));

    const existentes = (await db.collection('asistenciaStudents').get()).docs.map(
      (d) => d.data() as Student,
    );
    const plan = planImport(incoming, existentes);
    const resumen = summarizePlan(plan);

    if (payload.dryRun) {
      return {
        dryRun: true,
        resumen,
        revisiones: plan.reviews.map((r) => ({
          nombres: r.row.nombres,
          apellidos: r.row.apellidos,
          motivo: r.reason,
          candidatos: r.candidateIds,
        })),
      };
    }

    const ops: ((b: FirebaseFirestore.WriteBatch) => void)[] = [];
    const fechaHoy = fechaDeHoy();

    for (const c of plan.creates) {
      // La importacion es hoy solo de sede central (alcance v1, bachillerato).
      const { ops: nuevos } = opsNuevaFicha(
        { ...c.row, sede: 'central' },
        payload.anio,
        fechaHoy,
      );
      ops.push(...nuevos);
    }

    for (const u of plan.updates) {
      // La reimportacion actualiza contacto, NUNCA el docHash ni el qrToken.
      //
      // `docNumber` si se reescribe, y es a proposito: es el unico camino para rellenar
      // las fichas importadas antes de que el campo existiera. No hay riesgo de mezclar
      // personas porque la fila llego aqui por coincidencia de docHash, y ese hash sale
      // de este mismo numero.
      ops.push((b) =>
        b.update(db.doc(`asistenciaStudents/${u.studentId}`), {
          nombres: u.row.nombres,
          apellidos: u.row.apellidos,
          acudiente: u.row.acudiente,
          parentesco: u.row.parentesco,
          telefonos: u.row.telefonos,
          docNumber: u.row.docNumber,
          docType: u.row.docType,
        }),
      );
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
    return { dryRun: false, resumen };
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


