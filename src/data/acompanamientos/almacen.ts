/**
 * Lectura y guardado de publicaciones de acompañamientos en Firestore.
 *
 * Firebase-only: si `db` es null (Firebase no configurado en esta compilación)
 * o la suscripción falla (p. ej. sin permiso), las pantallas quedan con la
 * distribución inicial en vez de romperse — ver PRD.md §Datos.
 */

import {
  addDoc,
  collection,
  onSnapshot,
  query,
  serverTimestamp,
  Timestamp,
  where,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { COLECCION_PUBLICACIONES, type Distribucion, type FechaISO, type JornadaAcomp, type Publicacion } from './tipos';

/**
 * Se suscribe a las publicaciones de una jornada. Sin `orderBy` a propósito
 * (PLAN.md / TAREAS.md 1.5): una igualdad sobre un solo campo no necesita
 * índice compuesto, y el orden se hace en el cliente (`vigente.ts`), porque
 * son pocas publicaciones.
 *
 * Si `db` es null, entrega `[]` de una vez y no se suscribe a nada. Si la
 * suscripción falla (permiso denegado, sin red), entrega `[]` y avisa por
 * `alFallar` — quien llama debe caer de vuelta a la distribución inicial, no
 * romperse.
 */
export function suscribirPublicaciones(
  jornada: JornadaAcomp,
  alRecibir: (publicaciones: Publicacion[]) => void,
  alFallar?: (error: unknown) => void,
): () => void {
  if (!db) {
    alRecibir([]);
    return () => {};
  }
  const q = query(collection(db, COLECCION_PUBLICACIONES), where('jornada', '==', jornada));
  return onSnapshot(
    q,
    (snap) => {
      const publicaciones: Publicacion[] = snap.docs.map((d) => {
        const data = d.data() as Omit<Publicacion, 'id' | 'esInicial' | 'publicadoEn'> & {
          publicadoEn: Timestamp | null;
        };
        return {
          ...data,
          id: d.id,
          publicadoEn: data.publicadoEn instanceof Timestamp ? data.publicadoEn.toMillis() : null,
          esInicial: false,
        };
      });
      alRecibir(publicaciones);
    },
    (error) => {
      alFallar?.(error);
      alRecibir([]);
    },
  );
}

/**
 * Arma EXACTAMENTE el objeto que se guarda al publicar — función pura, sin
 * Firestore, para poder probarla (`tests-reglas/acompanamientos.test.ts`) y
 * para que `publicarDistribucion` no pueda desviarse de lo que se prueba.
 * `marcaTiempo` es lo que va en `publicadoEn`: en producción `serverTimestamp()`,
 * en la prueba un valor cualquiera que la regla acepte.
 */
export function documentoDePublicacion(
  dist: Distribucion,
  vigenteDesde: FechaISO,
  correo: string,
  nombre: string,
  marcaTiempo: unknown,
) {
  return {
    jornada: dist.jornada,
    vigenteDesde,
    zonas: dist.zonas,
    asignaciones: dist.asignaciones,
    publicadoPor: correo,
    publicadoPorNombre: nombre,
    publicadoEn: marcaTiempo,
  };
}

/**
 * Guarda una distribución como publicación en firme. Escribe exactamente las
 * claves que permite la regla de Firestore (`firestore.rules`,
 * `acompanamientosPublicaciones`): agregar un campo aquí sin agregarlo
 * también a la regla hace que el servidor rechace la escritura.
 *
 * Sin try/catch: si falla (sin conexión, regla que rechaza), el error debe
 * subir a la pantalla que llama — PRD.md dice que «no se publica nada, el
 * borrador se conserva y se dice qué pasó».
 */
export async function publicarDistribucion(
  dist: Distribucion,
  vigenteDesde: FechaISO,
  correo: string,
  nombre: string,
): Promise<string> {
  if (!db) throw new Error('Firebase no está configurado en esta compilación.');
  const ref = await addDoc(
    collection(db, COLECCION_PUBLICACIONES),
    documentoDePublicacion(dist, vigenteDesde, correo, nombre, serverTimestamp()),
  );
  return ref.id;
}
