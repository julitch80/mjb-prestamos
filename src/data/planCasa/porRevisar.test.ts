import { describe, it, expect } from 'vitest';
import { contarPorGuia, entregasRecibidasPorRevisar, type DatosPlanRevisar } from './porRevisar';
import type { AsignaturaPlan, Guia, GuiaPlan } from './tipos';

const asig = (id: string, correo: string): AsignaturaPlan =>
  ({ asignaturaId: id, docenteId: id, docenteCorreo: correo, criteriosPromocion: '', actualizadoEn: 1 });
const paso = (id: string, extra: object = {}) => ({ id, titulo: `Paso ${id}`, fecha: '2026-11-05', momentos: 1, ...extra });
const guia = (pasos: object[], integrada = false) => ({ pasos, integrada } as unknown as Guia);
const g = (id: string, extra: Partial<GuiaPlan>): GuiaPlan => ({
  id, asignaturaIds: ['mat', 'len'], eje: '', responsableCorreo: 'a@x.co', docentesCorreos: ['a@x.co', 'b@x.co'],
  vistosBuenos: {}, seguimiento: {}, sustentacionEstado: 'sin_citar', actualizadoEn: 1, ...extra,
});
const plan = (id: string, nombres: string) => ({ id, desde: '2026-11-02', modalidad: 'transversal' as const, nombres, apellidos: 'Z', grupo: '8º1' });
const nombre = (_p: string, id: string) => id.toUpperCase();
const o = { correo: 'b@x.co', gestor: false, hoy: '2026-11-09', nombre };

describe('entregasRecibidasPorRevisar', () => {
  const comps = [{ asignaturaId: 'mat', parte: 'x', queRevisar: 'y' }, { asignaturaId: 'len', parte: 'x', queRevisar: 'y' }];
  const d1: DatosPlanRevisar = {
    plan: plan('p1', 'Samuel David'), asigs: [asig('mat', 'a@x.co'), asig('len', 'b@x.co')],
    guias: [g('g1', {
      aprobada: guia([paso('p1', { componentes: comps }), paso('p2', { componentes: comps })], true),
      seguimiento: { p1: { estado: 'entregado', entregadoEn: 2000 }, p2: { estado: 'revisado', entregadoEn: 1000 } },
    })],
  };
  const d2: DatosPlanRevisar = {
    plan: plan('p2', 'Ana'), asigs: [asig('mat', 'a@x.co'), asig('len', 'b@x.co')],
    guias: [g('g2', {
      aprobada: guia([paso('ent-len'), paso('ent-mat')]),
      seguimiento: { 'ent-len': { estado: 'entregado', entregadoEn: 1500 }, 'ent-mat': { estado: 'entregado', entregadoEn: 900 } },
    })],
  };

  it('solo lo mío, no revisado, ordenado del más antiguo al más reciente', () => {
    const r = entregasRecibidasPorRevisar([d1, d2], o);
    expect(r.map(x => `${x.estudiante}:${x.pasoId}`)).toEqual(['Ana:ent-len', 'Samuel:p1']);
    expect(r[1].partes).toEqual(['LEN']);
    expect(r[1].pasoNum).toBe(1);
  });
  it('si ya marqué mi parte deja de aparecer', () => {
    const d = { ...d1, guias: [g('g1', { ...d1.guias[0], seguimiento: { p1: { estado: 'entregado', entregadoEn: 2000, porAsignatura: { len: { revisado: true } } } } })] };
    expect(entregasRecibidasPorRevisar([d], o)).toEqual([]);
  });
  it('sin entregadoEn o sin entregar no cuenta; el gestor ve todo lo entregado', () => {
    const sinFecha = { ...d2, guias: [g('g2', { ...d2.guias[0], seguimiento: { 'ent-len': { estado: 'entregado' } } })] };
    expect(entregasRecibidasPorRevisar([sinFecha], o)).toEqual([]);
    const todo = entregasRecibidasPorRevisar([d2], { ...o, correo: 'coord@x.co', gestor: true });
    expect(todo.map(x => x.pasoId)).toEqual(['ent-mat', 'ent-len']);
  });
  it('antes de que empiece el plan no hay nada', () => {
    expect(entregasRecibidasPorRevisar([d2], { ...o, hoy: '2026-10-30' })).toEqual([]);
  });
  it('cuenta por guía', () => {
    expect(contarPorGuia(entregasRecibidasPorRevisar([d1, d2], o))).toEqual({ g1: 1, g2: 1 });
  });
});
