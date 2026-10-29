// Codebase `plancasa`: guía con IA y copia pública (QR) del plan de trabajo en casa.
// Ver docs/plan-casa/PLAN.md.
//
// Despliegue: `npx firebase deploy --only functions:plancasa` (NUNCA sin acotar).
// Secreto: `npx firebase functions:secrets:set ANTHROPIC_API_KEY`.
// TRAMPA DEL 403: invoker 'public' en las callables; la autenticación real se comprueba dentro.

import { initializeApp } from 'firebase-admin/app';
import { FieldPath, getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { setGlobalOptions } from 'firebase-functions/v2';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineSecret } from 'firebase-functions/params';
import * as logger from 'firebase-functions/logger';
import Anthropic from '@anthropic-ai/sdk';
import { ASIGNATURAS } from '../../src/data/asignacionAcademica';
import { USUARIOS } from '../../src/data/maestros';
import type { GuiaPlan, EntradaGuiaIA, PlanCasa, SalidaGuiaIA } from '../../src/data/planCasa/tipos';
import { COL_PLANES, COL_PUBLICO, SUB_ENTREGAS, SUB_GUIAS } from '../../src/data/planCasa/tipos';
import type {
  EntradaSubirEntrega, EntradaVerEntrega, EntregaPlan, PlanPublico, SalidaSubirEntrega, SalidaVerEntrega, TipoEntrega,
} from '../../src/data/planCasa/tipos';
import {
  bytesDeBase64, cupoDiario, finAnioLectivo, inicioDiaColombia, nombreSeguro, seguimientoTrasEntrega, validarArchivo, validarEnlace,
} from '../../src/data/planCasa/entregas';
import { ESQUEMA_GUIA, MODELO, SISTEMA, construirPrompt, sanearGuia } from './guia';
import { cambioAfectaPublico, construirPublico } from './publico';
import { LOTE_LIMPIEZA, seleccionarVencidas } from './limpieza';
import { SISTEMA_CAMPOS, construirPromptCampos, esquemaCampos, sanearCampos, type EntradaCampos } from './campos';
import { ESQUEMA_PREGUNTAS, SISTEMA_PREGUNTAS, construirPromptPreguntas, sanearPreguntas, type EntradaPreguntas, type PreguntaSugerida } from './preguntas';

setGlobalOptions({ maxInstances: 10, region: 'us-central1' });

initializeApp();
const db = getFirestore();
const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');
const opciones = { region: 'us-central1', cors: true, invoker: 'public' as const };

const ROLES_GUIA = ['docente', 'coordinador', 'rectora', 'superusuario'];
const ROLES_ADMIN = ['coordinador', 'rectora', 'superusuario'];

interface Llamante { correo: string; role: string }

async function llamante(request: { auth?: { token?: Record<string, unknown> } | null }): Promise<Llamante> {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');
  const correo = String(request.auth.token?.email ?? '').toLowerCase();
  if (!correo) throw new HttpsError('permission-denied', 'No se pudo determinar tu correo.');
  if (request.auth.token?.suplantadoPor) throw new HttpsError('permission-denied', 'No disponible durante una suplantación.');
  const u = await db.doc(`users/${correo}`).get();
  if (!u.exists || u.get('active') !== true) throw new HttpsError('permission-denied', 'Tu usuario no está activo.');
  if (u.get('soloLectura') === true) throw new HttpsError('permission-denied', 'Tu usuario está en solo lectura.');
  return { correo, role: String(u.get('role') ?? '') };
}

async function esEquipo(correo: string): Promise<boolean> {
  const s = await db.doc('planCasaConfig/equipo').get();
  const correos = (s.get('correos') as unknown[] | undefined) ?? [];
  return correos.some(c => String(c).toLowerCase() === correo);
}

// ---------------------------------------------------------------- planCasaGuia

