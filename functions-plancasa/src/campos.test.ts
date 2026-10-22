import { describe, expect, it } from 'vitest';
import { construirPromptCampos, esquemaCampos, sanearCampos } from './campos';

describe('construirPromptCampos', () => {
  it('modo asignatura incluye grado, asignatura, pregunta, ajustes y existentes', () => {
    const p = construirPromptCampos({ modo: 'asignatura', asignaturas: ['Física'], grado: '10°', preguntaOrientadora: '¿Cómo ahorrar agua?', ajustes: ['Pocas tareas'], existentes: { aportes: 'caudal' } });
    expect(p).toContain('Asignatura: Física');
    expect(p).toContain('Grado: 10°');
    expect(p).toContain('¿Cómo ahorrar agua?');
    expect(p).toContain('- Pocas tareas');
    expect(p).toContain('- aportes: caudal');
    expect(p).toContain('criteriosPromocion');
  });
  it('modo pedido lista asignaturas y pide sus campos', () => {
    const p = construirPromptCampos({ modo: 'pedido', asignaturas: ['Química', 'Lengua'], grado: '9°' });
    expect(p).toContain('Química, Lengua');
    expect(p).toContain('textoReferencia');
    expect(p).toContain('(no hay)');
  });
});

describe('esquemaCampos / sanearCampos', () => {
  it('esquema requiere las claves del modo', () => {
    expect(esquemaCampos('pedido').required).toEqual(['tematicas', 'competencias', 'textoReferencia']);
  });
  it('conserva solo claves esperadas y limpia', () => {
    const r = sanearCampos({ tematicas: '  a  b ', competencias: 'c', textoReferencia: 5, otra: 'x' }, 'pedido');
    expect(r).toEqual({ tematicas: 'a b', competencias: 'c', textoReferencia: '' });
  });
  it('null si todo vacío o basura', () => {
    expect(sanearCampos({ tematicas: '' }, 'pedido')).toBeNull();
    expect(sanearCampos('x', 'asignatura')).toBeNull();
  });
});
