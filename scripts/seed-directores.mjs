// Puebla el campo `grupoDirigido` en users/{email} de Firestore.
//
// PARA QUÉ: las reglas del módulo de asistencia resuelven la dirección de grupo
// leyendo `callerDoc().grupoDirigido` — no existe un role 'director'. Sin este
// campo, asisIsDirectorOf() falla para todo el mundo y ningún director de grupo
// tiene acceso a su grupo.
//
// MODELO PUESTO/PERSONA: los mapas de maestros.ts apuntan a ids internos de
// USUARIOS (puestos: 'julian', 'carlos'…), no a correos. Este script resuelve el
// puesto contra el campo `slotId` del documento de Firestore, así que sigue
// siendo correcto después de un reemplazo de docente: el campo queda en quien
// ocupa el puesto hoy, no en quien lo ocupaba cuando se escribió el mapa.
//
// Uso:
//   node scripts/seed-directores.mjs            # aplica los cambios
//   node scripts/seed-directores.mjs --dry-run  # solo muestra qué haría
//
// Requiere serviceAccountKey.json en la raíz del repo. BÓRRALO al terminar.

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const keyPath = join(repoRoot, 'serviceAccountKey.json');

// FUENTE DE VERDAD: src/data/maestros.ts (DIRECTORES_MANANA y DIRECTORES_TARDE).
// Se replican aquí porque este script es Node y no puede importar TypeScript.
// Si cambian allá, hay que actualizarlos aquí y volver a correr el script.
const DIRECTORES = {
  // Mañana — notación con punto
  '11.1': 'johana',
  '11.2': 'julian',
  '11.3': 'claudia',
  '10.1': 'carlos',
  '10.2': 'beatriz',
  '10.3': 'ledis',
  '10.4': 'adolfo',
  '9.1': 'gloria_a',
  '9.2': 'marta',
  '9.3': 'uriel',
  // Tarde — notación con ordinal 'º' (así distingue la app la jornada; NO cambiar)
  '6º1': 'luis_angel',
  '6º2': 'fredy_garcia',
  '6º3': 'carolina',
  '7º1': 'yanet',
  '7º2': 'luis_javier',
  '7º3': 'harol',
  '8º1': 'edgar',
  '8º2': 'hugo',
  '8º3': 'monica_rave',
  '8º4': 'juan_pablo',
};

const soloSimulacion = process.argv.includes('--dry-run');

if (!existsSync(keyPath)) {
  console.error('No se encontró serviceAccountKey.json en la raíz del repo.');
  console.error('Descárgalo en: Consola Firebase → Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada.');
  process.exit(1);
}

async function main() {
  initializeApp({ credential: cert(JSON.parse(readFileSync(keyPath, 'utf-8'))) });
  const db = getFirestore();

  // slotId -> grado que dirige
  const gradoPorSlot = new Map();
  for (const [grado, slot] of Object.entries(DIRECTORES)) gradoPorSlot.set(slot, grado);

  const snap = await db.collection('users').get();
  if (snap.empty) {
    console.error('La colección users está vacía. ¿Corriste antes seed-users.mjs?');
    process.exit(1);
  }

  const batch = db.batch();
  let asignados = 0;
  let limpiados = 0;
  const slotsEncontrados = new Set();

  for (const doc of snap.docs) {
    const u = doc.data();
    const grado = u.slotId ? gradoPorSlot.get(u.slotId) : undefined;
    if (grado) {
      slotsEncontrados.add(u.slotId);
      if (u.grupoDirigido === grado) continue; // ya está bien
      console.log(`  ${doc.id}  (${u.slotId})  ->  ${grado}`);
      if (!soloSimulacion) batch.update(doc.ref, { grupoDirigido: grado });
      asignados++;
    } else if (u.grupoDirigido) {
      // Dejó de ser director (o el mapa cambió): se limpia para no dar acceso
      // a un grupo que ya no dirige.
      console.log(`  ${doc.id}  ->  se quita '${u.grupoDirigido}' (ya no dirige grupo)`);
      if (!soloSimulacion) batch.update(doc.ref, { grupoDirigido: null });
      limpiados++;
    }
  }

  // Aviso de puestos declarados como directores que no tienen usuario en Firestore.
  const faltantes = [...gradoPorSlot.keys()].filter((s) => !slotsEncontrados.has(s));
  if (faltantes.length > 0) {
    console.warn('\n⚠ Puestos de director sin usuario en Firestore (nadie tendrá acceso a esos grupos):');
    for (const s of faltantes) console.warn(`  ${s} -> dirige ${gradoPorSlot.get(s)}`);
  }

  if (soloSimulacion) {
    console.log(`\n[--dry-run] Sin cambios. Asignaría ${asignados} y limpiaría ${limpiados}.`);
    return;
  }
  if (asignados + limpiados === 0) {
    console.log('\nNada que cambiar: todos los directores ya están al día.');
    return;
  }
  await batch.commit();
  console.log(`\nListo. ${asignados} asignados, ${limpiados} limpiados.`);
  console.log('Recuerda borrar serviceAccountKey.json.');
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
