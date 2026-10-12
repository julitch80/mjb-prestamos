import { describe, expect, it } from 'vitest';
import { EDITORES_DEFAULT, fechaValida, horaValida, puedeCambiarEstado, puedeEditar, puestoIdValido, textoAsignacion } from './logica';

const act = { active: true };
describe('puedeEditar', () => {
  it('superusuario edita ambas', () => {
    const p = { ...act, role: 'superusuario' };
    expect(puedeEditar(p, EDITORES_DEFAULT, 'manana')).toBe(true);
    expect(puedeEditar(p, EDITORES_DEFAULT, 'tarde')).toBe(true);
  });
  it('editor solo de su jornada', () => {
    const juanDiego = { ...act, role: 'coordinador', slotId: 'coord_tarde' };
    expect(puedeEditar(juanDiego, EDITORES_DEFAULT, 'tarde')).toBe(true);
    expect(puedeEditar(juanDiego, EDITORES_DEFAULT, 'manana')).toBe(false);
    expect(puedeEditar({ ...act, slotId: 'hugo' }, EDITORES_DEFAULT, 'manana')).toBe(false);
    expect(puedeEditar({ ...act, slotId: 'julian' }, EDITORES_DEFAULT, 'manana')).toBe(true);
  });
  it('rechaza inactivo, solo lectura, sin slot y nulos', () => {
    expect(puedeEditar({ active: false, slotId: 'julian' }, EDITORES_DEFAULT, 'manana')).toBe(false);
    expect(puedeEditar({ ...act, slotId: 'julian', soloLectura: true }, EDITORES_DEFAULT, 'manana')).toBe(false);
    expect(puedeEditar({ ...act, role: 'docente' }, EDITORES_DEFAULT, 'manana')).toBe(false);
    expect(puedeEditar(null, EDITORES_DEFAULT, 'manana')).toBe(false);
    expect(puedeEditar({ ...act, slotId: 'julian' }, null, 'manana')).toBe(false);
  });
  it('estado: editor de cualquiera', () => {
    expect(puedeCambiarEstado({ ...act, slotId: 'hugo' }, EDITORES_DEFAULT)).toBe(true);
    expect(puedeCambiarEstado({ ...act, slotId: 'otro' }, EDITORES_DEFAULT)).toBe(false);
  });
});
describe('validaciones', () => {
  it('hora, fecha, puesto', () => {
    expect(horaValida('11:30')).toBe(true);
    expect(horaValida('24:00')).toBe(false);
    expect(fechaValida('2026-10-21')).toBe(true);
    expect(fechaValida('2026-02-30')).toBe(false);
    expect(puestoIdValido('cronometrador_1')).toBe(true);
    expect(puestoIdValido('a/b')).toBe(false);
    expect(puestoIdValido('')).toBe(false);
  });
  it('texto de notificación', () => {
    expect(textoAsignacion('Cronometrador 1', 'manana', true).cuerpo).toBe('Te asignaron Cronometrador 1 (mañana)');
    expect(textoAsignacion('X', 'tarde', false).cuerpo).toContain('Ya no tienes el rol');
  });
});
