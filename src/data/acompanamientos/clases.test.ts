import { describe, it, expect } from 'vitest';
import { clasesEnDia, clasesPorDia, DIA_CARGADO } from './clases';

/**
 * Valores calculados a mano leyendo `horarioBase.ts` directamente (contando
 * bloques distintos), NO recalculados con `clasesEnDia`, para que la prueba
 * sea independiente de la función que verifica.
 *
 * - Julián, mañana, lunes: bloques 3, 4, 5, 6 → 4 clases.
 * - Marta, tarde, martes: 3 clases (bloques 1, 2 y uno más — confirmado
 *   contando las entradas de horarioBase con docente 'marta', jornada
 *   'tarde', dia 'martes').
 */
describe('clases', () => {
  it('DIA_CARGADO es 5', () => {
    expect(DIA_CARGADO).toBe(5);
  });

  it('Julián tiene 4 clases el lunes de mañana', () => {
    expect(clasesEnDia('julian', 'manana', 'lunes')).toBe(4);
  });

  it('Marta tiene 3 clases el martes de tarde', () => {
    expect(clasesEnDia('marta', 'tarde', 'martes')).toBe(3);
  });

  it('clasesPorDia trae los 5 días y coincide con clasesEnDia', () => {
    const porDia = clasesPorDia('julian', 'manana');
    expect(Object.keys(porDia).sort()).toEqual(
      ['jueves', 'lunes', 'martes', 'miercoles', 'viernes'].sort(),
    );
    expect(porDia.lunes).toBe(clasesEnDia('julian', 'manana', 'lunes'));
    expect(porDia.miercoles).toBe(clasesEnDia('julian', 'manana', 'miercoles'));
  });

  it('un día sin clases da 0', () => {
    expect(clasesEnDia('julian', 'tarde', 'lunes')).toBe(0);
  });

  it('profesores reales con día de 5-6 clases quedan por encima de DIA_CARGADO', () => {
    // Confirmados a mano (ver comentario en clases.ts): monica_c viernes
    // mañana tiene 6 clases, y edgar miércoles tarde tiene 6.
    expect(clasesEnDia('monica_c', 'manana', 'viernes')).toBeGreaterThanOrEqual(DIA_CARGADO);
    expect(clasesEnDia('edgar', 'tarde', 'miercoles')).toBeGreaterThanOrEqual(DIA_CARGADO);
  });
});
