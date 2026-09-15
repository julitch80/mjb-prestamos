/**
 * Pruebas de reglas de Firestore para `acompanamientosPublicaciones`.
 *
 * Ejecutar con: npm run test:reglas
 *
 * REQUISITO: el emulador de Firestore necesita Java 11+. El JDK 21 esta en
 * `C:\Program Files\Microsoft\jdk-21.0.11.10-hotspot`, pero el Java del sistema
 * puede ser una version mas vieja. Si el emulador se queja de la version:
 *     export JAVA_HOME="/c/Program Files/Microsoft/jdk-21.0.11.10-hotspot"
 *     export PATH="$JAVA_HOME/bin:$PATH"
 *
 * AL LEER LA SALIDA: apareceran muchos `PERMISSION_DENIED` en stderr. NO son
 * fallos: son los rechazos que cada `assertFails` provoca a proposito. Lo que
 * importa es la linea final de vitest.
 *
 * A diferencia del proyecto de asistencia (que prueba un FRAGMENTO compuesto con
 * un stub), aqui se carga el archivo REAL `firestore.rules` tal cual se despliega
 * — es el unico archivo de reglas del proyecto (ver la cabecera de firestore.rules
 * sobre por que no se fusiona con nada mas).
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { addDoc, collection, deleteDoc, doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { documentoDePublicacion } from '../src/data/acompanamientos/almacen';
import { distribucionInicial } from '../src/data/acompanamientos/inicial';

const DOMINIO = 'iemanueljbetancur.edu.co';
const COORD_MANANA = `janneth.ocampo@${DOMINIO}`;
const COORD_TARDE = `juan.salazar@${DOMINIO}`;
const DOCENTE = `julian.medina@${DOMINIO}`;
const SUPERUSUARIO = `admin@${DOMINIO}`;
const RECTORA = `rectora@${DOMINIO}`;
const EXTERNO = 'cualquiera@gmail.com';

const COLECCION = 'acompanamientosPublicaciones';

let env: RulesTestEnvironment;

/** Contexto autenticado normal (sin suplantacion). */
function ctx(email: string) {
  return env.authenticatedContext(email, { email, email_verified: true }).firestore();
}

/**
 * Contexto de SUPLANTACION: mismo claim `suplantadoPor` que emite la funcion
 * `suplantar` en produccion (docs/plan-suplantacion.md). Una sesion asi debe
 * quedar de solo lectura, aunque el usuario suplantado sea coordinador.
 */
function ctxSuplantado(email: string, admin: string) {
  return env
    .authenticatedContext(email, { email, email_verified: true, suplantadoPor: admin })
    .firestore();
}

function publicacionValida(jornada: 'manana' | 'tarde', correo: string, nombre: string) {
  return {
    jornada,
    vigenteDesde: '2026-09-21',
    zonas: [{ id: 'restaurante', nombre: 'Restaurante', cupo: 1 }],
    asignaciones: [{ zonaId: 'restaurante', dia: 'lunes', docenteId: 'doris', candado: false }],
    publicadoPor: correo,
    publicadoPorNombre: nombre,
    publicadoEn: serverTimestamp(),
  };
}

beforeAll(async () => {
  const rules = readFileSync(path.resolve(__dirname, '..', 'firestore.rules'), 'utf8');
  env = await initializeTestEnvironment({
    projectId: 'demo-mjb',
    firestore: { rules, host: '127.0.0.1', port: 8080 },
  });
});

afterAll(async () => env?.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (c) => {
    const db = c.firestore();
    const usuarios: Array<{
      email: string;
      role: string;
      jornada: string | null;
      displayName: string;
    }> = [
      { email: COORD_MANANA, role: 'coordinador', jornada: 'manana', displayName: 'Janneth Ocampo' },
      { email: COORD_TARDE, role: 'coordinador', jornada: 'tarde', displayName: 'Juan Diego Salazar' },
      { email: DOCENTE, role: 'docente', jornada: 'manana', displayName: 'Julian Medina' },
      { email: SUPERUSUARIO, role: 'superusuario', jornada: null, displayName: 'Admin' },
      { email: RECTORA, role: 'rectora', jornada: 'ambas', displayName: 'Rectora' },
    ];
    for (const u of usuarios) {
      await setDoc(doc(db, 'users', u.email), {
        email: u.email,
        role: u.role,
        active: true,
        displayName: u.displayName,
        jornada: u.jornada,
      });
    }
  });
});

