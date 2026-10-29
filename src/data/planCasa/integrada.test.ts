import { describe, expect, it } from 'vitest';
import {
  capacidadPorSemana, estadoTrasRevision, faltanPorRevisar, fechaEntregaSemana, momentosPorSemana, nSemanas, revisionCompleta,
  semanaDeFecha, validarIntegrada, esGuiaIntegrable,
} from './integrada';
import type { Guia, PasoGuia } from './tipos';

const D = '2026-10-26';
const H = '2026-11-13'; // 3 semanas: 5, 4 (2-nov festivo) y 5 días hábiles

const paso = (id: string, semana: number, momentos = 1, extra: Partial<PasoGuia> = {}): PasoGuia => ({
  id, titulo: `T${id}`, instrucciones: '1. Hacer', momentos, evidencia: 'texto', evidenciaDetalle: 'x', semana, fecha: null, ...extra,
});
const guia = (pasos: PasoGuia[]): Guia => ({
  productoFinal: 'x', criteriosEvaluacion: ['a'], pasos,
  sustentacion: { modalidad: 'virtual', fecha: null, hora: null, lugarOEnlace: '', preguntasGuia: ['q'] },
});
const comp = (id: string) => ({ asignaturaId: id, parte: `parte ${id}`, queRevisar: `revisar ${id}` });
const asigs = [
  { asignaturaId: 'mat', nombre: 'Matemáticas', criterios: 'crit mat', entregable: 'ent mat', fechaEntrega: '2026-10-30' },
  { asignaturaId: 'eti', nombre: 'Ética', criterios: 'crit eti', entregable: 'ent eti' },
];
const ctx = { asignaturas: asigs, desde: D, hasta: H, topeDiario: 2, ritmo: 'diario' as const };

describe('capacidad por semana', () => {
  it('días hábiles por tope; el festivo no cuenta', () => {
    expect(nSemanas(D, H)).toBe(3);
    expect(capacidadPorSemana(D, H, 2)).toEqual([10, 8, 10]);
    expect(capacidadPorSemana(D, H, 3)).toEqual([15, 12, 15]);
  });
  it('día por medio: la mitad redondeada hacia arriba', () => {
    expect(capacidadPorSemana(D, H, 2, 'dia_por_medio')).toEqual([6, 4, 6]);
  });
  it('recorta a desde..hasta', () => {
    expect(capacidadPorSemana('2026-10-28', '2026-11-04', 2)).toEqual([6, 4]);
  });
  it('semanaDeFecha y suma de momentos', () => {
    expect(semanaDeFecha(D, H, '2026-11-04')).toBe(2);
    expect(semanaDeFecha(D, H, '2026-11-20')).toBe(0);
    expect(momentosPorSemana([paso('a', 1, 2), paso('b', 3, 1), paso('c', 3, 2)], 3)).toEqual([2, 0, 3]);
  });
});

describe('fechaEntregaSemana', () => {
  it('usa la fecha de los docentes en esa semana (la última); si no, el último día hábil', () => {
    expect(fechaEntregaSemana(D, H, 1, ['2026-10-28', '2026-10-30'])).toBe('2026-10-30');
    expect(fechaEntregaSemana(D, H, 2, ['2026-10-30'])).toBe('2026-11-06');
    expect(fechaEntregaSemana(D, H, 3, [undefined, '2026-12-01'])).toBe('2026-11-13');
  });
});

