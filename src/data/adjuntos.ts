// Subida de adjuntos del chat interno a Cloud Storage (Etapa 2 del chat).
// Firebase-only y NO-DESTRUCTIVO: mismo patrón defensivo que src/data/chat.ts
// — todas las funciones son no-op / seguras si Firebase no está configurado.
import {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
  type FirebaseStorage,
} from 'firebase/storage';
import { app, firebaseConfigurado } from '../lib/firebase';

export const storage: FirebaseStorage | null = firebaseConfigurado && app ? getStorage(app) : null;

export const TAMANO_MAXIMO_BYTES = 10 * 1024 * 1024; // 10 MB, espeja storage.rules

export type TipoAdjunto = 'imagen' | 'audio' | 'archivo';

export type AdjuntoSubido = {
  tipo: TipoAdjunto;
  url: string;
  nombre: string;
  bytes: number;
  duracionSeg?: number;
};

/** Deriva el tipo de adjunto a partir del contentType del archivo. */
function tipoDesdeContentType(contentType: string): TipoAdjunto {
  if (contentType.startsWith('image/')) return 'imagen';
  if (contentType.startsWith('audio/')) return 'audio';
  return 'archivo';
}

/** Extensión segura derivada del nombre original (sin puntos ni espacios raros). */
function extensionSegura(nombreOriginal: string): string {
  const m = /\.([a-zA-Z0-9]{1,8})$/.exec(nombreOriginal);
  return m ? `.${m[1].toLowerCase()}` : '';
}

/**
 * Sube un archivo al chat y devuelve los metadatos para guardar en el
 * mensaje. El nombre de archivo en Storage NUNCA es el nombre original (puede
 * traer `/` u otros caracteres que rompen la ruta) — se genera uno único con
 * timestamp + aleatorio, y el nombre original se conserva solo como dato en
 * el campo `nombre`.
 */
export async function subirAdjunto(
  channelId: string,
  file: File,
  onProgreso?: (pct: number) => void,
  duracionSeg?: number,
): Promise<AdjuntoSubido> {
  if (!storage) throw new Error('El almacenamiento no está configurado.');
  if (file.size > TAMANO_MAXIMO_BYTES) {
    throw new Error('El archivo supera el límite de 10 MB.');
  }
  const nombreUnico = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}${extensionSegura(file.name)}`;
  const storageRef = ref(storage, `chat/${channelId}/${nombreUnico}`);
  const tarea = uploadBytesResumable(storageRef, file, { contentType: file.type || 'application/octet-stream' });

  await new Promise<void>((resolve, reject) => {
    tarea.on(
      'state_changed',
      (snap) => {
        if (onProgreso) onProgreso(Math.round((snap.bytesTransferred / snap.totalBytes) * 100));
      },
      (err) => reject(err),
      () => resolve(),
    );
  });

  const url = await getDownloadURL(storageRef);
  const tipo = tipoDesdeContentType(file.type || '');
  return {
    tipo,
    url,
    nombre: file.name,
    bytes: file.size,
    ...(tipo === 'audio' && typeof duracionSeg === 'number' ? { duracionSeg } : {}),
  };
}

/** Formatea un peso en bytes a texto legible en español ("2,4 MB"). */
export function pesoLegible(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1).replace('.', ',')} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}
