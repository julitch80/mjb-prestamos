/**
 * Reglas de la evaluación de centros de interés (encuesta anónima).
 * Ejecutar con: npm run test:reglas (emulador local de Firestore).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { addDoc, collection, doc, getDoc, getDocs, setDoc, serverTimestamp } from 'firebase/firestore';

const D = 'iemanueljbetancur.edu.co';
const PROFE = `profe@${D}`;
const COORD = `coord@${D}`;
const SUPER = `admin@${D}`;
const YURI = `yuri@${D}`;

let env: RulesTestEnvironment;
const ctx = (email: string) => env.authenticatedContext(email, { email, email_verified: true }).firestore();
const anon = () => env.unauthenticatedContext().firestore();

const docA = (extra: Record<string, unknown> = {}) => ({
  instrumento: 'A', grado: '1', sede: 'principal',
  respuestas: { p1: 'feliz', p2: 'neutral', p3: 'triste', p4: 'feliz' }, creado: serverTimestamp(), ...extra,
});
const docB = (extra: Record<string, unknown> = {}) => ({
  instrumento: 'B', grado: '7', sede: null,
  respuestas: Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`p${i + 1}`, 'si'])), creado: serverTimestamp(), ...extra,
});

beforeAll(async () => {
  const rules = readFileSync(path.resolve(__dirname, '..', 'firestore.rules'), 'utf8');
  env = await initializeTestEnvironment({ projectId: 'demo-mjb', firestore: { rules, host: '127.0.0.1', port: 8080 } });
});
afterAll(async () => env?.cleanup());

async function sembrar(abierta: boolean | null) {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (c) => {
    const db = c.firestore();
    for (const [email, role] of [[PROFE, 'docente'], [COORD, 'coordinador'], [SUPER, 'superusuario'], [YURI, 'docente']] as const) {
      await setDoc(doc(db, 'users', email), { email, role, active: true, displayName: email });
    }
    if (abierta !== null) await setDoc(doc(db, 'evaluacionCIConfig', 'estado'), { abierta });
    await setDoc(doc(db, 'evaluacionCIConfig', 'lectores'), { correos: [YURI] });
  });
}

describe('evaluacionCI con la encuesta abierta', () => {
  beforeEach(() => sembrar(true));
  it('un anónimo crea A y B válidos', async () => {
    await assertSucceeds(addDoc(collection(anon(), 'evaluacionCI'), docA({ comentario: 'pintar' })));
    await assertSucceeds(addDoc(collection(anon(), 'evaluacionCI'), docB()));
  });
  it('rechaza valores fuera de dominio, claves extra o faltantes', async () => {
    const c = collection(anon(), 'evaluacionCI');
    await assertFails(addDoc(c, docA({ respuestas: { p1: 'si', p2: 'neutral', p3: 'triste', p4: 'feliz' } })));
    await assertFails(addDoc(c, docA({ respuestas: { p1: 'feliz', p2: 'neutral', p3: 'triste' } })));
    await assertFails(addDoc(c, docA({ nombre: 'Ana' })));
    await assertFails(addDoc(c, docB({ grado: '2' })));       // B no admite grados de A
    await assertFails(addDoc(c, docA({ grado: '5' })));       // A no admite grados de B
    await assertFails(addDoc(c, docA({ sede: 'otra' })));
  });
  it('rechaza comentario largo, comentario en B y creado manipulado', async () => {
    const c = collection(anon(), 'evaluacionCI');
    await assertFails(addDoc(c, docA({ comentario: 'x'.repeat(101) })));
    await assertFails(addDoc(c, docB({ comentario: 'hola' })));
    await assertFails(addDoc(c, docA({ creado: new Date('2020-01-01') })));
  });
  it('nadie actualiza ni borra (ni el superusuario)', async () => {
    const r = await addDoc(collection(anon(), 'evaluacionCI'), docA());
    await assertFails(setDoc(doc(ctx(SUPER), 'evaluacionCI', r.id), { x: 1 }));
  });
  it('lectura: anónimo y docente no; coordinador, superusuario y lector sí', async () => {
    await assertFails(getDocs(collection(anon(), 'evaluacionCI')));
    await assertFails(getDocs(collection(ctx(PROFE), 'evaluacionCI')));
    await assertSucceeds(getDocs(collection(ctx(COORD), 'evaluacionCI')));
    await assertSucceeds(getDocs(collection(ctx(SUPER), 'evaluacionCI')));
    await assertSucceeds(getDocs(collection(ctx(YURI), 'evaluacionCI')));
  });
});

describe('evaluacionCI cerrada o sin configurar', () => {
  it('cerrada: no se crea', async () => {
    await sembrar(false);
    await assertFails(addDoc(collection(anon(), 'evaluacionCI'), docA()));
  });
  it('sin documento de estado: no se crea', async () => {
    await sembrar(null);
    await assertFails(addDoc(collection(anon(), 'evaluacionCI'), docA()));
  });
});

describe('evaluacionCIConfig', () => {
  beforeEach(() => sembrar(true));
  it('estado: lo lee cualquiera; solo el superusuario escribe', async () => {
    await assertSucceeds(getDoc(doc(anon(), 'evaluacionCIConfig', 'estado')));
    await assertFails(setDoc(doc(ctx(COORD), 'evaluacionCIConfig', 'estado'), { abierta: false }));
    await assertSucceeds(setDoc(doc(ctx(SUPER), 'evaluacionCIConfig', 'estado'), { abierta: false }));
  });
  it('lectores: solo el superusuario escribe', async () => {
    await assertFails(setDoc(doc(ctx(YURI), 'evaluacionCIConfig', 'lectores'), { correos: [YURI, PROFE] }));
    await assertSucceeds(setDoc(doc(ctx(SUPER), 'evaluacionCIConfig', 'lectores'), { correos: [YURI] }));
  });
});