describe('validarIntegrada', () => {
  it('quita ent-*, deja una entrega por semana con componentes y las marca integrada', () => {
    const g = guia([
      paso('p1', 1, 1), paso('ent-mat', 1, 1), paso('p2', 1, 1, { esEntregaParcial: true, componentes: [comp('mat'), comp('eti')] }),
      paso('p3', 2, 1, { esEntregaParcial: true, componentes: [comp('mat')] }),
      paso('p4', 3, 1, { esEntregaParcial: true, componentes: [comp('eti'), { asignaturaId: 'fantasma', parte: 'x', queRevisar: 'y' }] }),
    ]);
    const r = validarIntegrada(g, ctx);
    expect(r.guia.integrada).toBe(true);
    expect(r.guia.pasos.some(p => p.id.startsWith('ent-'))).toBe(false);
    for (let k = 1; k <= 3; k++) expect(r.guia.pasos.filter(p => p.semana === k && p.esEntregaParcial).length).toBe(1);
    const ult3 = (l => l[l.length - 1])(r.guia.pasos.filter(p => p.semana === 3));
    expect(ult3.esEntregaParcial).toBe(true);
    expect(ult3.componentes!.map((c: { asignaturaId: string }) => c.asignaturaId)).toEqual(['eti']);
    expect(r.guia.pasos.map(p => p.id)).toEqual(r.guia.pasos.map((_, i) => `p${i + 1}`));
  });
  it('fechas: la de los docentes en la semana o el último día hábil; el resto sin fecha', () => {
    const g = guia([
      paso('p1', 1, 1, { fecha: '2026-10-27' }), paso('p2', 1, 1, { esEntregaParcial: true, componentes: [comp('mat'), comp('eti')] }),
      paso('p3', 2, 1, { esEntregaParcial: true, componentes: [comp('mat')] }),
      paso('p4', 3, 1, { esEntregaParcial: true, componentes: [comp('eti')] }),
    ]);
    const r = validarIntegrada(g, ctx);
    const entregas = r.guia.pasos.filter(p => p.esEntregaParcial);
    expect(entregas.map(p => p.fecha)).toEqual(['2026-10-30', '2026-11-06', '2026-11-13']);
    expect(r.guia.pasos.filter(p => !p.esEntregaParcial).every(p => p.fecha === null)).toBe(true);
  });
  it('agrega la asignatura que la IA omitió y avisa', () => {
    const g = guia([paso('p1', 1, 1, { esEntregaParcial: true, componentes: [comp('mat')] }), paso('p2', 2, 1, { esEntregaParcial: true, componentes: [comp('mat')] })]);
    const r = validarIntegrada(g, { ...ctx, hasta: '2026-11-06' });
    const todas = r.guia.pasos.flatMap(p => p.componentes ?? []).map(c => c.asignaturaId);
    expect(todas).toContain('eti');
    expect(r.avisos.some(a => a.includes('Ética'))).toBe(true);
  });
  it('rellena parte y qué revisar vacíos desde el entregable y los criterios; quita URLs', () => {
    const g = guia([paso('p1', 1, 1, { esEntregaParcial: true, instrucciones: 'Mira https://x.com/a ya', componentes: [{ asignaturaId: 'mat', parte: '', queRevisar: '' }, comp('eti')] })]);
    const r = validarIntegrada(g, { ...ctx, hasta: '2026-10-30' });
    const c = r.guia.pasos[0].componentes!.find(x => x.asignaturaId === 'mat')!;
    expect(c.parte).toBe('ent mat');
    expect(c.queRevisar).toBe('crit mat');
    expect(r.guia.pasos[0].instrucciones).not.toContain('http');
  });
  it('ajusta los momentos a la capacidad de la semana y avisa', () => {
    // semana 2: capacidad 8; pasos 4+4+4 = 12
    const g = guia([
      paso('p1', 1, 1, { esEntregaParcial: true, componentes: [comp('mat'), comp('eti')] }),
      paso('p2', 2, 4), paso('p3', 2, 4), paso('p4', 2, 4, { esEntregaParcial: true, componentes: [comp('mat')] }),
      paso('p5', 3, 1, { esEntregaParcial: true, componentes: [comp('eti')] }),
    ]);
    const r = validarIntegrada(g, ctx);
    const cap = capacidadPorSemana(D, H, 2);
    const mom = momentosPorSemana(r.guia.pasos, 3);
    mom.forEach((m, i) => expect(m).toBeLessThanOrEqual(cap[i]));
    expect(r.avisos.some(a => a.includes('semana 2'))).toBe(true);
    expect(r.guia.pasos.filter(p => p.semana === 2 && p.esEntregaParcial).length).toBe(1);
  });
  it('no altera lo que cabe y conserva los demás campos de la guía', () => {
    const g = { ...guia([paso('p1', 1, 1, { esEntregaParcial: true, componentes: [comp('mat'), comp('eti')] })]), notaAjustes: 'nota' };
    const r = validarIntegrada(g, { ...ctx, hasta: '2026-10-30' });
    expect(r.avisos).toEqual([]);
    expect(r.guia.notaAjustes).toBe('nota');
    expect(r.guia.sustentacion.preguntasGuia).toEqual(['q']);
  });
});

describe('revisión por asignatura', () => {
  const p = paso('p1', 1, 1, { esEntregaParcial: true, componentes: [comp('mat'), comp('eti')] });
  it('faltan los que no han revisado; completo cuando todos revisaron', () => {
    const seg = { estado: 'entregado' as const, porAsignatura: { mat: { revisado: true } } };
    expect(faltanPorRevisar(p, seg).map(c => c.asignaturaId)).toEqual(['eti']);
    expect(revisionCompleta(p, seg)).toBe(false);
    expect(revisionCompleta(p, { ...seg, porAsignatura: { mat: { revisado: true }, eti: { revisado: true } } })).toBe(true);
    expect(revisionCompleta(paso('p2', 1), undefined)).toBe(false);
  });
  it('estado tras revisión', () => {
    expect(estadoTrasRevision({ estado: 'entregado', entregadoEn: 1 }, true)).toBe('revisado');
    expect(estadoTrasRevision({ estado: 'revisado', entregadoEn: 1 }, false)).toBe('entregado');
    expect(estadoTrasRevision({ estado: 'revisado' }, false)).toBe('pendiente');
    expect(estadoTrasRevision(undefined, false)).toBe('pendiente');
  });
  it('esGuiaIntegrable', () => {
    expect(esGuiaIntegrable({ modalidad: 'por_asignatura' }, { asignaturaIds: ['a'] })).toBe(false);
    expect(esGuiaIntegrable({ modalidad: 'por_asignatura' }, { asignaturaIds: ['a', 'b'] })).toBe(true);
    expect(esGuiaIntegrable({ modalidad: 'transversal' }, { asignaturaIds: ['a'] })).toBe(true);
  });
});
