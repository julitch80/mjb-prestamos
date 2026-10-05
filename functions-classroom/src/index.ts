// Codebase `classroom`: integración con Google Classroom (docs/classroom/PRD.md).
// Por ahora solo la prueba de acceso (tarea 1.2).
//
// Despliegue: `firebase deploy --only functions:classroom` (NUNCA sin acotar).
// TRAMPA DEL 403: tras desplegar una callable v2 (Cloud Run) puede hacer falta permitir
// la invocación pública (allUsers / Cloud Run Invoker); aquí se declara invoker 'public'
// como en `default`, pero si el navegador recibe 403, revisar eso. La autenticación real
// se comprueba dentro de la función.

import { initializeApp } from 'firebase-admin/app';
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore';
import { setGlobalOptions } from 'firebase-functions/v2';
import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as logger from 'firebase-functions/logger';
import { ALCANCE_CURSOS, ALCANCE_TAREAS, ErrorApi, api, tokenComo } from './acceso';
import { RE_CORREO_DOMINIO, cambioReal, dentroDeVentana, urlCourseWorkPublicadas, claveVinculo, clasificarErrorToken, debeIgnorar, extraerMateriales, fechaDesdeClassroom, jornadaDeGrupo, type CourseWorkCrudo, fechaEntregaClassroom, mapearCursos, textoValido, urlCursosDelDocente, type CursoCrudo } from './logica';

setGlobalOptions({ maxInstances: 10, region: 'us-central1' });

initializeApp();
const db = getFirestore();

export const classroomProbarAcceso = onCall({ invoker: 'public' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');
  const correo = String(request.auth.token?.email ?? '').toLowerCase();
  if (!correo) throw new HttpsError('permission-denied', 'No se pudo determinar tu correo.');
  const snap = await db.doc(`users/${correo}`).get();
  if (!snap.exists || snap.get('active') !== true || snap.get('role') !== 'superusuario') {
    throw new HttpsError('permission-denied', 'Solo el superusuario puede probar el acceso.');
  }
  if (request.auth.token?.suplantadoPor) {
    throw new HttpsError('permission-denied', 'No disponible durante una suplantación.');
  }

  // El superusuario puede consultar la cuenta de profesor de otra persona del dominio
  const pedido = String((request.data as { correo?: unknown } | null)?.correo ?? '').trim().toLowerCase();
  if (pedido && !/^[^@\s]+@iemanueljbetancur\.edu\.co$/.test(pedido)) {
    throw new HttpsError('invalid-argument', 'Solo cuentas @iemanueljbetancur.edu.co.');
  }
  const cuenta = pedido || correo;

  let token: string;
  try {
    token = await tokenComo(cuenta, [ALCANCE_CURSOS]);
  } catch (e) {
    const detalle = e instanceof Error ? e.message : String(e);
    if (clasificarErrorToken(detalle) === 'sin-autorizacion') {
      return { ok: false, motivo: 'sin-autorizacion', detalle };
    }
    return { ok: false, motivo: 'error-token', detalle };
  }

  try {
    const r = await api<{ courses?: CursoCrudo[] }>(token, 'GET', urlCursosDelDocente(50));
    const cursos = mapearCursos(r.courses);
    return { ok: true, conteo: cursos.length, cursos };
  } catch (e) {
    if (e instanceof ErrorApi && e.estado === 403) {
      return { ok: false, motivo: 'sin-autorizacion', detalle: e.message };
    }
    throw new HttpsError('internal', e instanceof Error ? e.message : String(e));
  }
});

// ---------- 2.1: cursos y vínculos ----------

/**
 * Autenticación común. Exige usuario activo en users/{correo}. Las escrituras se rechazan
 * durante una suplantación (sesión de solo lectura). Solo el superusuario puede pasar
 * `correo` para actuar como otra cuenta del dominio; los demás siempre actúan como ellos.
 * Devuelve el usuario que llama y la cuenta de Classroom sobre la que se opera.
 */
