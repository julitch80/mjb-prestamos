import { describe, it, expect } from 'vitest';
import { esMixto, puedeCubrir, docentesDeLaJornada, diasDisponibles, pesoDeCarga } from './disponibilidad';

describe('disponibilidad', () => {
  it('Marta (mixta) cubre la tarde solo martes y jueves', () => {
    expect(diasDisponibles('marta', 'tarde')).toEqual(['martes', 'jueves']);
  });

  it('Marta (mixta) cubre la mañana lunes, miércoles y viernes', () => {
    expect(diasDisponibles('marta', 'manana')).toEqual(['lunes', 'miercoles', 'viernes']);
  });

  it('Edgar cubre la tarde los 5 días', () => {
    expect(diasDisponibles('edgar', 'tarde')).toEqual(['lunes', 'martes', 'miercoles', 'jueves', 'viernes']);
  });

  it('Edgar no cubre ningún día de la mañana (su CI del martes no cuenta)', () => {
    expect(diasDisponibles('edgar', 'manana')).toEqual([]);
    expect(puedeCubrir('edgar', 'manana', 'martes')).toBe(false);
  });

  it('Edgar no es mixto: es de tarde de tiempo completo', () => {
    expect(esMixto('edgar')).toBe(false);
  });

  it('yuri y alexander (ambas sin MIXTOS_TARDE) no participan en ninguna jornada', () => {
    expect(diasDisponibles('yuri', 'manana')).toEqual([]);
    expect(diasDisponibles('yuri', 'tarde')).toEqual([]);
    expect(diasDisponibles('alexander', 'manana')).toEqual([]);
    expect(diasDisponibles('alexander', 'tarde')).toEqual([]);
    expect(docentesDeLaJornada('manana').some((u) => u.id === 'yuri')).toBe(false);
    expect(docentesDeLaJornada('tarde').some((u) => u.id === 'alexander')).toBe(false);
  });

  it('Julián (solo mañana) cubre los 5 días de la mañana', () => {
    expect(diasDisponibles('julian', 'manana')).toEqual(['lunes', 'martes', 'miercoles', 'jueves', 'viernes']);
    expect(diasDisponibles('julian', 'tarde')).toEqual([]);
  });

  it('pesos de carga: Marta (mixta) 0.5, Julián (tiempo completo) 1', () => {
    expect(pesoDeCarga('marta', 'tarde')).toBe(0.5);
    expect(pesoDeCarga('marta', 'manana')).toBe(0.5);
    expect(pesoDeCarga('julian', 'manana')).toBe(1);
  });

  it('docentesDeLaJornada solo incluye a quien puede cubrir al menos un día', () => {
    const manana = docentesDeLaJornada('manana');
    expect(manana.some((u) => u.id === 'julian')).toBe(true);
    expect(manana.some((u) => u.id === 'edgar')).toBe(false);
    const tarde = docentesDeLaJornada('tarde');
    expect(tarde.some((u) => u.id === 'edgar')).toBe(true);
    expect(tarde.some((u) => u.id === 'julian')).toBe(false);
  });
});
