// Envío de push (Etapa 1 — docs/notificaciones-push/PLAN.md).
// Lee preferencias y silencio nocturno con la lógica compartida
// (../../src/data/notificacionesPushLogica.ts, la misma que usa el cliente),
// y entrega con firebase-admin messaging o encola en pushPendientes.
import { FieldValue } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { logger } from 'firebase-functions';
import {
  debeEnviarse, esHorarioSilencioBogota, esUrgente, type TipoNotificacion,
} from '../../src/data/notificacionesPushLogica';

export interface EnviarOpciones {
  tipo: TipoNotificacion;
  titulo: string;
  cuerpo: string;
  url: string;
  tag: string;
}

interface TokenGuardado {
  ref: FirebaseFirestore.DocumentReference;
  token: string;
}

async function tokensDe(db: FirebaseFirestore.Firestore, correo: string): Promise<TokenGuardado[]> {
  const snap = await db.collection('notifDispositivos').doc(correo).collection('items').get();
  return snap.docs.map(d => ({ ref: d.ref, token: String(d.data().token) }));
}

/** Envía (o encola si es de noche) una notificación a varios correos,
 * respetando la preferencia de cada quien. Best-effort: un fallo con un
 * correo no detiene a los demás. */
export async function enviarAUsuarios(
  db: FirebaseFirestore.Firestore,
  correos: string[],
  opciones: EnviarOpciones,
): Promise<void> {
  const silencio = esHorarioSilencioBogota(new Date());
  const unicos = [...new Set(correos.map(c => c.toLowerCase()))];

  for (const correo of unicos) {
    try {
      const prefSnap = await db.collection('notifPreferencias').doc(correo).get();
      const prefs = prefSnap.exists ? prefSnap.data() : null;
      if (!debeEnviarse(opciones.tipo, prefs as Record<string, boolean> | null)) continue;

      // Urgente (p. ej. accidente laboral, PRD accidente-laboral): se entrega
      // de inmediato aunque sea de noche, nunca se encola.
      if (silencio && !esUrgente(opciones.tipo)) {
        await db.collection('pushPendientes').add({
          correo, ...opciones, creadoEn: FieldValue.serverTimestamp(),
        });
        continue;
      }

      await enviarAhora(db, correo, opciones);
    } catch (err) {
      logger.error('notificaciones: fallo enviando a', correo, err);
    }
  }
}

/** Envía de inmediato a un correo ya filtrado por preferencia/silencio
 * (usado por entregarPendientes al vaciar la cola de la madrugada). */
export async function enviarAhora(
  db: FirebaseFirestore.Firestore,
  correo: string,
  opciones: EnviarOpciones,
): Promise<void> {
  const tokens = await tokensDe(db, correo);
  if (tokens.length === 0) return;

  const resp = await getMessaging().sendEachForMulticast({
    tokens: tokens.map(t => t.token),
    data: {
      title: opciones.titulo,
      body: opciones.cuerpo,
      url: opciones.url,
      tag: opciones.tag,
      tipo: opciones.tipo,
    },
    webpush: {
      headers: { Urgency: 'high', TTL: '86400' },
    },
  });

  await Promise.all(resp.responses.map(async (r, i) => {
    if (r.success) return;
    const code = r.error?.code ?? '';
    logger.warn('push fallido', { correo, code, mensaje: r.error?.message });
    // Solo se borra el token que FCM declara muerto. 'invalid-argument' también
    // sale por errores de la carga útil, y borrar ahí dejaba sin registro a
    // dispositivos sanos.
    if (code === 'messaging/registration-token-not-registered') {
      await tokens[i].ref.delete().catch(() => {});
    }
  }));
}

/** Agrupa varias entregas pendientes de una misma persona en una sola
 * notificación (usado por entregarPendientes). */
export function agruparPendientes(
  pendientes: { tipo: TipoNotificacion; titulo: string; cuerpo: string; url: string; tag: string }[],
): EnviarOpciones {
  if (pendientes.length === 1) return pendientes[0];
  return {
    tipo: pendientes[0].tipo,
    titulo: `Tienes ${pendientes.length} notificaciones`,
    cuerpo: pendientes.map(p => `• ${p.titulo}: ${p.cuerpo}`).join('\n').slice(0, 500),
    url: pendientes[0].url,
    tag: 'mjb-pendientes',
  };
}

export interface ResultadoPrueba {
  ok: boolean;
  motivo?: 'sin-dispositivos';
  enviados: number;
  fallidos: number;
  detalles: { dispositivo: string; error?: string }[];
}

/** Prueba diagnóstica: envía a TODOS los dispositivos del correo, sin mirar
 * preferencias ni el silencio nocturno. Limpia tokens no registrados. */
export async function enviarPrueba(
  db: FirebaseFirestore.Firestore,
  correo: string,
): Promise<ResultadoPrueba> {
  const snap = await db.collection('notifDispositivos').doc(correo).collection('items').get();
  if (snap.empty) return { ok: false, motivo: 'sin-dispositivos', enviados: 0, fallidos: 0, detalles: [] };
  const items = snap.docs.map(d => ({
    ref: d.ref,
    token: String(d.data().token),
    nombre: `${String(d.data().plataforma ?? 'dispositivo')} · ${d.id.slice(0, 6)}`,
  }));

  const resp = await getMessaging().sendEachForMulticast({
    tokens: items.map(t => t.token),
    data: {
      title: 'MJB · Prueba',
      body: 'Si ves esto con la app cerrada, las notificaciones funcionan.',
      url: 'https://julitch80.github.io/mjb-prestamos/',
      tag: 'mjb-prueba',
      tipo: 'prueba',
    },
    webpush: { headers: { Urgency: 'high', TTL: '3600' } },
  });

  const detalles: { dispositivo: string; error?: string }[] = [];
  await Promise.all(resp.responses.map(async (r, i) => {
    if (r.success) { detalles.push({ dispositivo: items[i].nombre }); return; }
    const code = r.error?.code ?? 'desconocido';
    detalles.push({ dispositivo: items[i].nombre, error: `${code}: ${r.error?.message ?? ''}` });
    logger.warn('prueba push fallida', { correo, code, mensaje: r.error?.message });
    if (code === 'messaging/registration-token-not-registered') {
      await items[i].ref.delete().catch(() => {});
    }
  }));
  return { ok: resp.successCount > 0, enviados: resp.successCount, fallidos: resp.failureCount, detalles };
}
