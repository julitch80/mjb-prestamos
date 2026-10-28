// Cliente de las entregas (agenda pública y seguimiento del docente).
// Ver docs/plan-casa/ENTREGAS-PRD.md.
import { httpsCallable } from 'firebase/functions';
import { collection, onSnapshot, query, where, type Unsubscribe } from 'firebase/firestore';
import { db, functions } from '../../lib/firebase';
import {
  COL_PLANES, SUB_ENTREGAS,
  type EntradaSubirEntrega, type EntradaVerEntrega, type EntregaPlan, type SalidaSubirEntrega, type SalidaVerEntrega,
} from './tipos';
import { LADO_FOTO, mimeEfectivo } from './entregas';

function mensajeRed(e: unknown): string {
  const m = e as { code?: string; message?: string };
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'Sin conexión a internet. Conéctate y vuelve a intentarlo.';
  if (m?.code === 'functions/not-found') return 'El envío de archivos aún no está activo. Avisa a tu docente.';
  if (m?.code === 'functions/deadline-exceeded' || m?.code === 'functions/unavailable') return 'La conexión es muy lenta o se cortó. Inténtalo de nuevo.';
  if (m?.code === 'functions/permission-denied') return 'No tiene permiso para abrir esta entrega.';
  if (m?.code === 'functions/invalid-argument') return m.message || 'Datos inválidos.';
  return 'No se pudo enviar. Revisa tu conexión e inténtalo de nuevo.';
}

/** Lee un archivo como base64 sin el prefijo data:. */
function aBase64(b: Blob): Promise<string> {
  return new Promise((ok, mal) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).split(',')[1] ?? '');
    r.onerror = () => mal(r.error);
    r.readAsDataURL(b);
  });
}

/**
 * Reduce una foto a LADO_FOTO px (lado mayor) en JPEG. Si el navegador no puede decodificarla
 * (p. ej. HEIC fuera de Safari) se envía tal cual y el servidor aplica el tope de 10 MB.
 */
export async function prepararArchivo(f: File): Promise<{ blob: Blob; nombre: string; contentType: string }> {
  const ct = mimeEfectivo(f.name, f.type);
  if (!ct.startsWith('image/')) return { blob: f, nombre: f.name, contentType: ct };
  try {
    const bmp = await createImageBitmap(f);
    const esc = Math.min(1, LADO_FOTO / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * esc); c.height = Math.round(bmp.height * esc);
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise<Blob | null>(r => c.toBlob(r, 'image/jpeg', 0.82));
    if (!blob) throw new Error('sin blob');
    return { blob, nombre: f.name.replace(/\.[^.]*$/, '') + '.jpg', contentType: 'image/jpeg' };
  } catch {
    return { blob: f, nombre: f.name, contentType: ct };
  }
}

export async function subirEntrega(
  base: { token: string; guiaId: string; pasoId: string },
  contenido: { blob: Blob; nombre: string; contentType: string } | { enlace: string },
): Promise<SalidaSubirEntrega> {
  if (!functions) return { ok: false, error: 'Sin conexión con el servidor.' };
  try {
    const entrada: EntradaSubirEntrega = 'enlace' in contenido
      ? { ...base, enlace: contenido.enlace }
      : { ...base, nombreArchivo: contenido.nombre, contentType: contenido.contentType, datosBase64: await aBase64(contenido.blob) };
    const r = await httpsCallable<EntradaSubirEntrega, SalidaSubirEntrega>(functions, 'planCasaSubirEntrega', { timeout: 180_000 })(entrada);
    return r.data;
  } catch (e) { return { ok: false, error: mensajeRed(e) }; }
}

/** Entregas de una guía, la más reciente primero. */
export function escucharEntregas(planId: string, guiaId: string, cb: (e: EntregaPlan[]) => void, onError: (e: Error) => void = () => {}): Unsubscribe {
  if (!db) return () => {};
  const q = query(collection(db, COL_PLANES, planId, SUB_ENTREGAS), where('guiaId', '==', guiaId));
  // Se ordena en el cliente para no exigir un índice compuesto (guiaId + creadoEn).
  return onSnapshot(q, s => cb(s.docs.map(d => ({ ...(d.data() as EntregaPlan), id: d.id })).sort((a, b) => b.creadoEn - a.creadoEn)), onError);
}

/** Abre una entrega en una pestaña nueva con una URL blob: local (nada permanente). */
export async function abrirEntrega(planId: string, entregaId: string): Promise<void> {
  if (!functions) throw new Error('Firebase no está configurado.');
  // La pestaña se abre ANTES del await para que el navegador no la bloquee como ventana emergente.
  const ventana = window.open('', '_blank');
  try {
    const r = await httpsCallable<EntradaVerEntrega, SalidaVerEntrega>(functions, 'planCasaVerEntrega', { timeout: 60_000 })({ planId, entregaId });
    if (!r.data.ok) throw new Error(r.data.error ?? 'No se pudo abrir.');
    if (r.data.url) { if (ventana) ventana.location.href = r.data.url; else window.open(r.data.url, '_blank', 'noopener'); return; }
    const bin = atob(r.data.datosBase64 ?? '');
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const url = URL.createObjectURL(new Blob([bytes], { type: r.data.contentType }));
    if (ventana) ventana.location.href = url; else window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 5 * 60_000);
  } catch (e) {
    ventana?.close();
    throw new Error(e instanceof Error && !(e as { code?: string }).code ? e.message : mensajeRed(e));
  }
}
