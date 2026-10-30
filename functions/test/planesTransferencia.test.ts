import { describe, expect, it } from 'vitest';
import { cambiosAsignatura, cambiosGuia, cambiosPlan, reemplazarCorreo } from '../src/planesTransferencia.js';

describe('planesTransferencia', () => {
  it('reemplaza sin duplicar y sin importar mayúsculas', () => {
    expect(reemplazarCorreo(['A@x.co', 'b@x.co'], 'a@x.co', 'c@x.co')).toEqual(['c@x.co', 'b@x.co']);
    expect(reemplazarCorreo(['a@x.co', 'c@x.co'], 'a@x.co', 'c@x.co')).toEqual(['c@x.co']);
  });
  it('es idempotente: sin el correo, no hay cambios', () => {
    expect(reemplazarCorreo(['c@x.co'], 'a@x.co', 'c@x.co')).toBeNull();
    expect(cambiosPlan({ docentesCorreos: ['c@x.co'] }, 'a@x.co', 'c@x.co')).toBeNull();
    expect(cambiosAsignatura({ docenteCorreo: 'c@x.co' }, 'a@x.co', 'c@x.co')).toBeNull();
    expect(cambiosGuia({ responsableCorreo: 'c@x.co', docentesCorreos: ['c@x.co'] }, 'a@x.co', 'c@x.co')).toBeNull();
  });
  it('asignatura y guía', () => {
    expect(cambiosAsignatura({ docenteCorreo: 'A@x.co' }, 'a@x.co', 'c@x.co')).toEqual({ docenteCorreo: 'c@x.co' });
    expect(cambiosGuia({ responsableCorreo: 'a@x.co', docentesCorreos: ['a@x.co', 'b@x.co'] }, 'a@x.co', 'c@x.co'))
      .toEqual({ responsableCorreo: 'c@x.co', docentesCorreos: ['c@x.co', 'b@x.co'] });
    expect(cambiosGuia({ responsableCorreo: 'b@x.co', docentesCorreos: ['a@x.co', 'b@x.co'] }, 'a@x.co', 'c@x.co'))
      .toEqual({ docentesCorreos: ['c@x.co', 'b@x.co'] });
  });
});
