// Plan en casa — lectura/escritura en Firestore y llamadas a las funciones del servidor.
// Contrato en ./tipos.ts. Los componentes no tocan Firestore directo: pasan por aquí.
import {
  addDoc, collection, FieldPath, doc, getDoc, getDocs, onSnapshot, query, setDoc, updateDoc, where,
  type Unsubscribe,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { auth, db, functions } from '../../lib/firebase';
import { USUARIOS } from '../maestros';
import { getAsignatura } from '../asignacionAcademica';
import {
  COL_PLANES, DOC_EQUIPO, DOC_MOTIVO, SUB_ASIGNATURAS, SUB_GUIAS, SUB_RESERVADO,
  type AsignaturaPlan, type GuiaPlan, type ModalidadGuias, type EntradaGuiaIA, type Guia, type MotivoReservado, type PlanCasa,
  type RitmoPlan, type SalidaGuiaIA,
} from './tipos';
import { docentesDelGrupo, nuevoToken } from './logica';

/** Los docentes del plan se guardan además como lista de correos (para las reglas). */
export type PlanConDocentes = PlanCasa;

function baseDatos() {
  if (!db) throw new Error('Firebase no está configurado.');
  return db;
}

export function correoActual(): string {
  return (auth?.currentUser?.email ?? '').trim().toLowerCase();
}

/** Enlace público (el del QR) de un plan. */
export function urlPublica(token: string): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}#/plan/${token}`;
}

// ── Equipo ────────────────────────────────────────────────────────────────

export async function leerEquipo(): Promise<string[]> {
  if (!db) return [];
  try {
    const s = await getDoc(doc(db, DOC_EQUIPO));
    return ((s.data()?.correos as string[] | undefined) ?? []).map(c => c.toLowerCase());
  } catch { return []; }
}

// ── Docentes del grupo ────────────────────────────────────────────────────

export interface AsignaturaDelGrupo {
  asignaturaId: string;
  asignaturaNombre: string;
  docenteId: string;
  docenteNombre: string;
}

/**
 * Asignaturas y docente de un grupo, desde la asignación académica 2026 (una fila por
 * asignatura; si hubiera dos docentes en la misma, queda el primero). Se excluye el CI.
 */
export function asignaturasDelGrupo(grupo: string): AsignaturaDelGrupo[] {
  const visto = new Set<string>();
  const salida: AsignaturaDelGrupo[] = [];
  for (const e of docentesDelGrupo(grupo)) {
    if (visto.has(e.asignaturaId)) continue;
    visto.add(e.asignaturaId);
    salida.push({
      asignaturaId: e.asignaturaId,
      asignaturaNombre: getAsignatura(e.asignaturaId)?.nombre ?? e.asignaturaId,
      docenteId: e.docenteId,
      docenteNombre: USUARIOS.find(u => u.id === e.docenteId)?.nombre ?? e.docenteId,
    });
  }
  return salida;
}

/**
 * docenteId (puesto de USUARIOS) → correo. `USUARIOS.correo` suele estar vacío, así que
 * primero se busca en la colección `users` por `slotId` (cuenta activa que ocupa el puesto:
 * así un reemplazo recibe el plan) y, si no, se usa USUARIOS.correo.
 */
export async function correosDeDocentes(ids: string[]): Promise<Record<string, string>> {
  const mapa: Record<string, string> = {};
  try {
    const snap = await getDocs(collection(baseDatos(), 'users'));
    snap.forEach(d => {
      const u = d.data() as { email?: string; slotId?: string | null; active?: boolean; soloLectura?: boolean };
      if (u.active === false || u.soloLectura || !u.slotId || !ids.includes(u.slotId)) return;
      mapa[u.slotId] = (u.email || d.id).trim().toLowerCase();
    });
  } catch { /* sin permiso: se usa el respaldo */ }
  for (const id of ids) {
    if (!mapa[id]) {
      const c = (USUARIOS.find(u => u.id === id)?.correo ?? '').trim().toLowerCase();
      if (c) mapa[id] = c;
    }
  }
  return mapa;
}

