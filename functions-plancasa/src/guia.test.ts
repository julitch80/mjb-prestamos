import { describe, expect, it } from 'vitest';
import { construirPrompt, sanearGuia } from './guia';

const entrada = {
  asignatura: 'Física', grado: '10°', desde: '2026-10-26', hasta: '2026-11-20',
  ajustes: ['Lecturas cortas', 'Evitar trabajo en equipo'], topeDiario: 3, semanas: 4, ritmo: 'diario' as const,
  criteriosPromocion: 'Explica la caída libre.',
  pedido: { tematicas: 'Cinemática', competencias: 'Explicar fenómenos', textoReferencia: 'Un texto.' },
  indicacion: 'más práctica',
};

describe('construirPrompt', () => {
  const p = construirPrompt(entrada);
  it('incluye ajustes, criterios, tope, referencia e indicación', () => {
    for (const t of ['Lecturas cortas', 'caída libre', 'Cinemática', 'Un texto.', 'más práctica', 'asignaturas: 3.']) expect(p).toContain(t);
  });
  it('limita el tope por paso a 3', () => expect(p).toContain('superar 3 momentos'));
  it('sin referencia ni indicación no las menciona', () => {
    const q = construirPrompt({ ...entrada, indicacion: undefined, pedido: { tematicas: 'a', competencias: 'b' } });
    expect(q).not.toContain('referencia del docente');
    expect(q).not.toContain('otra versión');
  });
});

describe('construirPrompt UAI', () => {
  it('incluye semanas y ritmo', () => {
    expect(construirPrompt(entrada)).toContain('Semanas del periodo: 4');
    expect(construirPrompt(entrada)).toContain('Ritmo: diario');
    const q = construirPrompt({ ...entrada, ritmo: 'dia_por_medio' });
    expect(q).toContain('día por medio');
  });
  it('transversal lleva pregunta orientadora, EBC/DBA y evidencia por área', () => {
    const p = construirPrompt({ ...entrada, transversal: { eje: '¿Cómo cuidamos el agua?', asignaturas: [
      { nombre: 'Ciencias', criteriosPromocion: 'c', ebcDba: 'DBA 4 ciclo del agua', evidenciaAprendizaje: 'Esquema del ciclo' }] } });
    for (const t of ['Pregunta orientadora', '¿Cómo cuidamos el agua?', 'EBC/DBA priorizado: DBA 4', 'Evidencia de aprendizaje esperada: Esquema']) expect(p).toContain(t);
  });
});

describe('construirPrompt transversal', () => {
  it('lista eje, asignaturas y pide menos carga', () => {
    const p = construirPrompt({ ...entrada, transversal: { eje: 'El agua', asignaturas: [
      { nombre: 'Ciencias', criteriosPromocion: 'Ciclo del agua', aportes: 'experimento' }, { nombre: 'Lengua', criteriosPromocion: 'Texto expositivo' }] } });
    for (const t of ['GUÍA TRANSVERSAL', 'El agua', '- Ciencias: Ciclo del agua', 'experimento', '- Lengua: Texto expositivo']) expect(p).toContain(t);
    expect(p).not.toContain('Criterios mínimos de promoción en esta asignatura');
  });
});

describe('sanearGuia UAI', () => {
  const base = {
    productoFinal: 'Cartel', criteriosEvaluacion: ['a'], preguntasSustentacion: ['¿p?'], notaAjustes: '',
    evidenciasAprendizaje: [{ asignatura: 'Ciencias', evidencia: 'Esquema' }, { asignatura: '', evidencia: 'x' }],
    sustentacionModalidad: 'esquema',
    pasos: [
      { titulo: 'B1', instrucciones: 'i', momentos: 2, evidencia: 'foto', evidenciaDetalle: '', semana: 2, esEntregaParcial: false, canalEntrega: 'Foto por WhatsApp', ajusteAplicado: 'Textos cortos' },
      { titulo: 'A1', instrucciones: 'i', momentos: 1, evidencia: 'audio', evidenciaDetalle: '', semana: 1, esEntregaParcial: true, canalEntrega: '', ajusteAplicado: '' },
      { titulo: 'A2', instrucciones: 'i', momentos: 1, evidencia: 'audio', evidenciaDetalle: '', semana: 1, esEntregaParcial: false, canalEntrega: 'Audio', ajusteAplicado: '' },
      { titulo: 'Z', instrucciones: 'i', momentos: 1, evidencia: 'audio', evidenciaDetalle: '', semana: 7, esEntregaParcial: false, canalEntrega: '', ajusteAplicado: '' },
    ],
  };
  const g = sanearGuia(base, 3, 3)!;
  it('ordena por semana, limita la semana y marca una entrega parcial por semana', () => {
    expect(g.pasos.map(p => p.titulo)).toEqual(['A1', 'A2', 'B1', 'Z']);
    expect(g.pasos.map(p => p.semana)).toEqual([1, 1, 2, 3]);
    expect(g.pasos.map(p => p.esEntregaParcial)).toEqual([false, true, true, true]);
    expect(g.pasos.map(p => p.id)).toEqual(['p1', 'p2', 'p3', 'p4']);
    expect(g.pasos[2].canalEntrega).toBe('Foto por WhatsApp');
    expect(g.pasos[0].canalEntrega).toBeUndefined();
  });
  it('evidencias por área y modalidad de sustentación', () => {
    expect(g.evidenciasAprendizaje).toEqual([{ asignatura: 'Ciencias', evidencia: 'Esquema' }]);
    expect(g.sustentacion.modalidad).toBe('esquema');
    expect(sanearGuia({ ...base, sustentacionModalidad: 'rara' }, 3, 3)!.sustentacion.modalidad).toBe('presencial');
  });
});

describe('sanearGuia', () => {
  const ok = {
    productoFinal: 'Informe', criteriosEvaluacion: ['a', 'b', 'c', 'd', 'e'],
    pasos: [
      { titulo: 'Uno', instrucciones: 'Haz esto', momentos: 9, evidencia: 'foto', evidenciaDetalle: 'foto del cuaderno' },
      { titulo: 'Dos', instrucciones: 'Haz aquello', momentos: 0, evidencia: 'raro', evidenciaDetalle: '' },
      { titulo: '', instrucciones: 'x', momentos: 1, evidencia: 'texto', evidenciaDetalle: '' },
    ],
    preguntasSustentacion: ['¿p1?', '¿p2?', '¿p3?'], notaAjustes: 'Nota',
  };
  it('ajusta ids, momentos, evidencia y fechas', () => {
    const g = sanearGuia(ok, 3)!;
    expect(g.pasos.map(p => p.id)).toEqual(['p1', 'p2']);
    expect(g.pasos[0].momentos).toBe(3);
    expect(g.pasos[1].momentos).toBe(1);
    expect(g.pasos[1].evidencia).toBe('texto');
    expect(g.pasos.every(p => p.fecha === null)).toBe(true);
    expect(g.criteriosEvaluacion).toHaveLength(4);
    expect(g.sustentacion.modalidad).toBe('presencial');
    expect(g.sustentacion.fecha).toBeNull();
  });
  it('rechaza respuestas incompletas', () => {
    expect(sanearGuia(null, 4)).toBeNull();
    expect(sanearGuia({ ...ok, pasos: [] }, 4)).toBeNull();
    expect(sanearGuia({ ...ok, productoFinal: '' }, 4)).toBeNull();
  });
});
