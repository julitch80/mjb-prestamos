/**
 * Reglas del plan de trabajo en casa. Ejecutar con: npm run test:reglas (emulador local).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { FieldPath, collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore';

const D = 'iemanueljbetancur.edu.co';
const COORD = `coord@${D}`;
const RECTORA = `rectora@${D}`;
const SUPER = `admin@${D}`;
const EQUIPO = `uai@${D}`;
const DOC1 = `doc1@${D}`;
const DOC2 = `doc2@${D}`;
const OTRO = `otro@${D}`;

let env: RulesTestEnvironment;
const ctx = (email: string) => env.authenticatedContext(email, { email, email_verified: true }).firestore();
const ctxSupl = (email: string) =>
  env.authenticatedContext(email, { email, email_verified: true, suplantadoPor: SUPER }).firestore();
const anon = () => env.unauthenticatedContext().firestore();

const asigDe = (correo: string, id: string) => ({
  asignaturaId: id, docenteId: 'x', docenteCorreo: correo, criteriosPromocion: 'c',
  seguimiento: {}, sustentacionEstado: 'sin_citar', actualizadoEn: 1,
});

const guiaDe = (resp: string, docs: string[]) => ({
  id: 'g1', asignaturaIds: ['mat', 'esp'], eje: 'e', responsableCorreo: resp, docentesCorreos: docs,
  vistosBuenos: {}, seguimiento: {}, sustentacionEstado: 'sin_citar', actualizadoEn: 1,
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
    for (const [email, role] of [[COORD, 'coordinador'], [RECTORA, 'rectora'], [SUPER, 'superusuario'],
      [EQUIPO, 'docente'], [DOC1, 'docente'], [DOC2, 'docente'], [OTRO, 'docente']] as const) {
      await setDoc(doc(db, 'users', email), { email, role, active: true, displayName: email });
    }
    await setDoc(doc(db, 'planCasaConfig', 'equipo'), { correos: [EQUIPO] });
    await setDoc(doc(db, 'planesCasa', 'p1'), { estudiante: 'x', docentesCorreos: [DOC1, DOC2] });
    await setDoc(doc(db, 'planesCasa', 'p1', 'reservado', 'motivo'), { texto: 'secreto' });
    await setDoc(doc(db, 'planesCasa', 'p1', 'asignaturas', 'mat'), asigDe(DOC1, 'mat'));
    await setDoc(doc(db, 'planesCasa', 'p1', 'asignaturas', 'esp'), asigDe(DOC2, 'esp'));
    await setDoc(doc(db, 'planesCasa', 'p1', 'guias', 'g1'), guiaDe(DOC1, [DOC1, DOC2]));
    await setDoc(doc(db, 'planesCasaPublico', 'tok123'), { primerNombre: 'Ana' });
  });
});

describe('planCasaConfig/equipo', () => {
  it('lo lee un usuario activo; solo el superusuario escribe', async () => {
    await assertSucceeds(getDoc(doc(ctx(DOC1), 'planCasaConfig', 'equipo')));
    await assertFails(setDoc(doc(ctx(COORD), 'planCasaConfig', 'equipo'), { correos: [COORD] }));
    await assertFails(setDoc(doc(ctx(EQUIPO), 'planCasaConfig', 'equipo'), { correos: [EQUIPO] }));
    await assertSucceeds(setDoc(doc(ctx(SUPER), 'planCasaConfig', 'equipo'), { correos: [EQUIPO, OTRO] }));
    await assertFails(setDoc(doc(ctxSupl(SUPER), 'planCasaConfig', 'equipo'), { correos: [] }));
  });
});

describe('planesCasa', () => {
  it('lee equipo, coordinador, rectora, superusuario y docente del plan; no un ajeno', async () => {
    for (const u of [EQUIPO, COORD, RECTORA, SUPER, DOC1]) await assertSucceeds(getDoc(doc(ctx(u), 'planesCasa', 'p1')));
    await assertFails(getDoc(doc(ctx(OTRO), 'planesCasa', 'p1')));
  });
  it('escriben equipo, coordinador y superusuario; no docente ni rectora ni suplantacion', async () => {
    for (const u of [EQUIPO, COORD, SUPER]) await assertSucceeds(setDoc(doc(ctx(u), 'planesCasa', 'p2'), { docentesCorreos: [] }));
    await assertFails(setDoc(doc(ctx(DOC1), 'planesCasa', 'p3'), { docentesCorreos: [] }));
    await assertFails(setDoc(doc(ctx(RECTORA), 'planesCasa', 'p3'), { docentesCorreos: [] }));
    await assertFails(setDoc(doc(ctxSupl(SUPER), 'planesCasa', 'p3'), { docentesCorreos: [] }));
  });
});

describe('planesCasa/reservado', () => {
  it('el docente NO lee el motivo; equipo, coordinador, rectora y super si', async () => {
    await assertFails(getDoc(doc(ctx(DOC1), 'planesCasa', 'p1', 'reservado', 'motivo')));
    await assertFails(getDoc(doc(ctx(OTRO), 'planesCasa', 'p1', 'reservado', 'motivo')));
    for (const u of [EQUIPO, COORD, RECTORA, SUPER]) {
      await assertSucceeds(getDoc(doc(ctx(u), 'planesCasa', 'p1', 'reservado', 'motivo')));
    }
  });
  it('escriben equipo/coord/super; no docente ni rectora', async () => {
    for (const u of [EQUIPO, COORD, SUPER]) await assertSucceeds(setDoc(doc(ctx(u), 'planesCasa', 'p1', 'reservado', 'motivo'), { texto: 'n' }));
    await assertFails(setDoc(doc(ctx(DOC1), 'planesCasa', 'p1', 'reservado', 'motivo'), { texto: 'n' }));
    await assertFails(setDoc(doc(ctx(RECTORA), 'planesCasa', 'p1', 'reservado', 'motivo'), { texto: 'n' }));
  });
});

describe('planesCasa/asignaturas', () => {
  it('lee el docente del plan; un ajeno no', async () => {
    await assertSucceeds(getDoc(doc(ctx(DOC1), 'planesCasa', 'p1', 'asignaturas', 'esp')));
    await assertFails(getDoc(doc(ctx(OTRO), 'planesCasa', 'p1', 'asignaturas', 'mat')));
  });
  it('el docente actualiza la suya pero no la de otro', async () => {
    await assertSucceeds(updateDoc(doc(ctx(DOC1), 'planesCasa', 'p1', 'asignaturas', 'mat'), { criteriosPromocion: 'nuevo' }));
    await assertFails(updateDoc(doc(ctx(DOC1), 'planesCasa', 'p1', 'asignaturas', 'esp'), { criteriosPromocion: 'nuevo' }));
  });
  it('el docente no cambia docenteCorreo ni asignaturaId', async () => {
    await assertFails(updateDoc(doc(ctx(DOC1), 'planesCasa', 'p1', 'asignaturas', 'mat'), { docenteCorreo: DOC2 }));
    await assertFails(updateDoc(doc(ctx(DOC1), 'planesCasa', 'p1', 'asignaturas', 'mat'), { asignaturaId: 'otra' }));
  });
  it('equipo/coord crean y reasignan; docente crea solo a su nombre', async () => {
    await assertSucceeds(setDoc(doc(ctx(COORD), 'planesCasa', 'p1', 'asignaturas', 'cn'), asigDe(DOC2, 'cn')));
    await assertSucceeds(updateDoc(doc(ctx(EQUIPO), 'planesCasa', 'p1', 'asignaturas', 'mat'), { docenteCorreo: DOC2 }));
    await assertSucceeds(setDoc(doc(ctx(DOC1), 'planesCasa', 'p1', 'asignaturas', 'art'), asigDe(DOC1, 'art')));
    await assertFails(setDoc(doc(ctx(DOC1), 'planesCasa', 'p1', 'asignaturas', 'soc'), asigDe(DOC2, 'soc')));
  });
  it('borran solo equipo/super; suplantacion no escribe', async () => {
    await assertFails(deleteDoc(doc(ctx(DOC1), 'planesCasa', 'p1', 'asignaturas', 'mat')));
    await assertFails(deleteDoc(doc(ctx(COORD), 'planesCasa', 'p1', 'asignaturas', 'mat')));
    await assertFails(updateDoc(doc(ctxSupl(DOC1), 'planesCasa', 'p1', 'asignaturas', 'mat'), { criteriosPromocion: 'z' }));
    await assertSucceeds(deleteDoc(doc(ctx(EQUIPO), 'planesCasa', 'p1', 'asignaturas', 'mat')));
  });
});

describe('planesCasa/guias', () => {
  const g = (u: string) => doc(ctx(u), 'planesCasa', 'p1', 'guias', 'g1');
  it('lee el docente del plan; un ajeno no', async () => {
    await assertSucceeds(getDoc(g(DOC2)));
    await assertFails(getDoc(g(OTRO)));
  });
  it('crean equipo/coord/super; un docente solo si es el responsable y esta en el plan', async () => {
    for (const u of [EQUIPO, COORD, SUPER]) await assertSucceeds(setDoc(doc(ctx(u), 'planesCasa', 'p1', 'guias', 'n' + u.length), guiaDe(DOC1, [DOC1])));
    await assertSucceeds(setDoc(doc(ctx(DOC1), 'planesCasa', 'p1', 'guias', 'mio'), guiaDe(DOC1, [DOC1])));
    await assertFails(setDoc(doc(ctx(DOC1), 'planesCasa', 'p1', 'guias', 'ajena'), guiaDe(DOC2, [DOC2])));
    await assertFails(setDoc(doc(ctx(OTRO), 'planesCasa', 'p1', 'guias', 'x'), guiaDe(OTRO, [OTRO])));
  });
  it('el responsable edita pero no cambia asignaturaIds/responsable/docentes', async () => {
    await assertSucceeds(updateDoc(g(DOC1), { eje: 'nuevo', aprobadaEn: 5 }));
    await assertFails(updateDoc(g(DOC1), { responsableCorreo: DOC2 }));
    await assertFails(updateDoc(g(DOC1), { asignaturaIds: ['x'] }));
    await assertFails(updateDoc(g(DOC1), { docentesCorreos: [DOC1] }));
  });
  it('otro docente de la guia solo cambia su visto bueno y el seguimiento', async () => {
    await assertSucceeds(updateDoc(g(DOC2), new FieldPath('vistosBuenos', DOC2), true));
    await assertSucceeds(updateDoc(g(DOC2), { seguimiento: { p1: { estado: 'entregado' } } }));
    await assertFails(updateDoc(g(DOC2), new FieldPath('vistosBuenos', DOC1), true));
    await assertFails(updateDoc(g(DOC2), { eje: 'x' }));
    await assertFails(updateDoc(g(DOC2), { aprobada: { productoFinal: 'x' } }));
    await assertFails(updateDoc(g(OTRO), { seguimiento: {} }));
  });
  it('equipo/coord/super editan; borran equipo/coord/super; docente no; suplantacion no', async () => {
    await assertSucceeds(updateDoc(g(COORD), { responsableCorreo: DOC2 }));
    await assertFails(deleteDoc(g(DOC1)));
    await assertFails(updateDoc(doc(ctxSupl(SUPER), 'planesCasa', 'p1', 'guias', 'g1'), { eje: 'z' }));
    await assertSucceeds(deleteDoc(g(EQUIPO)));
  });
});

describe('planesCasaPublico', () => {
  it('cualquiera (incluso sin sesion) lee por token; nadie lista', async () => {
    await assertSucceeds(getDoc(doc(anon(), 'planesCasaPublico', 'tok123')));
    await assertSucceeds(getDoc(doc(ctx(DOC1), 'planesCasaPublico', 'tok123')));
    await assertFails(getDocs(collection(anon(), 'planesCasaPublico')));
    await assertFails(getDocs(collection(ctx(SUPER), 'planesCasaPublico')));
  });
  it('ningun cliente escribe, ni el superusuario', async () => {
    for (const db of [anon(), ctx(SUPER), ctx(EQUIPO), ctx(COORD)]) {
      await assertFails(setDoc(doc(db, 'planesCasaPublico', 'tok123'), { primerNombre: 'X' }));
    }
    await assertFails(deleteDoc(doc(ctx(SUPER), 'planesCasaPublico', 'tok123')));
  });
});

describe('planesCasa/{id}/entregas (solo servidor escribe)', () => {
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (c) => {
      await setDoc(doc(c.firestore(), 'planesCasa', 'p1', 'entregas', 'e1'), { guiaId: 'g1', pasoId: 'p1', creadoEn: 1 });
    });
  });
  it('leen equipo, coordinacion, rectora, superusuario y docentes del plan; no un ajeno ni anonimo', async () => {
    for (const u of [EQUIPO, COORD, RECTORA, SUPER, DOC1, DOC2]) {
      await assertSucceeds(getDoc(doc(ctx(u), 'planesCasa', 'p1', 'entregas', 'e1')));
    }
    await assertSucceeds(getDocs(collection(ctx(DOC1), 'planesCasa', 'p1', 'entregas')));
    await assertFails(getDoc(doc(ctx(OTRO), 'planesCasa', 'p1', 'entregas', 'e1')));
    await assertFails(getDoc(doc(anon(), 'planesCasa', 'p1', 'entregas', 'e1')));
  });
  it('nadie escribe desde el cliente, ni el superusuario', async () => {
    for (const u of [SUPER, COORD, EQUIPO, DOC1]) {
      await assertFails(setDoc(doc(ctx(u), 'planesCasa', 'p1', 'entregas', 'e2'), { guiaId: 'g1' }));
      await assertFails(deleteDoc(doc(ctx(u), 'planesCasa', 'p1', 'entregas', 'e1')));
    }
    await assertFails(setDoc(doc(anon(), 'planesCasa', 'p1', 'entregas', 'e3'), { guiaId: 'g1' }));
  });
});
