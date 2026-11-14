import { describe, it, expect } from 'vitest';
import { validarEdicion } from './edicion';
import type { ContextoValidacion, Tarea } from './tipos';

// Mismo escenario que motor.test.ts: lunes 6 de julio de 2026, 6º1 matemáticas (cupo 2/semana).
function tarea(parcial: Partial<Tarea>): Tarea {
  return {
    id: 'a', grupo: '6º1', asignaturaId: 'matematicas', docenteId: 'yanet',
    titulo: 'Taller', momentos: 1, fechaAsignacion: '2026-07-06', fechaEntrega: '2026-07-13',
    estado: 'activa', ...parcial,
  };
}
function contexto(parcial: Partial<ContextoValidacion>): ContextoValidacion {
  return {
    hoy: '2026-07-06', tareas: [], cesiones: [],
    diasClase: ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'], ...parcial,
  };
}

describe('validarEdicion', () => {
  it('no cuenta la propia tarea en el cupo: reducir fecha o momentos de una tarea que ya ocupa el cupo sí cabe', () => {
    const otra = tarea({ id: 'x', momentos: 1, fechaEntrega: '2026-07-10' });
    const original = tarea({ id: 'a', momentos: 1, fechaEntrega: '2026-07-13' });
    // Con la propia tarea contada dos veces (1+1+1 en la misma semana) se excedería el cupo de 2.
    const r = validarEdicion(original, { ...original, momentos: 1, fechaEntrega: '2026-07-14' },
      contexto({ tareas: [otra, original] }));
    expect(r.ok).toBe(true);
  });

  it('rechaza con filtro cupo si el cambio de momentos excede la semana', () => {
    const otra = tarea({ id: 'x', momentos: 2, fechaEntrega: '2026-07-10' });
    const original = tarea({ id: 'a', momentos: 1, fechaEntrega: '2026-07-13' });
    const r = validarEdicion(original, { ...original, momentos: 2 }, contexto({ tareas: [otra, original] }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.filtro).toBe('cupo');
  });

  it('solo texto: pasa aunque la ventana de asignación ya esté cerrada', () => {
    const original = tarea({ fechaEntrega: '2026-07-13' });
    const r = validarEdicion(original, { ...original, titulo: 'Taller corregido' },
      contexto({ hoy: '2026-07-11', tareas: [original] })); // sábado
    expect(r.ok).toBe(true);
  });

  it('rechaza título vacío, enlace inválido y tarea cancelada', () => {
    const original = tarea({});
    expect(validarEdicion(original, { ...original, titulo: '  ' }, contexto({})).ok).toBe(false);
    expect(validarEdicion(original, { ...original, enlaces: [{ url: 'javascript:x' }] }, contexto({})).ok).toBe(false);
    expect(validarEdicion({ ...original, estado: 'cancelada' }, original, contexto({})).ok).toBe(false);
  });

  it('fecha nueva: exige futuro y día hábil', () => {
    const original = tarea({});
    expect(validarEdicion(original, { ...original, fechaEntrega: '2026-07-06' }, contexto({})).ok).toBe(false);
    expect(validarEdicion(original, { ...original, fechaEntrega: '2026-07-18' }, contexto({})).ok).toBe(false); // sábado
  });

  it('recordatorio: el límite de 3 por día no cuenta el propio', () => {
    const rec = (id: string, f: string) => tarea({ id, tipo: 'recordatorio', tipoRecordatorio: 'aviso', momentos: 0, fechaEntrega: f });
    const original = rec('a', '2026-07-08');
    const tres = [rec('x', '2026-07-09'), rec('y', '2026-07-09'), rec('z', '2026-07-09')];
    const bloqueado = validarEdicion(original, { ...original, fechaEntrega: '2026-07-09' },
      contexto({ tareas: [original, ...tres] }));
    expect(bloqueado.ok).toBe(false);
    const dos = validarEdicion(original, { ...original, fechaEntrega: '2026-07-09' },
      contexto({ tareas: [original, tres[0], tres[1]] }));
    expect(dos.ok).toBe(true);
  });
});
