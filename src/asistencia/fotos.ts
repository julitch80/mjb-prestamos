/**
 * Fotografias de estudiantes: comprimir, subir y resolver la URL.
 *
 * DATOS DE MENORES. La autorizacion de tratamiento existe (Ley 1581/2012), lo que
 * habilita tomarlas y usarlas — no relaja quien puede verlas. El control de acceso vive
 * en las reglas de Storage, no aqui.
 *
 * Ruta confirmada por el equipo de MJB: `asistencia/photos/{studentId}.jpg`.
 * El bucket NO es el predeterminado: es `mjb-prestamos-chat`, y `getStorage(app)` lo
 * resuelve solo porque va en `VITE_FIREBASE_STORAGE_BUCKET`. Su regla de borrado
 * automatico a los 90 dias aplica al prefijo `chat/`, asi que estas fotos no caducan.
 *
 * No se usa `src/data/adjuntos.ts` de MJB aunque haga algo parecido: su ruta esta
 * fijada a `chat/{channelId}/`. Se copia el patron (uploadBytesResumable +
 * getDownloadURL), no la funcion.
 */

import { getDownloadURL, getStorage, ref, uploadBytesResumable } from 'firebase/storage';
import { app } from '../lib/firebase';

/** Lado mayor de la imagen guardada. Foto carne: 3:4. */
const ANCHO = 600;
const ALTO = 800;
/** Tope de seguridad; la regla de Storage rechaza por encima de 2 MB. */
const MAX_BYTES = 2 * 1024 * 1024;

export function rutaFoto(studentId: string): string {
  return `asistencia/photos/${studentId}.jpg`;
}

/**
 * Reduce y comprime en el navegador antes de subir.
 *
 * Importa mas de lo que parece: son ~2.000 estudiantes y cada foto se descarga a TODOS
 * los dispositivos que pasan lista, para que la planilla funcione sin senal. Una foto
 * de 4 MB sin comprimir multiplicada por el colegio es un gasto de datos que el docente
 * paga de su plan.
 */
export async function comprimir(archivo: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(archivo);
  const lienzo = document.createElement('canvas');
  lienzo.width = ANCHO;
  lienzo.height = ALTO;
  const ctx = lienzo.getContext('2d');
  if (!ctx) throw new Error('El navegador no permitió procesar la imagen.');

  // Recorte centrado a 3:4, sin deformar el rostro.
  const escala = Math.max(ANCHO / bitmap.width, ALTO / bitmap.height);
  const w = bitmap.width * escala;
  const h = bitmap.height * escala;
  ctx.drawImage(bitmap, (ANCHO - w) / 2, (ALTO - h) / 2, w, h);
  bitmap.close();

  const blob = await new Promise<Blob | null>((res) =>
    lienzo.toBlob(res, 'image/jpeg', 0.82),
  );
  if (!blob) throw new Error('No fue posible comprimir la imagen.');
  return blob;
}

export interface ResultadoSubida {
  ruta: string;
  url: string;
  bytes: number;
}

/**
 * Sube la foto ya comprimida. `onProgreso` recibe 0..100.
 *
 * La ruta es determinista por estudiante: subir de nuevo REEMPLAZA. No se acumulan
 * versiones en Storage; el historial de la ficha lo lleva Firestore.
 */
export async function subirFoto(
  studentId: string,
  archivo: Blob,
  onProgreso?: (pct: number) => void,
): Promise<ResultadoSubida> {
  if (!app) throw new Error('Firebase no está configurado en esta instalación.');

  const comprimida = await comprimir(archivo);
  if (comprimida.size > MAX_BYTES) {
    throw new Error('La imagen sigue siendo demasiado grande después de comprimirla.');
  }

  const ruta = rutaFoto(studentId);
  const referencia = ref(getStorage(app), ruta);
  const tarea = uploadBytesResumable(referencia, comprimida, {
    contentType: 'image/jpeg',
    cacheControl: 'public,max-age=604800',
  });

  await new Promise<void>((resolver, rechazar) => {
    tarea.on(
      'state_changed',
      (s) => onProgreso?.(Math.round((s.bytesTransferred / s.totalBytes) * 100)),
      (e) => rechazar(traducirError(e)),
      () => resolver(),
    );
  });

  return { ruta, url: await getDownloadURL(referencia), bytes: comprimida.size };
}

/** URL de descarga de una foto ya subida. `null` si el estudiante no tiene. */
export async function urlDeFoto(studentId: string): Promise<string | null> {
  if (!app) return null;
  try {
    return await getDownloadURL(ref(getStorage(app), rutaFoto(studentId)));
  } catch {
    // No existe, o el usuario no tiene permiso. En ambos casos la ficha muestra las
    // iniciales: no hay nada que el docente pueda hacer con el detalle del error.
    return null;
  }
}

function traducirError(e: unknown): Error {
  const codigo = (e as { code?: string })?.code ?? '';
  if (codigo.includes('unauthorized')) {
    return new Error(
      'No tiene permiso para cambiar esta fotografía. Solo pueden hacerlo el director ' +
        'del grupo, coordinación y el superusuario.',
    );
  }
  if (codigo.includes('canceled')) return new Error('Subida cancelada.');
  if (codigo.includes('retry-limit')) {
    return new Error('La conexión falló durante la subida. Inténtelo de nuevo.');
  }
  return new Error(`No fue posible subir la fotografía: ${(e as Error).message}`);
}
