/**
 * Reglas de Firestore de la integracion con Classroom:
 * classroomVinculos, classroomTareas, classroomPendientes (solo escriben las funciones).
 * Ejecutar con: npm run test:reglas (emulador local, nunca produccion).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';

const D = 'iemanueljbetancur.edu.co';
const PROFE = `profe@${D}`;
const OTRO = `otro@${D}`;
const COORD_M = `coordm@${D}`;
const COORD_T = `coordt@${D}`;
const RECTORA = `rectora@${D}`;
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
    const us: [string, string, string?][] = [
      [PROFE, 'docente'], [OTRO, 'docente'], [COORD_M, 'coordinador', 'manana'],
      [COORD_T, 'coordinador', 'tarde'], [RECTORA, 'rectora'], [SUPER, 'superusuario'],
    ];
    for (const [email, role, jornada] of us) {
      await setDoc(doc(db, 'users', email), { email, role, active: true, displayName: email, ...(jornada ? { jornada } : {}) });
    }
    await setDoc(doc(db, 'classroomVinculos', PROFE), { mapa: {} });
    await setDoc(doc(db, 'classroomTareas', 't1'), { profesor: PROFE, origen: 'mjb' });
    await setDoc(doc(db, 'classroomPendientes', 'cw1'), { profesor: PROFE, jornada: 'manana', grupo: '10.1' });
  });
});

const COLS: [string, string][] = [['classroomVinculos', PROFE], ['classroomTareas', 't1'], ['classroomPendientes', 'cw1']];

describe('classroom: lectura', () => {
  it('el profesor dueno lee lo suyo; otro profesor no', async () => {
    for (const [c, id] of COLS) {
      await assertSucceeds(getDoc(doc(ctx(PROFE), c, id)));
      await assertFails(getDoc(doc(ctx(OTRO), c, id)));
    }
  });
  it('el superusuario lee los tres', async () => {
    for (const [c, id] of COLS) await assertSucceeds(getDoc(doc(ctx(SUPER), c, id)));
  });
  it('pendientes: coordinador de la misma jornada y rectora leen; otra jornada no', async () => {
    await assertSucceeds(getDoc(doc(ctx(COORD_M), 'classroomPendientes', 'cw1')));
    await assertFails(getDoc(doc(ctx(COORD_T), 'classroomPendientes', 'cw1')));
    await assertSucceeds(getDoc(doc(ctx(RECTORA), 'classroomPendientes', 'cw1')));
  });
  it('pendientes: consulta list por profesor (y estado) funciona al dueno y falla sin filtro', async () => {
    const col = (email: string) => collection(ctx(email), 'classroomPendientes');
    await assertSucceeds(getDocs(query(col(PROFE), where('profesor', '==', PROFE))));
    await assertSucceeds(getDocs(query(col(PROFE), where('profesor', '==', PROFE), where('estado', '==', 'pendiente'))));
    await assertFails(getDocs(col(PROFE)));
    await assertFails(getDocs(query(col(OTRO), where('profesor', '==', PROFE))));
  });
  it('pendientes: coordinador lista por su jornada y estado; otra jornada y sin filtro fallan; rectora lista sin jornada', async () => {
    const col = (email: string) => collection(ctx(email), 'classroomPendientes');
    const pend = where('estado', '==', 'pendiente');
    await assertSucceeds(getDocs(query(col(COORD_M), where('jornada', '==', 'manana'), pend)));
    await assertFails(getDocs(query(col(COORD_M), where('jornada', '==', 'tarde'), pend)));
    await assertFails(getDocs(query(col(COORD_T), where('jornada', '==', 'manana'), pend)));
    await assertFails(getDocs(query(col(COORD_M), pend)));
    await assertSucceeds(getDocs(query(col(RECTORA), pend)));
    await assertSucceeds(getDocs(query(col(SUPER), pend)));
    await assertFails(getDocs(query(col(PROFE), pend)));
  });
  it('el coordinador no lee vinculos ni tareas ajenos', async () => {
    await assertFails(getDoc(doc(ctx(COORD_M), 'classroomVinculos', PROFE)));
    await assertFails(getDoc(doc(ctx(COORD_M), 'classroomTareas', 't1')));
  });
  it('sin sesion: nada', async () => {
    const anon = env.unauthenticatedContext().firestore();
    for (const [c, id] of COLS) await assertFails(getDoc(doc(anon, c, id)));
  });
});

describe('classroom: escritura (nadie desde el cliente)', () => {
  it('ni dueno, ni coordinador, ni superusuario, ni anonimo crean/editan/borran', async () => {
    const anon = env.unauthenticatedContext().firestore();
    for (const db of [ctx(PROFE), ctx(COORD_M), ctx(RECTORA), ctx(SUPER), anon]) {
      for (const [c, id] of COLS) {
        await assertFails(setDoc(doc(db, c, id), { profesor: PROFE, jornada: 'manana' }));
        await assertFails(setDoc(doc(db, c, `nuevo_${id}`), { profesor: PROFE, jornada: 'manana' }));
        await assertFails(updateDoc(doc(db, c, id), { grupo: 'x' }));
        await assertFails(deleteDoc(doc(db, c, id)));
      }
    }
  });
});

describe('classroomTareas: consulta de lista del profesor', () => {
  it('el profesor lista sus tareas filtrando por su correo', async () => {
    await assertSucceeds(getDocs(query(collection(ctx(PROFE), 'classroomTareas'), where('profesor', '==', PROFE))));
  });
  it('sin filtro, la lista se rechaza', async () => {
    await assertFails(getDocs(collection(ctx(PROFE), 'classroomTareas')));
  });
});

