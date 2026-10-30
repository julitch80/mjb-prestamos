// Reemplazo temporal (docs/reemplazo-temporal). El reemplazo ocupa el puesto (slotId)
// del titular; el titular conserva su cuenta en solo lectura (las reglas bloquean sus
// escrituras) hasta la fecha de regreso.
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { fechaValida, hoyBogota, vencido } from './reemplazoFechas.js';
import { cambiosAsignatura, cambiosGuia, cambiosPlan } from './planesTransferencia.js';

const db = () => getFirestore();

async function revocar(uid: unknown) {
  if (typeof uid !== 'string' || !uid) return;
  try { await getAuth().revokeRefreshTokens(uid); } catch { /* no crítico */ }
}

// Pasa los planes académicos especiales (planesCasa) no cerrados de un docente a otro:
// plan.docentesCorreos, asignaturas.docenteCorreo y guias.responsableCorreo/docentesCorreos.
// Idempotente. Sin nombres de estudiantes ni motivos en los registros.
export async function transferirPlanesCasa(
  firestore: FirebaseFirestore.Firestore, deEmail: string, aEmail: string,
): Promise<{ planes: number; asignaturas: number; guias: number }> {
  const de = deEmail.trim().toLowerCase();
  const a = aEmail.trim().toLowerCase();
  const res = { planes: 0, asignaturas: 0, guias: 0 };
  if (!de || !a || de === a) return res;
  const planes = await firestore.collection('planesCasa').where('docentesCorreos', 'array-contains', de).get();
  const ops: Array<{ ref: FirebaseFirestore.DocumentReference; data: Record<string, unknown> }> = [];
  for (const p of planes.docs) {
    if (p.get('estado') === 'cerrado') continue;
    const cp = cambiosPlan(p.data(), de, a);
    if (cp) { ops.push({ ref: p.ref, data: { ...cp } }); res.planes++; }
    const [as, gs] = await Promise.all([p.ref.collection('asignaturas').get(), p.ref.collection('guias').get()]);
    for (const d of as.docs) {
      const c = cambiosAsignatura(d.data(), de, a);
      if (c) { ops.push({ ref: d.ref, data: { ...c } }); res.asignaturas++; }
    }
    for (const d of gs.docs) {
      const c = cambiosGuia(d.data(), de, a);
      if (c) { ops.push({ ref: d.ref, data: { ...c } }); res.guias++; }
    }
  }
  for (let i = 0; i < ops.length; i += 450) {
    const b = firestore.batch();
    for (const o of ops.slice(i, i + 450)) b.update(o.ref, o.data);
    await b.commit();
  }
  return res;
}

// Tolerante: un fallo se registra pero no rompe el reemplazo.
async function transferirSeguro(de: string, a: string) {
  try {
    return { ...(await transferirPlanesCasa(db(), de, a)), error: false };
  } catch (e) {
    console.error('transferirPlanesCasa', e instanceof Error ? e.message : 'error');
    return { planes: 0, asignaturas: 0, guias: 0, error: true };
  }
}

// Devuelve el puesto al titular y deja al reemplazo sin acceso. Compartida por
// «terminar ahora» y por la revisión diaria. Idempotente: si ya terminó, no hace nada.
async function finalizarReemplazo(id: string, motivo: 'manual' | 'vencido', por: string): Promise<boolean> {
  const ref = db().doc(`reemplazosTemporales/${id}`);
  const snap = await ref.get();
  if (!snap.exists || snap.get('estado') !== 'activo') return false;
  const titularRef = db().doc(`users/${snap.get('titularEmail')}`);
  const reempRef = db().doc(`users/${snap.get('reemplazoEmail')}`);
  const [tSnap, rSnap] = await Promise.all([titularRef.get(), reempRef.get()]);
  const slot = snap.get('slot');
  const batch = db().batch();
  if (tSnap.exists) {
    batch.update(titularRef, {
      slotId: tSnap.get('slotEnPausa') ?? slot,
      slotEnPausa: FieldValue.delete(),
      soloLectura: FieldValue.delete(),
      soloLecturaHasta: FieldValue.delete(),
      reemplazadoPor: FieldValue.delete(),
    });
  }
  if (rSnap.exists) {
    batch.update(reempRef, { slotId: null, active: false, reemplazoTemporal: FieldValue.delete() });
  }
  batch.update(ref, { estado: 'terminado', terminado: FieldValue.serverTimestamp(), motivo, por });
  batch.set(db().collection('auditLogs').doc(), {
    action: 'reemplazoTemporal.terminar',
    executedBy: por,
    executedAt: FieldValue.serverTimestamp(),
    reemplazoId: id,
    slot,
    titularEmail: snap.get('titularEmail'),
    reemplazoEmail: snap.get('reemplazoEmail'),
    motivo,
    status: 'ok',
  });
  await batch.commit();
  await transferirSeguro(String(snap.get('reemplazoEmail')), String(snap.get('titularEmail')));
  await revocar(rSnap.get('uid'));
  await revocar(tSnap.get('uid')); // su próxima sesión carga el puesto restaurado
  return true;
}

