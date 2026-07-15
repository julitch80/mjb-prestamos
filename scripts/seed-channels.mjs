// Seed de canales base del chat interno (Etapa 4 — Fase 3).
// Crea dos canales iniciales en la colección `channels` de Firestore:
//   - channels/general      → tipo 'general', "Sala de profesores" (todos)
//   - channels/coordinacion  → tipo 'rol', allowedRoles ['coordinador']
//
// Uso:
//   node scripts/seed-channels.mjs
//
// Requiere serviceAccountKey.json en la raíz del repo (igual que seed-users.mjs).

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const keyPath = join(repoRoot, 'serviceAccountKey.json');

if (!existsSync(keyPath)) {
  console.error('No se encontró serviceAccountKey.json en la raíz del repo.');
  console.error('Descárgalo desde: Consola Firebase → Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada.');
  process.exit(1);
}

async function main() {
  const serviceAccount = JSON.parse(readFileSync(keyPath, 'utf-8'));
  initializeApp({ credential: cert(serviceAccount) });
  const db = getFirestore();

  const canales = [
    {
      id: 'general',
      data: { type: 'general', name: 'Sala de profesores', createdAt: FieldValue.serverTimestamp() },
    },
    {
      id: 'coordinacion',
      data: {
        type: 'rol',
        name: 'Coordinación',
        allowedRoles: ['coordinador'],
        createdAt: FieldValue.serverTimestamp(),
      },
    },
  ];

  console.log('Sembrando canales base del chat...');
  for (const c of canales) {
    await db.doc(`channels/${c.id}`).set(c.data, { merge: true });
    console.log(`  channels/${c.id} -> ${c.data.type}${c.data.allowedRoles ? ' ' + JSON.stringify(c.data.allowedRoles) : ''}`);
  }

  console.log('Listo. Recuerda borrar serviceAccountKey.json cuando termines.');
}

main().catch((err) => {
  console.error('Error al sembrar canales:', err);
  process.exit(1);
});
