import { describe, expect, it } from 'vitest';
import { cambioReal, dentroDeVentana, urlCourseWorkPublicadas, claveVinculo, fechaEntregaClassroom, clasificarErrorToken, extraerAnio, extraerGrupo, mapearCursos, normalizarNombre, sugerirCurso, textoValido, urlCursosDelDocente } from './logica';

describe('classroom logica', () => {
  it('arma la URL de cursos', () => {
    expect(urlCursosDelDocente()).toBe('/courses?teacherId=me&courseStates=ACTIVE&pageSize=50');
  });
  it('mapea solo id, nombre y seccion', () => {
    expect(mapearCursos([{ id: '1', name: '10.1 Fisica', section: 'A', extra: 'x' } as never, { name: 'sin id' }]))
      .toEqual([{ id: '1', nombre: '10.1 Fisica', seccion: 'A', anio: null, alternateLink: '' }]);
    expect(mapearCursos(undefined)).toEqual([]);
  });
  it('clasifica errores de token', () => {
    expect(clasificarErrorToken('token 401: unauthorized_client Client is unauthorized')).toBe('sin-autorizacion');
    expect(clasificarErrorToken('signJwt 403 forbidden')).toBe('sin-autorizacion');
    expect(clasificarErrorToken('ECONNRESET')).toBe('otro');
  });
});

describe('normalizacion y sugerencia', () => {
  it('unifica el grupo', () => {
    for (const t of ['Física 10-°3 2025', 'FÍSICA 10°3', '10.3', '10º3', '10 3']) expect(extraerGrupo(t)).toBe('10.3');
    expect(extraerGrupo('Fisica 6º1')).toBe('6.1');
    expect(extraerGrupo('Matemáticas')).toBeNull();
    expect(normalizarNombre('FÍSICA 10°1 2026')).toBe('fisica 10.1 2026');
    expect(extraerGrupo('curso 2025')).toBeNull();
  });
  it('extrae el anio', () => {
    expect(extraerAnio('Física 10-°3 2025')).toBe(2025);
    expect(extraerAnio('FÍSICA 10°1', 'Ciencias 2026')).toBe(2026);
    expect(extraerAnio('Fisica 10°2')).toBeNull();
    expect(extraerAnio('Curso 1999')).toBeNull();
  });
  const cursos = [
    { id: 'a', nombre: 'Fisica 10°2', seccion: '' },
    { id: 'b', nombre: 'FISICA 11°3 2026', seccion: '' },
    { id: 'c', nombre: 'Fisica 10°4 2026', seccion: '' },
    { id: 'd', nombre: 'FÍSICA 10°1 2026', seccion: '' },
    { id: 'e', nombre: 'Física 10°1 2025 · Media', seccion: '' },
    { id: 'f', nombre: 'FÍSICA 10°1 2024', seccion: '' },
    { id: 'g', nombre: 'FÍSICA 10°1', seccion: 'Ciencias Nuturales' },
    { id: 'h', nombre: 'Matemáticas', seccion: 'GEO - Estadistica' },
  ];
  it('prefiere el anio actual y descarta los viejos', () => {
    expect(sugerirCurso('10.1', 'Física', cursos, 2026)).toBe('d');
    expect(sugerirCurso('10.1', 'Física', cursos.filter((c) => c.id !== 'd'), 2026)).toBe('g');
    expect(sugerirCurso('10.1', 'Física', cursos.filter((c) => !['d', 'g'].includes(c.id)), 2026)).toBeNull();
  });
  it('otros grupos y sin coincidencia', () => {
    expect(sugerirCurso('10.2', 'Física', cursos, 2026)).toBe('a');
    expect(sugerirCurso('11.3', 'Física', cursos, 2026)).toBe('b');
    expect(sugerirCurso('9.1', 'Física', cursos, 2026)).toBeNull();
    expect(sugerirCurso('6º1', 'Matemáticas', [{ id: 'x', nombre: 'Mate 6°1', seccion: '' }], 2026)).toBe('x');
    expect(sugerirCurso('10.1', 'Matemáticas', cursos, 2026)).toBeNull();
  });
  it('prefiere la asignatura', () => {
    const c = [{ id: 'm', nombre: 'Matemáticas 10°1 2026', seccion: '' }, { id: 'f', nombre: 'Física 10°1 2026', seccion: '' }];
    expect(sugerirCurso('10.1', 'Física', c, 2026)).toBe('f');
  });
  it('clave y validacion', () => {
    expect(claveVinculo('10.1', 'Física')).toBe('10_1|Física');
    expect(textoValido('10.1')).toBe(true);
    expect(textoValido('')).toBe(false);
    expect(textoValido('x'.repeat(41))).toBe(false);
    expect(textoValido(5)).toBe(false);
  });
});

