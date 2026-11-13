/**
 * Traspasa los centros de interes de un docente a otro, para el reemplazo temporal
 * (2026-11-13). Ver src/asistencia/domain/reemplazo-centros.ts.
 *
 * Va aparte de index.ts para poder probarla contra el emulador con un Firestore propio.
 * Recorre los programas (pocos) y en cada uno busca los centros donde el docente es lider
 * o docente. Al escribir el centro, `onCentroInteresEscrito` rehace el indice por grado con
 * el lider nuevo, que es lo que se quiere.
 */
import type { Firestore } from 'firebase-admin/firestore';
import { traspasoDeCentro } from '../../src/asistencia/domain/reemplazo-centros';

export async function traspasarCentrosInteres(
  db: Firestore,
  deCorreo: string,
  aCorreo: string,
): Promise<{ centros: number }> {
  const de = deCorreo.trim().toLowerCase();
  const a = aCorreo.trim().toLowerCase();
  if (!de || !a || de === a) return { centros: 0 };
  let centros = 0;
  const programas = await db.collection('asistenciaProgramas').get();
  for (const p of programas.docs) {
    const grupos = p.ref.collection('grupos');
    const [comoDocente, comoLider] = await Promise.all([
      grupos.where('docentes', 'array-contains', de).get(),
      grupos.where('lider', '==', de).get(),
    ]);
    const vistos = new Map([...comoDocente.docs, ...comoLider.docs].map((d) => [d.id, d]));
    if (vistos.size === 0) continue;
    const lote = db.batch();
    let n = 0;
    for (const g of vistos.values()) {
      const cambios = traspasoDeCentro(g.data() as { lider?: string; docentes?: string[] }, de, a);
      if (!cambios) continue;
      lote.update(g.ref, cambios);
      n++;
    }
    if (n > 0) await lote.commit();
    centros += n;
  }
  return { centros };
}
