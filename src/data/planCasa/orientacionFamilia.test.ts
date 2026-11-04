import { beforeEach, describe, expect, it } from 'vitest';
import {
  CARITAS, GRUPOS_SUGERENCIA, SUGERENCIAS, conDia, conHabitual, formatearHora, formatoReloj, guardarCarita,
  guardarHorario, horaDeDia, horaValida, leerCaritas, leerHorario, pildoraDelDia, podarHorario, rangoEstudio,
} from './orientacionFamilia';

const memoria = () => {
  const m = new Map<string, string>();
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); },
    removeItem: (k: string) => { m.delete(k); }, clear: () => m.clear(), key: () => null, length: 0,
  } as Storage;
};

describe('horas', () => {
  it('valida y formatea', () => {
    expect(horaValida('15:00')).toBe(true);
    expect(horaValida('24:00')).toBe(false);
    expect(horaValida('9:00')).toBe(false);
    expect(formatearHora('15:00')).toBe('3:00 p. m.');
    expect(formatearHora('00:30')).toBe('12:30 a. m.');
    expect(formatearHora('12:05')).toBe('12:05 p. m.');
    expect(formatearHora('xx')).toBe('');
  });
  it('rango con momentos de 25 min', () => {
    expect(rangoEstudio('15:00', 2)).toBe('3:00 p. m. – 3:50 p. m.');
    expect(rangoEstudio('23:30', 2)).toBe('11:30 p. m. – 12:20 a. m.');
  });
});

describe('horario', () => {
  it('el ajuste del día manda sobre la hora habitual', () => {
    let h = conHabitual({ porDia: {} }, '15:00');
    expect(horaDeDia(h, '2026-11-03')).toBe('15:00');
    h = conDia(h, '2026-11-03', '17:30');
    expect(horaDeDia(h, '2026-11-03')).toBe('17:30');
    expect(horaDeDia(h, '2026-11-04')).toBe('15:00');
    h = conDia(h, '2026-11-03', null);
    expect(horaDeDia(h, '2026-11-03')).toBeNull();
    h = conDia(h, '2026-11-03', undefined);
    expect(horaDeDia(h, '2026-11-03')).toBe('15:00');
  });
  it('un ajuste igual a la habitual no se guarda; sin habitual no hay hora', () => {
    const h = conDia(conHabitual({ porDia: {} }, '15:00'), '2026-11-03', '15:00');
    expect(h.porDia).toEqual({});
    expect(horaDeDia({ porDia: {} }, '2026-11-03')).toBeNull();
  });
  it('cambiar la habitual conserva los ajustes; poda los días pasados', () => {
    let h = conDia({ porDia: {} }, '2026-11-10', '18:00');
    h = conHabitual(h, '16:00');
    expect(h.porDia['2026-11-10']).toBe('18:00');
    h = conDia(h, '2026-11-01', '10:00');
    expect(Object.keys(podarHorario(h, '2026-11-03').porDia)).toEqual(['2026-11-10']);
    expect(conHabitual(h, null).habitual).toBeUndefined();
  });
});

describe('almacenamiento', () => {
  beforeEach(memoria);
  it('guarda por token y descarta datos raros', () => {
    guardarHorario('tokA', { habitual: '15:00', porDia: { '2026-11-03': null } });
    expect(leerHorario('tokA').habitual).toBe('15:00');
    expect(leerHorario('tokB')).toEqual({ porDia: {} });
    localStorage.setItem('mjb:planCasa:horario:malo', '{"habitual":"99:99","porDia":{"x":"1","2026-11-03":"07:00"}}');
    expect(leerHorario('malo')).toEqual({ porDia: { '2026-11-03': '07:00' } });
    localStorage.setItem('mjb:planCasa:horario:roto', 'no json');
    expect(leerHorario('roto')).toEqual({ porDia: {} });
  });
  it('caritas por día', () => {
    guardarCarita('t', '2026-11-03', 'bien');
    expect(leerCaritas('t')['2026-11-03']).toBe('bien');
    expect(guardarCarita('t', '2026-11-03', null)).toEqual({});
  });
  it('sin localStorage no revienta', () => {
    (globalThis as unknown as { localStorage: unknown }).localStorage = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } };
    expect(leerHorario('t')).toEqual({ porDia: {} });
    expect(() => guardarHorario('t', { porDia: {} })).not.toThrow();
    expect(leerCaritas('t')).toEqual({});
  });
});

describe('pildora del dia', () => {
  it('es estable en el día, rota día a día y recorre todo el listado', () => {
    expect(pildoraDelDia('2026-11-03').id).toBe(pildoraDelDia('2026-11-03').id);
    expect(pildoraDelDia('2026-11-04').id).not.toBe(pildoraDelDia('2026-11-03').id);
    const vistas = new Set<string>();
    for (let i = 0; i < SUGERENCIAS.length; i++) vistas.add(pildoraDelDia(`2026-12-${String(1 + i).padStart(2, '0')}`).id);
    expect(vistas.size).toBe(SUGERENCIAS.length);
  });
  it('la semilla desfasa y todo grupo tiene contenido breve', () => {
    expect(pildoraDelDia('2026-11-03', SUGERENCIAS, 'abc')).toBeTruthy();
    for (const g of GRUPOS_SUGERENCIA) expect(SUGERENCIAS.filter(s => s.grupo === g.id).length).toBeGreaterThan(0);
    for (const s of SUGERENCIAS) expect(s.texto.length).toBeLessThan(200);
    expect(new Set(SUGERENCIAS.map(s => s.id)).size).toBe(SUGERENCIAS.length);
    expect(CARITAS).toHaveLength(3);
  });
});

describe('reloj', () => {
  it('formatea mm:ss', () => {
    expect(formatoReloj(1500)).toBe('25:00');
    expect(formatoReloj(61.2)).toBe('01:02');
    expect(formatoReloj(-5)).toBe('00:00');
  });
});
