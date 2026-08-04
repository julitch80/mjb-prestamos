// Sincroniza cuentas de acceso (Firestore `users/`) a partir de USUARIOS en
// maestros.ts.
//
// POR QUÉ EXISTE: agregar a alguien en USUARIOS (código) lo hace aparecer en
// horarios, chat y colores, pero NO le da acceso a la app — `beforecreated`
// exige un documento en `users/{correo}` con `active: true`, y ese documento
// solo se creaba a mano (panel, uno por uno) o con scripts/seed-users.mjs
// (requiere descargar una clave de servicio). El 4 de agosto de 2026 los 12
// docentes de Gustavo Rodas se agregaron a USUARIOS pero nadie corrió ese
// paso aparte: ningún profesor de la sede pudo entrar el día de la
// presentación. Este sincronizador cierra ese hueco: un botón, sin clave.
import { collection, doc, getDocs, serverTimestamp, writeBatch } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { USUARIOS } from './maestros';

export interface ResultadoSyncCuentas {
  creadas: string[];
  /** Cuentas activas a las que les faltaba el `slotId` y se les repuso. */
  reparadas: { correo: string; slotId: string }[];
  yaExistian: number;
}

export async function sincronizarCuentasUsuarios(): Promise<ResultadoSyncCuentas> {
  if (!db || !auth?.currentUser) throw new Error('No hay sesión de Firebase.');

  const snap = await getDocs(collection(db, 'users'));
  const porCorreo = new Map(snap.docs.map((d) => [d.id.toLowerCase(), d.data()]));

  const actualizadoPor = auth.currentUser.email?.toLowerCase() ?? '';
  const batch = writeBatch(db);

  // ── 1. Altas: correos de USUARIOS que todavía no tienen cuenta ────────────
  const faltantes = USUARIOS.filter((u) => u.correo && !porCorreo.has(u.correo.toLowerCase()));
  for (const u of faltantes) {
    const correo = u.correo!.toLowerCase();
    batch.set(doc(db, 'users', correo), {
      email: correo,
      displayName: u.nombre,
      role: u.rol,
      active: true,
      slotId: u.id,
      sede: u.sede ?? 'central',
      jornada: u.jornada === 'ambas' ? 'ambas' : u.jornada,
      createdAt: serverTimestamp(),
      createdBy: actualizadoPor,
    });
  }

  // ── 2. Reparación del `slotId` ausente ────────────────────────────────────
  //
  // Es el fallo más difícil de ver de todo el sistema, y ya costó una tarde:
  // la INTERFAZ resuelve el puesto contra la lista estática USUARIOS, pero las
  // REGLAS (firestore.rules:213 y storage.rules:120) lo comparan contra
  // `users/{correo}.slotId` de Firestore. Si ese campo falta, la app enseña el
  // botón «Tomar foto» porque cree que eres el director, y el servidor rechaza
  // la subida diciendo que no lo eres. Dos fuentes distintas para el mismo
  // dato, discrepando en silencio.
  //
  // Solo se repone cuando el campo está VACÍO y la cuenta está ACTIVA. Un
  // docente reemplazado queda con `slotId: null` a propósito, pero también con
  // `active: false`, así que no lo tocamos y el reemplazo no se deshace.
  const reparadas: { correo: string; slotId: string }[] = [];
  for (const u of USUARIOS) {
    if (!u.correo) continue;
    const correo = u.correo.toLowerCase();
    const actual = porCorreo.get(correo);
    if (!actual) continue;                       // recién creado arriba
    if (actual.active !== true) continue;        // desactivado o reemplazado
    if (actual.slotId) continue;                 // ya lo tiene: no se pisa
    batch.update(doc(db, 'users', correo), { slotId: u.id });
    reparadas.push({ correo, slotId: u.id });
  }

  if (faltantes.length > 0 || reparadas.length > 0) await batch.commit();

  return {
    creadas: faltantes.map((u) => u.correo!),
    reparadas,
    yaExistian: porCorreo.size,
  };
}
