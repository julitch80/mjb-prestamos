// Codebase `classroom`: integración con Google Classroom (docs/classroom/PRD.md).
// Por ahora solo la prueba de acceso (tarea 1.2).
//
// Despliegue: `firebase deploy --only functions:classroom` (NUNCA sin acotar).
// TRAMPA DEL 403: tras desplegar una callable v2 (Cloud Run) puede hacer falta permitir
// la invocación pública (allUsers / Cloud Run Invoker); aquí se declara invoker 'public'
// como en `default`, pero si el navegador recibe 403, revisar eso. La autenticación real
// se comprueba dentro de la función.

import { initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { setGlobalOptions } from 'firebase-functions/v2';
import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { ALCANCE_CURSOS, ALCANCE_PUSH, ErrorApi, api, tokenComo } from './acceso';
import { RE_CORREO_DOMINIO, claveVinculo, clasificarErrorToken, mapearCursos, textoValido, urlCursosDelDocente, type CursoCrudo } from './logica';

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
 *       nombre, alternateLink, actualizado, registro: { registrationId, expiryTime } | { error } } },
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
    // Desvincular: se quita la entrada. Las suscripciones (registrations) no se borran por API
    // de forma fiable; caducan solas (~7 días) y se ignoran los avisos de cursos sin vínculo.
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

  // Avisos push de Classroom (alcance aparte: si falla, el vínculo se guarda igual).
  let registro: Record<string, unknown>;
  let detalleAvisos = '';
  try {
    const tp = await tokenComo(cuenta, [ALCANCE_CURSOS, ALCANCE_PUSH]);
    const r = await api<{ registrationId?: string; expiryTime?: string }>(tp, 'POST', '/registrations', {
      feed: { feedType: 'COURSE_WORK_CHANGES', courseWorkChangesInfo: { courseId } },
      cloudPubsubTopic: { topicName: 'projects/mjb-prestamos/topics/classroom-avisos' },
    });
    registro = { registrationId: r.registrationId ?? '', expiryTime: r.expiryTime ?? '' };
  } catch (e) {
    detalleAvisos = e instanceof Error ? e.message : String(e);
    registro = { error: detalleAvisos };
  }

  await ref.set({
    vinculos: {
      [clave]: {
        grupo, asignatura, courseId, nombre: curso.name ?? '', alternateLink: curso.alternateLink ?? '',
        actualizado: FieldValue.serverTimestamp(), registro,
      },
    },
    actualizado: FieldValue.serverTimestamp(),
  }, { merge: true });

  return detalleAvisos ? { ok: true, avisos: false, detalle: detalleAvisos } : { ok: true, avisos: true };
});
