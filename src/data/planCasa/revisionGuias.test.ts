import { describe, expect, it } from 'vitest';
import { resumenRevision } from './revisionGuias';
const asig = (id: string, c: string) => ({ asignaturaId: id, docenteId: id, docenteCorreo: c, criteriosPromocion: '', actualizadoEn: 1 }) as never;
const paso = (id: string, componentes?: { asignaturaId: string }[]) => ({ id, titulo: id, instrucciones: '', momentos: 1, evidencia: 'foto', evidenciaDetalle: '', semana: 1, fecha: null, componentes }) as never;
describe('resumenRevision', () => {
  it('reparte pendientes por docente y marca atrasadas', () => {
    const ahora = 10 * 86_400_000;
    const g = { id: 'g1', asignaturaIds: ['fis', 'qui'], responsableCorreo: 'f@x', docentesCorreos: [], vistosBuenos: {},
      aprobada: { pasos: [paso('p1', [{ asignaturaId: 'fis' }, { asignaturaId: 'qui' }]), paso('ent-qui')] },
      seguimiento: { p1: { estado: 'entregado', entregadoEn: 0, porAsignatura: { fis: { revisado: true } } }, 'ent-qui': { estado: 'revisado' } } } as never;
    const r = resumenRevision([{ plan: { id: 'a', nombres: 'Ana', apellidos: 'Paz', grupo: '11.2' }, asigs: [asig('fis', 'f@x'), asig('qui', 'q@x')], guias: [g] }], ahora, (_p, id) => id);
    expect(r.entregas).toBe(2); expect(r.revisadas).toBe(1); expect(r.pendientes).toBe(1); expect(r.atrasadas).toBe(1);
    const q = r.docentes.find(d => d.correo === 'q@x')!;
    expect(q.pendientes.map(p => p.asignaturas)).toEqual([['qui']]);
    expect(r.docentes.find(d => d.correo === 'f@x')!.pendientes).toHaveLength(0);
  });
});