export const planCasaGuia = onCall(
  { ...opciones, secrets: [ANTHROPIC_API_KEY], timeoutSeconds: 300, memory: '512MiB' },
  async (request): Promise<SalidaGuiaIA> => {
    const quien = await llamante(request);
    if (!ROLES_GUIA.includes(quien.role) && !(await esEquipo(quien.correo))) {
      throw new HttpsError('permission-denied', 'Tu usuario no puede pedir guías.');
    }
    const e = (request.data ?? {}) as EntradaGuiaIA;
    if (typeof e.asignatura !== 'string' || !e.asignatura.trim() || typeof e.pedido?.tematicas !== 'string' || !e.pedido.tematicas.trim()) {
      throw new HttpsError('invalid-argument', 'Faltan la asignatura o las temáticas.');
    }
    try {
      const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value() });
      const resp = await client.messages.create({
        model: MODELO,
        max_tokens: 20000,
        system: SISTEMA,
        output_config: { effort: 'medium', format: { type: 'json_schema', schema: ESQUEMA_GUIA as unknown as Record<string, unknown> } },
        messages: [{ role: 'user', content: construirPrompt(e) }],
      });
      logger.info('planCasaGuia: uso de tokens', {
        asignatura: e.asignatura, entrada: resp.usage.input_tokens, salida: resp.usage.output_tokens, stop: resp.stop_reason,
      });
      if (resp.stop_reason === 'refusal') return { ok: false, error: 'La IA no pudo generar esta guía. Reformula las temáticas e inténtalo de nuevo.' };
      if (resp.stop_reason === 'max_tokens') return { ok: false, error: 'La guía quedó incompleta. Pide una versión más corta.' };
      const texto = resp.content.map(b => (b.type === 'text' ? b.text : '')).join('');
      let bruto: unknown;
      try { bruto = JSON.parse(texto); } catch { return { ok: false, error: 'La respuesta de la IA no tuvo el formato esperado. Inténtalo de nuevo.' }; }
      const guia = sanearGuia(bruto, e.topeDiario, e.semanas, e.sinTecnologia === true);
      if (!guia) return { ok: false, error: 'La IA devolvió una guía incompleta. Inténtalo de nuevo.' };
      return { ok: true, guia };
    } catch (err) {
      logger.error('planCasaGuia: fallo', { mensaje: err instanceof Error ? err.message : String(err) });
      if (err instanceof Anthropic.RateLimitError) return { ok: false, error: 'La IA está saturada. Inténtalo en un minuto.' };
      if (err instanceof Anthropic.AuthenticationError) return { ok: false, error: 'La clave de la IA no es válida. Avisa al administrador.' };
      return { ok: false, error: 'No se pudo generar la guía. Inténtalo de nuevo.' };
    }
  },
);

// ------------------------------------------------------------ planCasaPreguntas

export const planCasaPreguntas = onCall(
  { ...opciones, secrets: [ANTHROPIC_API_KEY], timeoutSeconds: 60, memory: '256MiB' },
  async (request): Promise<{ ok: boolean; preguntas?: PreguntaSugerida[]; error?: string }> => {
    const quien = await llamante(request);
    if (!ROLES_GUIA.includes(quien.role) && !(await esEquipo(quien.correo))) {
      throw new HttpsError('permission-denied', 'Tu usuario no puede pedir sugerencias.');
    }
    const e = (request.data ?? {}) as EntradaPreguntas;
    if (!Array.isArray(e.asignaturas) || !e.asignaturas.some(a => typeof a === 'string' && a.trim())) {
      throw new HttpsError('invalid-argument', 'Escoge al menos una asignatura.');
    }
    try {
      const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value() });
      const resp = await client.messages.create({
        model: MODELO,
        max_tokens: 4000,
        system: SISTEMA_PREGUNTAS,
        output_config: { effort: 'low', format: { type: 'json_schema', schema: ESQUEMA_PREGUNTAS as unknown as Record<string, unknown> } },
        messages: [{ role: 'user', content: construirPromptPreguntas(e) }],
      });
      logger.info('planCasaPreguntas: uso de tokens', { entrada: resp.usage.input_tokens, salida: resp.usage.output_tokens, stop: resp.stop_reason });
      if (resp.stop_reason === 'refusal') return { ok: false, error: 'La IA no pudo generar sugerencias. Cambia la temática e inténtalo de nuevo.' };
      if (resp.stop_reason === 'max_tokens') return { ok: false, error: 'La respuesta quedó incompleta. Inténtalo de nuevo.' };
      const texto = resp.content.map(b => (b.type === 'text' ? b.text : '')).join('');
      let bruto: unknown;
      try { bruto = JSON.parse(texto); } catch { return { ok: false, error: 'La respuesta de la IA no tuvo el formato esperado. Inténtalo de nuevo.' }; }
      const preguntas = sanearPreguntas(bruto);
      if (!preguntas.length) return { ok: false, error: 'La IA no devolvió preguntas útiles. Inténtalo de nuevo.' };
      return { ok: true, preguntas };
    } catch (err) {
      logger.error('planCasaPreguntas: fallo', { mensaje: err instanceof Error ? err.message : String(err) });
      if (err instanceof Anthropic.RateLimitError) return { ok: false, error: 'La IA está saturada. Inténtalo en un minuto.' };
      if (err instanceof Anthropic.AuthenticationError) return { ok: false, error: 'La clave de la IA no es válida. Avisa al administrador.' };
      return { ok: false, error: 'No se pudieron generar las sugerencias. Inténtalo de nuevo.' };
    }
  },
);