// ── Planes ────────────────────────────────────────────────────────────────

/** Equipo/coordinación: todos los planes. Docente: solo los suyos (docentesCorreos). */
export function escucharPlanes(
  verTodos: boolean,
  cb: (planes: PlanConDocentes[]) => void,
  onError: (e: Error) => void,
): Unsubscribe {
  if (!db) { onError(new Error('Firebase no está configurado.')); return () => {}; }
  const ref = collection(db, COL_PLANES);
  const q = verTodos ? ref : query(ref, where('docentesCorreos', 'array-contains', correoActual()));
  return onSnapshot(q, snap => {
    cb(snap.docs.map(d => ({ ...(d.data() as PlanConDocentes), id: d.id }))
      .sort((a, b) => b.creadoEn - a.creadoEn));
  }, onError);
}

export function escucharAsignaturas(
  planId: string,
  cb: (a: AsignaturaPlan[]) => void,
  onError: (e: Error) => void = () => {},
): Unsubscribe {
  if (!db) return () => {};
  return onSnapshot(collection(db, COL_PLANES, planId, SUB_ASIGNATURAS), snap => {
    cb(snap.docs.map(d => ({ ...(d.data() as AsignaturaPlan), asignaturaId: d.id })));
  }, onError);
}

export async function leerMotivo(planId: string): Promise<string> {
  const s = await getDoc(doc(baseDatos(), COL_PLANES, planId, SUB_RESERVADO, DOC_MOTIVO));
  return (s.data() as MotivoReservado | undefined)?.texto ?? '';
}

/** Una guía transversal definida por el equipo. */
export interface GuiaTransversalDef { eje: string; asignaturaIds: string[]; responsableDocenteId: string }

export interface DatosNuevoPlan {
  studentId: string; nombres: string; apellidos: string; grupo: string;
  desde: string; hasta: string; motivo: string; contextoDocentes?: string; ajustes: string[]; topeDiario: number;
  ritmo: RitmoPlan;
  sinTecnologia?: boolean;
  modalidad: ModalidadGuias;
  /** Solo en transversal: cada asignatura del grupo en exactamente una guía. */
  guiasTransversales?: GuiaTransversalDef[];
}

export interface ResultadoCrear { planId: string; token: string; sinCorreo: string[]; publicado: boolean }

/** Firestore rechaza `undefined`. */
export function limpiar<T>(o: T): T { return JSON.parse(JSON.stringify(o)) as T; }

