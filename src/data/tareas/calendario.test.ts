import { describe, expect, it } from 'vitest';
import { primerHabilDesde, semanaOffsetInicial } from './calendario';

describe('semanaOffsetInicial', () => {
  it('domingo: la referencia salta al lunes siguiente, esa semana es "esta semana" (0)', () => {
    // 2026-09-20 es domingo. El lunes siguiente es 2026-09-21.
    expect(primerHabilDesde('2026-09-20')).toBe('2026-09-21');
    expect(semanaOffsetInicial('2026-09-20')).toBe(0);
  });

  it('viernes: no queda nada útil en la semana en curso, arranca en "próxima" (1)', () => {
    // 2026-09-18 es viernes.
    expect(semanaOffsetInicial('2026-09-18')).toBe(1);
  });

  it('miércoles normal: sigue quedando semana por delante, arranca en "esta semana" (0)', () => {
    // 2026-09-16 es miércoles.
    expect(semanaOffsetInicial('2026-09-16')).toBe(0);
  });
});
