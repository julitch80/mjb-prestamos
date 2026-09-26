// Codebase `notificaciones`: entrega push al celular aunque la app esté
// cerrada (docs/notificaciones-push/PRD.md, aprobado 24-sep-2026). Aislado
// como `calendario`: si falla, no toca préstamos ni asistencia.
//
// Tres disparadores:
//  - alNuevoMensajeChat: mensaje nuevo en el chat interno.
//  - pushDesdeAppsScript: el Apps Script llama aquí al crear un aviso de
//    coordinación/rectoría/horario/reserva/sugerencia (docs/backend-Code.gs).
//  - entregarPendientes: vacía a las 5:30 a. m. lo que se encoló de noche
//    (silencio nocturno, PRD D2).
//
// Despliegue: `firebase deploy --only functions:notificaciones` (NUNCA sin acotar).

import { createHash, timingSafeEqual } from 'node:crypto';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { setGlobalOptions } from 'firebase-functions/v2';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineSecret } from 'firebase-functions/params';
import { destinatariosDeCanal, type CanalParaDestinatarios, type TipoNotificacion, type UsuarioParaDestinatarios } from '../../src/data/notificacionesPushLogica';
import { parseHorarioModificadoDeNotificacion } from '../../src/data/horarioModificado';
import {
  debeAlertarInvestigacion, destinatariosAccidente, horaLimiteFurat,
} from '../../src/data/sst/accidenteLaboral';
import { agruparPendientes, enviarAhora, enviarAUsuarios, type EnviarOpciones } from './enviar';

// Techo de copias simultáneas (mismo patrón que `calendario`, 23-sep-2026).
setGlobalOptions({ maxInstances: 10 });

initializeApp();
const db = getFirestore();

const REGION = 'us-central1';
const BASE_URL = 'https://julitch80.github.io/mjb-prestamos/';

// Apps Script /exec (docs/backend-Code.gs), reusado para el correo de
// accidente laboral igual que functions-calendario. NO es el mismo endpoint
// que pushDesdeAppsScript (ese es Apps Script → esta función; este es al
// revés: esta función → Apps Script, para el correo).
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyIxTCPm0PvibDjbqYYv6gYgJtc6MqL-2NVzdEaRLsMO2nAasseQgDO0UUixkeX4X4zZA/exec';

// Secreto compartido con el Apps Script (docs/backend-Code.gs). Declarado,
// NO creado aquí: Julián lo guarda una vez con
// `firebase functions:secrets:set PUSH_SECRETO`.
const PUSH_SECRETO = defineSecret('PUSH_SECRETO');

// ── Chat: mensaje nuevo → push a quien pueda ver el canal, menos el autor ──
export const alNuevoMensajeChat = onDocumentCreated(
  { document: 'channels/{channelId}/messages/{messageId}', region: REGION },
  async (event) => {
    const m = event.data?.data();
    if (!m || m.deleted) return;
    const channelId = event.params.channelId;

    const canalSnap = await db.doc(`channels/${channelId}`).get();
    const canal = canalSnap.data();
    if (!canal) return;

    // Solo consulta todos los usuarios activos cuando el tipo de canal los
    // necesita (general/rol/segmento); directo/grupo ya trae sus miembros.
    let usuarios: UsuarioParaDestinatarios[] = [];
    if (['general', 'rol', 'segmento'].includes(canal.type)) {
      const usersSnap = await db.collection('users').where('active', '==', true).get();
      usuarios = usersSnap.docs.map(d => {
        const u = d.data();
        return { correo: d.id, role: u.role, active: u.active, sede: u.sede ?? null, jornada: u.jornada ?? null };
      });
    } else if (Array.isArray(canal.members)) {
      // directo/grupo: destinatariosDeCanal solo necesita active=true y el
      // correo para filtrar por members; el rol/sede no influyen aquí.
      usuarios = canal.members.map((correo: string) => (
        { correo, role: 'docente', active: true, sede: null, jornada: null }));
    }

    const destinatarios = destinatariosDeCanal(canal as unknown as CanalParaDestinatarios, usuarios, m.authorEmail ?? '');
    if (destinatarios.length === 0) return;

    const titulo = canal.type === 'directo'
      ? String(m.authorName ?? 'Nuevo mensaje')
      : String(canal.name ?? m.authorName ?? 'Chat');
    const cuerpo = String(m.text ?? '').slice(0, 100);

    await enviarAUsuarios(db, destinatarios, {
      tipo: 'chat',
      titulo,
      cuerpo,
      url: `${BASE_URL}?ir=chat&canal=${encodeURIComponent(channelId)}`,
      tag: `mjb-chat-${channelId}`,
    });
  });

