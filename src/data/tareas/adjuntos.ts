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
  if (file.size > TAMANO_MAXIMO_BYTES) {
    throw new Error('El archivo supera el límite de 10 MB.');
  }

  const nombreUnico = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}${extensionSegura(file.name)}`;
  const referencia = ref(getStorage(app), `tareas/${nombreUnico}`);
  const tarea = uploadBytesResumable(referencia, file, {
    contentType: file.type || 'application/octet-stream',
  });

  await new Promise<void>((resolver, rechazar) => {
    tarea.on(
      'state_changed',
      (s) => onProgreso?.(Math.round((s.bytesTransferred / s.totalBytes) * 100)),
      rechazar,
      () => resolver(),
    );
  });

  return { url: await getDownloadURL(referencia), nombre: file.name };
}
