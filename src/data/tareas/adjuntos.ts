// Archivos adjuntos de una tarea (guías, talleres, plantillas).
//
// VISIBILIDAD — decisión tomada por Julián el 5 de agosto de 2026:
// la agenda del grupo es PÚBLICA (se abre por QR, sin contraseña), porque los
// estudiantes y las familias no tienen cuenta institucional. Por lo tanto el
// enlace de descarga queda accesible para cualquiera que lo tenga. No es un
// descuido: es la única forma de que el destinatario pueda abrirlo. Lo que sí
// se hace es ADVERTIRLO en pantalla al subir, para que nadie publique ahí algo
// con datos de estudiantes creyendo que es un espacio cerrado.
//
// CONSERVACIÓN: van bajo el prefijo `tareas/`, separado de `chat/`, cuya regla
// de borrado a los 90 días NO les aplica. La limpieza de fin de año lectivo es
// una regla de ciclo de vida del bucket (configuración de Google Cloud), no
// código de la app — ver docs/adjuntos-de-tareas.md.

import { getDownloadURL, getStorage, ref, uploadBytesResumable } from 'firebase/storage';
import { app } from '../../lib/firebase';

/** Tope por archivo. Una guía en PDF cabe de sobra; un video no, a propósito. */
export const TAMANO_MAXIMO_BYTES = 10 * 1024 * 1024;

/** Lado mayor de una imagen comprimida. De sobra para leer un tablero a mano alzada. */
const LADO_MAYOR_IMAGEN = 1600;

export interface AdjuntoTarea {
  url: string;
  nombre: string;
}

function extensionSegura(nombre: string): string {
  const punto = nombre.lastIndexOf('.');
  if (punto < 0) return '';
  const ext = nombre.slice(punto).toLowerCase();
  return /^\.[a-z0-9]{1,8}$/.test(ext) ? ext : '';
}

/**
 * Comprime una foto tomada con el celular antes de subirla.
 *
 * Una foto de un teléfono actual pesa 4-8 MB, y el tope del adjunto es 10 MB:
 * sin comprimir, unas fotos pasarían y otras no, sin ningún patrón que el
 * docente pueda entender ("¿por qué esta sí y esa no?"). Reducir siempre a un
 * tamaño manejable hace el límite predecible. Solo se comprimen imágenes: un
 * PDF ya viene comprimido a su manera y recomprimirlo no tiene sentido (y
 * canvas no sabe leerlo).
 */
async function comprimirImagen(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const escala = Math.min(1, LADO_MAYOR_IMAGEN / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * escala);
  const h = Math.round(bitmap.height * escala);

  const lienzo = document.createElement('canvas');
  lienzo.width = w;
  lienzo.height = h;
  const ctx = lienzo.getContext('2d');
  if (!ctx) {
    bitmap.close();
    return file; // El navegador no soporta canvas: se sube tal cual, mejor que fallar.
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const blob = await new Promise<Blob | null>((res) => lienzo.toBlob(res, 'image/jpeg', 0.82));
  if (!blob) return file; // No se pudo comprimir: se intenta subir el original.

  const nombreJpg = file.name.replace(/\.[a-z0-9]{1,8}$/i, '') + '.jpg';
  return new File([blob], nombreJpg, { type: 'image/jpeg' });
}

/**
 * Sube el archivo y devuelve el enlace y el nombre original.
 *
 * El nombre en el almacenamiento NUNCA es el original: puede traer barras,
 * acentos o espacios que rompen la ruta. Se genera uno único y el original se
 * conserva aparte, solo para mostrarlo.
 */
export async function subirAdjuntoTarea(
  file: File,
  onProgreso?: (pct: number) => void,
): Promise<AdjuntoTarea> {
  if (!app) throw new Error('El almacenamiento no está configurado.');

  const archivo = file.type.startsWith('image/') ? await comprimirImagen(file) : file;

  if (archivo.size > TAMANO_MAXIMO_BYTES) {
    throw new Error('El archivo supera el límite de 10 MB.');
  }

  const nombreUnico = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}${extensionSegura(archivo.name)}`;
  const referencia = ref(getStorage(app), `tareas/${nombreUnico}`);
  const tarea = uploadBytesResumable(referencia, archivo, {
    contentType: archivo.type || 'application/octet-stream',
  });

  await new Promise<void>((resolver, rechazar) => {
    tarea.on(
      'state_changed',
      (s) => onProgreso?.(Math.round((s.bytesTransferred / s.totalBytes) * 100)),
      rechazar,
      () => resolver(),
    );
  });

  // El nombre mostrado es siempre el del archivo original elegido por el
  // docente, aunque lo subido sea la versión comprimida (p. ej. "IMG_01.png").
  return { url: await getDownloadURL(referencia), nombre: file.name };
}
