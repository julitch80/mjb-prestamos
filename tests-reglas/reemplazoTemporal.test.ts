/**
 * Reglas de Firestore del reemplazo temporal (docs/reemplazo-temporal).
 * Ejecutar con: npm run test:reglas (emulador local, nunca produccion).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const D = 'iemanueljbetancur.edu.co';
const TITULAR = `titular@${D}`;
const REEMPLAZO = `reemplazo@${D}`;
const OTRO = `otro@${D}`;
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
    await setDoc(doc(db, 'users', TITULAR), {
      email: TITULAR, role: 'docente', active: true, displayName: 'T', slotId: null,
      slotEnPausa: 'slot_x', soloLectura: true, soloLecturaHasta: '2026-12-01',
    });
    await setDoc(doc(db, 'users', REEMPLAZO), { email: REEMPLAZO, role: 'docente', active: true, displayName: 'R', slotId: 'slot_x' });
    await setDoc(doc(db, 'users', OTRO), { email: OTRO, role: 'docente', active: true, displayName: 'O' });
    await setDoc(doc(db, 'users', SUPER), { email: SUPER, role: 'superusuario', active: true, displayName: 'S' });
    await setDoc(doc(db, 'reemplazosTemporales', 'r1'), { titularEmail: TITULAR, reemplazoEmail: REEMPLAZO, estado: 'activo' });
  });
});

const pref = (email: string) => doc(ctx(email), 'notifPreferencias', email);

describe('solo lectura del titular', () => {
  it('el titular en solo lectura NO puede escribir pero si leer', async () => {
    await assertFails(setDoc(pref(TITULAR), { chat: true }));
    await assertSucceeds(getDoc(doc(ctx(TITULAR), 'users', TITULAR)));
  });
  it('un usuario normal y el reemplazo si escriben', async () => {
    await assertSucceeds(setDoc(pref(OTRO), { chat: true }));
    await assertSucceeds(setDoc(pref(REEMPLAZO), { chat: true }));
  });
  it('un usuario sin documento en users no rompe la regla (simplemente no escribe)', async () => {
    const x = `fantasma@${D}`;
    await assertFails(setDoc(doc(ctx(x), 'notifPreferencias', x), { chat: true }));
  });
});

describe('reemplazosTemporales', () => {
  it('ningun cliente escribe, ni el superusuario', async () => {
    await assertFails(setDoc(doc(ctx(SUPER), 'reemplazosTemporales', 'r2'), { titularEmail: TITULAR }));
    await assertFails(setDoc(doc(ctx(TITULAR), 'reemplazosTemporales', 'r1'), { estado: 'terminado' }));
  });
  it('leen el superusuario y los dos involucrados, no un tercero', async () => {
    await assertSucceeds(getDoc(doc(ctx(SUPER), 'reemplazosTemporales', 'r1')));
    await assertSucceeds(getDoc(doc(ctx(TITULAR), 'reemplazosTemporales', 'r1')));
    await assertSucceeds(getDoc(doc(ctx(REEMPLAZO), 'reemplazosTemporales', 'r1')));
    await assertFails(getDoc(doc(ctx(OTRO), 'reemplazosTemporales', 'r1')));
  });
});
