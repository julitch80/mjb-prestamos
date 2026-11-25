import { describe, expect, it } from 'vitest';
import { docentesPAE, esPAEManana, resumenPlanPAE } from './sustentacionesPAE';

describe('sustentaciones PAE', () => {
  it('solo 10.° y 11.° de la mañana', () => {
    expect(esPAEManana('10.1')).toBe(true);
    expect(esPAEManana('11.3')).toBe(true);
    expect(esPAEManana('9.1')).toBe(false);
    expect(esPAEManana('8º1')).toBe(false);
  });
  it('Claudia se reemplaza por Uriel en 10.° y no aparece en 11.°', () => {
    expect(docentesPAE('10.3')).toContain('uriel');
    expect(docentesPAE('10.3')).not.toContain('claudia');
    expect(docentesPAE('11.1')).not.toContain('claudia');
    expect(docentesPAE('11.1')).not.toContain('uriel');
  });
  it('cuenta pendientes, aprobadas y completo', () => {
    const r = resumenPlanPAE('11.1', { julian: { asesoria: true, sustentacion: true, valoracion: 'aprobo' } });
    expect(r.total).toBe(r.filas.length * 2);
    expect(r.pendientes).toBe(r.total - 2);
    expect(r.aprobadas).toBe(1);
    expect(r.completo).toBe(false);
    expect(r.filas.find(f => f.docenteId === 'julian')?.faltan).toEqual([]);
  });
});
