/**
 * Grados 2026: invitaciones con QR y aforo (2026-11-24). PRD: docs/grados/PRD.md.
 *
 * TODO LO QUE REGISTRA PASA POR AQUI, en transaccion: dos celulares en dos puertas no
 * pueden gastar el mismo cupo, y nadie se salta el control desde el celular. Las reglas
 * de `asistenciaGrados` niegan toda escritura del cliente.
 *
 * Dos callables:
 *  - `gradosPuerta`: lo de la puerta (invitados, graduandos, manuales y deshacer). Es la
 *    que se mantiene encendida el dia del evento (minInstances), por eso va sola.
 *  - `gradosAdministrar`: lo de coordinacion (crear, configurar, generar, anular,
 *    ampliar, regenerar, cerrar).
 *
 * Va aparte de index.ts para probarlo contra el emulador con un Firestore propio.
 */
import { randomBytes } from 'node:crypto';
import { FieldValue, type Firestore, type Transaction } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import {
  CAPACIDAD_POR_DEFECTO,
  CATEGORIAS_MANUAL,
  CUPOS_POR_DEFECTO,
  MAX_MANUALES_RECIENTES,
  PREFIJO_INVITACION,
  cuposRestantes,
  limpiarPorteria,
  ultimoRegistroVigente,
  type CambioInvitacion,
  type CategoriaManual,
  type EventoGrados,
  type Graduando,
  type IngresoManualReciente,
  type Invitacion,
  type ResumenAforo,
} from '../../src/asistencia/domain/grados-evento';

export const COL_GRADOS = 'asistenciaGrados';
const rutaEvento = (e: string) => `${COL_GRADOS}/${e}`;
const rutaInv = (e: string, t: string) => `${COL_GRADOS}/${e}/invitaciones/${t}`;
const rutaGrad = (e: string, s: string) => `${COL_GRADOS}/${e}/graduandos/${s}`;
const rutaAforo = (e: string) => `${COL_GRADOS}/${e}/aforo/resumen`;
const colIngresos = (e: string) => `${COL_GRADOS}/${e}/ingresos`;

export function nuevoTokenInvitacion(): string {
  return PREFIJO_INVITACION + randomBytes(16).toString('base64url');
}

interface Usuario {
  email: string;
  role: string;
  slotId: string | null;
}

async function usuarioActivo(db: Firestore, email: string | undefined): Promise<Usuario> {
  const e = email?.toLowerCase();
  if (!e) throw new HttpsError('unauthenticated', 'Sesión no válida.');
  const snap = await db.doc(`users/${e}`).get();
  if (!snap.exists || snap.data()?.active !== true) {
    throw new HttpsError('permission-denied', 'Usuario no registrado o inactivo en MJB.');
  }
  return { email: e, role: String(snap.data()?.role ?? ''), slotId: (snap.data()?.slotId as string) ?? null };
}

/** Coordinacion = superusuario, o coordinador con autoridad sobre la sede del evento. */
async function coordina(db: Firestore, u: Usuario, sede: string): Promise<boolean> {
  if (u.role === 'superusuario') return true;
  if (u.role !== 'coordinador') return false;
  const autoridad = await db.doc('asistenciaConfig/autoridadSede').get();
  const correos = ((autoridad.data()?.mapa ?? {}) as Record<string, string[]>)[sede] ?? [];
  return correos.includes(u.email);
}

async function dirigeGrado(db: Firestore, u: Usuario, grado: string): Promise<boolean> {
  if (!u.slotId) return false;
  const mapa = ((await db.doc('asistenciaConfig/directores').get()).data()?.mapa ?? {}) as Record<string, string>;
  return mapa[grado] === u.slotId;
}

function idEventoValido(x: unknown): string {
  if (typeof x !== 'string' || !/^[a-z0-9-]{3,60}$/.test(x)) throw new HttpsError('invalid-argument', 'Evento no válido.');
  return x;
}

