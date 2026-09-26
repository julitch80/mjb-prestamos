// Subida de evidencias (fotos y documentos) del módulo de accidente laboral a
// Cloud Storage. Mismo patrón defensivo que src/data/adjuntos.ts (chat):
// Firebase-only, no-op/seguro si Firebase no está configurado. Reglas en
// storage.rules bajo sst/accidentes/{id}/{eid}.
import {
  getStorage, ref, uploadBytes, getDownloadURL, type FirebaseStorage,
} from 'firebase/storage';
import { app, firebaseConfigurado } from '../../lib/firebase';
import { esTamanoEvidenciaValido, esTipoEvidenciaValido, dimensionesComprimidas } from './accidenteLaboral';

export const storage: FirebaseStorage | null = firebaseConfigurado && app ? getStorage(app) : null;

/**
 * Comprime una imagen en el navegador (canvas → JPEG, lado mayor 1600 px,
 * calidad 0.8) antes de subirla. Los PDF se suben tal cual, sin pasar por
 * aquí.
 */
export async function comprimirImagen(file: File): Promise<File> {
  if (typeof document === 'undefined' || typeof createImageBitmap === 'undefined') return file;
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const { width, height } = dimensionesComprimidas(bitmap.width, bitmap.height, 1600);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, width, height);
  const blob: Blob | null = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.8));
  if (!blob) return file;
  const nombre = file.name.replace(/\.[a-zA-Z0-9]+$/, '') + '.jpg';
  return new File([blob], nombre, { type: 'image/jpeg' });
}

export interface EvidenciaSubida {
  nombre: string;
  tipo: string;
  tamano: number;
  ruta: string;
}

/**
 * Sube un archivo de evidencia a Storage en `sst/accidentes/{id}/{eid}` y
 * devuelve los metadatos para crear el doc de la subcolección `evidencias`.
 * Comprime imágenes antes de subir; los PDF se suben sin cambios.
 */
export async function subirEvidencia(accidenteId: string, eid: string, fileOriginal: File): Promise<EvidenciaSubida> {
  if (!storage) throw new Error('El almacenamiento no está configurado.');
  const esImagen = fileOriginal.type.startsWith('image/');
  const file = esImagen ? await comprimirImagen(fileOriginal) : fileOriginal;
  const contentType = file.type || fileOriginal.type;
  if (!esTipoEvidenciaValido(contentType)) {
    throw new Error('Tipo de archivo no admitido. Usa foto (JPEG/PNG/WEBP/HEIC) o PDF.');
  }
  if (!esTamanoEvidenciaValido(file.size)) {
    throw new Error('El archivo supera el límite de 10 MB.');
  }
  const ruta = `sst/accidentes/${accidenteId}/${eid}`;
  const storageRef = ref(storage, ruta);
  await uploadBytes(storageRef, file, { contentType });
  return { nombre: fileOriginal.name, tipo: contentType, tamano: file.size, ruta };
}

/** URL de descarga de una evidencia ya subida, para abrirla en otra pestaña. */
export async function urlEvidencia(ruta: string): Promise<string> {
  if (!storage) throw new Error('El almacenamiento no está configurado.');
  return getDownloadURL(ref(storage, ruta));
}
