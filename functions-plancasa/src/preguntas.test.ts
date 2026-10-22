import { describe, expect, it } from 'vitest';
import { construirPromptPreguntas, sanearPreguntas } from './preguntas';

describe('construirPromptPreguntas', () => {
  it('incluye grado, asignaturas, temática y ajustes', () => {
    const p = construirPromptPreguntas({ tematica: 'el agua', asignaturas: ['Química', 'Lengua'], grado: '10.1', ajustes: ['Pocas tareas'] });
    expect(p).toContain('Grado: 10.1');
    expect(p).toContain('Química, Lengua');
    expect(p).toContain('el agua');
    expect(p).toContain('- Pocas tareas');
  });
  it('tolera entradas vacías', () => {
    const p = construirPromptPreguntas({ tematica: '', asignaturas: [], grado: '' });
    expect(p).toContain('(ninguno específico)');
    expect(p).toContain('libre');
  });
});

describe('sanearPreguntas', () => {
  const ok = { pregunta: ' ¿Cómo cuidamos el agua? ', porQue: 'Cerca', aportes: [{ asignatura: 'Química', aporte: 'pH' }, { asignatura: '', aporte: 'x' }], producto: 'Cartilla' };
  it('recorta y filtra aportes vacíos', () => {
    const r = sanearPreguntas({ preguntas: [ok] });
    expect(r).toHaveLength(1);
    expect(r[0].pregunta).toBe('¿Cómo cuidamos el agua?');
    expect(r[0].aportes).toEqual([{ asignatura: 'Química', aporte: 'pH' }]);
  });
  it('descarta sin pregunta o sin producto y limita a 8', () => {
    const r = sanearPreguntas({ preguntas: [{ ...ok, pregunta: '' }, { ...ok, producto: '' }, ...Array(12).fill(ok)] });
    expect(r).toHaveLength(8);
  });
  it('devuelve vacío con basura', () => {
    expect(sanearPreguntas(null)).toEqual([]);
    expect(sanearPreguntas({ preguntas: 'x' })).toEqual([]);
  });
});
