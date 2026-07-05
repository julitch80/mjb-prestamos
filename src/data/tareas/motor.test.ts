import { describe, it, expect } from 'vitest';
import {
  esDiaHabil, esDiaEjecutable, esFestivo, diaSemana, claveSemana, claveQuincena,
} from './calendario';
import { nivelDeGrupo, CONFIG_NIVEL } from './config';
import { planificarAgenda, ocupacionPorDia, validarTarea, ventanaValida } from './motor';
import type { Tarea, ContextoValidacion } from './tipos';

// Semana de referencia: lunes 6 a viernes 10 de julio de 2026.
// Festivo cercano: lunes 20 de julio (Independencia).

function tarea(parcial: Partial<Tarea>): Tarea {
  return {
    id: parcial.id ?? Math.random().toString(36).slice(2),
    grupo: '6º1',
    asignaturaId: 'matematicas',
    docenteId: 'yanet',
    titulo: 'Tarea de prueba',
    momentos: 1,
    fechaAsignacion: '2026-07-06',
    fechaEntrega: '2026-07-10',
    estado: 'activa',
    ...parcial,
  };
}

function contexto(parcial: Partial<ContextoValidacion>): ContextoValidacion {
  return {
    hoy: '2026-07-06',
    tareas: [],
    cesiones: [],
    diasClase: ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'],
    ...parcial,
  };
}

describe('calendario', () => {
  it('reconoce festivos y fines de semana', () => {
    expect(esFestivo('2026-07-20')).toBe(true);
    expect(esDiaHabil('2026-07-20')).toBe(false);
    expect(esDiaHabil('2026-07-11')).toBe(false); // sábado
    expect(esDiaHabil('2026-07-08')).toBe(true);
    expect(diaSemana('2026-07-06')).toBe('lunes');
  });

  it('bloquea ejecución en contrajornada de media técnica', () => {
    expect(esDiaEjecutable('10.1', '2026-07-07')).toBe(false); // martes, contrajornada
    expect(esDiaEjecutable('10.1', '2026-07-08')).toBe(true);  // miércoles
    expect(esDiaEjecutable('9.1', '2026-07-07')).toBe(true);   // grupo académico
  });

  it('calcula claves de semana y quincena', () => {
    expect(claveSemana('2026-07-08')).toBe('2026-07-06');
    expect(claveQuincena('2026-07-08')).toBe(claveQuincena('2026-07-15')); // mismo par
    expect(claveQuincena('2026-07-08')).not.toBe(claveQuincena('2026-07-21')); // par siguiente
  });

  it('clasifica niveles por grupo', () => {
    expect(nivelDeGrupo('6º1')).toBe('basica');
    expect(nivelDeGrupo('9.2')).toBe('basica');
    expect(nivelDeGrupo('10.3')).toBe('media');
    expect(nivelDeGrupo('10.1')).toBe('mt');
    expect(CONFIG_NIVEL.mt.periodoCupo).toBe('quincena');
  });
});

describe('planificarAgenda', () => {
  it('salta el fin de semana y no toca el día en curso', () => {
    // Asignada el viernes, entrega el miércoles: los 4 momentos caen el lunes
    const t = tarea({ fechaAsignacion: '2026-07-10', fechaEntrega: '2026-07-15', momentos: 4 });
    const plan = planificarAgenda([t], '6º1', '2026-07-10');
    expect(plan.sinUbicar).toHaveLength(0);
    expect(ocupacionPorDia(plan)['2026-07-13']).toBe(4);
    expect(plan.porDia['2026-07-10']).toBeUndefined();
    expect(plan.porDia['2026-07-11']).toBeUndefined();
  });

  it('reparte respetando el tope diario (EDF)', () => {
    const t1 = tarea({ id: 'a', momentos: 3, fechaEntrega: '2026-07-15' });
    const t2 = tarea({ id: 'b', asignaturaId: 'lengua', momentos: 3, fechaEntrega: '2026-07-15' });
    const plan = planificarAgenda([t1, t2], '6º1', '2026-07-10');
    expect(plan.sinUbicar).toHaveLength(0);
    const ocupacion = ocupacionPorDia(plan);
    expect(ocupacion['2026-07-13']).toBe(4); // tope
    expect(ocupacion['2026-07-14']).toBe(2);
  });

  it('marca sinUbicar cuando la agenda se satura', () => {
    // Solo el martes 7 disponible antes de la entrega: caben 4 de 12
    const ts = ['a', 'b', 'c'].map(id =>
      tarea({ id, asignaturaId: id, momentos: 4, fechaEntrega: '2026-07-08' }));
    const plan = planificarAgenda(ts, '6º1', '2026-07-06');
    const faltantes = plan.sinUbicar.reduce((s, b) => s + b.momentos, 0);
    expect(faltantes).toBe(8);
  });

  it('en media técnica no programa en días de contrajornada', () => {
    // 10.1: contrajornada martes y jueves
    const t = tarea({ grupo: '10.1', momentos: 4, fechaAsignacion: '2026-07-06', fechaEntrega: '2026-07-10' });
    const plan = planificarAgenda([t], '10.1', '2026-07-06');
    expect(plan.porDia['2026-07-07']).toBeUndefined(); // martes
    expect(plan.porDia['2026-07-09']).toBeUndefined(); // jueves
    expect(ocupacionPorDia(plan)['2026-07-08']).toBe(4); // miércoles
  });
});

