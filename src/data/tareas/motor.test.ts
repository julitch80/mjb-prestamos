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

function totalMomentos(agenda: ReturnType<typeof planificarAgenda>): number {
  return Object.values(ocupacionPorDia(agenda)).reduce((s, n) => s + n, 0);
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
  it('salta el fin de semana y no toca el día en curso ni los pasados', () => {
    // Asignada el viernes, entrega el miércoles: se reparte en lun y mar
    const t = tarea({ fechaAsignacion: '2026-07-10', fechaEntrega: '2026-07-15', momentos: 4 });
    const plan = planificarAgenda([t], '6º1', '2026-07-10');
    expect(plan.sinUbicar).toHaveLength(0);
    expect(totalMomentos(plan)).toBe(4);
    // nada el día en curso ni el fin de semana
    expect(plan.porDia['2026-07-10']).toBeUndefined();
    expect(plan.porDia['2026-07-11']).toBeUndefined();
    expect(plan.porDia['2026-07-12']).toBeUndefined();
    // repartido entre los dos días hábiles disponibles
    const oc = ocupacionPorDia(plan);
    expect(oc['2026-07-13']).toBe(2);
    expect(oc['2026-07-14']).toBe(2);
  });

  it('reparte respetando el tope diario', () => {
    const t1 = tarea({ id: 'a', momentos: 3, fechaEntrega: '2026-07-15' });
    const t2 = tarea({ id: 'b', asignaturaId: 'lengua', momentos: 3, fechaEntrega: '2026-07-15' });
    const plan = planificarAgenda([t1, t2], '6º1', '2026-07-10');
    expect(plan.sinUbicar).toHaveLength(0);
    expect(totalMomentos(plan)).toBe(6);
    for (const n of Object.values(ocupacionPorDia(plan))) expect(n).toBeLessThanOrEqual(4);
  });

  it('distribuye una tarea larga a lo largo de su lapso', () => {
    // 4 momentos con 3 semanas de plazo: no se amontonan en la primera semana
    const t = tarea({ momentos: 4, fechaAsignacion: '2026-07-06', fechaEntrega: '2026-07-24' });
    const plan = planificarAgenda([t], '6º1', '2026-07-06');
    expect(plan.sinUbicar).toHaveLength(0);
    const semanas = new Set(Object.keys(plan.porDia).map(f => claveSemana(f)));
    expect(semanas.size).toBeGreaterThanOrEqual(2); // repartida en varias semanas
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

  it('filtro 2: cupo por semana de ejecución agotado, y cesión que lo amplía', () => {
    // Matemáticas (cupo 2/semana). Dos tareas cuya ejecución cae en la semana del 6-jul.
    const existente = tarea({ id: 'x', momentos: 2, fechaEntrega: '2026-07-10' });
    const nueva = tarea({ momentos: 1, fechaEntrega: '2026-07-09' });
    const sinCesion = validarTarea(nueva, contexto({ tareas: [existente] }));
    expect(sinCesion.ok).toBe(false);
    if (!sinCesion.ok) expect(sinCesion.filtro).toBe('cupo');

    // Cesión para la SEMANA DE EJECUCIÓN (6-jul), no la de entrega
    const conCesion = validarTarea(nueva, contexto({
      tareas: [existente],
      cesiones: [{
        id: 'c1', grupo: '6º1', periodo: claveSemana('2026-07-08'),
        asignaturaOrigenId: 'artistica', asignaturaDestinoId: 'matematicas',
        docenteOrigenId: 'edgar', momentos: 1,
      }],
    }));
    expect(conCesion.ok).toBe(true);
  });

  it('permite una tarea larga si se reparte en varias semanas', () => {
    // 4 momentos de matemáticas (cupo 2/semana):
    const ctx = contexto({});
    // entrega esta misma semana → 4 momentos en una semana → excede cupo
    const corta = validarTarea(
      tarea({ momentos: 4, fechaEntrega: '2026-07-10' }), ctx);
    expect(corta.ok).toBe(false);
    if (!corta.ok) expect(corta.filtro).toBe('cupo');
    // entrega en tres semanas → ~1-2 por semana → cabe
    const larga = validarTarea(
      tarea({ momentos: 4, fechaAsignacion: '2026-07-06', fechaEntrega: '2026-07-24' }), ctx);
    expect(larga.ok).toBe(true);
  });

  it('filtro 3: bloqueo por capacidad con alternativa de fecha', () => {
    // Dos tareas llenan mar 7 y mié 8 (tope 4 c/u); la nueva no cabe antes del jue 9
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
    const ctx = contexto({});
    // 1 momento en la quincena → cabe (cupo MT = 1)
    const uno = validarTarea(
      tarea({ grupo: '10.1', momentos: 1, fechaEntrega: '2026-07-13' }), ctx);
    expect(uno.ok).toBe(true);
    // 2 momentos que se ejecutan en la misma quincena → excede cupo
    const dos = validarTarea(
      tarea({ grupo: '10.1', momentos: 2, fechaEntrega: '2026-07-13' }), ctx);
    expect(dos.ok).toBe(false);
    if (!dos.ok) expect(dos.filtro).toBe('cupo');
  });
});
