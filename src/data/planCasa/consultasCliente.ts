// Cliente de las consultas de las familias. Todo por callables (ver consultas.ts).
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../lib/firebase';
import type {
  ConsultaPlan, EntradaEnviarConsulta, EntradaResponderConsulta, SalidaEnviarConsulta, SalidaListarConsultas, SalidaMisConsultas, TipoConsulta, ConsultaFamilia,
} from './consultas';

function mensaje(e: unknown): string {
  const m = e as { code?: string; message?: string };
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'Sin conexión a internet. Conéctese y vuelva a intentarlo.';
  if (m?.code === 'functions/not-found') return 'Las consultas aún no están activas. Comuníquese con el colegio.';
  if (m?.code === 'functions/permission-denied') return m.message || 'No tiene permiso.';
  if (m?.code === 'functions/invalid-argument') return m.message || 'Datos inválidos.';
  return 'No se pudo completar. Revise su conexión e inténtelo de nuevo.';
}

export async function enviarConsulta(token: string, tipo: TipoConsulta, texto: string, contacto: string): Promise<SalidaEnviarConsulta> {
  if (!functions) return { ok: false, error: 'Sin conexión con el servidor.' };
  try {
    return (await httpsCallable<EntradaEnviarConsulta, SalidaEnviarConsulta>(functions, 'planCasaEnviarConsulta')({ token, tipo, texto, contacto })).data;
  } catch (e) { return { ok: false, error: mensaje(e) }; }
}

export async function misConsultas(token: string): Promise<ConsultaFamilia[]> {
  if (!functions || !token) return [];
  try {
    const r = await httpsCallable<{ token: string }, SalidaMisConsultas>(functions, 'planCasaMisConsultas')({ token });
    return r.data.consultas ?? [];
  } catch { return []; }
}

export async function listarConsultas(): Promise<ConsultaPlan[]> {
  if (!functions) throw new Error('Firebase no está configurado.');
  try {
    const r = await httpsCallable<unknown, SalidaListarConsultas>(functions, 'planCasaListarConsultas')({});
    return r.data.consultas ?? [];
  } catch (e) { throw new Error(mensaje(e)); }
}

export async function responderConsulta(id: string, respuesta: string): Promise<void> {
  if (!functions) throw new Error('Firebase no está configurado.');
  try {
    const r = await httpsCallable<EntradaResponderConsulta, { ok: boolean; error?: string }>(functions, 'planCasaResponderConsulta')({ id, respuesta });
    if (!r.data.ok) throw new Error(r.data.error ?? 'No se pudo responder.');
  } catch (e) { throw new Error(e instanceof Error && !(e as { code?: string }).code ? e.message : mensaje(e)); }
}