export const reemplazoTemporal = onCall(
  { region: 'us-central1', timeoutSeconds: 120, invoker: 'public' },
  async (request) => {
    const callerEmail = (request.auth?.token?.email ?? '').toLowerCase();
    if (!request.auth || !callerEmail) {
      throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');
    }
    if (request.auth.token?.suplantadoPor) {
      throw new HttpsError('permission-denied', 'No se puede hacer esto desde una sesión suplantada.');
    }
    const callerSnap = await db().doc(`users/${callerEmail}`).get();
    if (!callerSnap.exists || callerSnap.get('role') !== 'superusuario' || callerSnap.get('active') !== true) {
      throw new HttpsError('permission-denied', 'Solo el superusuario puede gestionar reemplazos temporales.');
    }

    const accion = String(request.data?.accion ?? '');
    const hoy = hoyBogota();

    async function validarInicio() {
      const titularEmail = String(request.data?.titularEmail ?? '').toLowerCase().trim();
      const reemplazoEmail = String(request.data?.reemplazoEmail ?? '').toLowerCase().trim();
      const hasta = request.data?.hasta;
      if (!titularEmail || !reemplazoEmail) throw new HttpsError('invalid-argument', 'Se requieren titularEmail y reemplazoEmail.');
      if (titularEmail === reemplazoEmail) throw new HttpsError('invalid-argument', 'El titular y el reemplazo no pueden ser la misma persona.');
      if (!fechaValida(hasta)) throw new HttpsError('invalid-argument', 'La fecha de regreso debe ser AAAA-MM-DD.');
      if (!(hasta > hoy)) throw new HttpsError('invalid-argument', 'La fecha de regreso debe ser posterior a hoy.');
      const [tSnap, rSnap] = await Promise.all([
        db().doc(`users/${titularEmail}`).get(),
        db().doc(`users/${reemplazoEmail}`).get(),
      ]);
      if (!tSnap.exists || tSnap.get('active') !== true) throw new HttpsError('failed-precondition', 'El titular no existe o no está activo.');
      const slot = tSnap.get('slotId');
      if (!slot) throw new HttpsError('failed-precondition', 'El titular no tiene un puesto asignado (slotId).');
      if (tSnap.get('soloLectura') === true) throw new HttpsError('failed-precondition', 'El titular ya está en solo lectura por otro reemplazo temporal.');
      if (!rSnap.exists || rSnap.get('active') !== true) throw new HttpsError('failed-precondition', `Primero crea y activa a ${reemplazoEmail} en el panel.`);
      if (rSnap.get('slotId') != null) throw new HttpsError('failed-precondition', 'El reemplazo ya ocupa un puesto.');
      if (rSnap.get('role') === 'superusuario') throw new HttpsError('failed-precondition', 'El reemplazo no puede ser superusuario.');
      const dup = await db().collection('reemplazosTemporales')
        .where('slot', '==', slot).where('estado', '==', 'activo').limit(1).get();
      if (!dup.empty) throw new HttpsError('failed-precondition', 'Ese puesto ya tiene un reemplazo temporal activo.');
      return { titularEmail, reemplazoEmail, hasta: hasta as string, slot: String(slot), tSnap, rSnap };
    }

    try {
      if (accion === 'previsualizar') {
        const v = await validarInicio();
        return {
          ok: true, slot: v.slot, titularEmail: v.titularEmail, reemplazoEmail: v.reemplazoEmail, hasta: v.hasta,
          titularNombre: v.tSnap.get('displayName') ?? v.titularEmail,
          reemplazoNombre: v.rSnap.get('displayName') ?? v.reemplazoEmail,
        };
      }

      if (accion === 'iniciar') {
        const v = await validarInicio();
        const ref = db().collection('reemplazosTemporales').doc();
        const batch = db().batch();
        batch.set(ref, {
          slot: v.slot, titularEmail: v.titularEmail, reemplazoEmail: v.reemplazoEmail,
          desde: FieldValue.serverTimestamp(), hasta: v.hasta, estado: 'activo', iniciadoPor: callerEmail,
        });
        batch.update(v.tSnap.ref, {
          slotId: null, slotEnPausa: v.slot, soloLectura: true,
          soloLecturaHasta: v.hasta, reemplazadoPor: v.reemplazoEmail,
        });
        batch.update(v.rSnap.ref, {
          slotId: v.slot,
          reemplazoTemporal: { titularEmail: v.titularEmail, hasta: v.hasta, id: ref.id },
        });
        batch.set(db().collection('auditLogs').doc(), {
          action: 'reemplazoTemporal.iniciar', executedBy: callerEmail, executedAt: FieldValue.serverTimestamp(),
          reemplazoId: ref.id, slot: v.slot, titularEmail: v.titularEmail, reemplazoEmail: v.reemplazoEmail,
          hasta: v.hasta, status: 'ok',
        });
        await batch.commit();
        await revocar(v.tSnap.get('uid')); // que su próxima sesión recoja el solo lectura
        const planes = await transferirSeguro(v.titularEmail, v.reemplazoEmail);
        return { ok: true, id: ref.id, slot: v.slot, hasta: v.hasta, planes };
      }

      const id = String(request.data?.id ?? '');
      if (!id) throw new HttpsError('invalid-argument', 'Falta el id del reemplazo.');

      if (accion === 'terminar') {
        const hecho = await finalizarReemplazo(id, 'manual', callerEmail);
        if (!hecho) throw new HttpsError('failed-precondition', 'Ese reemplazo no existe o ya terminó.');
        return { ok: true, id };
      }

      if (accion === 'cambiarFecha') {
        const hasta = request.data?.hasta;
        if (!fechaValida(hasta) || !(hasta > hoy)) throw new HttpsError('invalid-argument', 'La nueva fecha debe ser AAAA-MM-DD y posterior a hoy.');
        const ref = db().doc(`reemplazosTemporales/${id}`);
        const snap = await ref.get();
        if (!snap.exists || snap.get('estado') !== 'activo') throw new HttpsError('failed-precondition', 'Ese reemplazo no existe o ya terminó.');
        const batch = db().batch();
        batch.update(ref, { hasta });
        batch.update(db().doc(`users/${snap.get('titularEmail')}`), { soloLecturaHasta: hasta });
        batch.update(db().doc(`users/${snap.get('reemplazoEmail')}`), { 'reemplazoTemporal.hasta': hasta });
        batch.set(db().collection('auditLogs').doc(), {
          action: 'reemplazoTemporal.cambiarFecha', executedBy: callerEmail, executedAt: FieldValue.serverTimestamp(),
          reemplazoId: id, slot: snap.get('slot'), desde: snap.get('hasta'), hasta, status: 'ok',
        });
        await batch.commit();
        return { ok: true, id, hasta };
      }

      throw new HttpsError('invalid-argument', 'Acción desconocida.');
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      throw new HttpsError('internal', err instanceof Error ? err.message : String(err));
    }
  });