async function leerEvento(db: Firestore, eventoId: string): Promise<EventoGrados> {
  const s = await db.doc(rutaEvento(eventoId)).get();
  if (!s.exists) throw new HttpsError('not-found', 'Ese evento no existe.', { motivo: 'sin_evento' });
  return s.data() as EventoGrados;
}

function exigirAbierto(ev: EventoGrados) {
  if (ev.estado !== 'abierto') throw new HttpsError('failed-precondition', 'El evento está cerrado.', { motivo: 'cerrado' });
}

function entero(x: unknown, min: number, max: number, que: string): number {
  if (typeof x !== 'number' || !Number.isInteger(x) || x < min || x > max) {
    throw new HttpsError('invalid-argument', `${que} no válido.`);
  }
  return x;
}

function texto(x: unknown, max: number): string {
  return typeof x === 'string' ? x.trim().slice(0, max) : '';
}

/** Lo minimo que la pantalla necesita para refrescarse tras registrar. */
function vistaInvitacion(inv: Invitacion) {
  return {
    token: inv.token,
    studentId: inv.studentId,
    nombre: inv.nombre,
    grado: inv.grado,
    cupos: inv.cupos,
    usados: inv.usados,
    restantes: cuposRestantes(inv),
    anulada: inv.anulada,
    reemplazadaPor: inv.reemplazadaPor,
    prueba: inv.prueba,
    registros: inv.registros,
  };
}

function sumarAforo(tx: Transaction, db: Firestore, eventoId: string, campo: 'invitados' | 'graduandos' | 'manuales', n: number) {
  tx.set(db.doc(rutaAforo(eventoId)), { [campo]: FieldValue.increment(n) }, { merge: true });
}

// ===========================================================================
//  gradosPuerta
// ===========================================================================