async function autenticar(request: CallableRequest, escritura: boolean): Promise<{ usuario: string; cuenta: string }> {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');
  const usuario = String(request.auth.token?.email ?? '').toLowerCase();
  if (!usuario) throw new HttpsError('permission-denied', 'No se pudo determinar tu correo.');
  const snap = await db.doc(`users/${usuario}`).get();
  if (!snap.exists || snap.get('active') !== true) {
    throw new HttpsError('permission-denied', 'Tu usuario no está activo.');
  }
  if (escritura && request.auth.token?.suplantadoPor) {
    throw new HttpsError('permission-denied', 'No disponible durante una suplantación.');
  }
  const pedido = String((request.data as { correo?: unknown } | null)?.correo ?? '').trim().toLowerCase();
  if (pedido && snap.get('role') === 'superusuario') {
    if (!RE_CORREO_DOMINIO.test(pedido)) {
      throw new HttpsError('invalid-argument', 'Solo cuentas @iemanueljbetancur.edu.co.');
    }
    return { usuario, cuenta: pedido };
  }
  return { usuario, cuenta: usuario };
}

type Fallo = { ok: false; motivo: 'sin-autorizacion' | 'error-token'; detalle: string };

/** Token de la cuenta, o el resultado de fallo listo para devolver al cliente. */
async function pedirToken(cuenta: string, alcances: string[]): Promise<{ token: string } | { fallo: Fallo }> {
  try {
    return { token: await tokenComo(cuenta, alcances) };
  } catch (e) {
    const detalle = e instanceof Error ? e.message : String(e);
    const motivo = clasificarErrorToken(detalle) === 'sin-autorizacion' ? 'sin-autorizacion' : 'error-token';
    return { fallo: { ok: false, motivo, detalle } };
  }
}

/** Cursos ACTIVOS donde la cuenta es profesora, siguiendo nextPageToken hasta 200. */
async function listarCursos(token: string): Promise<CursoCrudo[]> {
  const todos: CursoCrudo[] = [];
  let pagina = '';
  do {
    const r = await api<{ courses?: CursoCrudo[]; nextPageToken?: string }>(
      token, 'GET', urlCursosDelDocente(50) + (pagina ? `&pageToken=${encodeURIComponent(pagina)}` : ''));
    todos.push(...(r.courses ?? []));
    pagina = r.nextPageToken ?? '';
  } while (pagina && todos.length < 200);
  return todos.slice(0, 200);
}

export const classroomCursos = onCall({ invoker: 'public' }, async (request) => {
  const { cuenta } = await autenticar(request, false);
  const t = await pedirToken(cuenta, [ALCANCE_CURSOS]);
  if ('fallo' in t) return t.fallo;
  try {
    return { ok: true, cursos: mapearCursos(await listarCursos(t.token)) };
  } catch (e) {
    if (e instanceof ErrorApi && e.estado === 403) {
      return { ok: false, motivo: 'sin-autorizacion', detalle: e.message };
    }
    throw new HttpsError('internal', e instanceof Error ? e.message : String(e));
  }
});

/**
 * Vincula (courseId) o desvincula (courseId null) un par grupo/asignatura con un curso.
 * Documento classroomVinculos/{correoCuenta}:
 *   { vinculos: { "<grupo con '.' cambiado a '_'>|<asignatura>": { grupo, asignatura, courseId,
 *       nombre, alternateLink, actualizado, vinculadoEn } },
 *     actualizado }
 * La clave lleva '_' en vez de '.' porque Firestore interpreta '.' como ruta anidada.
 */
