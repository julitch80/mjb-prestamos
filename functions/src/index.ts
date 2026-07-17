import { onCall, HttpsError as HttpsErrorCall } from 'firebase-functions/v2/https';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { beforeUserCreated, beforeUserSignedIn, HttpsError } from 'firebase-functions/v2/identity';

// Función de prueba del checkpoint Fase 0. Se ampliará en etapas siguientes.
export const ping = onCall({ region: 'us-central1' }, () => {
  return { ok: true, ts: Date.now() };
});

// ── Etapa 2: autenticación con Google Workspace institucional ──────────────

initializeApp();
const db = getFirestore();
const DOMAIN = 'iemanueljbetancur.edu.co';

// Se ejecuta ANTES de crear el usuario en Firebase Auth. Bloquea cualquier
// cuenta que no sea del dominio institucional o que no esté pre-registrada
// (activa) en la colección `users` de Firestore (ver scripts/seed-users.mjs).
export const beforecreated = beforeUserCreated({ region: 'us-central1' }, async (event) => {
  const email = (event.data?.email ?? '').toLowerCase();
  if (!email.endsWith('@' + DOMAIN)) {
    throw new HttpsError('permission-denied', 'Solo cuentas institucionales del colegio.');
  }
  const snap = await db.doc(`users/${email}`).get();
  if (!snap.exists || snap.get('active') !== true) {
    throw new HttpsError('permission-denied', 'Tu cuenta aún no está registrada en MJB Préstamos. Contacta al administrador.');
  }
  await snap.ref.update({ uid: event.data!.uid, firstLoginAt: FieldValue.serverTimestamp() });
});

// Se ejecuta en CADA inicio de sesión (incluso de cuentas ya creadas).
// Permite desactivar el acceso de un docente sin borrar su cuenta de Auth.
export const beforesignedin = beforeUserSignedIn({ region: 'us-central1' }, async (event) => {
  const email = (event.data?.email ?? '').toLowerCase();
  const snap = await db.doc(`users/${email}`).get();
  if (!snap.exists || snap.get('active') !== true) {
    throw new HttpsError('permission-denied', 'Cuenta desactivada en MJB Préstamos.');
  }
});