// Revisión diaria: el día del regreso, a primera hora, el puesto vuelve al titular.
export const finalizarReemplazosVencidos = onSchedule(
  { schedule: '0 5 * * *', timeZone: 'America/Bogota', region: 'us-central1' },
  async () => {
    const hoy = hoyBogota();
    const snap = await db().collection('reemplazosTemporales').where('estado', '==', 'activo').get();
    for (const d of snap.docs) {
      if (vencido(String(d.get('hasta')), hoy)) {
        try { await finalizarReemplazo(d.id, 'vencido', 'sistema'); }
        catch (e) { console.error('finalizarReemplazosVencidos', d.id, e); }
      }
    }
    // Sincronía idempotente: planes creados durante el reemplazo pasan al reemplazo.
    const vigentes = await db().collection('reemplazosTemporales').where('estado', '==', 'activo').get();
    for (const d of vigentes.docs) await transferirSeguro(String(d.get('titularEmail')), String(d.get('reemplazoEmail')));
  });

// Superusuario: pasa ahora los planes académicos a los reemplazos activos.
export const sincronizarPlanesReemplazos = onCall(
  { region: 'us-central1', timeoutSeconds: 300, invoker: 'public' },
  async (request) => {
    const callerEmail = (request.auth?.token?.email ?? '').toLowerCase();
    if (!request.auth || !callerEmail) throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');
    if (request.auth.token?.suplantadoPor) throw new HttpsError('permission-denied', 'No se puede hacer esto desde una sesión suplantada.');
    const c = await db().doc(`users/${callerEmail}`).get();
    if (!c.exists || c.get('role') !== 'superusuario' || c.get('active') !== true) {
      throw new HttpsError('permission-denied', 'Solo el superusuario puede hacer esto.');
    }
    const act = await db().collection('reemplazosTemporales').where('estado', '==', 'activo').get();
    const total = { reemplazos: act.size, planes: 0, asignaturas: 0, guias: 0, errores: 0 };
    for (const d of act.docs) {
      const r = await transferirSeguro(String(d.get('titularEmail')), String(d.get('reemplazoEmail')));
      total.planes += r.planes; total.asignaturas += r.asignaturas; total.guias += r.guias;
      if (r.error) total.errores++;
    }
    return { ok: true, ...total };
  });