export const classroomVincular = onCall({ invoker: 'public' }, async (request) => {
  const { cuenta } = await autenticar(request, true);
  const d = (request.data ?? {}) as { grupo?: unknown; asignatura?: unknown; courseId?: unknown };
  if (!textoValido(d.grupo) || !textoValido(d.asignatura)) {
    throw new HttpsError('invalid-argument', 'Grupo y asignatura deben ser texto de hasta 40 caracteres.');
  }
  const grupo = d.grupo.trim();
  const asignatura = d.asignatura.trim();
  const clave = claveVinculo(grupo, asignatura);
  const ref = db.doc(`classroomVinculos/${cuenta}`);

  if (d.courseId === null) {
    // Desvincular: se quita la entrada; la revisión periódica ya no mirará ese curso.
    await ref.set({ vinculos: { [clave]: FieldValue.delete() }, actualizado: FieldValue.serverTimestamp() }, { merge: true });
    return { ok: true, desvinculado: true };
  }
  const courseId = typeof d.courseId === 'string' ? d.courseId.trim() : '';
  if (!/^\d{1,20}$/.test(courseId)) throw new HttpsError('invalid-argument', 'courseId inválido.');

  const t = await pedirToken(cuenta, [ALCANCE_CURSOS]);
  if ('fallo' in t) return t.fallo;
  let curso: CursoCrudo;
  try {
    curso = await api<CursoCrudo>(t.token, 'GET', `/courses/${courseId}`);
    // Debe ser un curso donde la cuenta es profesora (evita vincular cursos ajenos).
    if (!(await listarCursos(t.token)).some((c) => c.id === courseId)) {
      throw new HttpsError('permission-denied', 'No eres profesor de ese curso (o no está activo).');
    }
  } catch (e) {
    if (e instanceof HttpsError) throw e;
    if (e instanceof ErrorApi && (e.estado === 404 || e.estado === 403)) {
      throw new HttpsError('not-found', 'El curso no existe o no tienes acceso.');
    }
    throw new HttpsError('internal', e instanceof Error ? e.message : String(e));
  }

  // `vinculadoEn` marca desde cuándo se traen tareas del curso (ver revisarClassroom): solo se
  // fija al crear la entrada o al cambiar de curso; revincular el mismo curso lo conserva.
  const previo = (await ref.get()).get('vinculos') as Record<string, { courseId?: string; vinculadoEn?: unknown }> | undefined;
  const conservar = previo?.[clave]?.courseId === courseId && previo[clave].vinculadoEn;
  const vinculadoEn = conservar ? previo![clave].vinculadoEn : FieldValue.serverTimestamp();

  await ref.set({
    vinculos: {
      [clave]: {
        grupo, asignatura, courseId, nombre: curso.name ?? '', alternateLink: curso.alternateLink ?? '',
        actualizado: FieldValue.serverTimestamp(), vinculadoEn,
      },
    },
    actualizado: FieldValue.serverTimestamp(),
  }, { merge: true });

  return { ok: true };
});

// ---------- 3.1: publicar una tarea de MJB en Classroom ----------

/**
 * Publica en el curso vinculado una tarea ya creada en MJB. El enlace MJB↔Classroom vive en
 * classroomTareas/{tareaId} (solo escribe esta función). Idempotente por tareaId.
 */
