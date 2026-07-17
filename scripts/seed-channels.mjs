// Seed de canales base del chat interno (Etapa 4 — Fase 3, + segmentos y grupos).
// Crea en la colección `channels` de Firestore:
//   - channels/general       → tipo 'general', "Sala de profesores" (todos)
//   - channels/coordinacion  → tipo 'rol', allowedRoles ['coordinador']
//   - channels/directivos    → tipo 'rol', allowedRoles ['coordinador','rectora']
//   - channels/seg__*        → tipo 'segmento', membresía automática por
//                               sede y/o jornada del usuario (ver firestore.rules)
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

  const segmento = (id, name, sede, jornada) => ({
    id,
    data: {
      type: 'segmento',
      name,
      sede,
      jornada,
      createdBy: 'seed',
      createdAt: FieldValue.serverTimestamp(),
    },
  });

  const canales = [
    {
      id: 'general',
      data: {
        type: 'general',
        name: 'Sala de profesores',
        createdBy: 'seed',
        createdAt: FieldValue.serverTimestamp(),
      },
    },
    {
      id: 'coordinacion',
      data: {
        type: 'rol',
        name: 'Coordinación',
        allowedRoles: ['coordinador'],
        createdBy: 'seed',
        createdAt: FieldValue.serverTimestamp(),
      },
    },
    {
      id: 'directivos',
      data: {
        type: 'rol',
        name: 'Directivos',
        allowedRoles: ['coordinador', 'rectora'],
        createdBy: 'seed',
        createdAt: FieldValue.serverTimestamp(),
      },
    },
    segmento('seg__central', 'Docentes — Sede Central', 'central', null),
    segmento('seg__gustavo_rodas', 'Docentes — Gustavo Rodas', 'gustavo_rodas', null),
    segmento('seg__la_finquita', 'Docentes — La Finquita', 'la_finquita', null),
    segmento('seg__central__manana', 'Central — Mañana', 'central', 'manana'),
    segmento('seg__central__tarde', 'Central — Tarde', 'central', 'tarde'),
    segmento('seg__gustavo_rodas__manana', 'Gustavo Rodas — Mañana', 'gustavo_rodas', 'manana'),
    segmento('seg__gustavo_rodas__tarde', 'Gustavo Rodas — Tarde', 'gustavo_rodas', 'tarde'),
    segmento('seg__la_finquita__manana', 'La Finquita — Mañana', 'la_finquita', 'manana'),
    segmento('seg__la_finquita__tarde', 'La Finquita — Tarde', 'la_finquita', 'tarde'),
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
