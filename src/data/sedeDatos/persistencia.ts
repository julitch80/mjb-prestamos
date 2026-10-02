// Lectura/escritura de sedeDatos/{sedeId} y aviso al superusuario al enviar.
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc, increment } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import { listarUsuarios } from '../adminUsers';
import { abrirDm, enviarMensaje } from '../chat';
import type { SedeDatosDoc, SedeDatosId } from './tipos';

/** Id del documento: en modo prueba (solo superusuario) es `prueba_{sede}`. */
export const docIdDeSede = (sede: SedeDatosId, prueba: boolean): string => (prueba ? `prueba_${sede}` : sede);

export function miCorreo(): string {
  return auth?.currentUser?.email?.toLowerCase() ?? '';
}

/** Firestore no admite `undefined`: se limpia por la vía más simple (todo es JSON). */
function limpio<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T;
}

export const docVacio = (sede: string): SedeDatosDoc => ({ sede: sede as SedeDatosId, respuestas: {}, archivos: [] });

export async function cargarSedeDatos(sede: string): Promise<SedeDatosDoc | null> {
  if (!db) return null;
  const snap = await getDoc(doc(db, 'sedeDatos', sede));
  return snap.exists() ? ({ ...docVacio(sede), ...(snap.data() as Partial<SedeDatosDoc>) }) : docVacio(sede);
}

export function escucharSedeDatos(sede: string, cb: (d: SedeDatosDoc | null) => void): () => void {
  if (!db) { cb(null); return () => {}; }
  return onSnapshot(
    doc(db, 'sedeDatos', sede),
    snap => cb(snap.exists() ? ({ ...docVacio(sede), ...(snap.data() as Partial<SedeDatosDoc>) }) : null),
    () => cb(null),
  );
}

/** Guarda respuestas y archivos. Con `enviar` marca la fecha de envío y cuenta el envío. */
export async function guardarSedeDatos(
  sede: string, datos: Pick<SedeDatosDoc, 'respuestas' | 'archivos'>, enviar = false,
): Promise<void> {
  if (!db) throw new Error('Firebase no está configurado.');
  const base = {
    sede,
    respuestas: limpio(datos.respuestas),
    archivos: limpio(datos.archivos),
    actualizadoPor: miCorreo(),
    actualizadoEn: serverTimestamp(),
  };
  // mergeFields: cada campo de primer nivel se REEMPLAZA entero (no se fusiona con lo viejo).
  const campos = ['sede', 'respuestas', 'archivos', 'actualizadoPor', 'actualizadoEn'];
  if (enviar) {
    await setDoc(doc(db, 'sedeDatos', sede), { ...base, enviadoEn: serverTimestamp(), enviosCount: increment(1) },
      { mergeFields: [...campos, 'enviadoEn', 'enviosCount'] });
  } else {
    await setDoc(doc(db, 'sedeDatos', sede), base, { mergeFields: campos });
  }
}

/**
 * Avisa a los superusuarios con un mensaje directo del chat: el codebase de notificaciones
 * ya convierte cada mensaje nuevo en un aviso push al destinatario (sin función nueva).
 * Devuelve cuántos avisos salieron; nunca lanza (el envío del formulario no depende de esto).
 */
export async function avisarEnvioASuperusuarios(textoAviso: string): Promise<number> {
  try {
    const yo = miCorreo();
    const supers = (await listarUsuarios()).filter(u => u.role === 'superusuario' && u.active && u.email.toLowerCase() !== yo);
    let n = 0;
    for (const s of supers) {
      try {
        const canal = await abrirDm(s.email);
        await enviarMensaje(canal, textoAviso);
        n++;
      } catch { /* sigue con el siguiente */ }
    }
    return n;
  } catch {
    return 0;
  }
}
