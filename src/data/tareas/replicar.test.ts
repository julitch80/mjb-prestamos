import { describe, it, expect } from 'vitest';
import { lapsoDe, planificarReplica, planificarReplicas, proximaClase, tareaDesdePlan } from './replicar';
import type { ContextoValidacion, Tarea } from './tipos';

// Semana de referencia: lunes 6 a viernes 10 de julio de 2026.
// Festivo: lunes 20 de julio (Independencia).

function tarea(parcial: Partial<Tarea> = {}): Tarea {
  return {
    id: 'origen',
    grupo: '10.1',
    asignaturaId: 'fisica',
    docenteId: 'julian',
    titulo: 'Taller de circuitos',
    momentos: 1,
    fechaAsignacion: '2026-07-06', // lunes
    fechaEntrega: '2026-07-10',    // viernes  -> 4 días de trabajo
    estado: 'activa',
    ...parcial,
  };
}

function contexto(parcial: Partial<ContextoValidacion> = {}): ContextoValidacion {
  return {
    hoy: '2026-07-06',
    tareas: [],
    cesiones: [],
    diasClase: ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'],
    ...parcial,
  };
}

describe('proximaClase', () => {
  it('encuentra el siguiente día de clase incluyendo el mismo día', () => {
    expect(proximaClase('2026-07-06', ['lunes'])).toBe('2026-07-06');
    expect(proximaClase('2026-07-06', ['jueves'])).toBe('2026-07-09');
  });

  it('salta festivos: el lunes 20 de julio no cuenta como clase', () => {
    // Desde el viernes 17, la próxima clase de "lunes" sería el 20 (festivo).
    expect(proximaClase('2026-07-17', ['lunes'])).toBe('2026-07-27');
  });

  it('devuelve null si el grupo no tiene días de clase cargados', () => {
    expect(proximaClase('2026-07-06', [])).toBeNull();
  });
});

describe('lapsoDe', () => {
  it('cuenta los días de trabajo entre asignación y entrega', () => {
    expect(lapsoDe(tarea())).toBe(4);
    expect(lapsoDe(tarea({ fechaAsignacion: '2026-07-06', fechaEntrega: '2026-07-07' }))).toBe(1);
  });
});

describe('planificarReplica — opción C', () => {
  it('asigna en la próxima clase del grupo destino, no en la fecha del original', () => {
    const plan = planificarReplica(tarea(), '10.2', contexto({ diasClase: ['jueves'] }));
    expect(plan.viable).toBe(true);
    expect(plan.fechaAsignacion).toBe('2026-07-09'); // jueves, no el lunes del original
  });

  it('conserva el mismo tiempo de trabajo y entrega en una clase con ese grupo', () => {
    const plan = planificarReplica(tarea(), '10.2', contexto({ diasClase: ['jueves'] }));
    // 4 días después del jueves 9 cae lunes 13; la próxima clase es el jueves 16.
    expect(plan.fechaEntrega).toBe('2026-07-16');
  });

  it('no propone nada si el grupo no tiene horario cargado (caso primaria hoy)', () => {
    const plan = planificarReplica(tarea(), '3°1', contexto({ diasClase: [] }));
    expect(plan.viable).toBe(false);
    expect(plan.motivo).toMatch(/horario/i);
  });

  it('cuando el cupo del grupo destino está agotado, no inventa: explica por qué', () => {
    // Se llena la semana de ejecución del grupo destino con la misma asignatura.
    const llenas: Tarea[] = Array.from({ length: 6 }, (_, i) =>
      tarea({
        id: `previa-${i}`,
        grupo: '10.2',
        momentos: 4,
        fechaAsignacion: '2026-07-06',
        fechaEntrega: '2026-07-31',
      }),
    );
    const plan = planificarReplica(
      tarea(),
      '10.2',
      contexto({ diasClase: ['jueves'], tareas: llenas }),
    );
    expect(plan.viable).toBe(false);
    expect(plan.motivo).toBeTruthy();
  });
});

describe('planificarReplicas', () => {
  it('excluye el grupo de origen', () => {
    const planes = planificarReplicas(tarea(), ['10.1', '10.2'], () =>
      contexto({ diasClase: ['jueves'] }),
    );
    expect(planes.map((p) => p.grupo)).toEqual(['10.2']);
  });

  it('usa el contexto de CADA grupo destino, no el del original', () => {
    const planes = planificarReplicas(tarea(), ['10.2', '10.3'], (g) =>
      contexto({ diasClase: g === '10.2' ? ['martes'] : ['viernes'] }),
    );
    expect(planes.find((p) => p.grupo === '10.2')?.fechaAsignacion).toBe('2026-07-07');
    expect(planes.find((p) => p.grupo === '10.3')?.fechaAsignacion).toBe('2026-07-10');
  });
});

describe('tareaDesdePlan', () => {
  it('hereda título, asignatura, docente y momentos del original', () => {
    const original = tarea();
    const plan = planificarReplica(original, '10.2', contexto({ diasClase: ['jueves'] }));
    const nueva = tareaDesdePlan(original, plan)!;
    expect(nueva).toMatchObject({
      grupo: '10.2',
      asignaturaId: 'fisica',
      docenteId: 'julian',
      titulo: 'Taller de circuitos',
      momentos: 1,
    });
  });

  it('devuelve null si el plan no es viable', () => {
    const plan = planificarReplica(tarea(), '3°1', contexto({ diasClase: [] }));
    expect(tareaDesdePlan(tarea(), plan)).toBeNull();
  });
});
