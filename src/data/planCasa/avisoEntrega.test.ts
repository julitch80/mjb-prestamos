import { describe, expect, it } from 'vitest';
import { cuerpoAvisoEntrega, destinatariosAvisoEntrega, primerNombre } from './avisoEntrega';

describe('avisoEntrega', () => {
  it('usa solo el primer nombre y el grupo', () => {
    expect(primerNombre('  Samuel David ')).toBe('Samuel');
    expect(cuerpoAvisoEntrega({ nombres: 'Samuel David', grupo: '9.1', tituloPaso: 'Mapa conceptual' }))
      .toBe('Samuel (9.1) entregó: Mapa conceptual');
  });
  it('tolera datos faltantes', () => {
    expect(cuerpoAvisoEntrega({})).toBe('Un estudiante hizo una entrega');
    expect(cuerpoAvisoEntrega({ nombres: 'Ana', grupo: '6º1' })).toBe('Ana (6º1) hizo una entrega');
  });
  it('une docentes y responsable sin repetir', () => {
    expect(destinatariosAvisoEntrega({ docentesCorreos: ['A@x.co', 'b@x.co'], responsableCorreo: 'a@x.co' }))
      .toEqual(['a@x.co', 'b@x.co']);
    expect(destinatariosAvisoEntrega({})).toEqual([]);
  });
});
