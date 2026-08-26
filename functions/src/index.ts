import { onCall, HttpsError as HttpsErrorCall } from 'firebase-functions/v2/https';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { beforeUserCreated, beforeUserSignedIn, HttpsError } from 'firebase-functions/v2/identity';

// Función de prueba del checkpoint Fase 0. Se ampliará en etapas siguientes.
export const ping = onCall({ region: 'us-central1', invoker: 'public' }, () => {
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
//
// `invoker: 'public'` es OBLIGATORIO aquí. Sin declararlo explícito, el 10 de
// agosto de 2026 el despliegue dejó el servicio de Cloud Run en "Requiere
// autenticación" (IAM) en vez de acceso público — la petición del navegador
// nunca llega al código de la función (que sí exige por dentro ser
// superusuario), Cloud Run la rechaza antes con un 401 genérico que el SDK
// de Firebase muestra como "internal", sin ninguna pista de la causa real.
// Redesplegar sin este campo no lo arregla: hay que fijarlo en el código para
// que cada despliegue lo vuelva a declarar.
export const replaceTeacher = onCall(
  { region: 'us-central1', timeoutSeconds: 120, invoker: 'public' },
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

// ── Suplantación real de solo lectura (Lote 1) ──────────────────────────────
// Emite un token personalizado que hace que Firestore/Storage evalúen al
// superusuario como si fuera el docente objetivo (mismas reglas, mismos
// datos). La atribución se preserva con la marca `suplantadoPor` en el token;
// las reglas (Lote 2, aún no desplegado en el momento de escribir esto)
// niegan TODA escritura mientras esa marca esté presente.
//
// ⚠️ INVESTIGACIÓN (no verificada con una prueba en vivo en este entorno,
// solo con la documentación oficial de Firebase Identity Platform sobre
// disparadores de "blocking functions"): las funciones `beforeUserCreated` y
// `beforeUserSignedIn` de este archivo se documentan como disparadas para
// email/contraseña, enlace de email, proveedores federados (OAuth/SAML/OIDC),
// anónimo y teléfono — el inicio de sesión con `signInWithCustomToken` NO
// aparece en esa lista y, según esa misma documentación, NO dispara
// blocking functions. Si eso es correcto, `beforesignedin` NO vuelve a
// validar dominio/activo cuando el navegador entra con el token que emite
// `suplantar`: la única barrera de dominio institucional para ese inicio de
// sesión es el cerrojo 4 de abajo. Esto queda anotado como lo mejor
// verificable desde este entorno (sin acceso a un proyecto Firebase real
// para probarlo en vivo); antes de confiar en ello para producción, Julián
// debería confirmarlo con una prueba real: suplantar y observar si
// `beforesignedin` se ejecuta (p. ej. con un log adicional temporal).
export const suplantar = onCall(
  { region: 'us-central1', invoker: 'public' },
  async (request) => {
    // Cerrojo 1: debe haber sesión.
    if (!request.auth) {
      throw new HttpsErrorCall('permission-denied', 'Debes iniciar sesión.');
    }

    // Cerrojo 2: el llamante debe ser superusuario activo, leído de
    // Firestore con el Admin SDK — nunca de un claim que mande el cliente.
    const callerEmail = (request.auth.token?.email ?? '').toLowerCase();
    if (!callerEmail) {
      throw new HttpsErrorCall('permission-denied', 'No se pudo determinar tu correo.');
    }
    const callerSnap = await db.doc(`users/${callerEmail}`).get();
    if (!callerSnap.exists || callerSnap.get('active') !== true || callerSnap.get('role') !== 'superusuario') {
      throw new HttpsErrorCall('permission-denied', 'Solo el superusuario puede suplantar.');
    }

    // Cerrojo 3: el llamante no puede venir ya suplantando. Sin esto la
    // suplantación sería encadenable (suplantar desde una sesión ya
    // suplantada) y permitiría "lavar" la marca de atribución.
    if (request.auth.token?.suplantadoPor) {
      throw new HttpsErrorCall('permission-denied', 'No puedes suplantar mientras ya estás suplantando a alguien.');
    }

    // Cerrojo 4: correo objetivo — dominio institucional, existe y activo.
    const targetEmail = String(request.data?.correo ?? '').toLowerCase().trim();
    if (!targetEmail || !targetEmail.endsWith('@' + DOMAIN)) {
      throw new HttpsErrorCall('permission-denied', 'El correo debe ser una cuenta institucional del colegio.');
    }
    const targetSnap = await db.doc(`users/${targetEmail}`).get();
    if (!targetSnap.exists || targetSnap.get('active') !== true) {
      throw new HttpsErrorCall('permission-denied', 'Esa persona no existe o está desactivada en el sistema.');
    }

    // Cerrojo 5: no se suplanta a un par (superusuario). No aporta a la
    // labor de auditoría y solo amplía el daño de un error.
    if (targetSnap.get('role') === 'superusuario') {
      throw new HttpsErrorCall('permission-denied', 'No se puede suplantar a otro superusuario.');
    }

    // El uid del custom token debe ser el uid REAL en Firebase Auth, no el
    // correo — createCustomToken firma para un uid de Auth. Si la persona
    // nunca ha iniciado sesión, no tiene uid todavía.
    let uid: string;
    try {
      const userRecord = await getAuth().getUserByEmail(targetEmail);
      uid = userRecord.uid;
    } catch {
      throw new HttpsErrorCall(
        'not-found',
        'Esa persona aún no ha iniciado sesión nunca en la aplicación, así que no se puede suplantar todavía.'
      );
    }

    // Firmar un custom token exige que la cuenta de servicio de las funciones tenga el
    // permiso `iam.serviceAccounts.signBlob`, que NO viene por defecto. Sin el, el SDK
    // lanza y el cliente solo veia un `internal` opaco que no dice que hacer. Se traduce
    // a un mensaje accionable: el arreglo es dar el rol "Creador de tokens de cuenta de
    // servicio" a la propia cuenta de servicio, no tocar este codigo.
    let token: string;
    try {
      token = await getAuth().createCustomToken(uid, { suplantadoPor: callerEmail });
    } catch (e) {
      const err = e as { code?: string };
      if (err.code === 'auth/insufficient-permission') {
        throw new HttpsErrorCall(
          'failed-precondition',
          'Falta un permiso en Google Cloud para firmar la sesión: la cuenta de servicio de ' +
            'las funciones necesita el rol "Creador de tokens de cuenta de servicio" ' +
            '(iam.serviceAccountTokenCreator) sobre sí misma. Es una configuración del ' +
            'proyecto, no un error de la aplicación.'
        );
      }
      throw e;
    }

    // Auditoría con Admin SDK (las reglas de Firestore prohíben que el
    // cliente escriba en auditLogs; el Admin SDK las salta).
    await db.collection('auditLogs').doc().set({
      tipo: 'suplantacion',
      action: 'suplantar',
      executedBy: callerEmail,
      targetEmail,
      targetUid: uid,
      executedAt: FieldValue.serverTimestamp(),
    });

    return { token };
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
