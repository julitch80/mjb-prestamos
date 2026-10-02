// Subida a Cloud Storage: sedeDatos/{sedeId}/{archivoId}. Reglas en storage.rules.
// Mismo patrón que src/data/sst/evidencias.ts (compresión de imágenes en el navegador).
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage, comprimirImagen } from '../sst/evidencias';
import { mimeBase } from './audio';
import { tipoDeArchivo, validarArchivo } from './archivos';
/** `docId` = id del documento: la sede real o `prueba_{sede}` (modo prueba del superusuario). */
type DocId = string;

export function nuevoId(prefijo: string): string {
  return `${prefijo}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export interface SubidaOk { id: string; ruta: string; tipo: string; tamano: number }

/** Sube un archivo (comprime si es imagen). Lanza Error con un mensaje legible si no sirve. */
export async function subirArchivoSede(sede: DocId, original: File): Promise<SubidaOk> {
  if (!storage) throw new Error('El almacenamiento no está configurado.');
  const tipoOrig = tipoDeArchivo(original.name, original.type);
  const file = tipoOrig.startsWith('image/') ? await comprimirImagen(original) : original;
  const tipo = tipoDeArchivo(file.name, file.type) || tipoOrig;
  const motivo = validarArchivo(file.name, tipo, file.size);
  if (motivo) throw new Error(`${original.name}: ${motivo}`);
  const id = nuevoId('f');
  const ruta = `sedeDatos/${sede}/${id}`;
  await uploadBytes(ref(storage, ruta), file, { contentType: tipo });
  return { id, ruta, tipo, tamano: file.size };
}

/** Sube una nota de voz grabada con MediaRecorder. */
export async function subirAudioSede(sede: DocId, blob: Blob, mime: string): Promise<SubidaOk> {
  if (!storage) throw new Error('El almacenamiento no está configurado.');
  const tipo = mimeBase(mime);
  const motivo = validarArchivo('nota', tipo, blob.size);
  if (motivo) throw new Error(motivo);
  const id = nuevoId('v');
  const ruta = `sedeDatos/${sede}/${id}`;
  await uploadBytes(ref(storage, ruta), blob, { contentType: tipo });
  return { id, ruta, tipo, tamano: blob.size };
}

export async function urlArchivoSede(ruta: string): Promise<string> {
  if (!storage) throw new Error('El almacenamiento no está configurado.');
  return getDownloadURL(ref(storage, ruta));
}
