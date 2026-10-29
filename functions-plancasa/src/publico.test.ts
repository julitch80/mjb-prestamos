import { describe, expect, it } from 'vitest';
import { construirPublico, primerNombre } from './publico';
import type { GuiaPlan, Guia, PlanCasa } from '../../src/data/planCasa/tipos';

const guia: Guia = {
  productoFinal: 'x', criteriosEvaluacion: ['a'],
  pasos: [{ id: 'p1', titulo: 't', instrucciones: 'i', momentos: 1, evidencia: 'foto', evidenciaDetalle: '', fecha: '2026-10-27' }],
  sustentacion: { modalidad: 'presencial', fecha: null, hora: null, lugarOEnlace: '', preguntasGuia: ['q'] },
};
const plan = {
  id: 'p', studentId: 's', nombres: 'María José', apellidos: 'Pérez Gómez', grupo: '8º1', desde: '2026-10-26', hasta: '2026-11-20',
  ajustes: ['secreto'], topeDiario: 3, estado: 'activo', tokenPublico: 'tok', creadoPor: 'a@b', creadoEn: 1, actualizadoEn: 1,
} as PlanCasa;
const base = { vistosBuenos: {}, seguimiento: {}, sustentacionEstado: 'sin_citar', actualizadoEn: 1, responsableCorreo: 'Resp@x.co', docentesCorreos: ['resp@x.co'] } as const;
const guias: GuiaPlan[] = [
  { ...base, id: 'fisica', asignaturaIds: ['fisica'], eje: 'Física', aprobada: guia },
  { ...base, id: 'mat', asignaturaIds: ['mat'], eje: 'Mat', propuesta: guia },
  { ...base, id: 't1', asignaturaIds: ['ciencias', 'lengua'], eje: 'El agua', aprobada: guia },
];

describe('construirPublico', () => {
  const pub = construirPublico(plan, guias, id => `A-${id}`, c => `D-${c}`, 99);
  it('solo primer nombre y guías aprobadas', () => {
    expect(pub.primerNombre).toBe('María');
    expect(pub.pasos).toHaveLength(2);
    expect(pub.pasos[0]).toMatchObject({ asignatura: 'A-fisica', docente: 'D-resp@x.co' });
    expect(pub.sustentaciones).toHaveLength(2);
  });
  it('etiqueta la guía transversal con eje y asignaturas', () => {
    expect(pub.pasos[1].asignatura).toBe('El agua (A-ciencias · A-lengua)');
  });
  it('no filtra apellidos, ajustes ni token', () => {
    const s = JSON.stringify(pub);
    for (const t of ['Pérez', 'Gómez', 'secreto', 'tok', 'studentId']) expect(s).not.toContain(t);
  });
  it('lleva guiaId y entregadoEn del seguimiento (entregas)', () => {
    const conEntrega = guias.map(g => g.id === 'fisica' ? { ...g, seguimiento: { p1: { estado: 'entregado' as const, entregadoEn: 7 } } } : g);
    const p2 = construirPublico(plan, conEntrega, id => id, c => c, 1);
    expect(p2.pasos[0]).toMatchObject({ guiaId: 'fisica', entregadoEn: 7 });
    expect(p2.pasos[1].guiaId).toBe('t1');
    expect('entregadoEn' in p2.pasos[1]).toBe(false);
  });
  it('primerNombre tolera vacío', () => expect(primerNombre('')).toBe(''));
});

import { cambioAfectaPublico } from './publico';
describe('cambioAfectaPublico', () => {
  const base = { eje: 'x', asignaturaIds: ['a'], responsableCorreo: 'a@b.c', aprobada: { pasos: [] }, seguimiento: {} } as never;
  it('ignora campos irrelevantes y detecta los relevantes', () => {
    expect(cambioAfectaPublico(base, { ...(base as object), vistosBuenos: { x: 1 }, pedido: 'p' } as never)).toBe(false);
    expect(cambioAfectaPublico(base, { ...(base as object), seguimiento: { p1: { estado: 'revisado' } } } as never)).toBe(true);
    expect(cambioAfectaPublico(undefined, base)).toBe(true);
  });
});
