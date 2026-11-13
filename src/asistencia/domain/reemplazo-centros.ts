/**
 * El reemplazo temporal traspasa los centros de interes (Julian, 2026-11-13).
 *
 * POR QUE HACE FALTA: el reemplazo de MJB pasa el PUESTO (slotId), y todo lo que cuelga del
 * puesto llega solo al reemplazante. Pero el lider y los docentes de un centro se guardan por
 * CORREO, asi que no pasaban: Sara reemplazaba a Luis Angel y no veia el centro de el.
 * Regla general: un reemplazo hereda TODO lo que esta a cargo del titular.
 *
 * Logica pura: el cambio que hay que hacerle a UN centro. La aplica
 * `traspasarCentrosInteres` (functions) al empezar el reemplazo (titular -> reemplazante) y
 * al terminarlo (reemplazante -> titular). Idempotente: si ya esta hecho, devuelve null.
 */
export function traspasoDeCentro(
  centro: { lider?: string; docentes?: string[] },
  deCorreo: string,
  aCorreo: string,
): { lider?: string; docentes: string[] } | null {
  const de = deCorreo.trim().toLowerCase();
  const a = aCorreo.trim().toLowerCase();
  if (!de || !a || de === a) return null;
  const docentes = (centro.docentes ?? []).map((d) => d.toLowerCase());
  const esLider = (centro.lider ?? '').toLowerCase() === de;
  if (!docentes.includes(de) && !esLider) return null;

  // El reemplazante OCUPA el lugar del titular (no queda de co-lider): el titular esta en
  // solo lectura durante el reemplazo, y asi el regreso es el mismo cambio al reves.
  const nuevos = [...new Set(docentes.map((d) => (d === de ? a : d)))];
  if (esLider && !nuevos.includes(a)) nuevos.push(a);
  return esLider ? { lider: a, docentes: nuevos } : { docentes: nuevos };
}

/**
 * Que traspaso toca ante una escritura del documento del reemplazo:
 *  - activo (al iniciarlo, o en cualquier cambio mientras dura, como extender la fecha):
 *    del titular al reemplazante. Idempotente, asi que repetirlo no hace dano.
 *  - deja de estar activo (fin manual o vencido): del reemplazante al titular.
 *  - en otro caso, nada.
 */
export function direccionDelTraspaso(
  antes: { estado?: string; titularEmail?: string; reemplazoEmail?: string } | null,
  despues: { estado?: string; titularEmail?: string; reemplazoEmail?: string } | null,
): { de: string; a: string } | null {
  const titular = String(despues?.titularEmail ?? antes?.titularEmail ?? '').toLowerCase();
  const reemplazo = String(despues?.reemplazoEmail ?? antes?.reemplazoEmail ?? '').toLowerCase();
  if (!titular || !reemplazo) return null;
  if (despues?.estado === 'activo') return { de: titular, a: reemplazo };
  if (antes?.estado === 'activo') return { de: reemplazo, a: titular };
  return null;
}
