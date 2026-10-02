import { describe, it, expect } from 'vitest';
import { TECNICAS_RESPIRACION, buscarTecnica, duracionCiclo, estadoEn, ESCALA_MIN, ESCALA_MAX } from './respiracionGuiada';

describe('respiracionGuiada', () => {
  it('define las 5 técnicas con la calma por defecto primero', () => {
    expect(TECNICAS_RESPIRACION.map(t => t.id)).toEqual(['calma', '4-2-8', 'caja', 'suspiro', 'coherente']);
    expect(duracionCiclo(buscarTecnica('calma'))).toBe(12);
    expect(duracionCiclo(buscarTecnica('4-2-8'))).toBe(14);
    expect(duracionCiclo(buscarTecnica('caja'))).toBe(16);
    expect(duracionCiclo(buscarTecnica('suspiro'))).toBe(9);
    expect(duracionCiclo(buscarTecnica('coherente'))).toBe(10);
  });

  it('calma: fase y cuenta regresiva según el tiempo', () => {
    const t = buscarTecnica('calma');
    let e = estadoEn(t, 0);
    expect([e.fase.tipo, e.segRestantes, e.escala]).toEqual(['inhala', 4, ESCALA_MIN]);
    e = estadoEn(t, 3.2);
    expect([e.fase.tipo, e.segRestantes]).toEqual(['inhala', 1]);
    e = estadoEn(t, 4.5);
    expect([e.fase.tipo, e.segRestantes, e.escala]).toEqual(['sostén', 2, ESCALA_MAX]);
    e = estadoEn(t, 6);
    expect([e.fase.tipo, e.segRestantes]).toEqual(['exhala', 6]);
    e = estadoEn(t, 12.1);
    expect([e.ciclo, e.fase.tipo, e.segRestantes]).toEqual([1, 'inhala', 4]);
  });

  it('crece al inhalar y se encoge al exhalar', () => {
    const t = buscarTecnica('coherente');
    expect(estadoEn(t, 2.5).escala).toBeGreaterThan(estadoEn(t, 0.5).escala);
    expect(estadoEn(t, 9.5).escala).toBeLessThan(estadoEn(t, 5.5).escala);
  });

  it('suspiro: segunda inhalación es un crecimiento extra', () => {
    const t = buscarTecnica('suspiro');
    const fin1 = estadoEn(t, 1.999);
    const e = estadoEn(t, 2.5);
    expect(e.fase.tipo).toBe('inhala2');
    expect(e.escala).toBeGreaterThan(fin1.escala);
    expect(estadoEn(t, 2.999).escala).toBeCloseTo(ESCALA_MAX, 1);
    expect(estadoEn(t, 3).fase.tipo).toBe('exhala');
  });

  it('caja: la segunda pausa mantiene el círculo pequeño', () => {
    const t = buscarTecnica('caja');
    const e = estadoEn(t, 13);
    expect(e.fase.tipo).toBe('sostén');
    expect(e.indiceFase).toBe(3);
    expect(e.escala).toBe(ESCALA_MIN);
  });

  it('tiempo negativo o id desconocido no rompen', () => {
    expect(estadoEn(buscarTecnica('x'), -5).ciclo).toBe(0);
  });
});
