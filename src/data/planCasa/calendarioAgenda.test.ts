import { describe, it, expect } from 'vitest';
import { agruparPorDia, cuadriculaMes, enRango, hayMesAnterior, hayMesSiguiente, limitarMes, lunesDe, semanaDe, sumarMeses } from './calendarioAgenda';

describe('calendarioAgenda', () => {
  it('semanaDe va de lunes a domingo', () => {
    // 2026-10-30 es viernes
    const s = semanaDe('2026-10-30');
    expect(s).toHaveLength(7);
    expect(s[0]).toBe('2026-10-26');
    expect(s[6]).toBe('2026-11-01');
  });
  it('lunesDe un domingo es el lunes anterior', () => {
    expect(lunesDe('2026-11-01')).toBe('2026-10-26');
    expect(lunesDe('2026-10-26')).toBe('2026-10-26');
  });
  it('cuadriculaMes cubre semanas completas empezando en lunes', () => {
    const c = cuadriculaMes('2026-10-15');
    expect(c.length % 7).toBe(0);
    expect(c[0].fecha).toBe('2026-09-28');
    expect(c[0].delMes).toBe(false);
    expect(c.find(x => x.fecha === '2026-10-01')?.delMes).toBe(true);
    expect(c[c.length - 1].fecha).toBe('2026-11-01');
    expect(c.filter(x => x.delMes)).toHaveLength(31);
  });
  it('febrero que empieza en lunes tiene 4 filas', () => {
    // 2027-02-01 es lunes
    expect(cuadriculaMes('2027-02-10')).toHaveLength(28);
  });
  it('agruparPorDia omite pasos sin fecha', () => {
    const g = agruparPorDia([{ fecha: '2026-10-01', n: 1 }, { fecha: '2026-10-01', n: 2 }, { fecha: null, n: 3 }, { fecha: '2026-10-02', n: 4 }]);
    expect(g['2026-10-01']).toHaveLength(2);
    expect(Object.keys(g)).toHaveLength(2);
  });
  it('navegación de meses limitada al plan', () => {
    expect(sumarMeses('2026-12-01', 1)).toBe('2027-01-01');
    expect(sumarMeses('2026-01-01', -1)).toBe('2025-12-01');
    expect(hayMesAnterior('2026-10-01', '2026-10-20')).toBe(false);
    expect(hayMesSiguiente('2026-10-01', '2026-11-05')).toBe(true);
    expect(hayMesSiguiente('2026-11-01', '2026-11-05')).toBe(false);
    expect(limitarMes('2026-09-01', '2026-10-20', '2026-11-05')).toBe('2026-10-01');
    expect(limitarMes('2027-01-01', '2026-10-20', '2026-11-05')).toBe('2026-11-01');
  });
  it('enRango incluye los extremos', () => {
    expect(enRango('2026-10-20', '2026-10-20', '2026-11-05')).toBe(true);
    expect(enRango('2026-11-06', '2026-10-20', '2026-11-05')).toBe(false);
  });
});
