import { describe, expect, test } from 'vitest';
import {
  avisoMinutosAntes, correoParaCalendario, cuerpoEventoGoogle, eventosDeseadosDelGrupo,
  planDeCambios, type EventoExistente, type TareaRemota,
} from './sincronizacion-calendario';

const nombre = (id: string) => ({ fisica: 'Física', matematicas: 'Matemáticas' }[id] ?? id);
const URL_AGENDA = 'https://julitch80.github.io/mjb-prestamos/#/agenda/10.1';

function tarea(p: Partial<TareaRemota>): TareaRemota {
  return { id: 'T1', grupo: '10.1', asignaturaId: 'fisica', titulo: 'Leyes de Newton',
    fechaEntrega: '2026-09-24', estado: 'activa', momentos: 2, ...p };
}

describe('aviso del día anterior (D2)', () => {
  test('mañana: 3 p. m. del día anterior', () => expect(avisoMinutosAntes('10.1')).toBe(540));
  test('tarde: 9 a. m. del día anterior', () => expect(avisoMinutosAntes('7º2')).toBe(900));
});

describe('eventos deseados', () => {
  test('solo tareas activas del grupo, con asignatura y título', () => {
    const ev = eventosDeseadosDelGrupo([
      tarea({}),
      tarea({ id: 'T2', estado: 'cancelada' }),
      tarea({ id: 'T3', grupo: '10.2' }),
    ], '10.1', nombre, URL_AGENDA);
    expect(ev.map((e) => e.tareaId)).toEqual(['T1']);
    expect(ev[0].resumen).toBe('Física — Leyes de Newton');
    expect(ev[0].descripcion).toContain(URL_AGENDA);
  });

  test('la huella cambia si cambia la fecha y no si no cambia nada', () => {
    const a = eventosDeseadosDelGrupo([tarea({})], '10.1', nombre, URL_AGENDA)[0];
    const b = eventosDeseadosDelGrupo([tarea({})], '10.1', nombre, URL_AGENDA)[0];
    const c = eventosDeseadosDelGrupo([tarea({ fechaEntrega: '2026-09-25' })], '10.1', nombre, URL_AGENDA)[0];
    expect(a.huella).toBe(b.huella);
    expect(a.huella).not.toBe(c.huella);
  });
});

describe('plan de cambios', () => {
  const d1 = eventosDeseadosDelGrupo([tarea({})], '10.1', nombre, URL_AGENDA)[0];
  const d2 = eventosDeseadosDelGrupo([tarea({ id: 'T2', titulo: 'Otra' })], '10.1', nombre, URL_AGENDA)[0];
  const ex = (p: Partial<EventoExistente>): EventoExistente =>
    ({ eventId: 'E1', tareaId: 'T1', grupo: '10.1', huella: d1.huella, ...p });

  test('crea lo que falta y no toca lo que está igual', () => {
    const p = planDeCambios([d1, d2], [ex({})]);
    expect(p.crear.map((e) => e.tareaId)).toEqual(['T2']);
    expect(p.actualizar).toEqual([]);
    expect(p.borrar).toEqual([]);
  });

  test('actualiza si cambió la huella', () => {
    const p = planDeCambios([d1], [ex({ huella: 'vieja' })]);
    expect(p.actualizar).toEqual([{ eventId: 'E1', evento: d1 }]);
  });

  test('borra la tarea cancelada y los duplicados, nunca eventos ajenos', () => {
    const p = planDeCambios([], [
      ex({}),
      ex({ eventId: 'E2' }),
      ex({ eventId: 'AJENO', tareaId: null, grupo: null, huella: null }),
    ]);
    expect(p.borrar.sort()).toEqual(['E1', 'E2']);
  });
});

describe('cuerpo del evento', () => {
  test('todo el día, termina el día siguiente, aviso y marcas privadas', () => {
    const d = eventosDeseadosDelGrupo([tarea({ fechaEntrega: '2026-09-30' })], '10.1', nombre, URL_AGENDA)[0];
    const c = cuerpoEventoGoogle(d) as any;
    expect(c.start).toEqual({ date: '2026-09-30' });
    expect(c.end).toEqual({ date: '2026-10-01' });
    expect(c.reminders.overrides[0].minutes).toBe(540);
    expect(c.extendedProperties.private.tareaId).toBe('T1');
  });
});

describe('quién recibe el calendario', () => {
  const D = 'iemanueljbetancur.edu.co';
  test('correo del dominio y cuenta activa', () =>
    expect(correoParaCalendario({ correoInstitucional: ' Ana.P@IEManuelJBetancur.edu.co ' }, D)).toBe('ana.p@iemanueljbetancur.edu.co'));
  test('sin correo, otro dominio, cuenta inactiva o retirado: no', () => {
    expect(correoParaCalendario({}, D)).toBeNull();
    expect(correoParaCalendario({ correoInstitucional: 'ana@gmail.com' }, D)).toBeNull();
    expect(correoParaCalendario({ correoInstitucional: 'ana@' + D, correoCuentaActiva: false }, D)).toBeNull();
    expect(correoParaCalendario({ correoInstitucional: 'ana@' + D, activo: false }, D)).toBeNull();
  });
});