// --------------------------------------------------------- planCasaSugerirCampos

export const planCasaSugerirCampos = onCall(
  { ...opciones, secrets: [ANTHROPIC_API_KEY], timeoutSeconds: 60, memory: '256MiB' },
  async (request): Promise<{ ok: boolean; campos?: Record<string, string>; error?: string }> => {
    const quien = await llamante(request);
    if (!ROLES_GUIA.includes(quien.role) && !(await esEquipo(quien.correo))) {
      throw new HttpsError('permission-denied', 'Tu usuario no puede pedir sugerencias.');
    }
    const e = (request.data ?? {}) as EntradaCampos;
    if (e.modo !== 'asignatura' && e.modo !== 'pedido' && e.modo !== 'entregable') throw new HttpsError('invalid-argument', 'Modo inválido.');
    if (!Array.isArray(e.asignaturas) || !e.asignaturas.some(a => typeof a === 'string' && a.trim())) {
      throw new HttpsError('invalid-argument', 'Falta la asignatura.');
    }
    try {
      const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value() });
      const resp = await client.messages.create({
        model: MODELO,
        max_tokens: 2000,
        system: SISTEMA_CAMPOS,
        output_config: { effort: 'low', format: { type: 'json_schema', schema: esquemaCampos(e.modo) as unknown as Record<string, unknown> } },
        messages: [{ role: 'user', content: construirPromptCampos(e) }],
      });
      logger.info('planCasaSugerirCampos: uso de tokens', { modo: e.modo, entrada: resp.usage.input_tokens, salida: resp.usage.output_tokens, stop: resp.stop_reason });
      if (resp.stop_reason === 'refusal') return { ok: false, error: 'La IA no pudo generar la sugerencia. Inténtalo de nuevo.' };
      if (resp.stop_reason === 'max_tokens') return { ok: false, error: 'La respuesta quedó incompleta. Inténtalo de nuevo.' };
      const texto = resp.content.map(b => (b.type === 'text' ? b.text : '')).join('');
      let bruto: unknown;
      try { bruto = JSON.parse(texto); } catch { return { ok: false, error: 'La respuesta de la IA no tuvo el formato esperado. Inténtalo de nuevo.' }; }
      const campos = sanearCampos(bruto, e.modo);
      if (!campos) return { ok: false, error: 'La IA no devolvió una sugerencia útil. Inténtalo de nuevo.' };
      return { ok: true, campos };
    } catch (err) {
      logger.error('planCasaSugerirCampos: fallo', { mensaje: err instanceof Error ? err.message : String(err) });
      if (err instanceof Anthropic.RateLimitError) return { ok: false, error: 'La IA está saturada. Inténtalo en un minuto.' };
      if (err instanceof Anthropic.AuthenticationError) return { ok: false, error: 'La clave de la IA no es válida. Avisa al administrador.' };
      return { ok: false, error: 'No se pudo generar la sugerencia. Inténtalo de nuevo.' };
    }
  },
);

// ------------------------------------------------------------ planCasaPublicar

