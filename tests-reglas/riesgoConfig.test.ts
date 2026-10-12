/**
 * Reglas de riesgoConfig (visibilidad temporal de brigadas): lee cualquier activo; solo el
 * superusuario escribe. Ejecutar con: npm run test:reglas (emulador local).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const D = 'iemanueljbetancur.edu.co';
const PROFE = `profe@${D}`;
const INACTIVO = `baja@${D}`;
const SUPER = `admin@${D}`;

let env: RulesTestEnvironment;
const ctx = (email: string) => env.authenticatedContext(email, { email, email_verified: true }).firestore();

beforeAll(async () => {
  const rules = readFileSync(path.resolve(__dirname, '..', 'firestore.rules'), 'utf8');
  env = await initializeTestEnvironment({ projectId: 'demo-mjb', firestore: { rules, host: '127.0.0.1', port: 8080 } });
});
afterAll(async () => env?.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (c) => {
    const db = c.firestore();
    await setDoc(doc(db, 'users', PROFE), { email: PROFE, role: 'docente', active: true, displayName: 'p' });
    await setDoc(doc(db, 'users', INACTIVO), { email: INACTIVO, role: 'docente', active: false, displayName: 'b' });
    await setDoc(doc(db, 'users', SUPER), { email: SUPER, role: 'superusuario', active: true, displayName: 's' });
    await setDoc(doc(db, 'riesgoConfig', 'visibilidad'), { brigadasPublicas: false });
  });
});

describe('riesgoConfig/visibilidad', () => {
  it('un usuario activo lee', async () => {
    await assertSucceeds(getDoc(doc(ctx(PROFE), 'riesgoConfig', 'visibilidad')));
  });
  it('un usuario inactivo no lee', async () => {
    await assertFails(getDoc(doc(ctx(INACTIVO), 'riesgoConfig', 'visibilidad')));
  });
  it('un no-superusuario no escribe', async () => {
    await assertFails(setDoc(doc(ctx(PROFE), 'riesgoConfig', 'visibilidad'), { brigadasPublicas: true }));
  });
  it('el superusuario escribe', async () => {
    await assertSucceeds(setDoc(doc(ctx(SUPER), 'riesgoConfig', 'visibilidad'), { brigadasPublicas: true }));
  });
});