export const classroomPublicar = onCall({ invoker: 'public' }, async (request) => {
  const { cuenta } = await autenticar(request, true);
  const d = (request.data ?? {}) as Record<string, unknown>;
  const tareaId = typeof d.tareaId === 'string' ? d.tareaId.trim() : '';
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(tareaId)) throw new HttpsError('invalid-argument', 'tareaId inválido.');
  if (!textoValido(d.grupo) || !textoValido(d.asignatura)) {
    throw new HttpsError('invalid-argument', 'Grupo y asignatura deben ser texto de hasta 40 caracteres.');
  }
  const titulo = typeof d.titulo === 'string' ? d.titulo.trim() : '';
  if (titulo.length < 1 || titulo.length > 200) throw new HttpsError('invalid-argument', 'Título de 1 a 200 caracteres.');
  const descripcion = typeof d.descripcion === 'string' ? d.descripcion.trim() : '';
  if (descripcion.length > 3000) throw new HttpsError('invalid-argument', 'Descripción de hasta 3000 caracteres.');
  const fechaEntrega = typeof d.fechaEntrega === 'string' ? d.fechaEntrega : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaEntrega) || Number.isNaN(Date.parse(fechaEntrega))) {
    throw new HttpsError('invalid-argument', 'fechaEntrega debe ser YYYY-MM-DD.');
  }
  const adjuntoUrl = typeof d.adjuntoUrl === 'string' ? d.adjuntoUrl.trim() : '';
  if (adjuntoUrl && !/^https:\/\/\S+$/.test(adjuntoUrl)) throw new HttpsError('invalid-argument', 'El adjunto debe ser un enlace https.');
  const adjuntoNombre = (typeof d.adjuntoNombre === 'string' ? d.adjuntoNombre.trim() : '').slice(0, 200) || 'Adjunto';
  const grupo = d.grupo.trim();
  const asignatura = d.asignatura.trim();

  const refTarea = db.doc(`classroomTareas/${tareaId}`);
  const previa = await refTarea.get();
  if (previa.exists && previa.get('courseWorkId')) {
    return { ok: true, ya: true, alternateLink: String(previa.get('alternateLink') ?? '') };
  }

  const vinc = (await db.doc(`classroomVinculos/${cuenta}`).get()).get('vinculos') as Record<string, { courseId?: string }> | undefined;
  const courseId = vinc?.[claveVinculo(grupo, asignatura)]?.courseId;
  if (!courseId) return { ok: false, motivo: 'sin-vinculo' };

  const t = await pedirToken(cuenta, [ALCANCE_TAREAS]);
  if ('fallo' in t) return t.fallo;
  const { dueDate, dueTime } = fechaEntregaClassroom(fechaEntrega);
  let creada: { id?: string; alternateLink?: string };
  try {
    creada = await api<{ id?: string; alternateLink?: string }>(t.token, 'POST', `/courses/${courseId}/courseWork`, {
      title: titulo,
      description: descripcion || undefined,
      workType: 'ASSIGNMENT',
      state: 'PUBLISHED',
      materials: adjuntoUrl ? [{ link: { url: adjuntoUrl, title: adjuntoNombre } }] : undefined,
      dueDate,
      dueTime,
    });
  } catch (e) {
    const detalle = e instanceof Error ? e.message : String(e);
    if (e instanceof ErrorApi && e.estado === 403) return { ok: false, motivo: 'sin-autorizacion', detalle };
    return { ok: false, motivo: 'error-classroom', detalle };
  }
  if (!creada.id) return { ok: false, motivo: 'error-classroom', detalle: 'Classroom no devolvió el id de la tarea.' };

  const alternateLink = creada.alternateLink ?? '';
  await refTarea.set({
    profesor: cuenta, grupo, asignatura, courseId, courseWorkId: creada.id, alternateLink,
    origen: 'mjb', fechaEntrega, creado: FieldValue.serverTimestamp(),
  });
  return { ok: true, alternateLink };
});

// ---------- 3.2: borrar de Classroom una tarea cancelada en MJB ----------

/**
 * Borra de Classroom la tarea que MJB publicó (solo si origen === 'mjb': Classroom solo deja
 * borrar al proyecto que la creó). El documento se conserva con la marca borradoEnClassroom.
 */
