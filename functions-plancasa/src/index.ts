// Codebase `plancasa`: guía con IA y copia pública (QR) del plan de trabajo en casa.
// Ver docs/plan-casa/PLAN.md.
//
// Despliegue: `npx firebase deploy --only functions:plancasa` (NUNCA sin acotar).
// Secreto: `npx firebase functions:secrets:set ANTHROPIC_API_KEY`.
// TRAMPA DEL 403: invoker 'public' en las callables; la autenticación real se comprueba dentro.

import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { setGlobalOptions } from 'firebase-functions/v2';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import * as logger from 'firebase-functions/logger';
import Anthropic from '@anthropic-ai/sdk';
import { ASIGNATURAS } from '../../src/data/asignacionAcademica';
import { USUARIOS } from '../../src/data/maestros';
import type { GuiaPlan, EntradaGuiaIA, PlanCasa, SalidaGuiaIA } from '../../src/data/planCasa/tipos';
import { COL_PLANES, COL_PUBLICO, SUB_GUIAS } from '../../src/data/planCasa/tipos';
import { ESQUEMA_GUIA, MODELO, SISTEMA, construirPrompt, sanearGuia } from './guia';
import { construirPublico } from './publico';
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
  { ...opciones, secrets: [ANTHROPIC_API_KEY], timeoutSeconds: 180, memory: '512MiB' },
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
        max_tokens: 8000,
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
      const guia = sanearGuia(bruto, e.topeDiario, e.semanas);
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

  const nombres = await mapaDocentes(guias.filter(g => g.aprobada).map(g => g.responsableCorreo));
  const publico = construirPublico(plan, guias, nombreAsignatura, c => nombres.get(c) ?? c.split('@')[0], Date.now());
  await db.doc(`${COL_PUBLICO}/${plan.tokenPublico}`).set(publico);
  logger.info('planCasaPublicar', { planId, pasos: publico.pasos.length, sustentaciones: publico.sustentaciones.length });
  return { ok: true, pasos: publico.pasos.length };
});
