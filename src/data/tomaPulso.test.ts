import { describe, it, expect } from 'vitest';
import { clasificarPulso, lpmPorConteo, lpmPorToques, formatearRegistro } from './tomaPulso';

const serie = (ints: number[]) => ints.reduce<number[]>((a, d) => [...a, a[a.length - 1] + d], [0]);

describe('tomaPulso', () => {
  it('conteo', () => {
    expect(lpmPorConteo(18, 15)).toBe(72);
    expect(lpmPorConteo(37, 30)).toBe(74);
    expect(lpmPorConteo(70, 60)).toBe(70);
  });
  it('toques: mediana y descartes', () => {
    const r = lpmPorToques(serie([800, 800, 800, 800, 800, 800, 800]))!;
    expect(r.lpm).toBe(75);
    expect(r.irregular).toBe(false);
    // un intervalo de 100 ms (doble toque) y uno de 4000 ms se descartan
    const r2 = lpmPorToques(serie([800, 100, 800, 4000, 800, 800, 800]))!;
    expect(r2.lpm).toBe(75);
    expect(r2.intervalosUsados).toBe(5);
  });
  it('toques: mínimo de toques', () => {
    expect(lpmPorToques(serie([800, 800, 800, 800]))).toBeNull();
  });
  it('toques: irregular', () => {
    const r = lpmPorToques(serie([500, 1100, 600, 1200, 450, 1000, 700]))!;
    expect(r.irregular).toBe(true);
  });
  it('clasificación en límites', () => {
    expect(clasificarPulso(70, '6-11')).toBe('normal');
    expect(clasificarPulso(69, '6-11')).toBe('vigilar');
    expect(clasificarPulso(60, '6-11')).toBe('vigilar');
    expect(clasificarPulso(59, '6-11')).toBe('alerta');
    expect(clasificarPulso(120, '6-11')).toBe('normal');
    expect(clasificarPulso(121, '6-11')).toBe('vigilar');
    expect(clasificarPulso(140, '6-11')).toBe('vigilar');
    expect(clasificarPulso(141, '6-11')).toBe('alerta');
    for (const e of ['12-17', 'adulto'] as const) {
      expect(clasificarPulso(60, e)).toBe('normal');
      expect(clasificarPulso(100, e)).toBe('normal');
      expect(clasificarPulso(101, e)).toBe('vigilar');
      expect(clasificarPulso(120, e)).toBe('vigilar');
      expect(clasificarPulso(121, e)).toBe('alerta');
      expect(clasificarPulso(59, e)).toBe('vigilar');
      expect(clasificarPulso(50, e)).toBe('vigilar');
      expect(clasificarPulso(49, e)).toBe('alerta');
    }
  });
  it('registro en texto', () => {
    const t = formatearRegistro([{ hora: '10:05', lpm: 72, modo: 'toques', edad: 'adulto', semaforo: 'normal' }]);
    expect(t).toContain('10:05 - 72 lpm');
  });
});