// ── Traduce un id de directivo (rectora/coord_manana/coord_tarde) a correo ──
async function correoDeDirectivo(destinatario: string): Promise<string | null> {
  let query: FirebaseFirestore.Query = db.collection('users').where('active', '==', true);
  if (destinatario === 'rectora') {
    query = query.where('role', '==', 'rectora');
  } else if (destinatario === 'coord_manana') {
    query = query.where('role', '==', 'coordinador').where('jornada', '==', 'manana');
  } else if (destinatario === 'coord_tarde') {
    query = query.where('role', '==', 'coordinador').where('jornada', '==', 'tarde');
  } else {
    return null;
  }
  const snap = await query.limit(1).get();
  return snap.empty ? null : snap.docs[0].id;
}

async function correoDeSlotId(slotId: string): Promise<string | null> {
  const snap = await db.collection('users').where('slotId', '==', slotId).where('active', '==', true).limit(1).get();
  return snap.empty ? null : snap.docs[0].id;
}

const TITULOS: Record<string, string> = {
  rectoria: '📋 Rectoría',
  coordinador: '📋 Coordinación',
  intercambio: '🔄 Intercambio de espacio',
  aprobada: '✅ Reserva aprobada',
  rechazada: '❌ Reserva rechazada',
  cancelada: '🚫 Reserva cancelada',
  horario_modificado: '📅 Tu horario cambió',
  sugerencia: '💡 Tu sugerencia',
};

// ── Endpoint que llama el Apps Script (docs/backend-Code.gs) ────────────────
/**
 * Compara el secreto en tiempo constante (sobre sus huellas SHA-256, que siempre miden
 * lo mismo): un `!==` corriente responde un poco antes cuanto antes difiere, y eso
 * permite adivinarlo por partes midiendo tiempos. Un secreto vacío nunca es válido.
 */
function secretoValido(recibido: string | undefined, esperado: string): boolean {
  if (!recibido || !esperado) return false;
  const h = (t: string) => createHash('sha256').update(t).digest();
  return timingSafeEqual(h(recibido), h(esperado));
}

export const pushDesdeAppsScript = onRequest(
  { region: REGION, secrets: [PUSH_SECRETO] },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({ ok: false, motivo: 'metodo-no-permitido' });
      return;
    }
    if (!secretoValido(req.get('x-mjb-secreto'), PUSH_SECRETO.value())) {
      res.status(401).json({ ok: false, motivo: 'secreto-invalido' });
      return;
    }

    const { destinatario, tipo, mensaje } = req.body ?? {};
    if (!destinatario || !tipo || !mensaje) {
      res.status(400).json({ ok: false, motivo: 'faltan-campos' });
      return;
    }

    let correo = await correoDeSlotId(String(destinatario));
    if (!correo) correo = await correoDeDirectivo(String(destinatario));
    if (!correo) {
      logger.warn('pushDesdeAppsScript: sin usuario para destinatario', destinatario);
      res.status(200).json({ ok: false, motivo: 'sin-usuario' });
      return;
    }

    // horario_modificado lleva una referencia técnica al final del mensaje
    // ([[horario:YYYY-MM-DD:jornada]], ver src/data/horarioModificado.ts):
    // se quita antes de mostrarlo en la notificación.
    const { mensajeLimpio } = parseHorarioModificadoDeNotificacion(String(mensaje));

    const opciones: EnviarOpciones = {
      tipo: tipo as TipoNotificacion,
      titulo: TITULOS[String(tipo)] ?? 'MJB Préstamos',
      cuerpo: mensajeLimpio.slice(0, 150),
      url: `${BASE_URL}?ir=inicio`,
      tag: `mjb-${tipo}`,
    };

    await enviarAUsuarios(db, [correo], opciones);
    res.status(200).json({ ok: true });
  });