export async function operarPuerta(
  db: Firestore,
  email: string | undefined,
  data: unknown,
  opciones: { ahora?: number } = {},
) {
  const ahora = opciones.ahora ?? Date.now();
  const d = (data ?? {}) as Record<string, unknown>;
  const eventoId = idEventoValido(d.eventoId);
  const u = await usuarioActivo(db, email);
  const ev = await leerEvento(db, eventoId);
  const esCoord = await coordina(db, u, ev.sede);
  const esPorteria = ev.porteria.includes(u.email);
  const dispositivo = texto(d.dispositivo, 40);
  const accion = d.accion;

  // Directores: SOLO marcar/deshacer la llegada de graduandos de su grado (se comprueba
  // abajo, con el grado del graduando).
  const puedePuerta = esCoord || esPorteria;

  // Busqueda por apellido (papel danado): la invitacion vigente de un estudiante. Porteria
  // no puede LISTAR invitaciones (reglas), asi que la busca la funcion.
  if (accion === 'consultarInvitacion') {
    if (!puedePuerta) throw new HttpsError('permission-denied', 'No está autorizado para portería de grados.');
    exigirAbierto(ev);
    const studentId = texto(d.studentId, 80);
    const q = await db.collection(`${rutaEvento(eventoId)}/invitaciones`).where('studentId', '==', studentId).where('reemplazadaPor', '==', null).limit(1).get();
    const inv = q.empty ? null : (q.docs[0].data() as Invitacion);
    if (!inv || inv.anulada) throw new HttpsError('not-found', 'Invitación no válida.', { motivo: 'invalida' });
    return { ok: true, invitacion: vistaInvitacion(inv) };
  }

  if (accion === 'invitado' || accion === 'deshacerInvitado') {
    if (!puedePuerta) throw new HttpsError('permission-denied', 'No está autorizado para portería de grados.');
    const token = texto(d.token, 80);
    if (!token) throw new HttpsError('invalid-argument', 'Falta el código.');
    return db.runTransaction(async (tx) => {
      const evSnap = await tx.get(db.doc(rutaEvento(eventoId)));
      exigirAbierto(evSnap.data() as EventoGrados);
      const ref = db.doc(rutaInv(eventoId, token));
      const s = await tx.get(ref);
      const inv = s.exists ? (s.data() as Invitacion) : null;
      if (!inv || inv.anulada || inv.reemplazadaPor) {
        throw new HttpsError('not-found', 'Invitación no válida.', { motivo: 'invalida' });
      }
      if (accion === 'invitado') {
        const cantidad = entero(d.cantidad, 1, 10, 'Cantidad');
        if (cantidad > cuposRestantes(inv)) {
          throw new HttpsError('failed-precondition', 'No quedan cupos suficientes.', {
            motivo: 'agotada',
            invitacion: vistaInvitacion(inv),
          });
        }
        const ingreso = db.collection(colIngresos(eventoId)).doc();
        tx.set(ingreso, { tipo: 'invitado', cantidad, token, studentId: inv.studentId, por: u.email, en: ahora, dispositivo, deshecho: null });
        const registros = [...inv.registros, { ingresoId: ingreso.id, cantidad, por: u.email, en: ahora, deshecho: null }];
        const nueva = { ...inv, usados: inv.usados + cantidad, registros };
        tx.update(ref, { usados: nueva.usados, registros });
        sumarAforo(tx, db, eventoId, 'invitados', cantidad);
        return { ok: true, invitacion: vistaInvitacion(nueva) };
      }
      const ultimo = ultimoRegistroVigente(inv.registros);
      if (!ultimo) throw new HttpsError('failed-precondition', 'No hay ingresos para deshacer.', { motivo: 'nada' });
      const marca = { por: u.email, en: ahora };
      const registros = inv.registros.map((r) => (r.ingresoId === ultimo.ingresoId ? { ...r, deshecho: marca } : r));
      const nueva = { ...inv, usados: Math.max(0, inv.usados - ultimo.cantidad), registros };
      tx.update(ref, { usados: nueva.usados, registros });
      tx.update(db.doc(`${colIngresos(eventoId)}/${ultimo.ingresoId}`), { deshecho: marca });
      sumarAforo(tx, db, eventoId, 'invitados', -ultimo.cantidad);
      return { ok: true, invitacion: vistaInvitacion(nueva) };
    });
  }

  if (accion === 'graduando' || accion === 'deshacerGraduando') {
    const studentId = texto(d.studentId, 80);
    if (!studentId) throw new HttpsError('invalid-argument', 'Falta el estudiante.');
    const ref = db.doc(rutaGrad(eventoId, studentId));
    const previo = await ref.get();
    if (!previo.exists) throw new HttpsError('not-found', 'No es graduando de este evento.', { motivo: 'no_es_graduando' });
    if (!puedePuerta && !(await dirigeGrado(db, u, String(previo.data()?.grado)))) {
      throw new HttpsError('permission-denied', 'Solo puede registrar a los graduandos de su grupo.');
    }
    return db.runTransaction(async (tx) => {
      const evSnap = await tx.get(db.doc(rutaEvento(eventoId)));
      exigirAbierto(evSnap.data() as EventoGrados);
      const g = (await tx.get(ref)).data() as Graduando;
      if (!g.elegible) throw new HttpsError('failed-precondition', 'No es graduando de este evento.', { motivo: 'no_es_graduando' });
      if (accion === 'graduando') {
        if (g.llego) throw new HttpsError('already-exists', 'El graduando ya llegó.', { motivo: 'ya_llego', en: g.en, por: g.por });
        tx.update(ref, { llego: true, en: ahora, por: u.email });
        tx.set(db.collection(colIngresos(eventoId)).doc(), { tipo: 'graduando', cantidad: 1, studentId, por: u.email, en: ahora, dispositivo, deshecho: null });
        sumarAforo(tx, db, eventoId, 'graduandos', 1);
        return { ok: true, graduando: { ...g, llego: true, en: ahora, por: u.email } };
      }
      if (!g.llego) throw new HttpsError('failed-precondition', 'No hay llegada para deshacer.', { motivo: 'nada' });
      const deshechos = [...(g.deshechos ?? []), { en: g.en ?? 0, por: g.por ?? '', deshechoEn: ahora, deshechoPor: u.email }];
      tx.update(ref, { llego: false, en: null, por: null, deshechos });
      tx.set(db.collection(colIngresos(eventoId)).doc(), { tipo: 'graduando', cantidad: -1, studentId, por: u.email, en: ahora, dispositivo, deshecho: null, esDeshacer: true });
      sumarAforo(tx, db, eventoId, 'graduandos', -1);
      return { ok: true, graduando: { ...g, llego: false, en: null, por: null, deshechos } };
    });
  }

  if (accion === 'manual' || accion === 'deshacerManual') {
    if (!puedePuerta) throw new HttpsError('permission-denied', 'No está autorizado para portería de grados.');
    return db.runTransaction(async (tx) => {
      const evSnap = await tx.get(db.doc(rutaEvento(eventoId)));
      exigirAbierto(evSnap.data() as EventoGrados);
      const aforoRef = db.doc(rutaAforo(eventoId));
      const aforo = ((await tx.get(aforoRef)).data() ?? {}) as Partial<ResumenAforo>;
      const recientes = [...(aforo.manualesRecientes ?? [])];
      if (accion === 'manual') {
        const cantidad = entero(d.cantidad, 1, 500, 'Cantidad');
        const categoria = d.categoria as CategoriaManual;
        if (!CATEGORIAS_MANUAL.some((c) => c.id === categoria)) throw new HttpsError('invalid-argument', 'Categoría no válida.');
        const ingreso = db.collection(colIngresos(eventoId)).doc();
        tx.set(ingreso, { tipo: 'manual', cantidad, categoria, por: u.email, en: ahora, dispositivo, deshecho: null });
        const fila: IngresoManualReciente = { ingresoId: ingreso.id, cantidad, categoria, por: u.email, en: ahora, deshecho: false };
        tx.set(aforoRef, { manuales: FieldValue.increment(cantidad), manualesRecientes: [...recientes, fila].slice(-MAX_MANUALES_RECIENTES) }, { merge: true });
        return { ok: true };
      }
      const ingresoId = texto(d.ingresoId, 60);
      const i = recientes.findIndex((r) => r.ingresoId === ingresoId);
      if (i < 0 || recientes[i].deshecho) throw new HttpsError('failed-precondition', 'Ese ingreso no se puede deshacer.', { motivo: 'nada' });
      recientes[i] = { ...recientes[i], deshecho: true };
      tx.update(db.doc(`${colIngresos(eventoId)}/${ingresoId}`), { deshecho: { por: u.email, en: ahora } });
      tx.set(aforoRef, { manuales: FieldValue.increment(-recientes[i].cantidad), manualesRecientes: recientes }, { merge: true });
      return { ok: true };
    });
  }

  throw new HttpsError('invalid-argument', 'Acción no válida.');
}