const nombreAsignatura = (id: string) => ASIGNATURAS.find(a => a.id === id)?.nombre ?? id;
/** Los correos de USUARIOS están vacíos: se resuelve por correo directo y, si no, por el slotId de users/{correo}. */
async function mapaDocentes(correos: string[]): Promise<Map<string, string>> {
  const m = new Map<string, string>();
  for (const c of new Set(correos.map(x => String(x ?? '').toLowerCase()).filter(Boolean))) {
    let nombre = USUARIOS.find(u => u.correo && u.correo.toLowerCase() === c)?.nombreCorto;
    if (!nombre) {
      const slot = (await db.doc(`users/${c}`).get()).get('slotId');
      nombre = USUARIOS.find(u => u.id === slot)?.nombreCorto;
    }
    m.set(c, nombre ?? (c.split('@')[0] || c));
  }
  return m;
}

/** Reconstruye y escribe la copia pública. Sin auth: la llaman la callable (ya autorizada) y el trigger. */
async function republicar(planId: string, plan?: PlanCasa, guias?: GuiaPlan[]): Promise<{ pasos: number } | null> {
  if (!plan) {
    const planSnap = await db.doc(`${COL_PLANES}/${planId}`).get();
    if (!planSnap.exists) return null;
    plan = { ...(planSnap.data() as PlanCasa), id: planId };
  }
  if (typeof plan.tokenPublico !== 'string' || plan.tokenPublico.length < 20) return null;
  if (!guias) {
    const guiasSnap = await db.collection(`${COL_PLANES}/${planId}/${SUB_GUIAS}`).get();
    guias = guiasSnap.docs.map(d => ({ ...(d.data() as GuiaPlan), id: d.id }));
  }
  const nombres = await mapaDocentes(guias.filter(g => g.aprobada).map(g => g.responsableCorreo));
  const publico = construirPublico(plan, guias, nombreAsignatura, c => nombres.get(c) ?? c.split('@')[0], Date.now());
  await db.doc(`${COL_PUBLICO}/${plan.tokenPublico}`).set(publico);
  logger.info('republicar', { planId, pasos: publico.pasos.length, sustentaciones: publico.sustentaciones.length });
  return { pasos: publico.pasos.length };
}

export const planCasaPublicar = onCall(opciones, async (request) => {
  const quien = await llamante(request);
  const planId = (request.data as { planId?: unknown } | undefined)?.planId;
  if (typeof planId !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(planId)) throw new HttpsError('invalid-argument', 'planId inválido.');
  const planSnap = await db.doc(`${COL_PLANES}/${planId}`).get();
  if (!planSnap.exists) throw new HttpsError('not-found', 'El plan no existe.');
  const plan = { ...(planSnap.data() as PlanCasa), id: planId };
  const guiasSnap = await db.collection(`${COL_PLANES}/${planId}/${SUB_GUIAS}`).get();
  const guias = guiasSnap.docs.map(d => ({ ...(d.data() as GuiaPlan), id: d.id }));

  const permitido = ROLES_ADMIN.includes(quien.role)
    || (await esEquipo(quien.correo))
    || guias.some(g => (g.docentesCorreos ?? []).some(c => String(c).toLowerCase() === quien.correo));
  if (!permitido) throw new HttpsError('permission-denied', 'No puedes publicar este plan.');
  if (typeof plan.tokenPublico !== 'string' || plan.tokenPublico.length < 20) throw new HttpsError('failed-precondition', 'El plan no tiene token público válido.');

  const r = await republicar(planId, plan, guias);
  return { ok: true, pasos: r?.pasos ?? 0 };
});

// Republicación automática: un cambio relevante en una guía actualiza la copia pública.
// Solo escribe planesCasaPublico (no planesCasa), así que no hay bucle.
export const planCasaRepublicarAlCambiarGuia = onDocumentWritten(
  { document: `${COL_PLANES}/{planId}/${SUB_GUIAS}/{guiaId}`, region: 'us-central1' },
  async (event) => {
    const antes = event.data?.before.exists ? (event.data.before.data() as GuiaPlan) : undefined;
    const despues = event.data?.after.exists ? (event.data.after.data() as GuiaPlan) : undefined;
    if (!cambioAfectaPublico(antes, despues)) return;
    const planId = event.params.planId;
    const planSnap = await db.doc(`${COL_PLANES}/${planId}`).get();
    if (!planSnap.exists || planSnap.get('estado') === 'cerrado') return;
    await republicar(planId);
  },
);

