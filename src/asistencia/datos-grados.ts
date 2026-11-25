/**
 * Datos de Grados 2026 (2026-11-24). Ver domain/grados-evento.ts y docs/grados/PRD.md.
 *
 * El celular SOLO LEE: todo lo que registra va por las funciones `gradosPuerta` y
 * `gradosAdministrar`, en transaccion. Por eso aqui no hay ni un setDoc.
 */
import { collection, doc, getDoc, getDocs, onSnapshot, query, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, esperarAuth, functions } from '../lib/firebase';
import { RESUMEN_VACIO, type EventoGrados, type Graduando, type Invitacion, type ResumenAforo } from './domain/grados-evento';
import type { Student } from './domain/types';

const COL = 'asistenciaGrados';

function base() {
  if (!db) throw new Error('Firebase no está configurado en esta instalación.');
  return db;
}

export async function leerEventosGrados(): Promise<EventoGrados[]> {
  if (!(await esperarAuth())) return [];
  const s = await getDocs(collection(base(), COL));
  return s.docs.map((d) => d.data() as EventoGrados).sort((a, b) => Number(a.ensayo) - Number(b.ensayo) || a.eventoId.localeCompare(b.eventoId));
}

export async function leerInvitacion(eventoId: string, token: string): Promise<Invitacion | null> {
  await esperarAuth();
  try {
    const s = await getDoc(doc(base(), COL, eventoId, 'invitaciones', token));
    return s.exists() ? (s.data() as Invitacion) : null;
  } catch {
    // Un codigo con caracteres raros o sin permiso: para la puerta es lo mismo, no valida.
    return null;
  }
}

export async function leerInvitaciones(eventoId: string): Promise<Invitacion[]> {
  await esperarAuth();
  return (await getDocs(collection(base(), COL, eventoId, 'invitaciones'))).docs.map((d) => d.data() as Invitacion);
}

export async function leerGraduando(eventoId: string, studentId: string): Promise<Graduando | null> {
  await esperarAuth();
  try {
    const s = await getDoc(doc(base(), COL, eventoId, 'graduandos', studentId));
    return s.exists() ? (s.data() as Graduando) : null;
  } catch {
    return null;
  }
}

/** Los graduandos de UN grado. El director solo puede consultar asi, filtrando por grado. */
export function escucharGraduandos(eventoId: string, grado: string, cb: (g: Graduando[]) => void, onError: (e: Error) => void): () => void {
  if (!db) return () => {};
  return onSnapshot(
    query(collection(base(), COL, eventoId, 'graduandos'), where('grado', '==', grado)),
    (s) => cb(s.docs.map((d) => d.data() as Graduando)),
    onError,
  );
}

export function escucharAforo(eventoId: string, cb: (r: ResumenAforo) => void, onError: (e: Error) => void): () => void {
  if (!db) return () => {};
  return onSnapshot(
    doc(base(), COL, eventoId, 'aforo', 'resumen'),
    (s) => cb({ ...RESUMEN_VACIO, ...((s.data() as Partial<ResumenAforo>) ?? {}) }),
    onError,
  );
}

export interface IngresoRegistrado {
  tipo: 'invitado' | 'graduando' | 'manual';
  cantidad: number;
  por: string;
  en: number;
  categoria?: string;
  studentId?: string | null;
  deshecho: { por: string; en: number } | null;
  esDeshacer?: boolean;
}

/** El registro completo: solo coordinacion (reglas). */
export async function leerIngresos(eventoId: string): Promise<IngresoRegistrado[]> {
  await esperarAuth();
  return (await getDocs(collection(base(), COL, eventoId, 'ingresos'))).docs
    .map((d) => d.data() as IngresoRegistrado)
    .sort((a, b) => a.en - b.en);
}

export async function leerEstudiante(studentId: string): Promise<Student | null> {
  await esperarAuth();
  const s = await getDoc(doc(base(), 'asistenciaStudents', studentId));
  return s.exists() ? ({ ...(s.data() as Student), studentId: s.id }) : null;
}

/** Id de este celular, para el registro de cada ingreso. */
export function idDispositivo(): string {
  const clave = 'mjb-grados-dispositivo';
  try {
    const ya = localStorage.getItem(clave);
    if (ya) return ya;
    const nuevo = `cel-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(clave, nuevo);
    return nuevo;
  } catch {
    return 'sin-id';
  }
}

/** Error de una funcion, con el `motivo` que manda el servidor (agotada, ya_llego...). */
export class ErrorGrados extends Error {
  constructor(
    mensaje: string,
    readonly motivo: string | null,
    readonly detalles: Record<string, unknown>,
    readonly sinConexion: boolean,
  ) {
    super(mensaje);
  }
}

async function llamar<T>(nombre: string, datos: Record<string, unknown>): Promise<T> {
  if (!functions) throw new ErrorGrados('Firebase no está configurado.', null, {}, false);
  await esperarAuth();
  try {
    return (await httpsCallable(functions, nombre)(datos)).data as T;
  } catch (e) {
    const err = e as { message?: string; code?: string; details?: Record<string, unknown> };
    const sinConexion = err.code === 'functions/unavailable' || err.code === 'functions/deadline-exceeded' || (typeof navigator !== 'undefined' && !navigator.onLine);
    throw new ErrorGrados(
      sinConexion ? 'Sin conexión: no se registró, intente de nuevo.' : err.message || 'No se pudo completar.',
      (err.details?.motivo as string) ?? null,
      err.details ?? {},
      sinConexion,
    );
  }
}

export type VistaInvitacion = Pick<Invitacion, 'token' | 'studentId' | 'nombre' | 'grado' | 'cupos' | 'usados' | 'anulada' | 'reemplazadaPor' | 'prueba' | 'registros'> & { restantes: number };

export const puertaGrados = (eventoId: string, datos: Record<string, unknown>) =>
  llamar<{ ok: true; invitacion?: VistaInvitacion; graduando?: Graduando }>('gradosPuerta', { eventoId, dispositivo: idDispositivo(), ...datos });

export const administrarGrados = (eventoId: string, datos: Record<string, unknown>) =>
  llamar<{ ok: true; creadas?: number; existentes?: number; token?: string; evento?: EventoGrados }>('gradosAdministrar', { eventoId, ...datos });