describe('acompanamientosPublicaciones — crear', () => {
  it('la coordinadora de la manana publica su jornada', async () => {
    await assertSucceeds(
      addDoc(
        collection(ctx(COORD_MANANA), COLECCION),
        publicacionValida('manana', COORD_MANANA, 'Janneth Ocampo'),
      ),
    );
  });

  it('la coordinadora de la manana NO puede publicar en la tarde', async () => {
    await assertFails(
      addDoc(
        collection(ctx(COORD_MANANA), COLECCION),
        publicacionValida('tarde', COORD_MANANA, 'Janneth Ocampo'),
      ),
    );
  });

  it('el coordinador de la tarde NO puede publicar en la manana', async () => {
    await assertFails(
      addDoc(
        collection(ctx(COORD_TARDE), COLECCION),
        publicacionValida('manana', COORD_TARDE, 'Juan Diego Salazar'),
      ),
    );
  });

  it('un docente no puede publicar', async () => {
    await assertFails(
      addDoc(collection(ctx(DOCENTE), COLECCION), publicacionValida('manana', DOCENTE, 'Julian Medina')),
    );
  });

  it('el superusuario puede publicar en cualquier jornada', async () => {
    await assertSucceeds(
      addDoc(collection(ctx(SUPERUSUARIO), COLECCION), publicacionValida('tarde', SUPERUSUARIO, 'Admin')),
    );
  });

  it('la rectora no puede publicar', async () => {
    await assertFails(
      addDoc(collection(ctx(RECTORA), COLECCION), publicacionValida('manana', RECTORA, 'Rectora')),
    );
  });

  it('una sesion de suplantacion de la coordinadora de la manana no puede publicar', async () => {
    await assertFails(
      addDoc(
        collection(ctxSuplantado(COORD_MANANA, SUPERUSUARIO), COLECCION),
        publicacionValida('manana', COORD_MANANA, 'Janneth Ocampo'),
      ),
    );
  });

  it('publicadoPor distinto del correo que llama se rechaza', async () => {
    await assertFails(
      addDoc(
        collection(ctx(COORD_MANANA), COLECCION),
        publicacionValida('manana', COORD_TARDE, 'Janneth Ocampo'),
      ),
    );
  });

  it('un campo extra no permitido se rechaza', async () => {
    await assertFails(
      addDoc(collection(ctx(COORD_MANANA), COLECCION), {
        ...publicacionValida('manana', COORD_MANANA, 'Janneth Ocampo'),
        extra: 'no deberia estar aqui',
      }),
    );
  });

  it('la coordinadora de la manana publica un documento armado con documentoDePublicacion (tarea 7.3)', async () => {
    const base = distribucionInicial('manana');
    const dist = { ...base, asignaciones: [...base.asignaciones, { zonaId: base.zonas[0].id, dia: 'viernes' as const, docenteId: 'julian', candado: false }] };
    const documento = documentoDePublicacion(dist, '2026-09-21', COORD_MANANA, 'Janneth Ocampo', serverTimestamp());
    await assertSucceeds(addDoc(collection(ctx(COORD_MANANA), COLECCION), documento));
  });

  it('publicacion con metas (mapa) se acepta', async () => {
    await assertSucceeds(
      addDoc(collection(ctx(COORD_MANANA), COLECCION), {
        ...publicacionValida('manana', COORD_MANANA, 'Janneth Ocampo'),
        metas: { doris: 2, julian: 1 },
      }),
    );
  });

  it('metas como string (no mapa) se rechaza', async () => {
    await assertFails(
      addDoc(collection(ctx(COORD_MANANA), COLECCION), {
        ...publicacionValida('manana', COORD_MANANA, 'Janneth Ocampo'),
        metas: 'no es un mapa',
      }),
    );
  });

  it('vigenteDesde con formato invalido se rechaza', async () => {
    await assertFails(
      addDoc(collection(ctx(COORD_MANANA), COLECCION), {
        ...publicacionValida('manana', COORD_MANANA, 'Janneth Ocampo'),
        vigenteDesde: '21/09/2026',
      }),
    );
  });
});

