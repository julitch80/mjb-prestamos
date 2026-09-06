// Resuelve la persona que ocupa cada puesto (slot). En modo google, los docs
// de Firestore users/ con slotId sobreescriben nombre y correo de la entrada
// correspondiente de USUARIOS. En modo pin no hace nada (no-destructivo):
// este módulo solo se invoca desde initAuthGoogle (modo google).
import { USUARIOS } from './maestros';
import type { UsuarioFirestore } from './adminUsers';

/** true si al menos un slot está ocupado por una persona distinta a la base. */
export let hayReemplazos = false;

/**
 * Parchea IN PLACE las entradas de USUARIOS con la persona que ocupa cada
 * puesto según Firestore. Si el nombre difiere del nombre base, hubo un
 * reemplazo real y también se actualiza el nombreCorto (primer nombre).
 *
 * NOTA — por qué la detección de reemplazo usa `nombre` y no `correo`:
 * `USUARIOS.correo` sale vacío de `maestros.ts` a propósito (ver el
 * comentario ahí) precisamente para que el correo NUNCA viaje en el bundle
 * público — solo llega aquí, en tiempo de ejecución y tras login, desde
 * Firestore. Comparar contra un correo base vacío marcaría TODO login como
 * "reemplazo real", así que el nombre (que sí sigue en el bundle, no es dato
 * sensible) es la señal correcta de si cambió la persona del puesto. El
 * correo, en cambio, se rellena siempre que Firestore lo traiga, haya o no
 * reemplazo — es el único mecanismo que lo resuelve.
 */
export function aplicarPlantillaFirestore(usuariosFs: UsuarioFirestore[]) {
  for (const fs of usuariosFs) {
    if (!fs.slotId || fs.active !== true) continue;
    const base = USUARIOS.find((u) => u.id === fs.slotId);
    if (!base) continue;
    const nombreFs = (fs.displayName || '').trim().toLowerCase();
    const nombreBase = (base.nombre || '').trim().toLowerCase();
    const esReemplazoReal = !!nombreFs && nombreFs !== nombreBase;
    if (fs.displayName) base.nombre = fs.displayName;
    // El correo se resuelve aquí siempre que Firestore lo traiga: en
    // maestros.ts queda vacío a propósito (ver comentario ahí), así que este
    // es el único punto donde una sesión iniciada obtiene el correo real.
    if (fs.email) base.correo = fs.email;
    // Fase A — multi-sede: si el doc de Firestore trae sede, se propaga a la
    // entrada de USUARIOS para que el direccionamiento (modo google) use la
    // sede real en vez del default 'central'.
    if (fs.sede) base.sede = fs.sede;
    if (esReemplazoReal) {
      // Reemplazo real: nueva persona en el puesto.
      hayReemplazos = true;
      const primerNombre = nombreFs ? (fs.displayName || '').trim().split(/\s+/)[0] : '';
      if (primerNombre) base.nombreCorto = primerNombre;
    }
  }
}
