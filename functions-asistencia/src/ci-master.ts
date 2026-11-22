/**
 * Centros de interes para la extension «MJB -> Master 2000», V2 (2026-11-20).
 * Ver src/asistencia/domain/ci-master.ts y, en MJB, docs/extension-master2000/PRD.md.
 *
 * Va aparte de index.ts para probarlo contra el emulador con un Firestore propio.
 *
 * PERMISOS: los mismos que para editar una ficha del grado (`requireAutoridadSobreGrado`
 * de index.ts, replicada aqui con el `db` como parametro): superusuario; coordinador de
 * la sede; o el director del grado (su `slotId` en `asistenciaConfig/directores.mapa`).
 * Por ser por PUESTO, un reemplazo temporal del director tambien entra.
 *
 * DONDE SE GUARDA LA SUBIDA: `asistenciaSubidasMaster/{programaId}__{grado}`. No tiene
 * regla en firestore.rules, asi que el cliente no la lee ni la escribe (Firestore niega lo
 * que no tiene `match`); solo estas funciones, con el Admin SDK. El aviso al director lo
 * trae la app llamando a `ciParaMaster`, no leyendo la coleccion.
 */
import type { Firestore } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import {
  codigoGrupoMaster,
  contenidoValido,
  estadoFrenteASubida,
  filasCiMaster,
  idSubidaCi,
  pendientesDeSubir,
  type ContenidoMaster,
  type EstadoFrenteASubida,
  type FilaCiMaster,
  type PendienteDeSubir,
} from '../../src/asistencia/domain/ci-master';
import { consolidarGrupo } from '../../src/asistencia/domain/valoracion';
import { jornadaDeGrado } from '../../src/asistencia/domain/ids';
import type { ValoracionEstudiante } from '../../src/asistencia/domain/types';

export const COL_SUBIDAS = 'asistenciaSubidasMaster';

interface Usuario {
  email: string;
  role: string;
  slotId: string | null;
}

async function usuarioActivo(db: Firestore, email: string | undefined): Promise<Usuario> {
  const e = email?.toLowerCase();
  if (!e) throw new HttpsError('unauthenticated', 'Sesión no válida.');
  const snap = await db.doc(`users/${e}`).get();
  if (!snap.exists || snap.data()?.active !== true) {
    throw new HttpsError('permission-denied', 'Usuario no registrado o inactivo en MJB.');
  }
  return { email: e, role: String(snap.data()?.role ?? ''), slotId: (snap.data()?.slotId as string) ?? null };
}

async function mapaDirectores(db: Firestore): Promise<Record<string, string>> {
  return ((await db.doc('asistenciaConfig/directores').get()).data()?.mapa ?? {}) as Record<string, string>;
}

/** Misma logica que `requireAutoridadSobreGrado` (index.ts). */
async function exigirAutoridad(db: Firestore, u: Usuario, grado: string, sede: string): Promise<void> {
  if (u.role === 'superusuario') return;
  if (u.role === 'coordinador') {
    const autoridad = await db.doc('asistenciaConfig/autoridadSede').get();
    const correos = ((autoridad.data()?.mapa ?? {}) as Record<string, string[]>)[sede] ?? [];
    if (correos.includes(u.email)) return;
    throw new HttpsError('permission-denied', 'No coordina esa sede.');
  }
  const mapa = await mapaDirectores(db);
  if (u.slotId && mapa[grado] === u.slotId) return;
  throw new HttpsError('permission-denied', `No es director de ${grado}.`);
}

/** El grado pedido o, si no se pide, el de direccion del usuario. */
async function gradoDe(db: Firestore, u: Usuario, grupo: unknown): Promise<string> {
  if (typeof grupo === 'string' && grupo.trim()) return grupo.trim();
  const mapa = await mapaDirectores(db);
  const suyos = u.slotId ? Object.keys(mapa).filter((g) => mapa[g] === u.slotId).sort() : [];
  if (suyos.length === 1) return suyos[0];
  if (suyos.length === 0) {
    throw new HttpsError('failed-precondition', 'Usted no es director de ningún grupo en MJB. Si es coordinación, elija el grupo.', {
      motivo: 'sin_direccion',
    });
  }
  throw new HttpsError('failed-precondition', `Usted dirige ${suyos.length} grupos: elija uno.`, {
    motivo: 'varios_grupos',
    grados: suyos,
  });
}

interface Contexto {
  usuario: Usuario;
  grado: string;
  sede: string;
  programa: { programaId: string; nombre: string };
  filas: FilaCiMaster[];
  subida: DocSubida | null;
}

interface SubidaEstudiante extends ContenidoMaster {
  matricula: string;
  subidoEn: number;
  subidoPor: string;
}

interface DocSubida {
  programaId: string;
  grado: string;
  sede: string;
  periodo: number | null;
  codigoGrupo: string | null;
  estudiantes: Record<string, SubidaEstudiante>;
  ultimaSubidaEn: number;
  ultimaSubidaPor: string;
}

