// Seed de la colección `users` en Firestore a partir de un CSV local.
// Ver scripts/README-seed.md para instrucciones completas.
//
// Uso:
//   node scripts/seed-users.mjs docentes.csv
//
// El CSV debe tener encabezado: email,displayName,role
// Opcionalmente una 4.ª columna: slotId (id interno del docente en la app,
// ver src/data/maestros.ts — habilita el reemplazo instantáneo de docente).
// Opcionalmente una 5.ª columna: sede (uno de: central, gustavo_rojas,
// la_finquita — Fase A, arquitectura multi-sede). Default: central.
// Opcionalmente una 6.ª columna: jornada (uno de: manana, tarde, ambas —
// usada para la segmentación automática del chat interno). Default: manana.
// Ejemplo:
//   email,displayName,role,slotId,sede,jornada
//   julian.medina@iemanueljbetancur.edu.co,Julián David Medina Tamayo,superusuario,julian,central,manana
//   janneth.ocampo@iemanueljbetancur.edu.co,Janneth Astrid Ocampo Carvajal,coordinador,,central,manana
//   johana.cano@iemanueljbetancur.edu.co,Leidy Johana Cano Ruiz,docente,johana,central,manana

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

const csvPath = process.argv[2] ? join(process.cwd(), process.argv[2]) : join(repoRoot, 'docentes.csv');
const keyPath = join(repoRoot, 'serviceAccountKey.json');

if (!existsSync(keyPath)) {
  console.error('No se encontró serviceAccountKey.json en la raíz del repo.');
  console.error('Descárgalo desde: Consola Firebase → Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada.');
  process.exit(1);
}
if (!existsSync(csvPath)) {
  console.error(`No se encontró el CSV en: ${csvPath}`);
  console.error('Uso: node scripts/seed-users.mjs [ruta/al/docentes.csv]');
  process.exit(1);
}

function parseCSV(texto) {
  const lineas = texto.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const encabezado = lineas[0].split(',').map(h => h.trim());
  const idxEmail = encabezado.indexOf('email');
  const idxNombre = encabezado.indexOf('displayName');
  const idxRole = encabezado.indexOf('role');
  const idxSlot = encabezado.indexOf('slotId'); // opcional
  const idxSede = encabezado.indexOf('sede'); // opcional, 5.ª columna
  const idxJornada = encabezado.indexOf('jornada'); // opcional, 6.ª columna
  if (idxEmail === -1 || idxNombre === -1 || idxRole === -1) {
    throw new Error('El CSV debe tener las columnas: email,displayName,role');
  }
  return lineas.slice(1).map(linea => {
    const cols = linea.split(',').map(c => c.trim());
    const slotId = idxSlot !== -1 ? (cols[idxSlot] || null) : null;
    const sede = idxSede !== -1 ? (cols[idxSede] || 'central') : 'central';
    const jornada = idxJornada !== -1 ? (cols[idxJornada] || 'manana') : 'manana';
    return { email: cols[idxEmail].toLowerCase(), displayName: cols[idxNombre], role: cols[idxRole], slotId, sede, jornada };
  });
}

async function main() {
  const serviceAccount = JSON.parse(readFileSync(keyPath, 'utf-8'));
  initializeApp({ credential: cert(serviceAccount) });
  const db = getFirestore();

  const filas = parseCSV(readFileSync(csvPath, 'utf-8'));
  if (filas.length === 0) {
    console.log('El CSV no tiene filas de datos.');
    return;
  }

  console.log(`Sembrando ${filas.length} usuarios en Firestore (colección "users")...`);

  const batchSize = 400; // límite de Firestore por batch es 500
  for (let i = 0; i < filas.length; i += batchSize) {
    const lote = filas.slice(i, i + batchSize);
    const batch = db.batch();
    for (const fila of lote) {
      if (!fila.email || !fila.email.includes('@')) {
        console.warn(`  Fila omitida (email inválido): ${JSON.stringify(fila)}`);
        continue;
      }
      const ref = db.doc(`users/${fila.email}`);
      batch.set(ref, {
        displayName: fila.displayName,
        role: fila.role,
        active: true,
        slotId: fila.slotId || null,
        sede: fila.sede || 'central',
        jornada: fila.jornada || 'manana',
        createdAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      console.log(`  ${fila.email} -> ${fila.role}${fila.slotId ? ` (slot: ${fila.slotId})` : ''} [sede: ${fila.sede || 'central'}, jornada: ${fila.jornada || 'manana'}]`);
    }
    await batch.commit();
  }

  console.log('Listo. Recuerda borrar serviceAccountKey.json cuando termines.');
}

main().catch(err => {
  console.error('Error al sembrar usuarios:', err);
  process.exit(1);
});
