import { describe, expect, it } from 'vitest';
import {
  EDITORES_DEFAULT, avisoIdValido, esDestinatarioAviso, fechaValida, horaTexto, horaValida, normalizarAvisos, puedeCambiarEstado,
  puedeCrearAviso, puedeEditar, puedeModificarAviso, puestoIdValido, textoAsignacion, textoAvisoValido, textoCambioHorario, truncar,
} from './logica';

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

describe('avisos', () => {
  const mana = { ...act, role: 'docente', slotId: 'julian' };
  const tarde = { ...act, role: 'coordinador', slotId: 'coord_tarde' };
  const sup = { ...act, role: 'superusuario', slotId: 'x' };
  it('texto de cambio de horario', () => {
    expect(textoCambioHorario('manana', '2026-10-21', '10:00', 'Lluvia'))
      .toBe('⚠️ Cambio: el simulacro de la mañana pasa al miércoles 21 de octubre a las 10:00 a. m. — motivo: Lluvia');
    expect(textoCambioHorario('tarde', '2026-11-05', '16:05')).toBe('⚠️ Cambio: el simulacro de la tarde pasa al jueves 5 de noviembre a las 4:05 p. m.');
    expect(horaTexto('00:30')).toBe('12:30 a. m.');
    expect(horaTexto('12:00')).toBe('12:00 p. m.');
    expect(textoCambioHorario('tarde', '2026-11-05', '16:05', 'x'.repeat(900)).length).toBeLessThanOrEqual(500);
  });
  it('permisos: crear', () => {
    expect(puedeCrearAviso(mana, EDITORES_DEFAULT, 'manana')).toBe(true);
    expect(puedeCrearAviso(mana, EDITORES_DEFAULT, 'tarde')).toBe(false);
    expect(puedeCrearAviso(mana, EDITORES_DEFAULT, 'ambas')).toBe(true);
    expect(puedeCrearAviso(tarde, EDITORES_DEFAULT, 'manana')).toBe(false);
    expect(puedeCrearAviso(sup, EDITORES_DEFAULT, 'tarde')).toBe(true);
    expect(puedeCrearAviso({ ...act, slotId: 'otro' }, EDITORES_DEFAULT, 'ambas')).toBe(false);
  });
  it('permisos: modificar/borrar', () => {
    expect(puedeModificarAviso(mana, EDITORES_DEFAULT, { jornada: 'manana', porSlot: 'otro' })).toBe(true);
    expect(puedeModificarAviso(mana, EDITORES_DEFAULT, { jornada: 'tarde', porSlot: 'julian' })).toBe(false);
    expect(puedeModificarAviso(mana, EDITORES_DEFAULT, { jornada: 'ambas', porSlot: 'coord_tarde' })).toBe(false);
    expect(puedeModificarAviso(mana, EDITORES_DEFAULT, { jornada: 'ambas', porSlot: 'julian' })).toBe(true);
    expect(puedeModificarAviso(sup, EDITORES_DEFAULT, { jornada: 'ambas', porSlot: 'julian' })).toBe(true);
  });
  it('validadores y destinatarios', () => {
    expect(textoAvisoValido('hola')).toBe(true);
    expect(textoAvisoValido('   ')).toBe(false);
    expect(textoAvisoValido('x'.repeat(501))).toBe(false);
    expect(avisoIdValido('cambio_manana')).toBe(true);
    expect(avisoIdValido('a.b')).toBe(false);
    expect(truncar('a'.repeat(200), 120).length).toBe(120);
    expect(esDestinatarioAviso({ active: true, jornada: 'manana' }, 'manana', 'principal')).toBe(true);
    expect(esDestinatarioAviso({ active: true, jornada: 'ambas', sede: 'central' }, 'tarde', 'principal')).toBe(true);
    expect(esDestinatarioAviso({ active: true, jornada: 'tarde' }, 'manana', 'principal')).toBe(false);
    expect(esDestinatarioAviso({ active: true, jornada: 'manana', sede: 'primaria' }, 'manana', 'principal')).toBe(false);
    expect(esDestinatarioAviso({ active: false, jornada: 'manana' }, 'ambas', 'principal')).toBe(false);
  });
  it('normalizarAvisos', () => {
    const autor = { por: 'a@b.c', porSlot: 'julian', ahoraISO: '2026-10-12T00:00:00.000Z' };
    const ok = normalizarAvisos({ descanso: { texto: ' hola ', jornada: 'manana', tipo: 'info' } }, autor);
    expect(ok.ok && ok.avisos.descanso).toMatchObject({ texto: 'hola', por: 'a@b.c', cuando: autor.ahoraISO });
    expect(normalizarAvisos(undefined, autor)).toEqual({ ok: true, avisos: {} });
    expect(normalizarAvisos({ A: { texto: 'x', jornada: 'manana', tipo: 'info' } }, autor).ok).toBe(false);
    expect(normalizarAvisos({ a: { texto: 'x', jornada: 'nadie', tipo: 'info' } }, autor).ok).toBe(false);
    expect(normalizarAvisos({ a: { texto: 'x', jornada: 'ambas', tipo: 'raro' } }, autor).ok).toBe(false);
    expect(normalizarAvisos([], autor).ok).toBe(false);
  });
});
