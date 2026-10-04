// Codebase `classroom`: integración con Google Classroom (docs/classroom/PRD.md).
// Por ahora solo la prueba de acceso (tarea 1.2).
//
// Despliegue: `firebase deploy --only functions:classroom` (NUNCA sin acotar).
// TRAMPA DEL 403: tras desplegar una callable v2 (Cloud Run) puede hacer falta permitir
// la invocación pública (allUsers / Cloud Run Invoker); aquí se declara invoker 'public'
// como en `default`, pero si el navegador recibe 403, revisar eso. La autenticación real
// se comprueba dentro de la función.

import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { setGlobalOptions } from 'firebase-functions/v2';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { ALCANCE_CURSOS, ErrorApi, api, tokenComo } from './acceso';
import { clasificarErrorToken, mapearCursos, urlCursosDelDocente, type CursoCrudo } from './logica';

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
