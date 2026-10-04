import { describe, expect, it } from 'vitest';
import { clasificarErrorToken, mapearCursos, urlCursosDelDocente } from './logica';

describe('classroom logica', () => {
  it('arma la URL de cursos', () => {
    expect(urlCursosDelDocente()).toBe('/courses?teacherId=me&courseStates=ACTIVE&pageSize=50');
  });
  it('mapea solo id, nombre y seccion', () => {
    expect(mapearCursos([{ id: '1', name: '10.1 Fisica', section: 'A', extra: 'x' } as never, { name: 'sin id' }]))
      .toEqual([{ id: '1', nombre: '10.1 Fisica', seccion: 'A' }]);
    expect(mapearCursos(undefined)).toEqual([]);
  });
  it('clasifica errores de token', () => {
    expect(clasificarErrorToken('token 401: unauthorized_client Client is unauthorized')).toBe('sin-autorizacion');
    expect(clasificarErrorToken('signJwt 403 forbidden')).toBe('sin-autorizacion');
    expect(clasificarErrorToken('ECONNRESET')).toBe('otro');
  });
});