// ===========================================================================
//  gradosAdministrar
// ===========================================================================

export async function administrarGrados(
  db: Firestore,
  email: string | undefined,
  data: unknown,
  opciones: { ahora?: number; token?: () => string } = {},
) {
  const ahora = opciones.ahora ?? Date.now();
  const generarToken = opciones.token ?? nuevoTokenInvitacion;
  const d = (data ?? {}) as Record<string, unknown>;
  const eventoId = idEventoValido(d.eventoId);
  const u = await usuarioActivo(db, email);
  const accion = d.accion;

  if (accion === 'crearEvento') {
    const sede = texto(d.sede, 30) || 'central';
    if (!(await coordina(db, u, sede))) throw new HttpsError('permission-denied', 'Solo coordinación.');
    const ref = db.doc(rutaEvento(eventoId));
    if ((await ref.get()).exists) throw new HttpsError('already-exists', 'Ese evento ya existe.');
    const grados = Array.isArray(d.grados) ? d.grados.map((g) => texto(g, 10)).filter(Boolean) : [];
    const ensayo = d.ensayo === true;
    if (!ensayo && (grados.length === 0 || grados.length > 10)) throw new HttpsError('invalid-argument', 'Faltan los grupos.');
    const ev: EventoGrados = {
      eventoId,
      nombre: texto(d.nombre, 80) || eventoId,
      fecha: texto(d.fecha, 10),
      hora: texto(d.hora, 5),
      capacidad: typeof d.capacidad === 'number' ? entero(d.capacidad, 1, 5000, 'Capacidad') : CAPACIDAD_POR_DEFECTO,
      grados,
      sede,
      porteria: limpiarPorteria(Array.isArray(d.porteria) ? (d.porteria as string[]) : []),
      estado: 'abierto',
      ensayo,
      creadoPor: u.email,
      creadoEn: ahora,
    };
    await ref.set(ev);
    await db.doc(rutaAforo(eventoId)).set({ invitados: 0, graduandos: 0, manuales: 0, manualesRecientes: [] });
    return { ok: true, evento: ev };
  }

  const ev = await leerEvento(db, eventoId);
  if (!(await coordina(db, u, ev.sede))) throw new HttpsError('permission-denied', 'Solo coordinación.');

  if (accion === 'configurar') {
    const cambios: Partial<EventoGrados> = {};
    if (d.capacidad !== undefined) cambios.capacidad = entero(d.capacidad, 1, 5000, 'Capacidad');
    if (d.porteria !== undefined) cambios.porteria = limpiarPorteria(d.porteria as string[] | string);
    if (d.nombre !== undefined) cambios.nombre = texto(d.nombre, 80) || ev.nombre;
    if (d.fecha !== undefined) cambios.fecha = texto(d.fecha, 10);
    if (d.hora !== undefined) cambios.hora = texto(d.hora, 5);
    await db.doc(rutaEvento(eventoId)).update(cambios);
    return { ok: true, evento: { ...ev, ...cambios } };
  }

  if (accion === 'cerrar') {
    await db.doc(rutaEvento(eventoId)).update({ estado: 'cerrado', cerradoPor: u.email, cerradoEn: ahora });
    return { ok: true };
  }

  if (accion === 'generarInvitaciones') {
    exigirAbierto(ev);
    return generarInvitaciones(db, ev, generarToken, ahora);
  }

  // Lo que sigue opera sobre UNA invitacion, por su token.
  const token = texto(d.token, 80);
  if (!token) throw new HttpsError('invalid-argument', 'Falta la invitación.');
  const motivo = texto(d.motivo, 200);
  return db.runTransaction(async (tx) => {
    const ref = db.doc(rutaInv(eventoId, token));
    const s = await tx.get(ref);
    if (!s.exists) throw new HttpsError('not-found', 'Esa invitación no existe.');
    const inv = s.data() as Invitacion;
    if (inv.reemplazadaPor) throw new HttpsError('failed-precondition', 'Esa invitación ya fue reemplazada.');
    const gradRef = inv.studentId ? db.doc(rutaGrad(eventoId, inv.studentId)) : null;
    const cambio = (tipo: CambioInvitacion['tipo'], detalle?: string): CambioInvitacion => ({
      tipo, motivo, por: u.email, en: ahora, ...(detalle ? { detalle } : {}),
    });

    if (accion === 'anular' || accion === 'reactivar') {
      const anulada = accion === 'anular';
      if (anulada && !motivo) throw new HttpsError('invalid-argument', 'Escriba el motivo.');
      tx.update(ref, { anulada, cambios: [...inv.cambios, cambio(accion)] });
      if (gradRef) tx.update(gradRef, { elegible: !anulada });
      return { ok: true };
    }
    if (accion === 'ampliar') {
      if (!motivo) throw new HttpsError('invalid-argument', 'Escriba el motivo.');
      const cupos = entero(d.cupos, Math.max(1, inv.usados), 10, 'Cupos');
      tx.update(ref, { cupos, cambios: [...inv.cambios, cambio('ampliar', `${inv.cupos} -> ${cupos}`)] });
      return { ok: true };
    }
    if (accion === 'regenerar') {
      const nuevo = generarToken();
      const nueva: Invitacion = { ...inv, token: nuevo, reemplazadaPor: null, creadaEn: ahora, cambios: [...inv.cambios, cambio('regenerar', `antes ${inv.token.slice(0, 7)}…`)] };
      tx.set(db.doc(rutaInv(eventoId, nuevo)), nueva);
      tx.update(ref, { reemplazadaPor: nuevo });
      return { ok: true, token: nuevo };
    }
    throw new HttpsError('invalid-argument', 'Acción no válida.');
  });
}