export async function crearPlan(d: DatosNuevoPlan): Promise<ResultadoCrear> {
  const bd = baseDatos();
  const correo = correoActual();
  const asigs = asignaturasDelGrupo(d.grupo);
  const correos = await correosDeDocentes([...new Set(asigs.map(a => a.docenteId))]);
  const ahora = Date.now();
  const token = nuevoToken();
  const docentesCorreos = [...new Set(Object.values(correos))];
  const docenteDe = (aid: string) => asigs.find(a => a.asignaturaId === aid)!.docenteId;

  // Guías: una por asignatura (id = asignaturaId) o las transversales del equipo.
  const defs: GuiaTransversalDef[] = d.modalidad === 'transversal'
    ? (d.guiasTransversales ?? [])
    : asigs.map(a => ({ eje: a.asignaturaNombre, asignaturaIds: [a.asignaturaId], responsableDocenteId: a.docenteId }));
  const idGuia = (g: GuiaTransversalDef, i: number) => (d.modalidad === 'transversal' ? `g${i + 1}` : g.asignaturaIds[0]);

  const ref = await addDoc(collection(bd, COL_PLANES), {
    studentId: d.studentId, nombres: d.nombres, apellidos: d.apellidos, grupo: d.grupo,
    desde: d.desde, hasta: d.hasta, ...(d.contextoDocentes?.trim() ? { contextoDocentes: d.contextoDocentes.trim() } : {}), ajustes: d.ajustes, topeDiario: d.topeDiario,
    ritmo: d.ritmo ?? 'diario', ...(d.sinTecnologia ? { sinTecnologia: true } : {}), modalidad: d.modalidad, docentesCorreos,
    estado: 'activo', tokenPublico: token, creadoPor: correo, creadoEn: ahora, actualizadoEn: ahora,
  });
  await setDoc(doc(bd, COL_PLANES, ref.id, SUB_RESERVADO, DOC_MOTIVO), {
    texto: d.motivo, porCorreo: correo, actualizadoEn: ahora,
  } satisfies MotivoReservado);
  await Promise.all(asigs.map(a => setDoc(doc(bd, COL_PLANES, ref.id, SUB_ASIGNATURAS, a.asignaturaId), {
    asignaturaId: a.asignaturaId, docenteId: a.docenteId, docenteCorreo: correos[a.docenteId] ?? '',
    criteriosPromocion: '', actualizadoEn: ahora,
  } satisfies AsignaturaPlan)));
  await Promise.all(defs.map((g, i) => {
    const gc = [...new Set(g.asignaturaIds.map(a => correos[docenteDe(a)]).filter(Boolean))];
    return setDoc(doc(bd, COL_PLANES, ref.id, SUB_GUIAS, idGuia(g, i)), {
      id: idGuia(g, i), asignaturaIds: g.asignaturaIds, eje: g.eje,
      responsableCorreo: correos[g.responsableDocenteId] ?? '', docentesCorreos: gc,
      vistosBuenos: {}, seguimiento: {}, sustentacionEstado: 'sin_citar', actualizadoEn: ahora,
    } satisfies GuiaPlan);
  }));
  let publicado = true;
  try { await publicarPlan(ref.id); } catch { publicado = false; }
  return {
    planId: ref.id, token, publicado,
    sinCorreo: asigs.filter(a => !correos[a.docenteId]).map(a => `${a.asignaturaNombre} (${a.docenteNombre})`),
  };
}

export function escucharGuias(
  planId: string,
  cb: (g: GuiaPlan[]) => void,
  onError: (e: Error) => void = () => {},
): Unsubscribe {
  if (!db) return () => {};
  return onSnapshot(collection(db, COL_PLANES, planId, SUB_GUIAS), snap => {
    cb(snap.docs.map(d => ({ ...(d.data() as GuiaPlan), id: d.id })));
  }, onError);
}

export async function guardarGuia(planId: string, guiaId: string, cambios: Partial<GuiaPlan>) {
  await updateDoc(doc(baseDatos(), COL_PLANES, planId, SUB_GUIAS, guiaId), {
    ...limpiar(cambios), actualizadoEn: Date.now(),
  });
}

/** Visto bueno del docente (el correo tiene puntos: se escribe con FieldPath). */
export async function darVistoBueno(planId: string, guiaId: string, correo: string, valor: boolean) {
  await updateDoc(doc(baseDatos(), COL_PLANES, planId, SUB_GUIAS, guiaId),
    new FieldPath('vistosBuenos', correo.toLowerCase()), valor);
}

export async function cambiarEstadoPlan(planId: string, estado: 'activo' | 'cerrado') {
  await updateDoc(doc(baseDatos(), COL_PLANES, planId), { estado, actualizadoEn: Date.now() });
}

export async function guardarSinTecnologia(planId: string, sinTecnologia: boolean, ajustes: string[]) {
  await updateDoc(doc(baseDatos(), COL_PLANES, planId), { sinTecnologia, ajustes, actualizadoEn: Date.now() });
}

export async function guardarContexto(planId: string, contextoDocentes: string) {
  await updateDoc(doc(baseDatos(), COL_PLANES, planId), { contextoDocentes: contextoDocentes.trim(), actualizadoEn: Date.now() });
}

