/**
 * Reglas de Firestore de Simulacros: lectura para usuarios activos; nadie escribe desde el
 * cliente (solo la callable simulacroCambiar con admin SDK).
 * Ejecutar con: npm run test:reglas (emulador local, nunca produccion).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore';

const D = 'iemanueljbetancur.edu.co';
const PROFE = `profe@${D}`;
const INACTIVO = `baja@${D}`;
const SUPER = `admin@${D}`;
const COORD_T = `coordt@${D}`;

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
    await setDoc(doc(db, 'users', COORD_T), { email: COORD_T, role: 'coordinador', jornada: 'tarde', slotId: 'coord_tarde', active: true, displayName: 'c' });
    await setDoc(doc(db, 'simulacros', 's1'), { titulo: 'x', estado: 'publicado', editores: { manana: ['julian'], tarde: ['hugo'] } });
    await setDoc(doc(db, 'simulacros', 's1', 'cambios', 'c1'), { por: SUPER, tipo: 'hora' });
  });
});

describe('simulacros: lectura', () => {
  it('usuario activo lee simulacro y cambios', async () => {
    await assertSucceeds(getDoc(doc(ctx(PROFE), 'simulacros', 's1')));
    await assertSucceeds(getDocs(collection(ctx(PROFE), 'simulacros', 's1', 'cambios')));
  });
  it('sin sesion no lee', async () => {
    const anon = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anon, 'simulacros', 's1')));
    await assertFails(getDocs(collection(anon, 'simulacros', 's1', 'cambios')));
  });
  it('usuario inactivo no lee', async () => {
    await assertFails(getDoc(doc(ctx(INACTIVO), 'simulacros', 's1')));
  });
});

describe('simulacros: escritura desde el cliente', () => {
  for (const [nombre, email] of [['docente', PROFE], ['coordinador editor', COORD_T], ['superusuario', SUPER]] as const) {
    it(`${nombre} no puede escribir`, async () => {
      const db = ctx(email);
      await assertFails(setDoc(doc(db, 'simulacros', 's2'), { titulo: 'n' }));
      await assertFails(updateDoc(doc(db, 'simulacros', 's1'), { estado: 'archivado' }));
      await assertFails(deleteDoc(doc(db, 'simulacros', 's1')));
      await assertFails(addDoc(collection(db, 'simulacros', 's1', 'cambios'), { por: email }));
      await assertFails(updateDoc(doc(db, 'simulacros', 's1', 'cambios', 'c1'), { tipo: 'x' }));
    });
  }
});