// ── Vacía a las 5:30 a. m. lo que se encoló de noche (PRD D2) ──────────────
export const entregarPendientes = onSchedule(
  { schedule: '30 5 * * *', timeZone: 'America/Bogota', region: REGION },
  async () => {
    const snap = await db.collection('pushPendientes').get();
    if (snap.empty) return;

    const porCorreo = new Map<string, { id: string; data: FirebaseFirestore.DocumentData }[]>();
    snap.docs.forEach(d => {
      const correo = String(d.data().correo);
      const lista = porCorreo.get(correo) ?? [];
      lista.push({ id: d.id, data: d.data() });
      porCorreo.set(correo, lista);
    });

    for (const [correo, items] of porCorreo) {
      try {
        const opciones = agruparPendientes(items.map(i => ({
          tipo: i.data.tipo, titulo: i.data.titulo, cuerpo: i.data.cuerpo,
          url: i.data.url, tag: i.data.tag,
        })));
        await enviarAhora(db, correo, opciones);
      } catch (err) {
        logger.error('entregarPendientes: fallo con', correo, err);
      }
    }

    const batch = db.batch();
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
  });

// ── Accidente laboral (docs/accidente-laboral/PRD.md, aprobado 26-sep-2026) ─

/** POST best-effort al Apps Script para el correo con nombre y lesión
 * (dato sensible que SÍ puede ir al correo institucional de responsables,
 * pero nunca al push del celular). Un fallo aquí nunca debe tumbar el push,
 * que es lo que de verdad avisa a tiempo. */
async function enviarCorreoAccidente(
  secreto: string,
  datos: {
    tipoPersona: string; nombrePersona: string; fechaHora: string; lugar: string;
    lesionAparente: string; horaLimiteFurat?: string; destinatarios: string[];
  },
): Promise<void> {
  try {
    const body = new URLSearchParams({
      action: 'correoAccidenteLaboral',
      secreto,
      tipoPersona: datos.tipoPersona,
      nombrePersona: datos.nombrePersona,
      fechaHora: datos.fechaHora,
      lugar: datos.lugar,
      lesionAparente: datos.lesionAparente,
      horaLimiteFurat: datos.horaLimiteFurat ?? '',
      destinatarios: datos.destinatarios.join(','),
    });
    await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
  } catch (err) {
    logger.error('accidenteLaboral: fallo enviando correo (Apps Script)', err);
  }
}

const TITULO_ACCIDENTE = '🦺 Accidente laboral registrado';
const CUERPO_ACCIDENTE = 'Hay un accidente laboral por atender';

export const alNuevoAccidente = onDocumentCreated(
  { document: 'sstAccidentes/{id}', region: REGION, secrets: [PUSH_SECRETO] },
  async (event) => {
    const caso = event.data?.data();
    if (!caso) return;

    const usersSnap = await db.collection('users').where('active', '==', true).get();
    const usuarios: UsuarioParaDestinatarios[] = usersSnap.docs.map(d => {
      const u = d.data();
      return { correo: d.id, role: u.role, active: u.active, sede: u.sede ?? null, jornada: u.jornada ?? null };
    });

    const copasstSnap = await db.doc('sstConfig/copasst').get();
    const copasstCorreos: string[] = Array.isArray(copasstSnap.data()?.correos) ? copasstSnap.data()!.correos : [];

    const destinatarios = destinatariosAccidente(usuarios, copasstCorreos, String(caso.reportadoPor ?? ''));
    if (destinatarios.length === 0) return;

    // Push: SIN nombre ni lesión, y urgente (omite el silencio nocturno).
    await enviarAUsuarios(db, destinatarios, {
      tipo: 'accidente_nuevo',
      titulo: TITULO_ACCIDENTE,
      cuerpo: CUERPO_ACCIDENTE,
      url: `${BASE_URL}?ir=riesgo`,
      tag: `mjb-accidente-${event.params.id}`,
    });

    // Correo: SÍ puede llevar nombre y lesión (correo institucional a responsables).
    const esDocente = caso.tipoPersona === 'docente';
    await enviarCorreoAccidente(PUSH_SECRETO.value(), {
      tipoPersona: String(caso.tipoPersona ?? ''),
      nombrePersona: String(caso.nombrePersona ?? ''),
      fechaHora: String(caso.fechaHora ?? ''),
      lugar: String(caso.lugar ?? ''),
      lesionAparente: String(caso.lesionAparente ?? ''),
      horaLimiteFurat: esDocente && caso.fechaHora ? horaLimiteFurat(String(caso.fechaHora)) : undefined,
      destinatarios,
    });
  });