export const classroomBorrar = onCall({ invoker: 'public' }, async (request) => {
  const { cuenta } = await autenticar(request, true);
  const d = (request.data ?? {}) as Record<string, unknown>;
  const tareaId = typeof d.tareaId === 'string' ? d.tareaId.trim() : '';
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(tareaId)) throw new HttpsError('invalid-argument', 'tareaId inválido.');

  const refTarea = db.doc(`classroomTareas/${tareaId}`);
  const snap = await refTarea.get();
  if (!snap.exists || !snap.get('courseWorkId')) return { ok: true, nada: true };
  if (snap.get('profesor') !== cuenta) throw new HttpsError('permission-denied', 'Esta tarea no es de tu cuenta.');
  if (snap.get('borradoEnClassroom') === true) return { ok: true, nada: true };
  if (snap.get('origen') !== 'mjb') return { ok: false, motivo: 'no-creada-por-mjb' };

  const courseId = String(snap.get('courseId') ?? '');
  const courseWorkId = String(snap.get('courseWorkId'));
  if (!/^\d{1,20}$/.test(courseId) || !/^[A-Za-z0-9_-]{1,40}$/.test(courseWorkId)) {
    return { ok: false, motivo: 'error-classroom', detalle: 'Identificadores de Classroom inválidos.' };
  }

  const t = await pedirToken(cuenta, [ALCANCE_TAREAS]);
  if ('fallo' in t) return t.fallo;
  try {
    await api<unknown>(t.token, 'DELETE', `/courses/${courseId}/courseWork/${courseWorkId}`);
  } catch (e) {
    // 404 = ya estaba borrada en Classroom: cuenta como borrada.
    if (!(e instanceof ErrorApi && e.estado === 404)) {
      const detalle = e instanceof Error ? e.message : String(e);
      if (e instanceof ErrorApi && e.estado === 403) return { ok: false, motivo: 'sin-autorizacion', detalle };
      return { ok: false, motivo: 'error-classroom', detalle };
    }
  }
  await refTarea.update({ borradoEnClassroom: true, borrado: FieldValue.serverTimestamp() });
  return { ok: true };
});

// ---------- 4.1: revisión periódica de Classroom -> classroomPendientes ----------
// Classroom solo permite avisos push con OAuth por usuario (la delegación de dominio da
// 403 @MissingGrant), así que se sondea cada 5 minutos con la delegación de dominio.

type Dueno = { profesor: string; grupo: string; asignatura: string; courseId: string };

/**
 * Documento classroomPendientes/{courseWorkId}:
 *   { profesor, grupo, asignatura, jornada: 'manana'|'tarde', courseId, courseWorkId, titulo,
 *     descripcion (<=3000), alternateLink, fechaClassroom: 'YYYY-MM-DD'|null,
 *     materiales: [{titulo,url}] (<=10), updateTimeClassroom, estado: 'pendiente'|'publicada'|...,
 *     creado, actualizado, borradoEnClassroom?: true }
 * Devuelve 'nuevo' | 'actualizado' | 'sin-cambios' | 'ignorada'.
 */
async function procesarCourseWork(dueno: Dueno, cw: CourseWorkCrudo): Promise<'nuevo' | 'actualizado' | 'sin-cambios' | 'ignorada'> {
  const id = String(cw.id ?? '');
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(id)) return 'ignorada';
  const existeEnc = !(await db.collection('classroomTareas').where('courseWorkId', '==', id).limit(1).get()).empty;
  const motivo = debeIgnorar(cw, existeEnc);
  if (motivo) { logger.info('Tarea ignorada', { id, motivo }); return 'ignorada'; }
  const refPend = db.doc(`classroomPendientes/${id}`);
  const datos = {
    profesor: dueno.profesor, grupo: dueno.grupo, asignatura: dueno.asignatura,
    jornada: jornadaDeGrupo(dueno.grupo), courseId: dueno.courseId, courseWorkId: id,
    titulo: String(cw.title ?? '').slice(0, 200),
    descripcion: String(cw.description ?? '').slice(0, 3000),
    alternateLink: cw.alternateLink ?? '',
    fechaClassroom: fechaDesdeClassroom(cw.dueDate, cw.dueTime),
    materiales: extraerMateriales(cw.materials),
    updateTimeClassroom: cw.updateTime ?? '',
    actualizado: FieldValue.serverTimestamp(),
  };
  return db.runTransaction(async (tx) => {
    const previa = await tx.get(refPend);
    if (previa.exists && !cambioReal(previa.get('updateTimeClassroom'), cw.updateTime)) return 'sin-cambios' as const;
    // Existente: se conserva su estado y 'creado'; nuevo: queda pendiente.
    tx.set(refPend, previa.exists ? datos : { ...datos, estado: 'pendiente', creado: FieldValue.serverTimestamp() }, { merge: true });
    return previa.exists ? 'actualizado' as const : 'nuevo' as const;
  });
}

