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
 * puesto según Firestore. Si el correo difiere del correo base, hubo un
 * reemplazo real y también se actualiza el nombreCorto (primer nombre).
 */
export function aplicarPlantillaFirestore(usuariosFs: UsuarioFirestore[]) {
  for (const fs of usuariosFs) {
    if (!fs.slotId || fs.active !== true) continue;
    const base = USUARIOS.find((u) => u.id === fs.slotId);
    if (!base) continue;
    const emailFs = (fs.email || '').toLowerCase();
    const correoBase = (base.correo || '').toLowerCase();
    if (fs.displayName) base.nombre = fs.displayName;
    if (fs.email) base.correo = fs.email;
    if (emailFs && emailFs !== correoBase) {
      // Reemplazo real: nueva persona en el puesto.
      hayReemplazos = true;
      const primerNombre = (fs.displayName || '').trim().split(/\s+/)[0];
      if (primerNombre) base.nombreCorto = primerNombre;
    }
  }
}
