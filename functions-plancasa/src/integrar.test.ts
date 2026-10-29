import { describe, expect, it } from 'vitest';
import { esquemaIntegrar, construirPromptIntegrar, sanearIntegrada } from './integrar';
import { construirPublico } from './publico';
import type { EntradaIntegrarGuia, Guia, GuiaPlan, PlanCasa } from '../../src/data/planCasa/tipos';

const guia: Guia = {
  productoFinal: 'Cartel', criteriosEvaluacion: ['a'],
  pasos: [
    { id: 'p1', titulo: 'Leer', instrucciones: '1. Lee', momentos: 1, evidencia: 'texto', evidenciaDetalle: 'r', semana: 1, fecha: null },
    { id: 'ent-mat', titulo: 'Entregable de Mat', instrucciones: 'x', momentos: 1, evidencia: 'foto', evidenciaDetalle: 'x', semana: 1, fecha: null },
  ],
  sustentacion: { modalidad: 'presencial', fecha: null, hora: null, lugarOEnlace: '', preguntasGuia: ['q'] },
};
const entrada: EntradaIntegrarGuia = {
  guia, eje: '¿Cómo cuidamos el agua?', grado: '8º', desde: '2026-10-26', hasta: '2026-11-06', ajustes: ['Lecturas cortas'], topeDiario: 2, ritmo: 'diario',
  asignaturas: [
    { asignaturaId: 'mat', nombre: 'Matemáticas', criterios: 'Resuelve', entregable: 'Taller', fechaEntrega: '2026-10-29' },
    { asignaturaId: 'eti', nombre: 'Ética', criterios: 'Reflexiona', entregable: 'Cartel' },
  ],
};

describe('construirPromptIntegrar', () => {
  const p = construirPromptIntegrar(entrada);
  it('incluye capacidad por semana, datos de cada docente y la guía actual sin ent-*', () => {
    for (const t of ['Semana 1: 10 momentos', 'Semana 2: 8 momentos', 'id «mat»', 'Taller', '2026-10-29', 'Resuelve', 'Leer', '¿Cómo cuidamos el agua?']) expect(p).toContain(t);
    expect(p).not.toContain('Entregable de Mat');
  });
  it('no menciona nombre ni motivo del estudiante', () => expect(p).not.toMatch(/nombre del estudiante|motivo/i));
});

describe('esquemaIntegrar', () => {
  it('agrega componentes por paso con el id restringido', () => {
    const e = esquemaIntegrar(['mat', 'eti']) as any;
    const it = e.properties.pasos.items;
    expect(it.required).toContain('componentes');
    expect(it.properties.componentes.items.properties.asignaturaId.enum).toEqual(['mat', 'eti']);
  });
});

describe('sanearIntegrada', () => {
  const bruto = {
    productoFinal: 'Cartel', evidenciasAprendizaje: [], criteriosEvaluacion: ['c'], preguntasSustentacion: ['q'], sustentacionModalidad: 'presencial', notaAjustes: '',
    pasos: [
      { titulo: 'Leer', instrucciones: '1. Lee https://x.com', momentos: 1, evidencia: 'texto', evidenciaDetalle: 'r', semana: 1, esEntregaParcial: false, canalEntrega: '', ajusteAplicado: '', lectura: '', componentes: [] },
      { titulo: 'Entrega 1', instrucciones: '1. Une', momentos: 1, evidencia: 'foto', evidenciaDetalle: 'Cartel con taller', semana: 1, esEntregaParcial: true, canalEntrega: 'Foto', ajusteAplicado: '', lectura: '',
        componentes: [{ asignaturaId: 'mat', parte: 'El taller', queRevisar: 'Procedimiento' }] },
      { titulo: 'Entrega 2', instrucciones: '1. Une', momentos: 1, evidencia: 'foto', evidenciaDetalle: 'Reflexión', semana: 2, esEntregaParcial: true, canalEntrega: 'Foto', ajusteAplicado: '', lectura: '',
        componentes: [{ asignaturaId: 'eti', parte: 'La reflexión', queRevisar: 'Coherencia' }] },
    ],
  };
  it('integrada, una entrega por semana, componentes, fecha del docente y sin URLs', () => {
    const r = sanearIntegrada(bruto, entrada)!;
    expect(r.guia.integrada).toBe(true);
    const entregas = r.guia.pasos.filter(p => p.esEntregaParcial);
    expect(entregas).toHaveLength(2);
    expect(entregas[0].fecha).toBe('2026-10-29');
    expect(entregas[1].fecha).toBe('2026-11-06');
    expect(entregas[0].componentes?.[0]).toMatchObject({ asignaturaId: 'mat', parte: 'El taller' });
    expect(r.guia.pasos[0].instrucciones).not.toContain('http');
    expect(r.avisos).toEqual([]);
  });
  it('null si la respuesta no sirve', () => expect(sanearIntegrada({}, entrada)).toBeNull());
});

describe('copia pública de una entrega integrada', () => {
  it('lleva el nombre de cada asignatura, quién revisó y su comentario', () => {
    const r = sanearIntegrada({
      productoFinal: 'P', criteriosEvaluacion: ['c'], preguntasSustentacion: ['q'], sustentacionModalidad: 'presencial',
      pasos: [{ titulo: 'E', instrucciones: '1. a', momentos: 1, evidencia: 'foto', evidenciaDetalle: 'x', semana: 1, esEntregaParcial: true,
        componentes: [{ asignaturaId: 'mat', parte: 'a', queRevisar: 'b' }, { asignaturaId: 'eti', parte: 'c', queRevisar: 'd' }] }],
    }, { ...entrada, hasta: '2026-10-30' })!;
    const g = { id: 'g1', asignaturaIds: ['mat', 'eti'], eje: 'Agua', responsableCorreo: 'r@x', docentesCorreos: ['r@x'], vistosBuenos: {},
      aprobada: r.guia, sustentacionEstado: 'sin_citar', actualizadoEn: 1,
      seguimiento: { p1: { estado: 'entregado', porAsignatura: { mat: { revisado: true, comentario: 'Muy bien' } } } } } as unknown as GuiaPlan;
    const plan = { nombres: 'Ana', apellidos: 'P', grupo: '8º1', desde: '2026-10-26', hasta: '2026-10-30', tokenPublico: 't' } as PlanCasa;
    const pub = construirPublico(plan, [g], id => (id === 'mat' ? 'Matemáticas' : 'Ética'), () => 'D', 1);
    const comps = pub.pasos[0].componentes!;
    expect(comps[0]).toMatchObject({ asignatura: 'Matemáticas', revisado: true, comentario: 'Muy bien' });
    expect(comps[1].asignatura).toBe('Ética');
    expect(comps[1].revisado).toBeUndefined();
    expect(pub.pasos[0].revisado).toBeUndefined();
  });
});