/** Todo lo que necesitan las dos callables: permisos, alumnos, valoraciones y subida. */
async function cargar(
  db: Firestore,
  email: string | undefined,
  data: { grupo?: unknown; sede?: unknown; programaId?: unknown },
): Promise<Contexto> {
  const usuario = await usuarioActivo(db, email);
  const grado = await gradoDe(db, usuario, data.grupo);

  // Los estudiantes activos del grado. La sede sale de ellos: en bachillerato los grados
  // no se repiten entre sedes; si algun dia se repiten, hay que decir cual.
  const fichas = (await db.collection('asistenciaStudents').where('gradoActual', '==', grado).get()).docs
    .map((d) => ({ ...(d.data() as Record<string, unknown>), studentId: d.id }) as Record<string, unknown> & { studentId: string })
    .filter((e) => e.activo === true);
  const sedes = [...new Set(fichas.map((e) => String(e.sede)))];
  const sedePedida = typeof data.sede === 'string' && data.sede ? data.sede : null;
  if (!sedePedida && sedes.length > 1) {
    throw new HttpsError('failed-precondition', `El grupo ${grado} existe en varias sedes: elija una.`, { motivo: 'varias_sedes', sedes });
  }
  const sede = sedePedida ?? sedes[0] ?? 'central';
  // Permisos ANTES de leer valoraciones (las fichas solo se usaron para saber la sede).
  await exigirAutoridad(db, usuario, grado, sede);
  const estudiantes = fichas.filter((e) => String(e.sede) === sede);
  if (estudiantes.length === 0) {
    throw new HttpsError('not-found', `No hay estudiantes activos en ${grado}.`, { motivo: 'grupo_vacio' });
  }

  // El programa activo de esa sede y jornada: el mismo que elige la pantalla del director.
  let programaId: string;
  let nombre: string;
  if (typeof data.programaId === 'string' && data.programaId) {
    const p = await db.doc(`asistenciaProgramas/${data.programaId}`).get();
    if (!p.exists) throw new HttpsError('not-found', 'Ese programa no existe.', { motivo: 'sin_programa' });
    programaId = p.id;
    nombre = String(p.data()?.nombre ?? p.id);
  } else {
    const activos = (await db.collection('asistenciaProgramas').where('activo', '==', true).get()).docs.filter((p) => {
      const d = p.data();
      return (!d.sede || d.sede === sede) && (!d.jornada || d.jornada === jornadaDeGrado(grado));
    });
    if (activos.length === 0) {
      throw new HttpsError('not-found', 'No hay ningún programa de centros de interés activo para este grupo.', { motivo: 'sin_programa' });
    }
    // Mas de uno activo a la vez no deberia pasar; se toma el primero por id, igual de
    // estable que la pantalla, y se devuelve cual fue.
    activos.sort((a, b) => a.id.localeCompare(b.id));
    programaId = activos[0].id;
    nombre = String(activos[0].data().nombre ?? programaId);
  }

  const [vals, indice, subidaSnap] = await Promise.all([
    db.collection('asistenciaValoraciones').where('grado', '==', grado).where('programaId', '==', programaId).get(),
    db.doc(`asistenciaProgramas/${programaId}/porGrado/${grado}`).get(),
    db.doc(`${COL_SUBIDAS}/${idSubidaCi(programaId, grado)}`).get(),
  ]);
  const valoraciones = vals.docs
    .map((d) => ({ valoracionId: d.id, ...(d.data() as Omit<ValoracionEstudiante, 'valoracionId'>) }))
    .filter((v) => v.sede === undefined || v.sede === sede);
  const centros = indice.exists ? ((indice.data()?.centros ?? {}) as Record<string, unknown>) : null;
  const consolidado = consolidarGrupo(
    estudiantes.map((e) => ({ studentId: e.studentId, apellidos: String(e.apellidos ?? ''), nombres: String(e.nombres ?? '') })),
    valoraciones,
    centros ? new Set(Object.keys(centros)) : null,
  );
  const matriculas = new Map(estudiantes.map((e) => [e.studentId, typeof e.matricula === 'string' ? e.matricula : '']));
  const filas = filasCiMaster(
    grado,
    consolidado.map((f) => ({ ...f, matricula: matriculas.get(f.studentId) || undefined })),
  );
  return {
    usuario,
    grado,
    sede,
    programa: { programaId, nombre },
    filas,
    subida: subidaSnap.exists ? (subidaSnap.data() as DocSubida) : null,
  };
}

function periodoValido(p: unknown): number | null {
  if (p === undefined || p === null) return null;
  if (typeof p === 'number' && Number.isInteger(p) && p >= 1 && p <= 4) return p;
  throw new HttpsError('invalid-argument', 'El periodo debe ser 1, 2, 3 o 4.');
}

// ---------------------------------------------------------------------------
//  ciParaMaster
// ---------------------------------------------------------------------------

