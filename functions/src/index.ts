import { onCall } from 'firebase-functions/v2/https';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
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
