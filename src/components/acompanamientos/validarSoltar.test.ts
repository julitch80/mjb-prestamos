import { describe, expect, it } from 'vitest';
import { distribucionInicial } from '../../data/acompanamientos/inicial';
import { validarSoltar } from './EditorManualAcompanamientos';

describe('soltar un profesor en una casilla del editor manual', () => {
  const manana = distribucionInicial('manana');

  it('no deja poner a Edgar en la mañana y dice por qué', () => {
    const r = validarSoltar(manana, 'manana', 'edgar', 'tienda-escolar', 'martes', null);
    expect(r.ok).toBe(false);
    expect(r.motivo).toContain('no está en la jornada de la mañana');
  });

  it('no deja poner a Marta en la tarde un lunes (solo va martes y jueves)', () => {
    const tarde = { ...distribucionInicial('tarde'), asignaciones: [] };
    const zona = tarde.zonas[0].id;
    expect(validarSoltar(tarde, 'tarde', 'marta', zona, 'lunes', null).ok).toBe(false);
    expect(validarSoltar(tarde, 'tarde', 'marta', zona, 'martes', null).ok).toBe(true);
  });

  it('no deja soltar en una casilla llena, ni a alguien que ya cubre otra zona ese día', () => {
    const lleno = validarSoltar(manana, 'manana', 'julian', 'restaurante', 'lunes', null);
    expect(lleno.ok).toBe(false);
    expect(lleno.motivo).toContain('ya tiene su cupo');

    const libre = { ...manana, asignaciones: manana.asignaciones.filter((a) => !(a.zonaId === 'banos' && a.dia === 'lunes')) };
    // Doris ya está en el restaurante el lunes.
    const doble = validarSoltar(libre, 'manana', 'doris', 'banos', 'lunes', null);
    expect(doble.ok).toBe(false);
    expect(doble.motivo).toContain('ya cubre Restaurante');
  });

  it('deja soltar en una casilla que quedó vacía', () => {
    const libre = { ...manana, asignaciones: manana.asignaciones.filter((a) => !(a.zonaId === 'banos' && a.dia === 'lunes')) };
    const quien = manana.asignaciones.find((a) => a.zonaId === 'banos' && a.dia === 'lunes')!.docenteId;
    expect(validarSoltar(libre, 'manana', quien, 'banos', 'lunes', null).ok).toBe(true);
  });
});