export interface RespuestaCiParaMaster {
  grado: string;
  sede: string;
  periodo: number | null;
  codigoGrupoMaster: string | null;
  programa: { programaId: string; nombre: string };
  filas: (FilaCiMaster & { subido: (ContenidoMaster & { subidoEn: number }) | null; estadoApp: EstadoFrenteASubida })[];
  resumen: { total: number; seDigitan: number; sinMatricula: number; pendientes: number };
  pendientes: PendienteDeSubir[];
  ultimaSubida: { en: number; por: string; periodo: number | null } | null;
}

export async function datosCiParaMaster(
  db: Firestore,
  email: string | undefined,
  data: unknown,
): Promise<RespuestaCiParaMaster> {
  const d = (data ?? {}) as Record<string, unknown>;
  const periodo = periodoValido(d.periodo);
  const c = await cargar(db, email, d);
  const subidos = c.subida?.estudiantes ?? null;
  const pendientes = pendientesDeSubir(c.filas, subidos);
  return {
    grado: c.grado,
    sede: c.sede,
    periodo,
    codigoGrupoMaster: codigoGrupoMaster(c.grado),
    programa: c.programa,
    filas: c.filas.map((f) => {
      const s = subidos?.[f.studentId] ?? null;
      return {
        ...f,
        subido: s ? { val: s.val, codigos: s.codigos, f: s.f, fj: s.fj, observaciones: s.observaciones, subidoEn: s.subidoEn } : null,
        estadoApp: estadoFrenteASubida(f, s),
      };
    }),
    resumen: {
      total: c.filas.length,
      seDigitan: c.filas.filter((f) => f.seDigita).length,
      sinMatricula: c.filas.filter((f) => f.seDigita && !f.matricula).length,
      pendientes: pendientes.length,
    },
    pendientes,
    ultimaSubida: c.subida ? { en: c.subida.ultimaSubidaEn, por: c.subida.ultimaSubidaPor, periodo: c.subida.periodo } : null,
  };
}

// ---------------------------------------------------------------------------
//  ciRegistrarSubida
// ---------------------------------------------------------------------------

export interface RespuestaCiRegistrarSubida {
  registrados: number;
  /** Matriculas que no son de ningun estudiante activo del grupo: no se guardaron. */
  sinEmparejar: string[];
  /** Indices (0..n-1) de `filas` con forma invalida: no se guardaron. */
  invalidas: number[];
  pendientes: number;
}

export async function registrarSubidaCi(
  db: Firestore,
  email: string | undefined,
  data: unknown,
  ahora: number = Date.now(),
): Promise<RespuestaCiRegistrarSubida> {
  const d = (data ?? {}) as Record<string, unknown>;
  const periodo = periodoValido(d.periodo);
  if (typeof d.grupo !== 'string' || !d.grupo.trim()) throw new HttpsError('invalid-argument', 'Falta el grupo.');
  if (!Array.isArray(d.filas)) throw new HttpsError('invalid-argument', 'Faltan las filas subidas.');
  if (d.filas.length > 80) throw new HttpsError('invalid-argument', 'Demasiadas filas para un grupo.');
  const c = await cargar(db, email, d);

  const porMatricula = new Map(c.filas.filter((f) => f.matricula).map((f) => [f.matricula, f.studentId]));
  const nuevos: Record<string, SubidaEstudiante> = {};
  const sinEmparejar: string[] = [];
  const invalidas: number[] = [];
  d.filas.forEach((x, i) => {
    const matricula = x && typeof x === 'object' ? String((x as Record<string, unknown>).matricula ?? '').trim() : '';
    const contenido = contenidoValido(x);
    if (!matricula || !contenido) {
      invalidas.push(i);
      return;
    }
    const studentId = porMatricula.get(matricula);
    if (!studentId) {
      sinEmparejar.push(matricula);
      return;
    }
    nuevos[studentId] = { ...contenido, matricula, subidoEn: ahora, subidoPor: c.usuario.email };
  });

  const id = idSubidaCi(c.programa.programaId, c.grado);
  const ref = db.doc(`${COL_SUBIDAS}/${id}`);
  // Por estudiante, con merge: una subida parcial no borra lo que se subio antes de los
  // demas. Lo que el director decidio NO subir (conservar el Master) no llega aqui.
  await ref.set(
    {
      programaId: c.programa.programaId,
      grado: c.grado,
      sede: c.sede,
      periodo,
      codigoGrupo: codigoGrupoMaster(c.grado),
      estudiantes: nuevos,
      ultimaSubidaEn: ahora,
      ultimaSubidaPor: c.usuario.email,
    },
    { merge: true },
  );

  const estudiantes = { ...(c.subida?.estudiantes ?? {}), ...nuevos };
  return {
    registrados: Object.keys(nuevos).length,
    sinEmparejar,
    invalidas,
    pendientes: pendientesDeSubir(c.filas, estudiantes).length,
  };
}
