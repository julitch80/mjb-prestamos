/**
 * Reglas de Firestore para `sedeDatos/{sedeId}` (formulario «Datos de la sede»).
 * Ejecutar con: npm run test:reglas (emulador local, nunca produccion).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';

const D = 'iemanueljbetancur.edu.co';
const JANNETH = `janneth.ocampo@${D}`;
const JUAN = `juan.salazar@${D}`;
const DOCENTE = `docente@${D}`;
const SUPER = `admin@${D}`;

let env: RulesTestEnvironment;
const ctx = (email: string) => env.authenticatedContext(email, { email, email_verified: true }).firestore();
const ctxSupl = (email: string) =>
  env.authenticatedContext(email, { email, email_verified: true, suplantadoPor: SUPER }).firestore();

const cuerpo = (sede: string, email: string, extra: Record<string, unknown> = {}) => ({
  sede, respuestas: {}, archivos: [], actualizadoPor: email, actualizadoEn: serverTimestamp(), ...extra,
});

beforeAll(async () => {
  const rules = readFileSync(path.resolve(__dirname, '..', 'firestore.rules'), 'utf8');
  env = await initializeTestEnvironment({ projectId: 'demo-mjb', firestore: { rules, host: '127.0.0.1', port: 8080 } });
});
afterAll(async () => env?.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (c) => {
    const db = c.firestore();
    for (const [email, role] of [[JANNETH, 'coordinador'], [JUAN, 'coordinador'], [DOCENTE, 'docente'], [SUPER, 'superusuario']]) {
      await setDoc(doc(db, 'users', email), { email, role, active: true, displayName: email });
    }
    await setDoc(doc(db, 'asistenciaConfig', 'autoridadSede'), {
      mapa: { central: [JANNETH, JUAN], gustavo_rodas: [JANNETH], la_finquita: [JUAN] },
    });
  });
});

describe('sedeDatos', () => {
  it('cada coordinador escribe y lee SOLO su sede', async () => {
    await assertSucceeds(setDoc(doc(ctx(JANNETH), 'sedeDatos', 'gustavo_rodas'), cuerpo('gustavo_rodas', JANNETH)));
    await assertSucceeds(getDoc(doc(ctx(JANNETH), 'sedeDatos', 'gustavo_rodas')));
    await assertFails(setDoc(doc(ctx(JANNETH), 'sedeDatos', 'la_finquita'), cuerpo('la_finquita', JANNETH)));
    await assertSucceeds(setDoc(doc(ctx(JUAN), 'sedeDatos', 'la_finquita'), cuerpo('la_finquita', JUAN)));
    await assertFails(getDoc(doc(ctx(JUAN), 'sedeDatos', 'gustavo_rodas')));
  });
  it('el superusuario escribe y lee ambas; el docente ninguna', async () => {
    await assertSucceeds(setDoc(doc(ctx(SUPER), 'sedeDatos', 'la_finquita'), cuerpo('la_finquita', SUPER)));
    await assertSucceeds(getDoc(doc(ctx(SUPER), 'sedeDatos', 'gustavo_rodas')));
    await assertFails(setDoc(doc(ctx(DOCENTE), 'sedeDatos', 'la_finquita'), cuerpo('la_finquita', DOCENTE)));
    await assertFails(getDoc(doc(ctx(DOCENTE), 'sedeDatos', 'la_finquita')));
  });
  it('modo prueba: prueba_{sede} es solo del superusuario', async () => {
    for (const id of ['prueba_gustavo_rodas', 'prueba_la_finquita']) {
      await assertSucceeds(setDoc(doc(ctx(SUPER), 'sedeDatos', id), cuerpo(id, SUPER)));
      await assertSucceeds(getDoc(doc(ctx(SUPER), 'sedeDatos', id)));
      await assertFails(getDoc(doc(ctx(JANNETH), 'sedeDatos', id)));
      await assertFails(getDoc(doc(ctx(JUAN), 'sedeDatos', id)));
      await assertFails(setDoc(doc(ctx(JANNETH), 'sedeDatos', id), cuerpo(id, JANNETH)));
    }
    await assertFails(setDoc(doc(ctx(SUPER), 'sedeDatos', 'prueba_central'), cuerpo('prueba_central', SUPER)));
  });
  it('sin suplantacion: la sesion suplantada solo lee', async () => {
    await assertFails(setDoc(doc(ctxSupl(JANNETH), 'sedeDatos', 'gustavo_rodas'), cuerpo('gustavo_rodas', JANNETH)));
    await assertSucceeds(getDoc(doc(ctxSupl(JANNETH), 'sedeDatos', 'gustavo_rodas')));
  });
  it('rechaza sedes inventadas, campos extra y autoria falsa', async () => {
    await assertFails(setDoc(doc(ctx(SUPER), 'sedeDatos', 'central'), cuerpo('central', SUPER)));
    await assertFails(setDoc(doc(ctx(JANNETH), 'sedeDatos', 'gustavo_rodas'), cuerpo('gustavo_rodas', JANNETH, { extra: 1 })));
    await assertFails(setDoc(doc(ctx(JANNETH), 'sedeDatos', 'gustavo_rodas'), cuerpo('gustavo_rodas', JUAN)));
  });
  it('los archivos no se pueden quitar, la fecha de envio no se falsea y nada se borra', async () => {
    const ref = (e: string) => doc(ctx(e), 'sedeDatos', 'gustavo_rodas');
    const arch = { id: 'f1', etiqueta: 'A1' };
    await assertSucceeds(setDoc(ref(JANNETH), cuerpo('gustavo_rodas', JANNETH, { archivos: [arch] })));
    await assertFails(setDoc(ref(JANNETH), cuerpo('gustavo_rodas', JANNETH, { archivos: [] })));
    await assertSucceeds(setDoc(ref(JANNETH), cuerpo('gustavo_rodas', JANNETH, { archivos: [arch, { id: 'f2', etiqueta: 'A2' }] })));
    await assertFails(setDoc(ref(JANNETH), cuerpo('gustavo_rodas', JANNETH, {
      archivos: [arch, { id: 'f2', etiqueta: 'A2' }], enviadoEn: new Date('2020-01-01'),
    })));
    await assertSucceeds(setDoc(ref(JANNETH), cuerpo('gustavo_rodas', JANNETH, {
      archivos: [arch, { id: 'f2', etiqueta: 'A2' }], enviadoEn: serverTimestamp(), enviosCount: 1,
    })));
    await assertFails(deleteDoc(ref(SUPER)));
  });
});