/** Cada hora: casos de docente sin FURAT radicado que cruzan 24 h o 40 h
 * desde el accidente, y casos con más de 15 días sin cerrar la
 * investigación. Marca en el doc los umbrales ya avisados para no repetir. */
export const alertasAccidentes = onSchedule(
  { schedule: '0 * * * *', timeZone: 'America/Bogota', region: REGION },
  async () => {
    const ahora = new Date();
    const ahoraISO = ahora.toISOString();

    const usersSnap = await db.collection('users').where('active', '==', true).get();
    const usuarios: UsuarioParaDestinatarios[] = usersSnap.docs.map(d => {
      const u = d.data();
      return { correo: d.id, role: u.role, active: u.active, sede: u.sede ?? null, jornada: u.jornada ?? null };
    });
    const copasstSnap = await db.doc('sstConfig/copasst').get();
    const copasstCorreos: string[] = Array.isArray(copasstSnap.data()?.correos) ? copasstSnap.data()!.correos : [];

    const snap = await db.collection('sstAccidentes').where('estado', '!=', 'cerrado').get();
    for (const doc of snap.docs) {
      const caso = doc.data();
      const destinatarios = destinatariosAccidente(usuarios, copasstCorreos, String(caso.reportadoPor ?? ''));
      if (destinatarios.length === 0) continue;
      const avisos = caso.avisos ?? {};
      const patch: Record<string, unknown> = {};

      if (caso.tipoPersona === 'docente' && caso.estado === 'reportado' && caso.fechaHora) {
        const horasTranscurridas = (ahora.getTime() - new Date(String(caso.fechaHora)).getTime()) / (60 * 60 * 1000);
        if (horasTranscurridas >= 40 && !avisos.furat40h) {
          await enviarAUsuarios(db, destinatarios, {
            tipo: 'accidente_nuevo', titulo: '⏰ FURAT por vencer',
            cuerpo: 'Quedan menos de 8 horas para radicar un FURAT', url: `${BASE_URL}?ir=riesgo`,
            tag: `mjb-accidente-furat40-${doc.id}`,
          });
          patch['avisos.furat40h'] = true;
        } else if (horasTranscurridas >= 24 && !avisos.furat24h) {
          await enviarAUsuarios(db, destinatarios, {
            tipo: 'accidente_nuevo', titulo: '⏰ FURAT pendiente',
            cuerpo: 'Un FURAT lleva más de 24 horas sin radicar', url: `${BASE_URL}?ir=riesgo`,
            tag: `mjb-accidente-furat24-${doc.id}`,
          });
          patch['avisos.furat24h'] = true;
        }
      }

      if (debeAlertarInvestigacion(String(caso.fechaHora ?? ahoraISO), ahoraISO, String(caso.estado ?? '')) && !avisos.investigacion15d) {
        await enviarAUsuarios(db, destinatarios, {
          tipo: 'accidente_nuevo', titulo: '📋 Investigación sin cerrar',
          cuerpo: 'Un caso lleva más de 15 días sin cerrar la investigación', url: `${BASE_URL}?ir=riesgo`,
          tag: `mjb-accidente-invest15-${doc.id}`,
        });
        patch['avisos.investigacion15d'] = true;
      }

      if (Object.keys(patch).length > 0) await doc.ref.update(patch);
    }
  });