describe('validarTarea — filtros', () => {
  it('filtro 0: rechaza entregas en festivo o fin de semana', () => {
    const r = validarTarea(tarea({ fechaEntrega: '2026-07-20' }), contexto({}));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.filtro).toBe('entrega');
  });

  it('filtro 1: ventana de asignación de clase + 2 días', () => {
    expect(ventanaValida('2026-07-08', ['lunes'])).toBe(true);  // clase lunes 6, asigna miércoles 8
    expect(ventanaValida('2026-07-09', ['lunes'])).toBe(false); // jueves: 3 días después
    const r = validarTarea(
      tarea({ fechaAsignacion: '2026-07-09', fechaEntrega: '2026-07-15' }),
      contexto({ diasClase: ['lunes'] })
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.filtro).toBe('ventana');
  });

  it('filtro 2: cupo semanal agotado, y cesión que lo amplía', () => {
    const existente = tarea({ id: 'x', momentos: 2, fechaEntrega: '2026-07-15' });
    const nueva = tarea({ momentos: 1, fechaEntrega: '2026-07-16' });
    const sinCesion = validarTarea(nueva, contexto({ tareas: [existente] }));
    expect(sinCesion.ok).toBe(false);
    if (!sinCesion.ok) expect(sinCesion.filtro).toBe('cupo');

    const conCesion = validarTarea(nueva, contexto({
      tareas: [existente],
      cesiones: [{
        id: 'c1', grupo: '6º1', periodo: claveSemana('2026-07-16'),
        asignaturaOrigenId: 'artistica', asignaturaDestinoId: 'matematicas',
        docenteOrigenId: 'edgar', momentos: 1,
      }],
    }));
    expect(conCesion.ok).toBe(true);
  });

  it('filtro 3: bloqueo duro con alternativas cuando no hay capacidad', () => {
    // Martes 7 y miércoles 8 quedan llenos (tope 4 c/u)
    const t1 = tarea({ id: 'a', asignaturaId: 'ingles', momentos: 4, fechaEntrega: '2026-07-09' });
    const t2 = tarea({ id: 'b', asignaturaId: 'lengua', momentos: 4, fechaEntrega: '2026-07-09' });
    const nueva = tarea({ asignaturaId: 'sociales', momentos: 2, fechaEntrega: '2026-07-09' });
    const r = validarTarea(nueva, contexto({ tareas: [t1, t2] }));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.filtro).toBe('capacidad');
      expect(r.alternativas?.primeraEntregaViable).toBe('2026-07-10');
    }
  });

  it('media técnica: cupo por quincena', () => {
    const existente = tarea({
      id: 'x', grupo: '10.1', momentos: 1, fechaEntrega: '2026-07-14',
    });
    // Misma quincena → cupo (1) agotado
    const mismaQuincena = validarTarea(
      tarea({ grupo: '10.1', momentos: 1, fechaEntrega: '2026-07-16' }),
      contexto({ tareas: [existente] })
    );
    expect(mismaQuincena.ok).toBe(false);
    if (!mismaQuincena.ok) expect(mismaQuincena.filtro).toBe('cupo');
    // Quincena siguiente → pasa (martes 21: el lunes 20 es festivo)
    const siguienteQuincena = validarTarea(
      tarea({ grupo: '10.1', momentos: 1, fechaAsignacion: '2026-07-06', fechaEntrega: '2026-07-21' }),
      contexto({ tareas: [existente] })
    );
    expect(siguienteQuincena.ok).toBe(true);
  });
});