// Fin del año lectivo: borra archivo y registro de las entregas con `borrarDespuesDe` vencido.
export const planCasaLimpiarEntregas = onSchedule(
  { schedule: '0 3 * * *', timeZone: 'America/Bogota', region: 'us-central1' },
  async () => {
    const ahora = Date.now();
    const snap = await db.collectionGroup(SUB_ENTREGAS).where('borrarDespuesDe', '<', ahora).limit(LOTE_LIMPIEZA).get();
    const vencidas = seleccionarVencidas(snap.docs.map(d => ({ ref: d.ref, ...(d.data() as EntregaPlan) })), ahora, LOTE_LIMPIEZA);
    let archivos = 0; let registros = 0; let fallos = 0;
    for (const v of vencidas) {
      try {
        if (v.ruta) {
          await getStorage().bucket().file(v.ruta).delete({ ignoreNotFound: true });
          archivos++;
        }
        await v.ref.delete();
        registros++;
      } catch (err) {
        fallos++;
        logger.error('planCasaLimpiarEntregas: fallo', { ruta: v.ruta, mensaje: err instanceof Error ? err.message : String(err) });
      }
    }
    logger.info('planCasaLimpiarEntregas', { candidatas: snap.size, archivos, registros, fallos });
  },
);

// ------------------------------------------------------- planCasaSubirEntrega
// PÚBLICA (sin login): el token del QR es el secreto. El archivo viaja en base64 dentro de la
// callable (10 MB → ~13,4 MB; el límite de petición de Functions v2 es 32 MB), así que no hacen
// falta URL firmadas de subida, CORS del bucket ni permisos IAM de firma.

const RE_ID = /^[A-Za-z0-9_-]{1,100}$/;

export const planCasaSubirEntrega = onCall(
  { ...opciones, timeoutSeconds: 120, memory: '512MiB' },
  async (request): Promise<SalidaSubirEntrega> => {
    const e = (request.data ?? {}) as EntradaSubirEntrega;
    if (typeof e.token !== 'string' || !/^[A-Za-z0-9_-]{20,200}$/.test(e.token)) throw new HttpsError('invalid-argument', 'Enlace inválido.');
    if (typeof e.guiaId !== 'string' || !RE_ID.test(e.guiaId) || typeof e.pasoId !== 'string' || !RE_ID.test(e.pasoId)) {
      throw new HttpsError('invalid-argument', 'Paso inválido.');
    }
    const planes = await db.collection(COL_PLANES).where('tokenPublico', '==', e.token).limit(1).get();
    if (planes.empty) return { ok: false, error: 'Este enlace ya no es válido. Pide uno nuevo en el colegio.' };
    const planRef = planes.docs[0].ref;
    if (planes.docs[0].get('estado') === 'cerrado') return { ok: false, error: 'Este plan ya está cerrado: no recibe entregas.' };

    const guiaRef = planRef.collection(SUB_GUIAS).doc(e.guiaId);
    const guiaSnap = await guiaRef.get();
    const guia = guiaSnap.data() as GuiaPlan | undefined;
    if (!guia?.aprobada?.pasos?.some(p => p.id === e.pasoId)) return { ok: false, error: 'Ese paso ya no está en tu plan. Recarga la página.' };

    // Archivo o enlace.
    let tipo: TipoEntrega; let contentType: string; let nombre: string; let buffer: Buffer | null = null; let url: string | undefined;
    if (typeof e.enlace === 'string' && e.enlace.trim()) {
      const v = validarEnlace(e.enlace);
      if (!v.ok) return { ok: false, error: v.error };
      tipo = 'enlace'; contentType = 'text/uri-list'; nombre = 'Enlace'; url = v.url;
    } else {
      if (typeof e.datosBase64 !== 'string' || !e.datosBase64) return { ok: false, error: 'No llegó ningún archivo.' };
      nombre = nombreSeguro(String(e.nombreArchivo ?? 'archivo'));
      const v = validarArchivo(nombre, String(e.contentType ?? ''), bytesDeBase64(e.datosBase64));
      if (!v.ok) return { ok: false, error: v.error };
      tipo = v.tipo; contentType = v.contentType;
      buffer = Buffer.from(e.datosBase64, 'base64');
    }

    const ahora = Date.now();
    const hoy = await planRef.collection(SUB_ENTREGAS).where('creadoEn', '>=', inicioDiaColombia(ahora)).count().get();
    const cupo = cupoDiario(hoy.data().count);
    if (!cupo.ok) return { ok: false, error: cupo.error };

    const entregaRef = planRef.collection(SUB_ENTREGAS).doc();
    const ruta = buffer ? `${COL_PLANES}/${planRef.id}/entregas/${e.guiaId}/${e.pasoId}/${ahora}-${nombre}` : '';
    if (buffer) {
      await getStorage().bucket().file(ruta).save(buffer, {
        resumable: false, contentType, metadata: { cacheControl: 'private, max-age=0', metadata: { entregaId: entregaRef.id } },
      });
    }
    const registro: Omit<EntregaPlan, 'id'> = {
      guiaId: e.guiaId, pasoId: e.pasoId, tipo, ruta, ...(url ? { url } : {}), nombre, contentType,
      tamano: buffer?.length ?? 0, creadoEn: ahora, borrarDespuesDe: finAnioLectivo(ahora),
    };
    const pubRef = db.doc(`${COL_PUBLICO}/${e.token}`);
    await db.runTransaction(async tx => {
      const [g, pub] = await Promise.all([tx.get(guiaRef), tx.get(pubRef)]);
      const previo = (g.get('seguimiento') as GuiaPlan['seguimiento'] | undefined)?.[e.pasoId];
      tx.set(entregaRef, registro);
      tx.update(guiaRef, new FieldPath('seguimiento', e.pasoId), seguimientoTrasEntrega(previo, ahora));
      if (pub.exists) {
        const pasos = ((pub.get('pasos') as PlanPublico['pasos'] | undefined) ?? [])
          .map(p => (p.guiaId === e.guiaId && p.id === e.pasoId ? { ...p, entregadoEn: ahora } : p));
        tx.update(pubRef, { pasos });
      }
    });
    logger.info('planCasaSubirEntrega', { planId: planRef.id, guiaId: e.guiaId, pasoId: e.pasoId, tipo, bytes: registro.tamano });
    return { ok: true, entregadoEn: ahora };
  },
);

