/**
 * Reglas de calendarioAcademico/{anio} y su subcoleccion `cambios`.
 * Ejecutar con: npm run test:reglas (emulador local, nunca produccion).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { addDoc, collection, deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

const D = 'iemanueljbetancur.edu.co';
const COORD = `coord@${D}`;
const RECTORA = `rectora@${D}`;
const SUPER = `admin@${D}`;
const DOCENTE = `docente@${D}`;
const INACTIVO = `baja@${D}`;

let env: RulesTestEnvironment;
const ctx = (email: string) => env.authenticatedContext(email, { email, email_verified: true }).firestore();
const ctxSupl = (email: string) =>
  env.authenticatedContext(email, { email, email_verified: true, suplantadoPor: SUPER }).firestore();
const cuerpo = (email: string) => ({ eventos: { a: { id: 'a', titulo: 'x', desde: '2026-10-28' } }, actualizado: new Date().toISOString(), porCorreo: email });

beforeAll(async () => {
  const rules = readFileSync(path.resolve(__dirname, '..', 'firestore.rules'), 'utf8');
  env = await initializeTestEnvironment({ projectId: 'demo-mjb', firestore: { rules, host: '127.0.0.1', port: 8080 } });
});
afterAll(async () => env?.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (c) => {
    const db = c.firestore();
    for (const [email, role, active] of [[COORD, 'coordinador', true], [RECTORA, 'rectora', true], [SUPER, 'superusuario', true],
      [DOCENTE, 'docente', true], [INACTIVO, 'coordinador', false]] as const) {
      await setDoc(doc(db, 'users', email), { email, role, active, displayName: email });
    }
    await setDoc(doc(db, 'calendarioAcademico', '2026'), cuerpo(SUPER));
  });
});

describe('calendarioAcademico', () => {
  it('cualquier usuario activo lee; un inactivo no', async () => {
    await assertSucceeds(getDoc(doc(ctx(DOCENTE), 'calendarioAcademico', '2026')));
    await assertFails(getDoc(doc(ctx(INACTIVO), 'calendarioAcademico', '2026')));
  });
  it('coordinador, rectora y superusuario escriben', async () => {
    for (const u of [COORD, RECTORA, SUPER]) {
      await assertSucceeds(setDoc(doc(ctx(u), 'calendarioAcademico', '2026'), cuerpo(u)));
    }
  });
  it('un docente no escribe', async () => {
    await assertFails(setDoc(doc(ctx(DOCENTE), 'calendarioAcademico', '2026'), cuerpo(DOCENTE)));
  });
  it('no se puede firmar a nombre de otro ni agregar campos', async () => {
    await assertFails(setDoc(doc(ctx(COORD), 'calendarioAcademico', '2026'), cuerpo(RECTORA)));
    await assertFails(updateDoc(doc(ctx(COORD), 'calendarioAcademico', '2026'), { extra: 1 }));
  });
  it('suplantacion: solo lectura', async () => {
    await assertFails(setDoc(doc(ctxSupl(COORD), 'calendarioAcademico', '2026'), cuerpo(COORD)));
  });
  it('nadie borra', async () => {
    await assertFails(deleteDoc(doc(ctx(SUPER), 'calendarioAcademico', '2026')));
  });
});

describe('calendarioAcademico/cambios', () => {
  const reg = (u: string) => ({ por: u, cuando: new Date().toISOString(), eventoId: 'a', antes: null, despues: null, motivo: 'x' });
  it('coordinador agrega; docente no; nadie edita ni borra', async () => {
    await assertSucceeds(addDoc(collection(ctx(COORD), 'calendarioAcademico', '2026', 'cambios'), reg(COORD)));
    await assertFails(addDoc(collection(ctx(DOCENTE), 'calendarioAcademico', '2026', 'cambios'), reg(DOCENTE)));
    await assertFails(addDoc(collection(ctx(COORD), 'calendarioAcademico', '2026', 'cambios'), reg(RECTORA)));
    const ref = await addDoc(collection(ctx(COORD), 'calendarioAcademico', '2026', 'cambios'), reg(COORD));
    await assertFails(updateDoc(ref, { motivo: 'y' }));
    await assertFails(deleteDoc(ref));
  });
  it('un usuario activo lee el registro', async () => {
    await assertSucceeds(getDoc(doc(ctx(DOCENTE), 'calendarioAcademico', '2026', 'cambios', 'z')));
  });
});
