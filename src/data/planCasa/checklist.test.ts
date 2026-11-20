import { describe, it, expect } from 'vitest';
import { construirChequeo, entregasPorRevisar, indiceColor, llavePaso, puedoRevisarPaso, resumenChequeo, revisaSinPermisoEnGuia } from './checklist';
import type { AsignaturaPlan, Guia, GuiaPlan } from './tipos';

const asig = (id: string, correo: string, extra: Partial<AsignaturaPlan> = {}): AsignaturaPlan =>
  ({ asignaturaId: id, docenteId: id, docenteCorreo: correo, criteriosPromocion: '', actualizadoEn: 1, ...extra });
const guiaBase = (extra: Partial<Guia> = {}): Guia => ({ pasos: [], ...extra } as unknown as Guia);
const g = (extra: Partial<GuiaPlan> = {}): GuiaPlan => ({
  id: 'g1', asignaturaIds: ['mat', 'len'], eje: '', responsableCorreo: 'a@x.co', docentesCorreos: ['a@x.co', 'b@x.co'],
  vistosBuenos: {}, seguimiento: {}, sustentacionEstado: 'sin_citar', actualizadoEn: 1, ...extra,
});
const plan = { desde: '2026-11-02', modalidad: 'transversal' as const };
const nombre = (id: string) => id;
const base = { plan, correo: 'b@x.co', gestor: false, nombre, hoy: '2026-10-29' };

describe('construirChequeo', () => {
  it('docente de asignatura: criterios y entregable; sin propuesta no pide visto bueno', () => {
    const items = construirChequeo({ ...base, asigs: [asig('len', 'b@x.co', { criteriosPromocion: 'x', porIA: true })], guias: [g()] });
    expect(items.map(i => i.id)).toEqual(['crit-len', 'ent-len']);
    expect(items[0].hecho).toBe(false); // generado por IA no cuenta
  });
  it('con propuesta aparece el visto bueno', () => {
    const items = construirChequeo({ ...base, asigs: [asig('len', 'b@x.co', { criteriosPromocion: 'x', entregable: 'e', fechaEntrega: '2026-11-05' })], guias: [g({ propuesta: guiaBase() })] });
    expect(items.find(i => i.id === 'vb-len')?.hecho).toBe(false);
    expect(items.find(i => i.id === 'ent-len')?.hecho).toBe(true);
  });
  it('líder: criterios n de m y siguiente paso', () => {
    const items = construirChequeo({ ...base, correo: 'a@x.co', asigs: [asig('mat', 'a@x.co', { criteriosPromocion: 'x' }), asig('len', 'b@x.co')], guias: [g()] });
    expect(items.find(i => i.id === 'critt-g1')?.texto).toContain('1 de 2');
    expect(items.find(i => i.id === 'apr-g1')?.hecho).toBe(false);
    expect(resumenChequeo(items).siguiente?.id).toBe('ent-mat');
  });
  it('gestor ve la lista de líder de todas las guías', () => {
    const items = construirChequeo({ ...base, correo: 'c@x.co', gestor: true, asigs: [], guias: [g(), g({ id: 'g2' })] });
    expect(items.filter(i => i.id.startsWith('apr-')).length).toBe(2);
  });
});

describe('entregasPorRevisar', () => {
  const aprobada = guiaBase({ pasos: [{ id: 'p1', titulo: 'Entrega 1' } as never] });
  it('no cuenta antes del inicio del plan', () => {
    expect(entregasPorRevisar({ ...base, asigs: [], guias: [g({ aprobada, seguimiento: { p1: { estado: 'entregado' } } })] })).toEqual([]);
  });
  it('el líder revisa pasos entregados', () => {
    const r = entregasPorRevisar({ ...base, hoy: '2026-11-03', correo: 'a@x.co', asigs: [], guias: [g({ aprobada, seguimiento: { p1: { estado: 'entregado' } } })] });
    expect(r).toHaveLength(1);
  });
});