// --------------------------------------------------------- planCasaVerEntrega
// Con login. Devuelve el archivo en base64 (el navegador arma una URL blob: local y temporal):
// nunca hay una URL permanente ni firmada que se pueda reenviar.

export const planCasaVerEntrega = onCall(
  { ...opciones, timeoutSeconds: 60, memory: '512MiB' },
  async (request): Promise<SalidaVerEntrega> => {
    const quien = await llamante(request);
    const e = (request.data ?? {}) as EntradaVerEntrega;
    if (typeof e.planId !== 'string' || !RE_ID.test(e.planId) || typeof e.entregaId !== 'string' || !RE_ID.test(e.entregaId)) {
      throw new HttpsError('invalid-argument', 'Datos inválidos.');
    }
    const snap = await db.doc(`${COL_PLANES}/${e.planId}/${SUB_ENTREGAS}/${e.entregaId}`).get();
    if (!snap.exists) throw new HttpsError('not-found', 'La entrega no existe.');
    const ent = snap.data() as EntregaPlan;
    const guia = (await db.doc(`${COL_PLANES}/${e.planId}/${SUB_GUIAS}/${ent.guiaId}`).get()).data() as GuiaPlan | undefined;
    const docenteGuia = (guia?.docentesCorreos ?? []).some(c => String(c).toLowerCase() === quien.correo)
      || String(guia?.responsableCorreo ?? '').toLowerCase() === quien.correo;
    if (!ROLES_ADMIN.includes(quien.role) && !docenteGuia && !(await esEquipo(quien.correo))) {
      throw new HttpsError('permission-denied', 'No puedes abrir esta entrega.');
    }
    if (ent.tipo === 'enlace') return { ok: true, url: ent.url, nombre: ent.nombre };
    try {
      const [buf] = await getStorage().bucket().file(ent.ruta).download();
      logger.info('planCasaVerEntrega', { planId: e.planId, entregaId: e.entregaId, por: quien.correo });
      return { ok: true, contentType: ent.contentType, nombre: ent.nombre, datosBase64: buf.toString('base64') };
    } catch (err) {
      logger.error('planCasaVerEntrega: fallo', { mensaje: err instanceof Error ? err.message : String(err) });
      return { ok: false, error: 'No se encontró el archivo (puede haberse borrado al cierre del año).' };
    }
  },
);