/**
 * Una invitacion por estudiante activo de los grupos del evento, con 2 cupos, y su fila
 * en `graduandos`. Idempotente: el que ya tiene fila en `graduandos` no se toca (asi un
 * regenerado o anulado no revive). En el ensayo, 3 invitaciones de prueba sin estudiante.
 */
async function generarInvitaciones(db: Firestore, ev: EventoGrados, generarToken: () => string, ahora: number) {
  const base = (x: Partial<Invitacion>): Invitacion => ({
    token: '', eventoId: ev.eventoId, studentId: null, nombre: '', grado: '', cupos: CUPOS_POR_DEFECTO, usados: 0,
    anulada: false, reemplazadaPor: null, prueba: false, registros: [], cambios: [], creadaEn: ahora, ...x,
  });

  if (ev.ensayo) {
    const ya = await db.collection(`${rutaEvento(ev.eventoId)}/invitaciones`).limit(1).get();
    if (!ya.empty) return { ok: true, creadas: 0, existentes: ya.size };
    const lote = db.batch();
    for (let i = 1; i <= 3; i++) {
      const token = generarToken();
      lote.set(db.doc(rutaInv(ev.eventoId, token)), base({ token, nombre: `INVITACIÓN DE PRUEBA ${i}`, grado: 'PRUEBA', prueba: true }));
    }
    await lote.commit();
    return { ok: true, creadas: 3, existentes: 0 };
  }

  const fichas = (await db.collection('asistenciaStudents').where('gradoActual', 'in', ev.grados).get()).docs
    .map((s) => ({ ...(s.data() as Record<string, unknown>), studentId: s.id }) as Record<string, unknown> & { studentId: string })
    .filter((e) => e.activo === true && e.sede === ev.sede);
  const existentes = new Set((await db.collection(`${rutaEvento(ev.eventoId)}/graduandos`).get()).docs.map((g) => g.id));
  const nuevos = fichas.filter((e) => !existentes.has(e.studentId));
  for (let i = 0; i < nuevos.length; i += 200) {
    const lote = db.batch();
    for (const e of nuevos.slice(i, i + 200)) {
      const token = generarToken();
      const nombre = `${String(e.apellidos ?? '').trim()} ${String(e.nombres ?? '').trim()}`.trim();
      const grado = String(e.gradoActual);
      lote.set(db.doc(rutaInv(ev.eventoId, token)), base({ token, studentId: e.studentId, nombre, grado }));
      const g: Graduando = { studentId: e.studentId, grado, nombre, elegible: true, llego: false, en: null, por: null, deshechos: [] };
      lote.set(db.doc(rutaGrad(ev.eventoId, e.studentId)), g);
    }
    await lote.commit();
  }
  return { ok: true, creadas: nuevos.length, existentes: existentes.size };
}
