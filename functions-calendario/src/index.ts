// Codebase `calendario`: lleva la agenda de tareas al Google Calendar institucional de
// cada estudiante, en un calendario aparte «Tareas MJB» (docs/calendario-tareas/PRD.md).
//
// Cada 15 minutos (5 a. m. – 10 p. m.) y para cada grupo activado:
//   1. lee las tareas del grupo del Apps Script (la misma respuesta, cacheada, que usa
//      la agenda pública);
//   2. lee de Firestore los estudiantes del grupo con correo institucional;
//   3. por cada uno, compara su «Tareas MJB» con lo que debería tener y corrige solo
//      las diferencias.
// Es idempotente: si una revisión se corta o falla, la siguiente lo deja al día.
//
// PERMISOS. La función corre como la cuenta de servicio CUENTA_SERVICIO, autorizada en
// Workspace (delegación de dominio) SOLO con el alcance `calendar.app.created`: puede
// crear calendarios y manejar los que ella misma creó, y nada más — no ve el calendario
// principal ni ningún otro del estudiante. No hay archivo de clave: el acceso se firma
// con la API IAM Credentials (la cuenta necesita «Creador de tokens» sobre sí misma).
//
// INTERRUPTOR. Todo se gobierna desde el documento `calendarioTareas/config`:
//   { pausado: boolean, grupos: string[], soloCorreos?: string[], soloSimular?: boolean }
// Si el documento no existe, NO se hace nada. Cambiarlo no requiere desplegar.
//
// Despliegue: `firebase deploy --only functions:calendario` (NUNCA sin acotar).

import { initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { GoogleAuth } from 'google-auth-library';
import {
  NOMBRE_CALENDARIO, correoParaCalendario, cuerpoEventoGoogle, eventosDeseadosDelGrupo,
  planDeCambios, type EventoDeseado, type EventoExistente, type TareaRemota,
} from '../../src/data/tareas/sincronizacion-calendario';
import { getAsignatura } from '../../src/data/asignacionAcademica';

initializeApp();
const db = getFirestore();

const REGION = 'us-central1';
const PROYECTO = 'mjb-prestamos';
const CUENTA_SERVICIO = `calendario-tareas@${PROYECTO}.iam.gserviceaccount.com`;
const ALCANCE = 'https://www.googleapis.com/auth/calendar.app.created';
const DOMINIO = 'iemanueljbetancur.edu.co';
const APPS_SCRIPT = 'https://script.google.com/macros/s/AKfycbyIxTCPm0PvibDjbqYYv6gYgJtc6MqL-2NVzdEaRLsMO2nAasseQgDO0UUixkeX4X4zZA/exec';
const URL_AGENDA = (g: string) => `https://julitch80.github.io/mjb-prestamos/#/agenda/${encodeURIComponent(g)}`;
const API = 'https://www.googleapis.com/calendar/v3';

interface Config {
  pausado?: boolean;
  grupos?: string[];
  soloCorreos?: string[];
  soloSimular?: boolean;
}

interface Resumen {
  grupo: string;
  estudiantes: number;
  sinCorreo: number;
  creados: number;
  actualizados: number;
  borrados: number;
  calendariosCreados: number;
  retirados: number;
  errores: { correo: string; error: string }[];
  simulado: boolean;
}

// ── Acceso como el estudiante (delegación de dominio, sin archivo de clave) ────

const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });

async function tokenComo(correo: string): Promise<string> {
  const cliente = await auth.getClient();
  const ahora = Math.floor(Date.now() / 1000);
  const payload = { iss: CUENTA_SERVICIO, sub: correo, scope: ALCANCE,
    aud: 'https://oauth2.googleapis.com/token', iat: ahora, exp: ahora + 3600 };
  const firmado = await cliente.request<{ signedJwt: string }>({
    url: `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${CUENTA_SERVICIO}:signJwt`,
    method: 'POST',
    data: { payload: JSON.stringify(payload) },
  });
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: firmado.data.signedJwt,
    }),
  });
  const cuerpo = await res.json() as { access_token?: string; error?: string; error_description?: string };
  if (!res.ok || !cuerpo.access_token) {
    // unauthorized_client = la delegación de dominio no está autorizada para este alcance.
    throw new Error(`token ${res.status}: ${cuerpo.error ?? ''} ${cuerpo.error_description ?? ''}`.trim());
  }
  return cuerpo.access_token;
}

class ErrorApi extends Error {
  constructor(public estado: number, mensaje: string) { super(mensaje); }
}