describe('sugerirCurso: confusiones vistas en el piloto', () => {
  const cursos = [
    { id: 'viejo', nombre: 'FÍSICA 10°1', seccion: 'Ciencias Nuturales' },
    { id: 'nuevo', nombre: 'FÍSICA 10°1 2026', seccion: '' },
  ];
  it('no usa la sección para casar la asignatura', () => {
    expect(sugerirCurso('10.1', 'Ciencias Sociales', cursos, 2026)).toBeNull();
  });
  it('exige todas las palabras de la asignatura', () => {
    expect(sugerirCurso('10.1', 'Educación Física', cursos, 2026)).toBeNull();
  });
  it('Física prefiere el curso del año', () => {
    expect(sugerirCurso('10.1', 'Física', cursos, 2026)).toBe('nuevo');
  });
});


describe('fechaEntregaClassroom', () => {
  it('23:59 de Bogotá es el día siguiente 04:59 UTC', () => {
    expect(fechaEntregaClassroom('2026-10-09')).toEqual({ dueDate: { year: 2026, month: 10, day: 10 }, dueTime: { hours: 4, minutes: 59 } });
  });
  it('cambia de mes y de año', () => {
    expect(fechaEntregaClassroom('2026-10-31').dueDate).toEqual({ year: 2026, month: 11, day: 1 });
    expect(fechaEntregaClassroom('2026-12-31').dueDate).toEqual({ year: 2027, month: 1, day: 1 });
    expect(fechaEntregaClassroom('2028-02-28').dueDate).toEqual({ year: 2028, month: 2, day: 29 });
  });
  it('rechaza formatos raros', () => {
    expect(() => fechaEntregaClassroom('9/10/2026')).toThrow();
  });
});

import { debeIgnorar, extraerMateriales, fechaDesdeClassroom, jornadaDeGrupo } from './logica';

describe('4.1 de Classroom a MJB', () => {
  it('jornada por grupo', () => {
    expect(jornadaDeGrupo('6º1')).toBe('tarde');
    expect(jornadaDeGrupo('10.1')).toBe('manana');
  });
  it('fecha desde Classroom es la inversa de fechaEntregaClassroom', () => {
    for (const f of ['2026-10-09', '2026-12-31', '2028-02-28', '2026-03-01']) {
      const e = fechaEntregaClassroom(f);
      expect(fechaDesdeClassroom(e.dueDate, e.dueTime)).toBe(f);
    }
    expect(fechaDesdeClassroom({ year: 2027, month: 1, day: 1 }, { hours: 4, minutes: 59 })).toBe('2026-12-31');
    expect(fechaDesdeClassroom(undefined, undefined)).toBeNull();
  });
  it('decide qué ignorar', () => {
    const base = { state: 'PUBLISHED', workType: 'ASSIGNMENT' };
    expect(debeIgnorar(base, false)).toBeNull();
    expect(debeIgnorar({ ...base, associatedWithDeveloper: true }, false)).toBe('creada-por-mjb');
    expect(debeIgnorar(base, true)).toBe('ya-enlazada');
    expect(debeIgnorar({ ...base, state: 'DRAFT' }, false)).toBe('no-publicada');
    expect(debeIgnorar({ ...base, workType: 'MATERIAL' }, false)).toBe('tipo-no-soportado');
    expect(debeIgnorar({ state: 'PUBLISHED', workType: 'SHORT_ANSWER_QUESTION' }, false)).toBeNull();
  });
  it('extrae materiales', () => {
    const r = extraerMateriales([
      { link: { url: 'http://a', title: 'A' } },
      { driveFile: { driveFile: { title: 'D', alternateLink: 'http://d' } } },
      { youtubeVideo: { title: 'Y', alternateLink: 'http://y' } },
      { link: {} },
    ]);
    expect(r).toEqual([{ titulo: 'A', url: 'http://a' }, { titulo: 'D', url: 'http://d' }, { titulo: 'Y', url: 'http://y' }]);
    expect(extraerMateriales(Array.from({ length: 15 }, (_, i) => ({ link: { url: 'http://x' + i } })))).toHaveLength(10);
    expect(extraerMateriales(undefined)).toEqual([]);
  });
  it('ventana de vínculo', () => {
    const v = Date.parse('2026-10-05T12:00:00Z');
    expect(dentroDeVentana('2026-10-05T12:00:00.000Z', v)).toBe(true);
    expect(dentroDeVentana('2026-10-05T12:30:00Z', v)).toBe(true);
    expect(dentroDeVentana('2026-10-05T11:59:59Z', v)).toBe(false);
    expect(dentroDeVentana(undefined, v)).toBe(false);
    expect(dentroDeVentana('basura', v)).toBe(false);
    expect(dentroDeVentana('2026-10-05T12:30:00Z', null)).toBe(false);
  });
  it('url de tareas publicadas', () => {
    expect(urlCourseWorkPublicadas('123')).toBe('/courses/123/courseWork?courseWorkStates=PUBLISHED&orderBy=updateTime%20desc&pageSize=30');
  });
  it('detecta cambio real', () => {
    expect(cambioReal(undefined, 'a')).toBe(true);
    expect(cambioReal('a', 'a')).toBe(false);
    expect(cambioReal('a', 'b')).toBe(true);
  });
});