/** Pendientes guardados de un curso cuya tarea ya no existe en Classroom. Devuelve cuántos trató. */
async function revisarBorradas(token: string, courseId: string, publicadas: Set<string>): Promise<number> {
  let borrados = 0;
  const snap = await db.collection('classroomPendientes').where('courseId', '==', courseId).get();
  for (const doc of snap.docs) {
    if (publicadas.has(doc.id) || doc.get('borradoEnClassroom') === true) continue;
    const estado = doc.get('estado');
    if (estado !== 'pendiente' && estado !== 'publicada') continue;
    let borrada = false;
    try {
      const cw = await api<CourseWorkCrudo>(token, 'GET', `/courses/${courseId}/courseWork/${doc.id}`);
      borrada = cw.state === 'DELETED';
    } catch (e) {
      if (e instanceof ErrorApi && e.estado === 404) borrada = true; else throw e;
    }
    if (!borrada) continue;
    if (estado === 'pendiente') await doc.ref.delete(); // aún no se publicó nada en MJB
    else {
      // TODO 5.1: cancelar la tarea en MJB y avisar al profesor. Por ahora solo se marca.
      await doc.ref.set({ borradoEnClassroom: true, actualizado: FieldValue.serverTimestamp() }, { merge: true });
    }
    borrados++;
  }
  return borrados;
}

export const revisarClassroom = onSchedule(
  { schedule: 'every 5 minutes', timeZone: 'America/Bogota', retryCount: 0 },
  async () => {
    const r = { cuentas: 0, cursos: 0, nuevos: 0, actualizados: 0, borrados: 0, errores: 0 };
    const docs = (await db.collection('classroomVinculos').get()).docs;
    for (const doc of docs) {
      const vinc = (doc.get('vinculos') ?? {}) as Record<string, {
        courseId?: string; grupo?: string; asignatura?: string; vinculadoEn?: Timestamp; actualizado?: Timestamp }>;
      const entradas = Object.values(vinc).filter((v) => v?.courseId && v.grupo && v.asignatura);
      if (!entradas.length) continue;
      r.cuentas++;
      let token: string;
      try {
        token = await tokenComo(doc.id, [ALCANCE_TAREAS]); // un token por cuenta
      } catch (e) {
        r.errores++;
        logger.error('Revisión: sin token', { cuenta: doc.id, error: e instanceof Error ? e.message : String(e) });
        continue;
      }
      for (const v of entradas) {
        const courseId = String(v.courseId);
        r.cursos++;
        try {
          const desde = (v.vinculadoEn ?? v.actualizado)?.toMillis?.() ?? null;
          const dueno: Dueno = { profesor: doc.id, grupo: String(v.grupo), asignatura: String(v.asignatura), courseId };
          const lista = await api<{ courseWork?: CourseWorkCrudo[] }>(token, 'GET', urlCourseWorkPublicadas(courseId, 30));
          const publicadas = new Set<string>();
          for (const cw of lista.courseWork ?? []) {
            if (cw.id) publicadas.add(cw.id);
            if (!dentroDeVentana(cw.creationTime, desde)) continue;
            const res = await procesarCourseWork(dueno, cw);
            if (res === 'nuevo') r.nuevos++; else if (res === 'actualizado') r.actualizados++;
          }
          r.borrados += await revisarBorradas(token, courseId, publicadas);
        } catch (e) {
          r.errores++;
          logger.error('Revisión: fallo en un curso', { cuenta: doc.id, courseId, error: e instanceof Error ? e.message : String(e) });
        }
      }
    }
    logger.info(`Revisión de Classroom: cuentas=${r.cuentas} cursos=${r.cursos} nuevos=${r.nuevos} actualizados=${r.actualizados} borrados=${r.borrados} errores=${r.errores}`);
  },
);