describe('acompanamientosPublicaciones — inmutable', () => {
  async function sembrarPublicacion(): Promise<string> {
    let id = '';
    await env.withSecurityRulesDisabled(async (c) => {
      const ref = await addDoc(collection(c.firestore(), COLECCION), {
        ...publicacionValida('manana', COORD_MANANA, 'Janneth Ocampo'),
        publicadoEn: new Date(),
      });
      id = ref.id;
    });
    return id;
  }

  it('quien la creo no puede editarla', async () => {
    const id = await sembrarPublicacion();
    await assertFails(updateDoc(doc(ctx(COORD_MANANA), COLECCION, id), { vigenteDesde: '2026-10-01' }));
  });

  it('quien la creo no puede borrarla', async () => {
    const id = await sembrarPublicacion();
    await assertFails(deleteDoc(doc(ctx(COORD_MANANA), COLECCION, id)));
  });
});

describe('acompanamientosPublicaciones — leer', () => {
  async function sembrarPublicacion(): Promise<string> {
    let id = '';
    await env.withSecurityRulesDisabled(async (c) => {
      const ref = await addDoc(collection(c.firestore(), COLECCION), {
        ...publicacionValida('manana', COORD_MANANA, 'Janneth Ocampo'),
        publicadoEn: new Date(),
      });
      id = ref.id;
    });
    return id;
  }

  it('un docente puede leer una publicacion', async () => {
    const id = await sembrarPublicacion();
    const { getDoc } = await import('firebase/firestore');
    await assertSucceeds(getDoc(doc(ctx(DOCENTE), COLECCION, id)));
  });

  it('un correo externo no puede leer', async () => {
    const id = await sembrarPublicacion();
    const { getDoc } = await import('firebase/firestore');
    await assertFails(getDoc(doc(ctx(EXTERNO), COLECCION, id)));
  });
});

describe('acompanamientosPublicaciones — cancelar antes de regir', () => {
  async function sembrar(vigenteDesde: string, extra: Record<string, unknown> = {}): Promise<string> {
    let id = '';
    await env.withSecurityRulesDisabled(async (c) => {
      const ref = await addDoc(collection(c.firestore(), COLECCION), {
        ...publicacionValida('manana', COORD_MANANA, 'Janneth Ocampo'),
        vigenteDesde,
        publicadoEn: new Date(),
        ...extra,
      });
      id = ref.id;
    });
    return id;
  }
  const cancelacion = (correo: string) => ({ canceladaPor: correo, canceladaPorNombre: 'X', canceladaEn: serverTimestamp() });

  it('el superusuario cancela una programada', async () => {
    const id = await sembrar('2099-11-27');
    await assertSucceeds(updateDoc(doc(ctx(SUPERUSUARIO), COLECCION, id), cancelacion(SUPERUSUARIO)));
  });

  it('la coordinadora de la jornada cancela una programada', async () => {
    const id = await sembrar('2099-11-27');
    await assertSucceeds(updateDoc(doc(ctx(COORD_MANANA), COLECCION, id), cancelacion(COORD_MANANA)));
  });

  it('el coordinador de la otra jornada y un docente no pueden', async () => {
    const id = await sembrar('2099-11-27');
    await assertFails(updateDoc(doc(ctx(COORD_TARDE), COLECCION, id), cancelacion(COORD_TARDE)));
    await assertFails(updateDoc(doc(ctx(DOCENTE), COLECCION, id), cancelacion(DOCENTE)));
  });

  it('no se cancela una que ya rige', async () => {
    const id = await sembrar('2020-01-01');
    await assertFails(updateDoc(doc(ctx(SUPERUSUARIO), COLECCION, id), cancelacion(SUPERUSUARIO)));
  });

  it('no se cancela dos veces ni se cambia otra cosa al cancelar', async () => {
    const id = await sembrar('2099-11-27', { canceladaPor: COORD_MANANA, canceladaPorNombre: 'J', canceladaEn: new Date() });
    await assertFails(updateDoc(doc(ctx(SUPERUSUARIO), COLECCION, id), cancelacion(SUPERUSUARIO)));
    const id2 = await sembrar('2099-11-27');
    await assertFails(updateDoc(doc(ctx(SUPERUSUARIO), COLECCION, id2), { ...cancelacion(SUPERUSUARIO), vigenteDesde: '2099-12-01' }));
  });
});
