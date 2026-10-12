// Codebase `simulacros`: cambios del simulacro (docs/simulacros/PLAN.md).
// Todo cambio pasa por la callable `simulacroCambiar`; el cliente NUNCA escribe (reglas).
//
// Despliegue: `firebase deploy --only functions:simulacros` (NUNCA sin acotar).
// TRAMPA DEL 403: invoker 'public' como en las demás callables; la autenticación real
// se comprueba dentro de la función.

import { initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { setGlobalOptions } from 'firebase-functions/v2';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import { debeEnviarse, esHorarioSilencioBogota } from '../../src/data/notificacionesPushLogica';
import {
  EDITORES_DEFAULT, avisoIdValido, esDestinatarioAviso, esJornada, estadoValido, fechaValida, horaValida, idSimulacroValido,
  jornadaAvisoValida, normalizarAvisos, puedeCambiarEstado, puedeCrearAviso, puedeEditar, puedeModificarAviso, puestoIdValido,
  textoAsignacion, textoAvisoValido, textoCambioHorario, tipoAvisoValido, truncar,
  type Aviso, type Editores, type Jornada, type JornadaAviso, type PerfilEditor,
} from './logica';

setGlobalOptions({ maxInstances: 10, region: 'us-central1' });

initializeApp();
const db = getFirestore();

type Datos = Record<string, unknown>;
type Entrada = Record<string, unknown>;

export const simulacroCambiar = onCall({ invoker: 'public' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');
  const correo = String(request.auth.token?.email ?? '').toLowerCase();
  if (!correo) throw new HttpsError('permission-denied', 'No se pudo determinar tu correo.');
  if (request.auth.token?.suplantadoPor) throw new HttpsError('permission-denied', 'No disponible durante una suplantación.');
  const usuarioSnap = await db.doc(`users/${correo}`).get();
  if (!usuarioSnap.exists || usuarioSnap.get('active') !== true) throw new HttpsError('permission-denied', 'Tu usuario no está activo.');
  if (usuarioSnap.get('soloLectura') === true) throw new HttpsError('permission-denied', 'Tu usuario está en solo lectura.');
  const perfil: PerfilEditor = {
    role: usuarioSnap.get('role'), slotId: usuarioSnap.get('slotId') ?? null, active: true, soloLectura: false,
  };
  const esSuper = perfil.role === 'superusuario';

  const d = (request.data ?? {}) as Entrada;
  const id = d.simulacroId;
  if (!idSimulacroValido(id)) throw new HttpsError('invalid-argument', 'simulacroId inválido.');
  const accion = String(d.accion ?? '');
  const ref = db.doc(`simulacros/${id}`);
  const motivo = typeof d.motivo === 'string' ? d.motivo.slice(0, 300) : '';
  const porSlot = perfil.slotId ?? null;
  const bitacora = (tipo: string, jornada: Jornada | null, antes: unknown, despues: unknown) => ({
    por: correo, porSlot, cuando: FieldValue.serverTimestamp(), tipo, jornada, antes: antes ?? null, despues: despues ?? null, motivo,
  });

  // ---- crear: solo superusuario ----
  if (accion === 'crear') {
    if (!esSuper) throw new HttpsError('permission-denied', 'Solo el superusuario crea simulacros.');
    const datos = (d.datos ?? {}) as Datos;
    const jorn = (j: Jornada) => {
      const x = ((datos.jornadas as Datos | undefined)?.[j] ?? {}) as Datos;
      if (!fechaValida(x.fecha) || !horaValida(x.hora)) throw new HttpsError('invalid-argument', `Fecha/hora inválida en ${j}.`);
      return { fecha: x.fecha, hora: x.hora, llamada123: null };
    };
    const nac = (datos.nacional ?? {}) as Datos;
    if (!fechaValida(nac.fecha) || !horaValida(nac.hora)) throw new HttpsError('invalid-argument', 'Fecha/hora nacional inválida.');
    const editores: Editores = (datos.editores as Editores | undefined) ?? EDITORES_DEFAULT;
    const av = normalizarAvisos(datos.avisos, { por: correo, porSlot, ahoraISO: new Date().toISOString() });
    if (!av.ok) throw new HttpsError('invalid-argument', av.error);
    const doc = {
      titulo: String(datos.titulo ?? '').slice(0, 120), sede: String(datos.sede ?? 'principal'),
      evento: String(datos.evento ?? 'sismo'), plantilla: String(datos.plantilla ?? 'sismo2026'),
      estado: 'borrador', nacional: { fecha: nac.fecha, hora: nac.hora }, editores,
      jornadas: { manana: jorn('manana'), tarde: jorn('tarde') },
      asignaciones: (datos.asignaciones as Datos | undefined) ?? {},
      avisos: av.avisos,
      actualizado: FieldValue.serverTimestamp(),
    };
    await db.runTransaction(async (tx) => {
      if ((await tx.get(ref)).exists) throw new HttpsError('already-exists', 'Ese simulacro ya existe.');
      tx.set(ref, doc);
      tx.set(ref.collection('cambios').doc(), bitacora('estado', null, null, 'borrador'));
    });
    return { ok: true };
  }

  const jornada = d.jornada;
  const notificar: { slot: string; puesto: string; jornada: Jornada; asignado: boolean }[] = [];
  const avisosPush: { texto: string; jornada: JornadaAviso }[] = [];
  let sedeSim = 'principal';
  let estadoSim = 'borrador';

  await db.runTransaction(async (tx) => {
    notificar.length = 0; // la transacción puede reintentarse
    avisosPush.length = 0;
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError('not-found', 'No existe ese simulacro.');
    sedeSim = String(snap.get('sede') ?? 'principal');
    estadoSim = String(snap.get('estado') ?? 'borrador');
    const editores = snap.get('editores') as Editores;
    const exigirJornada = (): Jornada => {
      if (!esJornada(jornada)) throw new HttpsError('invalid-argument', 'jornada inválida.');
      if (!puedeEditar(perfil, editores, jornada)) throw new HttpsError('permission-denied', 'No puedes editar esa jornada.');
      return jornada;
    };
    const actual = (snap.get('jornadas') ?? {}) as Record<string, Datos>;
    const nuevoCambio = ref.collection('cambios').doc();

    if (accion === 'hora') {
      const j = exigirJornada();
      if (!horaValida(d.hora) || !fechaValida(d.fecha)) throw new HttpsError('invalid-argument', 'Fecha u hora inválida.');
      const antes = { fecha: actual[j]?.fecha, hora: actual[j]?.hora };
      const despues = { fecha: d.fecha, hora: d.hora };
      const cambioFecha = antes.fecha !== d.fecha;
      const cambioHora = antes.hora !== d.hora;
      if (!cambioFecha && !cambioHora) throw new HttpsError('failed-precondition', 'No hay cambios.');
      // Aviso automático «cambio_<jornada>»: se reemplaza en cada reprogramación (el editor puede borrarlo).
      const textoCambio = textoCambioHorario(j, d.fecha as string, d.hora as string, motivo);
      const avisoCambio: Aviso = {
        texto: textoCambio, jornada: j, tipo: 'importante', automatico: true,
        por: correo, porSlot, cuando: new Date().toISOString(),
      };
      tx.update(ref, {
        [`jornadas.${j}.fecha`]: d.fecha, [`jornadas.${j}.hora`]: d.hora,
        [`jornadas.${j}.motivo`]: motivo, [`jornadas.${j}.llamada123`]: null, // reinicia el aviso del 123
        [`avisos.cambio_${j}`]: avisoCambio,
        actualizado: FieldValue.serverTimestamp(),
      });
      avisosPush.push({ texto: textoCambio, jornada: j });
      tx.set(nuevoCambio, bitacora(cambioFecha && !cambioHora ? 'fecha' : 'hora', j, antes, despues));
    } else if (accion === 'asignar') {
      const j = exigirJornada();
      const puestoId = d.puestoId;
      if (!puestoIdValido(puestoId)) throw new HttpsError('invalid-argument', 'puestoId inválido.');
      const slot = d.slot === null || d.slot === undefined ? null : d.slot;
      if (slot !== null && (typeof slot !== 'string' || !/^[A-Za-z0-9_.-]{1,60}$/.test(slot))) throw new HttpsError('invalid-argument', 'slot inválido.');
      const previo = ((snap.get('asignaciones') ?? {}) as Record<string, Record<string, { slot?: string | null; porConfirmar?: boolean }>>)[puestoId]?.[j] ?? null;
      const nuevo = { slot, porConfirmar: d.porConfirmar === true };
      tx.update(ref, { [`asignaciones.${puestoId}.${j}`]: nuevo, actualizado: FieldValue.serverTimestamp() });
      tx.set(nuevoCambio, bitacora('asignacion', j, { puestoId, ...(previo ?? { slot: null }) }, { puestoId, ...nuevo }));
      const nombre = typeof d.puestoNombre === 'string' && d.puestoNombre.trim() ? d.puestoNombre.trim().slice(0, 80) : puestoId;
      const previoSlot = previo?.slot ?? null;
      if (previoSlot !== slot) {
        if (slot) notificar.push({ slot, puesto: nombre, jornada: j, asignado: true });
        if (previoSlot) notificar.push({ slot: previoSlot, puesto: nombre, jornada: j, asignado: false });
      }
    } else if (accion === 'llamada123') {
      const j = exigirJornada();
      const marca = { hecho: true, por: correo, cuando: new Date().toISOString() };
      tx.update(ref, { [`jornadas.${j}.llamada123`]: marca, actualizado: FieldValue.serverTimestamp() });
      tx.set(nuevoCambio, bitacora('llamada123', j, actual[j]?.llamada123 ?? null, marca));
    } else if (accion === 'avisoGuardar') {
      if (!textoAvisoValido(d.texto)) throw new HttpsError('invalid-argument', 'El aviso debe tener entre 1 y 500 caracteres.');
      if (!jornadaAvisoValida(d.jornada)) throw new HttpsError('invalid-argument', 'jornada inválida.');
      if (!tipoAvisoValido(d.tipo)) throw new HttpsError('invalid-argument', 'tipo inválido.');
      const texto = d.texto.trim();
      const avisos = (snap.get('avisos') ?? {}) as Record<string, Aviso>;
      let avisoId: string;
      let nuevo: Aviso;
      let previo: Aviso | null = null;
      if (d.avisoId === undefined || d.avisoId === null || d.avisoId === '') {
        if (!puedeCrearAviso(perfil, editores, d.jornada)) throw new HttpsError('permission-denied', 'No puedes publicar avisos en esa jornada.');
        avisoId = `a_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
        nuevo = { texto, jornada: d.jornada, tipo: d.tipo, por: correo, porSlot, cuando: new Date().toISOString() };
      } else {
        if (!avisoIdValido(d.avisoId)) throw new HttpsError('invalid-argument', 'avisoId inválido.');
        avisoId = d.avisoId;
        previo = avisos[avisoId] ?? null;
        if (!previo) throw new HttpsError('not-found', 'Ese aviso no existe.');
        if (!puedeModificarAviso(perfil, editores, previo) || !puedeCrearAviso(perfil, editores, d.jornada)) {
          throw new HttpsError('permission-denied', 'No puedes editar ese aviso.');
        }
        nuevo = { ...previo, texto, jornada: d.jornada, tipo: d.tipo, editado: true };
      }
      tx.update(ref, { [`avisos.${avisoId}`]: nuevo, actualizado: FieldValue.serverTimestamp() });
      tx.set(nuevoCambio, bitacora('aviso', esJornada(nuevo.jornada) ? nuevo.jornada : null,
        previo ? { id: avisoId, texto: previo.texto, jornada: previo.jornada, tipo: previo.tipo } : null,
        { id: avisoId, texto, jornada: nuevo.jornada, tipo: nuevo.tipo }));
      if (nuevo.tipo === 'importante' && (!previo || previo.texto !== texto)) avisosPush.push({ texto, jornada: nuevo.jornada });
    } else if (accion === 'avisoBorrar') {
      if (!avisoIdValido(d.avisoId)) throw new HttpsError('invalid-argument', 'avisoId inválido.');
      const previo = ((snap.get('avisos') ?? {}) as Record<string, Aviso>)[d.avisoId];
      if (!previo) throw new HttpsError('not-found', 'Ese aviso no existe.');
      if (!puedeModificarAviso(perfil, editores, previo)) throw new HttpsError('permission-denied', 'No puedes borrar ese aviso.');
      tx.update(ref, { [`avisos.${d.avisoId}`]: FieldValue.delete(), actualizado: FieldValue.serverTimestamp() });
      tx.set(nuevoCambio, bitacora('aviso', esJornada(previo.jornada) ? previo.jornada : null,
        { id: d.avisoId, texto: previo.texto, jornada: previo.jornada, tipo: previo.tipo }, null));
    } else if (accion === 'estado') {
      if (!esSuper && !puedeCambiarEstado(perfil, editores)) throw new HttpsError('permission-denied', 'No puedes cambiar el estado.');
      if (!estadoValido(d.estado)) throw new HttpsError('invalid-argument', 'estado inválido.');
      tx.update(ref, { estado: d.estado, actualizado: FieldValue.serverTimestamp() });
      tx.set(nuevoCambio, bitacora('estado', null, snap.get('estado'), d.estado));
    } else {
      throw new HttpsError('invalid-argument', 'Acción desconocida.');
    }
  });

  // Notificaciones: después de guardar; un fallo aquí jamás deshace el cambio.
  // Mientras el simulacro esté en borrador (revisión interna) no se avisa a nadie:
  // los docentes aún no lo ven y no deben recibir notificaciones de él.
  if (estadoSim !== 'publicado') return { ok: true };
  for (const n of notificar) {
    try { await avisarSlot(n.slot, n.puesto, n.jornada, n.asignado, String(id)); }
    catch (e) { logger.error('simulacros: fallo al notificar', n.slot, e); }
  }
  for (const a of avisosPush) {
    try { await avisarJornada(a.jornada, a.texto, sedeSim, String(id)); }
    catch (e) { logger.error('simulacros: fallo al notificar el aviso', e); }
  }
  return { ok: true };
});

// ---------- Notificación (copia mínima del patrón de functions-notificaciones/src/enviar.ts) ----------
// Tipo 'coordinador' = categoría «avisos». De noche (21:00–5:30) se encola en pushPendientes
// y la función `entregarPendientes` de la codebase notificaciones la entrega a las 5:30.
async function avisarSlot(slot: string, puesto: string, jornada: Jornada, asignado: boolean, simulacroId: string): Promise<void> {
  const q = await db.collection('users').where('slotId', '==', slot).where('active', '==', true).limit(1).get();
  if (q.empty) return;
  const { titulo, cuerpo } = textoAsignacion(puesto, jornada, asignado);
  await enviarPush(q.docs[0].id.toLowerCase(), titulo, cuerpo, `simulacro-${simulacroId}`);
}

/** Aviso importante: a todos los usuarios activos de la sede que trabajan en esa(s) jornada(s). */
async function avisarJornada(jornada: JornadaAviso, texto: string, sede: string, simulacroId: string): Promise<void> {
  const q = await db.collection('users').where('active', '==', true).get();
  const correos = q.docs
    .filter(u => esDestinatarioAviso({ active: u.get('active'), jornada: u.get('jornada'), sede: u.get('sede') }, jornada, sede))
    .map(u => u.id.toLowerCase());
  const cuerpo = truncar(texto, 120);
  await Promise.allSettled(correos.map(c =>
    enviarPush(c, 'Simulacro: aviso importante', cuerpo, `simulacro-aviso-${simulacroId}`)
      .catch(e => logger.error('simulacros: fallo al notificar a un usuario', e))));
}

async function enviarPush(correo: string, titulo: string, cuerpo: string, tag: string): Promise<void> {
  const opciones = { tipo: 'coordinador' as const, titulo, cuerpo, url: '/', tag };

  const pref = await db.collection('notifPreferencias').doc(correo).get();
  if (!debeEnviarse(opciones.tipo, (pref.exists ? pref.data() : null) as Record<string, boolean> | null)) return;
  if (esHorarioSilencioBogota(new Date())) {
    await db.collection('pushPendientes').add({ correo, ...opciones, creadoEn: FieldValue.serverTimestamp() });
    return;
  }
  const items = await db.collection('notifDispositivos').doc(correo).collection('items').get();
  const tokens = items.docs.map(x => ({ ref: x.ref, token: String(x.data().token) }));
  if (tokens.length === 0) return;
  const resp = await getMessaging().sendEachForMulticast({
    tokens: tokens.map(t => t.token),
    data: { title: opciones.titulo, body: opciones.cuerpo, url: opciones.url, tag: opciones.tag, tipo: opciones.tipo },
    webpush: { headers: { Urgency: 'high', TTL: '86400' } },
  });
  await Promise.all(resp.responses.map(async (r, i) => {
    const code = r.error?.code ?? '';
    if (!r.success && (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-argument')) {
      await tokens[i].ref.delete().catch(() => {});
    }
  }));
}