/** Revoca el enlace anterior y genera otro. Devuelve el token nuevo. */
export async function regenerarToken(plan: PlanCasa): Promise<string> {
  const token = nuevoToken();
  await updateDoc(doc(baseDatos(), COL_PLANES, plan.id), { tokenPublico: token, actualizadoEn: Date.now() });
  try { await publicarPlan(plan.id); } catch { /* el servidor republica al aprobar la próxima guía */ }
  return token;
}

export async function guardarAsignatura(planId: string, asignaturaId: string, cambios: Partial<AsignaturaPlan>) {
  await updateDoc(doc(baseDatos(), COL_PLANES, planId, SUB_ASIGNATURAS, asignaturaId), {
    ...limpiar(cambios), actualizadoEn: Date.now(),
  });
}

// ── Funciones del servidor ────────────────────────────────────────────────

function traducirError(e: unknown): Error {
  const m = e as { message?: string; code?: string };
  const txt = m?.message ?? 'Error desconocido';
  if (/ANTHROPIC|api key|clave/i.test(txt)) return new Error('Falta configurar la clave de la IA en el servidor. Avise a Julián.');
  if (m?.code === 'functions/not-found' || /not.?found|404/i.test(txt)) return new Error('La función aún no está desplegada en el servidor.');
  if (m?.code === 'functions/unauthenticated') return new Error('Su sesión venció. Vuelva a entrar.');
  if (m?.code === 'functions/permission-denied') return new Error('No tiene permiso para hacer esto.');
  if (m?.code === 'functions/deadline-exceeded') return new Error('La IA tardó demasiado. Intente de nuevo.');
  return new Error(txt);
}

export async function pedirGuiaIA(entrada: EntradaGuiaIA): Promise<Guia> {
  if (!functions) throw new Error('Firebase no está configurado.');
  try {
    const r = await httpsCallable<EntradaGuiaIA, SalidaGuiaIA>(functions, 'planCasaGuia', { timeout: 120_000 })(entrada);
    if (!r.data.ok || !r.data.guia) throw new Error(r.data.error ?? 'La IA no devolvió una guía.');
    return r.data.guia;
  } catch (e) { throw traducirError(e); }
}

export interface PreguntaSugerida { pregunta: string; porQue: string; aportes: { asignatura: string; aporte: string }[]; producto: string }

export async function sugerirPreguntas(entrada: { tematica: string; asignaturas: string[]; grado: string; ajustes?: string[] }): Promise<PreguntaSugerida[]> {
  if (!functions) throw new Error('Firebase no está configurado.');
  try {
    const r = await httpsCallable<typeof entrada, { ok: boolean; preguntas?: PreguntaSugerida[]; error?: string }>(functions, 'planCasaPreguntas', { timeout: 60_000 })(entrada);
    if (!r.data.ok || !r.data.preguntas?.length) throw new Error(r.data.error ?? 'La IA no devolvió preguntas.');
    return r.data.preguntas;
  } catch (e) { throw traducirError(e); }
}

export interface EntradaSugerirCampos {
  modo: 'asignatura' | 'pedido'; preguntaOrientadora?: string; asignaturas: string[]; grado: string;
  ajustes?: string[]; existentes?: Record<string, string>; sinTecnologia?: boolean;
}

export async function sugerirCampos(entrada: EntradaSugerirCampos): Promise<Record<string, string>> {
  if (!functions) throw new Error('Firebase no está configurado.');
  try {
    const r = await httpsCallable<EntradaSugerirCampos, { ok: boolean; campos?: Record<string, string>; error?: string }>(functions, 'planCasaSugerirCampos', { timeout: 60_000 })(entrada);
    if (!r.data.ok || !r.data.campos) throw new Error(r.data.error ?? 'La IA no devolvió una sugerencia.');
    return r.data.campos;
  } catch (e) { throw traducirError(e); }
}

export async function publicarPlan(planId: string): Promise<void> {
  if (!functions) throw new Error('Firebase no está configurado.');
  try { await httpsCallable<{ planId: string }, unknown>(functions, 'planCasaPublicar')({ planId }); }
  catch (e) { throw traducirError(e); }
}
