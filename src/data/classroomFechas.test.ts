import { describe, it, expect } from 'vitest';
import { distanciaDias, fechasMasCercanas } from './classroomFechas';

describe('classroomFechas', () => {
  it('distanciaDias', () => {
    expect(distanciaDias('2026-10-05', '2026-10-08')).toBe(3);
    expect(distanciaDias('2026-10-08', '2026-10-05')).toBe(3);
  });
  it('ordena por cercanía al objetivo y devuelve en orden cronológico', () => {
    const c = ['2026-10-06', '2026-10-09', '2026-10-13', '2026-10-20'];
    expect(fechasMasCercanas(c, '2026-10-12', 2)).toEqual(['2026-10-09', '2026-10-13']);
  });
  it('sin objetivo toma las más tempranas', () => {
    expect(fechasMasCercanas(['2026-10-20', '2026-10-06', '2026-10-09'], null, 2)).toEqual(['2026-10-06', '2026-10-09']);
  });
});