// ── Etapa 5: reemplazo de docente (puesto vs persona) ───────────────────────
// Mueve el `slotId` (puesto en el horario) del docente saliente al entrante,
// desactiva al saliente y registra todo en `auditLogs`. Solo superusuario.
export const replaceTeacher = onCall(
  { region: 'us-central1', timeoutSeconds: 120 },
  async (request) => {
    // 1. Autorización: caller debe ser superusuario activo.
    const callerEmail = (request.auth?.token?.email ?? '').toLowerCase();
    if (!request.auth || !callerEmail) {
      throw new HttpsErrorCall('unauthenticated', 'Debes iniciar sesión.');
    }
    const callerSnap = await db.doc(`users/${callerEmail}`).get();
    if (!callerSnap.exists || callerSnap.get('role') !== 'superusuario' || callerSnap.get('active') !== true) {
      throw new HttpsErrorCall('permission-denied', 'Solo el superusuario puede reemplazar docentes.');
    }

    // 2. Validaciones de entrada.
    const outgoingEmail = String(request.data?.outgoingEmail ?? '').toLowerCase().trim();
    const incomingEmail = String(request.data?.incomingEmail ?? '').toLowerCase().trim();
    const dryRun = request.data?.dryRun === false ? false : true; // default true
    if (!outgoingEmail || !incomingEmail) {
      throw new HttpsErrorCall('invalid-argument', 'Se requieren outgoingEmail e incomingEmail.');
    }
    if (outgoingEmail === incomingEmail) {
      throw new HttpsErrorCall('invalid-argument', 'El saliente y el entrante no pueden ser la misma persona.');
    }

    const writeAudit = (extra: Record<string, unknown>) =>
      db.collection('auditLogs').doc().set({
        action: 'replaceTeacher',
        executedBy: callerEmail,
        executedAt: FieldValue.serverTimestamp(),
        outgoingEmail,
        incomingEmail,
        ...extra,
      });

    try {
      const [outSnap, inSnap] = await Promise.all([
        db.doc(`users/${outgoingEmail}`).get(),
        db.doc(`users/${incomingEmail}`).get(),
      ]);
      if (!outSnap.exists) {
        throw new HttpsErrorCall('failed-precondition', `El docente saliente ${outgoingEmail} no existe en el sistema.`);
      }
      if (!inSnap.exists || inSnap.get('active') !== true) {
        throw new HttpsErrorCall('failed-precondition', `Primero crea y activa a ${incomingEmail} en el panel.`);
      }

      // 3. El saliente debe tener puesto (slotId).
      const slot = outSnap.get('slotId');
      if (!slot) {
        throw new HttpsErrorCall('failed-precondition', 'El docente saliente no tiene un puesto asignado (slotId).');
      }
      // 4. El entrante no puede ocupar ya otro puesto.
      const inSlot = inSnap.get('slotId');
      if (inSlot != null) {
        throw new HttpsErrorCall('failed-precondition', `El docente entrante ya ocupa el puesto ${inSlot}; un reemplazo lo dejaría con dos puestos.`);
      }

      // 5. Resumen de cambios.
      const changes = [
        { campo: 'slotId', de: outgoingEmail, a: incomingEmail, valor: slot },
        { campo: 'active', usuario: outgoingEmail, a: false },
      ];

      // 6. Dry run: solo auditoría, sin escrituras en users.
      if (dryRun) {
        await writeAudit({ slot, dryRun: true, changes, status: 'ok', errorMessage: null });
        return { dryRun: true, slot, changes };
      }

      // 7. Ejecución real: batch atómico + auditoría.
      const batch = db.batch();
      batch.update(outSnap.ref, {
        active: false,
        slotId: null,
        replacedBy: incomingEmail,
        replacedAt: FieldValue.serverTimestamp(),
      });
      batch.update(inSnap.ref, { slotId: slot });
      batch.set(db.collection('auditLogs').doc(), {
        action: 'replaceTeacher',
        executedBy: callerEmail,
        executedAt: FieldValue.serverTimestamp(),
        outgoingEmail,
        incomingEmail,
        slot,
        dryRun: false,
        changes,
        status: 'ok',
        errorMessage: null,
      });
      await batch.commit();

      // Revoca los tokens del saliente para cerrar su sesión activa.
      const uid = outSnap.get('uid');
      if (uid) {
        try { await getAuth().revokeRefreshTokens(uid); } catch { /* no crítico */ }
      }

      return { dryRun: false, slot, changes };
    } catch (err) {
      // 8. Auditoría de error (sin ocultar el error original).
      const msg = err instanceof Error ? err.message : String(err);
      try {
        await writeAudit({ dryRun, status: 'error', errorMessage: msg });
      } catch { /* la auditoría de error nunca debe tapar el error real */ }
      if (err instanceof HttpsErrorCall) throw err;
      throw new HttpsErrorCall('internal', msg);
    }
  });

// ── Etapa 4: chat interno — metadatos del último mensaje por canal ──────────
// Al crear un mensaje, actualiza el documento del canal con el resumen del
// último mensaje para poder ordenar la lista de canales y mostrar preview.
export const onMessageCreated = onDocumentCreated(
  { document: 'channels/{channelId}/messages/{messageId}', region: 'us-central1' },
  async (event) => {
    const m = event.data?.data();
    if (!m) return;
    await db.doc(`channels/${event.params.channelId}`).update({
      lastMessageAt: m.createdAt,
      lastMessagePreview: String(m.text).slice(0, 80),
      lastMessageBy: m.authorName ?? m.authorEmail,
    });
  });
