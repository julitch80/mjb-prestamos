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
//
// SOLO CREA. Nunca sobreescribe una cuenta que ya existe -ni su rol, ni su
// slotId, ni si está activa o no- porque el superusuario puede haber tomado
// una decisión ahí (por ejemplo, desactivar a alguien, o un reemplazo de
// docente que dejó el slotId en null a propósito) que este sincronizador no
// tiene por qué conocer ni pisar.
import { collection, doc, getDocs, serverTimestamp, writeBatch } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { USUARIOS } from './maestros';

export interface ResultadoSyncCuentas {
  creadas: string[];
  yaExistian: number;
}

export async function sincronizarCuentasUsuarios(): Promise<ResultadoSyncCuentas> {
  if (!db || !auth?.currentUser) throw new Error('No hay sesión de Firebase.');

  const snap = await getDocs(collection(db, 'users'));
  const existentes = new Set(snap.docs.map((d) => d.id.toLowerCase()));

  const faltantes = USUARIOS.filter(
    (u) => u.correo && !existentes.has(u.correo.toLowerCase()),
  );
  if (faltantes.length === 0) return { creadas: [], yaExistian: USUARIOS.length };

  const actualizadoPor = auth.currentUser.email?.toLowerCase() ?? '';
  const batch = writeBatch(db);
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
  await batch.commit();

  return { creadas: faltantes.map((u) => u.correo!), yaExistian: existentes.size };
}
