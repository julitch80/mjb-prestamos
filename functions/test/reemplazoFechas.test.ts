import { describe, expect, it } from 'vitest';
import { fechaValida, hoyBogota, vencido } from '../src/reemplazoFechas.js';

describe('reemplazoFechas', () => {
  it('hoyBogota usa UTC-5', () => {
    expect(hoyBogota(new Date('2026-10-06T03:00:00Z'))).toBe('2026-10-05');
    expect(hoyBogota(new Date('2026-10-06T05:00:00Z'))).toBe('2026-10-06');
  });
  it('fechaValida', () => {
    expect(fechaValida('2026-10-05')).toBe(true);
    expect(fechaValida('2026-02-30')).toBe(false);
    expect(fechaValida('5/10/2026')).toBe(false);
    expect(fechaValida(undefined)).toBe(false);
  });
  it('vencido el día del regreso y después', () => {
    expect(vencido('2026-10-10', '2026-10-09')).toBe(false);
    expect(vencido('2026-10-10', '2026-10-10')).toBe(true);
    expect(vencido('2026-10-10', '2026-10-11')).toBe(true);
  });
});