describe('puedoRevisarPaso', () => {
  const asigs = [asig('mat', 'a@x.co'), asig('len', 'b@x.co')];
  const guia = g();
  const paso = (id: string, componentes?: unknown) => ({ id, titulo: id, ...(componentes ? { componentes } : {}) }) as never;
  it('cualquier docente de la guía (docentesCorreos) puede revisar, aunque no sea responsable ni de la asignatura del paso', () => {
    const gg = g({ docentesCorreos: ['a@x.co', 'b@x.co', 'c@x.co'] });
    expect(puedoRevisarPaso(paso('ent-len'), gg, asigs, 'C@x.co', false)).toBe(true);
    expect(puedoRevisarPaso(paso('p1'), gg, asigs, 'b@x.co', false)).toBe(true);
  });
  it('docente de una asignatura de la guía pero fuera de docentesCorreos: puede, y se detecta el caso', () => {
    const gg = g({ docentesCorreos: ['a@x.co'] });
    expect(puedoRevisarPaso(paso('p1'), gg, asigs, 'b@x.co', false)).toBe(true);
    expect(revisaSinPermisoEnGuia(gg, asigs, 'b@x.co', false)).toBe(true);
    expect(revisaSinPermisoEnGuia(g(), asigs, 'b@x.co', false)).toBe(false);
    expect(revisaSinPermisoEnGuia(gg, asigs, 'b@x.co', true)).toBe(false);
  });
  it('docente ajeno a la guía no revisa', () => {
    expect(puedoRevisarPaso(paso('p1'), g(), asigs, 'z@x.co', false)).toBe(false);
    expect(puedoRevisarPaso(paso('ent-len'), g(), asigs, 'z@x.co', false)).toBe(false);
  });
  it('guía integrada: quien tiene una parte, y también otro docente de la guía', () => {
    const p = paso('p1', [{ asignaturaId: 'len' }]);
    expect(puedoRevisarPaso(p, guia, asigs, 'b@x.co', false)).toBe(true);
    expect(puedoRevisarPaso(p, guia, asigs, 'a@x.co', false)).toBe(true);
  });
  it('gestor: todo', () => {
    expect(puedoRevisarPaso(paso('ent-len'), guia, asigs, 'z@x.co', true)).toBe(true);
  });
  it('entregasPorRevisar: ent-<asig> entregado le aparece a todo docente de la guía, no a un ajeno', () => {
    const aprobada = guiaBase({ pasos: [paso('ent-len')] });
    const gg = g({ aprobada, seguimiento: { 'ent-len': { estado: 'entregado' } } });
    const d = { ...base, hoy: '2026-11-03', asigs, guias: [gg] };
    expect(entregasPorRevisar({ ...d, correo: 'b@x.co' })).toHaveLength(1);
    expect(entregasPorRevisar({ ...d, correo: 'a@x.co' })).toHaveLength(1);
    expect(entregasPorRevisar({ ...d, correo: 'z@x.co' })).toHaveLength(0);
  });
  it('docente en docentesCorreos, ni responsable ni de la asignatura del paso: lo ve por revisar', () => {
    const aprobada = guiaBase({ pasos: [paso('ent-len')] });
    const gg = g({ aprobada, docentesCorreos: ['a@x.co', 'c@x.co'], seguimiento: { 'ent-len': { estado: 'entregado' } } });
    expect(entregasPorRevisar({ ...base, hoy: '2026-11-03', correo: 'c@x.co', asigs, guias: [gg] })).toHaveLength(1);
  });
  it('paso «pendiente» con entregas reales cuenta como por revisar; sin entregas no', () => {
    const aprobada = guiaBase({ pasos: [paso('p1')] });
    const gg = g({ aprobada, seguimiento: { p1: { estado: 'pendiente' } } });
    const d = { ...base, hoy: '2026-11-03', correo: 'a@x.co', asigs, guias: [gg] };
    expect(entregasPorRevisar(d)).toHaveLength(0);
    expect(entregasPorRevisar({ ...d, conEntregas: { [llavePaso('g1', 'p1')]: 5 } })).toHaveLength(1);
  });
  it('paso revisado no aparece, ni con entregas reales', () => {
    const aprobada = guiaBase({ pasos: [paso('p1')] });
    const gg = g({ aprobada, seguimiento: { p1: { estado: 'revisado' } } });
    expect(entregasPorRevisar({ ...base, hoy: '2026-11-03', correo: 'a@x.co', asigs, guias: [gg], conEntregas: { [llavePaso('g1', 'p1')]: 5 } })).toHaveLength(0);
  });
  it('guía integrada: con parte propia deja de aparecer al marcarla; sin parte propia aparece hasta «revisado»', () => {
    const p = paso('p1', [{ asignaturaId: 'len' }]);
    const aprobada = guiaBase({ pasos: [p] });
    const gg = g({ aprobada, seguimiento: { p1: { estado: 'entregado', porAsignatura: { len: { revisado: true } } } } });
    const d = { ...base, hoy: '2026-11-03', asigs, guias: [gg] };
    expect(entregasPorRevisar({ ...d, correo: 'b@x.co' })).toHaveLength(0);
    expect(entregasPorRevisar({ ...d, correo: 'a@x.co' })).toHaveLength(1);
  });
});

describe('indiceColor', () => {
  it('es determinista y está en rango', () => {
    expect(indiceColor('abc', 6)).toBe(indiceColor('abc', 6));
    expect(indiceColor('abc', 6)).toBeLessThan(6);
  });
});
