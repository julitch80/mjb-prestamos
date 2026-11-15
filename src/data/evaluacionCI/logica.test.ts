import { describe, expect, it } from 'vitest';
import {
  armarDocumento, filtrar, instrumentoDeGrado, porcentaje, puedeVerResultados, resumir, filasExcel, type RespuestaCI,
} from './logica';

const A = (g: string, p: string[], extra: Partial<RespuestaCI> = {}): RespuestaCI => ({
  instrumento: 'A', grado: g, sede: 'principal', respuestas: { p1: p[0], p2: p[1], p3: p[2], p4: p[3] }, creado: null, ...extra,
});
const B = (g: string, v: string): RespuestaCI => ({
  instrumento: 'B', grado: g, sede: null, creado: null,
  respuestas: Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`p${i + 1}`, v])),
});

describe('instrumentoDeGrado', () => {
  it('preescolar a 2.° es A; 3.° a 11.° es B; otro es null', () => {
    expect(['preescolar', '1', '2'].map(instrumentoDeGrado)).toEqual(['A', 'A', 'A']);
    expect(['3', '6', '11'].map(instrumentoDeGrado)).toEqual(['B', 'B', 'B']);
    expect(instrumentoDeGrado('12')).toBeNull();
  });
});

describe('armarDocumento', () => {
  const ok = { p1: 'feliz', p2: 'neutral', p3: 'triste', p4: 'feliz' };
  it('arma A y recorta el comentario a 100', () => {
    const d = armarDocumento('1', 'principal', ok, 'x'.repeat(150))!;
    expect(d.instrumento).toBe('A');
    expect(d.comentario).toHaveLength(100);
  });
  it('rechaza faltantes o valores fuera de dominio', () => {
    expect(armarDocumento('1', null, { ...ok, p4: '' }, '')).toBeNull();
    expect(armarDocumento('1', null, { ...ok, p1: 'si' }, '')).toBeNull();
    expect(armarDocumento('1', 'otra', ok, '')).toBeNull();
  });
  it('B no lleva comentario y exige las 10', () => {
    const r = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`p${i + 1}`, 'si']));
    expect(armarDocumento('7', null, r, 'hola')!.comentario).toBeUndefined();
    expect(armarDocumento('7', null, { ...r, p10: '' }, '')).toBeNull();
  });
});

describe('resumir y filtrar', () => {
  const rs = [A('1', ['feliz', 'feliz', 'neutral', 'triste'], { comentario: 'pintar' }), A('2', ['feliz', 'triste', 'neutral', 'triste']), B('7', 'si'), B('8', 'no')];
  it('cuenta por instrumento y pregunta', () => {
    const r = resumir(rs);
    expect([r.total, r.totalA, r.totalB]).toEqual([4, 2, 2]);
    expect(r.A[0].valores).toEqual({ feliz: 2, neutral: 0, triste: 0 });
    expect(r.A[3].valores.triste).toBe(2);
    expect(r.B[9].valores).toEqual({ si: 1, no: 1 });
    expect(r.comentarios).toHaveLength(1);
  });
  it('filtra por grado y sede (incluye sin dato)', () => {
    expect(filtrar(rs, { grado: '7', sede: '' })).toHaveLength(1);
    expect(filtrar(rs, { grado: '', sede: 'principal' })).toHaveLength(2);
    expect(filtrar(rs, { grado: '', sede: 'sin_dato' })).toHaveLength(2);
  });
  it('porcentaje sin división por cero', () => {
    expect(porcentaje(1, 3)).toBe(33.3);
    expect(porcentaje(0, 0)).toBe(0);
  });
  it('resumen vacío no revienta', () => {
    expect(resumir([]).A[0].total).toBe(0);
  });
});

describe('filasExcel', () => {
  it('cabecera + una fila por respuesta', () => {
    const f = filasExcel([A('preescolar', ['feliz', 'feliz', 'feliz', 'feliz'])]);
    expect(f).toHaveLength(2);
    expect(f[0][0]).toBe('Fecha');
    expect(f[1][2]).toBe('Preescolar');
    expect(f[1][4]).toBe('Feliz');
  });
});

describe('puedeVerResultados', () => {
  it('roles directivos, yuri y correos autorizados; docente común no', () => {
    expect(puedeVerResultados('coordinador', 'x', null, [])).toBe(true);
    expect(puedeVerResultados('rectora', 'x', null, [])).toBe(true);
    expect(puedeVerResultados('superusuario', 'x', null, [])).toBe(true);
    expect(puedeVerResultados('docente', 'yuri', null, [])).toBe(true);
    expect(puedeVerResultados('docente', 'z', 'Yuri@a.co', ['yuri@a.co'])).toBe(true);
    expect(puedeVerResultados('docente', 'z', 'otro@a.co', ['yuri@a.co'])).toBe(false);
  });
});