async function api<T>(token: string, metodo: string, ruta: string, cuerpo?: unknown): Promise<T> {
  for (let intento = 0; ; intento++) {
    const res = await fetch(API + ruta, {
      method: metodo,
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
    if (res.ok) return (res.status === 204 ? undefined : await res.json()) as T;
    // 403 por cuota de velocidad y 429/5xx: se reintenta con espera; lo demás, no.
    const texto = await res.text();
    const porCuota = res.status === 429 || res.status >= 500 || (res.status === 403 && /rateLimit|quota/i.test(texto));
    if (porCuota && intento < 3) { await esperar(1000 * 2 ** intento); continue; }
    throw new ErrorApi(res.status, `${metodo} ${ruta.split('?')[0]} ${res.status}: ${texto.slice(0, 200)}`);
  }
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── Calendario «Tareas MJB» de un estudiante ────────────────────────────────

const refCuenta = (correo: string) => db.collection('calendarioTareasCuentas').doc(correo);

/**
 * Devuelve el id del calendario «Tareas MJB» del estudiante, creándolo si no existe o
 * si el estudiante lo borró (decisión D1 de Julián: se vuelve a crear).
 */
async function asegurarCalendario(token: string, correo: string, simular: boolean): Promise<{ id: string | null; creado: boolean }> {
  const guardado = (await refCuenta(correo).get()).data()?.calendarId as string | undefined;
  if (guardado) {
    try {
      await api(token, 'GET', `/calendars/${encodeURIComponent(guardado)}`);
      return { id: guardado, creado: false };
    } catch (e) {
      if (!(e instanceof ErrorApi) || (e.estado !== 404 && e.estado !== 410)) throw e;
    }
  }
  if (simular) return { id: null, creado: true };
  const nuevo = await api<{ id: string }>(token, 'POST', '/calendars', {
    summary: NOMBRE_CALENDARIO,
    description: 'Tareas de tu grupo en la I.E. Manuel J. Betancur. Lo actualiza la aplicación del colegio; si no lo quieres ver, ocúltalo desmarcándolo.',
    timeZone: 'America/Bogota',
  });
  await refCuenta(correo).set({ calendarId: nuevo.id, creadoEn: FieldValue.serverTimestamp() }, { merge: true });
  return { id: nuevo.id, creado: true };
}

async function eventosExistentes(token: string, calendarId: string): Promise<EventoExistente[]> {
  const out: EventoExistente[] = [];
  let pagina: string | undefined;
  do {
    const q = new URLSearchParams({ maxResults: '2500', showDeleted: 'false', fields: 'items(id,extendedProperties),nextPageToken' });
    if (pagina) q.set('pageToken', pagina);
    const r = await api<{ items?: { id: string; extendedProperties?: { private?: Record<string, string> } }[]; nextPageToken?: string }>(
      token, 'GET', `/calendars/${encodeURIComponent(calendarId)}/events?${q}`);
    for (const it of r.items ?? []) {
      const p = it.extendedProperties?.private ?? {};
      out.push({ eventId: it.id, tareaId: p.tareaId ?? null, grupo: p.grupo ?? null, huella: p.huella ?? null });
    }
    pagina = r.nextPageToken;
  } while (pagina);
  return out;
}

async function aplicar(token: string, calendarId: string, deseados: EventoDeseado[], existentes: EventoExistente[], simular: boolean) {
  const plan = planDeCambios(deseados, existentes);
  if (!simular) {
    const cal = `/calendars/${encodeURIComponent(calendarId)}/events`;
    for (const e of plan.crear) await api(token, 'POST', cal, cuerpoEventoGoogle(e));
    for (const a of plan.actualizar) await api(token, 'PUT', `${cal}/${encodeURIComponent(a.eventId)}`, cuerpoEventoGoogle(a.evento));
    for (const id of plan.borrar) {
      try { await api(token, 'DELETE', `${cal}/${encodeURIComponent(id)}`); }
      catch (e) { if (!(e instanceof ErrorApi) || (e.estado !== 404 && e.estado !== 410)) throw e; }
    }
  }
  return plan;
}

// ── Revisión de un grupo ──────────────────────────────────────────────────────

async function tareasDelGrupo(grupo: string): Promise<TareaRemota[]> {
  for (let intento = 0; ; intento++) {
    try {
      const res = await fetch(`${APPS_SCRIPT}?action=getDatosTareas&grupo=${encodeURIComponent(grupo)}`, { redirect: 'follow' });
      const cuerpo = await res.json() as { ok?: boolean; tareas?: TareaRemota[] };
      if (res.ok && cuerpo.ok && Array.isArray(cuerpo.tareas)) return cuerpo.tareas;
      throw new Error(`respuesta ${res.status}`);
    } catch (e) {
      // Si no se pueden leer las tareas NO se toca ningún calendario: borrar a ciegas
      // por un fallo del Apps Script vaciaría la agenda de todo el grupo.
      if (intento >= 2) throw new Error(`No se pudieron leer las tareas de ${grupo}: ${(e as Error).message}`);
      await esperar(3000 * (intento + 1));
    }
  }
}

async function revisarGrupo(grupo: string, cfg: Config): Promise<Resumen> {
  const simular = !!cfg.soloSimular;
  const resumen: Resumen = { grupo, estudiantes: 0, sinCorreo: 0, creados: 0, actualizados: 0, borrados: 0,
    calendariosCreados: 0, retirados: 0, errores: [], simulado: simular };

  const tareas = await tareasDelGrupo(grupo);
  const deseados = eventosDeseadosDelGrupo(tareas, grupo, (id) => getAsignatura(id)?.nombre ?? id, URL_AGENDA(grupo));

  const snap = await db.collection('asistenciaStudents').where('gradoActual', '==', grupo).get();
  const soloCorreos = cfg.soloCorreos?.map((c) => c.trim().toLowerCase());
  const correos: string[] = [];
  for (const d of snap.docs) {
    const correo = correoParaCalendario(d.data(), DOMINIO);
    if (!correo) { if (d.data().activo !== false) resumen.sinCorreo++; continue; }
    if (soloCorreos && soloCorreos.length && !soloCorreos.includes(correo)) continue;
    correos.push(correo);
  }
  resumen.estudiantes = correos.length;

  for (const correo of correos) {
    try {
      const token = await tokenComo(correo);
      const cal = await asegurarCalendario(token, correo, simular);
      if (cal.creado) resumen.calendariosCreados++;
      const existentes = cal.id ? (await eventosExistentes(token, cal.id)).filter((e) => !e.grupo || e.grupo === grupo) : [];
      const plan = await aplicar(token, cal.id ?? '', deseados, existentes, simular || !cal.id);
      resumen.creados += plan.crear.length;
      resumen.actualizados += plan.actualizar.length;
      resumen.borrados += plan.borrar.length;
      if (!simular) await refCuenta(correo).set({ grupo, ultimaRevision: FieldValue.serverTimestamp() }, { merge: true });
    } catch (e) {
      resumen.errores.push({ correo, error: (e as Error).message.slice(0, 300) });
    }
  }

  // Estudiantes que estaban en el grupo y ya no (cambio de grupo, retiro, sin correo):
  // se les borran los eventos DE ESTE GRUPO. El calendario se queda, por si pasan a otro
  // grupo activado.
  const refEstado = db.collection('calendarioTareas').doc(`estado-${grupo}`);
  const anteriores: string[] = (await refEstado.get()).data()?.correos ?? [];
  const actuales = new Set(correos);
  for (const correo of anteriores.filter((c) => !actuales.has(c))) {
    if (soloCorreos && soloCorreos.length) break; // en modo de prueba no se retira a nadie
    try {
      const calendarId = (await refCuenta(correo).get()).data()?.calendarId as string | undefined;
      if (!calendarId) continue;
      const token = await tokenComo(correo);
      const suyos = (await eventosExistentes(token, calendarId)).filter((e) => e.grupo === grupo);
      await aplicar(token, calendarId, [], suyos, simular);
      resumen.retirados++;
      resumen.borrados += suyos.length;
    } catch (e) {
      const estado = e instanceof ErrorApi ? e.estado : 0;
      if (estado !== 404 && estado !== 410) resumen.errores.push({ correo, error: 'retiro: ' + (e as Error).message.slice(0, 280) });
    }
  }

  if (!simular) {
    await refEstado.set({ correos, ultimaRevision: FieldValue.serverTimestamp(), resumen }, { merge: false });
  } else {
    await refEstado.set({ ultimaSimulacion: FieldValue.serverTimestamp(), resumenSimulado: resumen }, { merge: true });
  }
  return resumen;
}

// ── Programación ──────────────────────────────────────────────────────────────

export const sincronizarCalendarioTareas = onSchedule(
  {
    schedule: 'every 15 minutes from 05:00 to 22:00',
    timeZone: 'America/Bogota',
    region: REGION,
    serviceAccount: CUENTA_SERVICIO,
    timeoutSeconds: 540,
    memory: '256MiB',
    retryCount: 0,
  },
  async () => {
    const cfg = (await db.collection('calendarioTareas').doc('config').get()).data() as Config | undefined;
    if (!cfg) { logger.info('calendarioTareas/config no existe: no se hace nada.'); return; }
    if (cfg.pausado) { logger.info('Sincronización en pausa (calendarioTareas/config.pausado).'); return; }
    for (const grupo of cfg.grupos ?? []) {
      try {
        const r = await revisarGrupo(grupo, cfg);
        const linea = `${r.simulado ? '[SIMULACIÓN] ' : ''}${grupo}: ${r.estudiantes} estudiantes, ${r.sinCorreo} sin correo, `
          + `${r.calendariosCreados} calendarios nuevos, ${r.creados} creados, ${r.actualizados} actualizados, `
          + `${r.borrados} borrados, ${r.retirados} retirados, ${r.errores.length} errores`;
        if (r.errores.length) logger.warn(linea, { errores: r.errores.slice(0, 20) });
        else logger.info(linea);
      } catch (e) {
        logger.error(`${grupo}: revisión abortada sin tocar calendarios — ${(e as Error).message}`);
      }
    }
  },
);
