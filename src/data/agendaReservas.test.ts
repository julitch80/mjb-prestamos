import { describe, it, test, expect } from 'vitest';
import {
  normalizarTexto,
  emparejarLugar,
  horaABloques,
  construirPlanReservasAgenda,
  MARCA_AGENDA,
} from './agendaReservas';
import type { ReservaExistente } from './agendaReservas';
import type { AgendaSemanal } from './agendaSemanal';

describe('normalizarTexto', () => {
  it('quita tildes, mayúsculas y puntuación', () => {
    expect(normalizarTexto('Sala de Informática')).toBe('sala de informatica');
    expect(normalizarTexto('Biblioteca.')).toBe('biblioteca');
  });
});

describe('emparejarLugar', () => {
  it('reconoce variantes de nombre de aula', () => {
    expect(emparejarLugar('Aula 5')).toBe('aula_5');
    expect(emparejarLugar('aula5')).toBe('aula_5');
    expect(emparejarLugar('A5')).toBe('aula_5');
    expect(emparejarLugar('  aula   5  ')).toBe('aula_5');
  });

  it('reconoce sala de informática, laboratorio y biblioteca con tolerancia', () => {
    expect(emparejarLugar('Sala de informática')).toBe('sala_info_1');
    expect(emparejarLugar('informática')).toBe('sala_info_1');
    expect(emparejarLugar('Laboratorio')).toBe('lab_ciencias');
    expect(emparejarLugar('Biblioteca')).toBe('biblioteca');
    expect(emparejarLugar('Auditorio')).toBe('auditorio');
  });

  it('no reconoce lugares externos, genéricos u otra sede', () => {
    expect(emparejarLugar('Cancha')).toBeNull();
    expect(emparejarLugar('Biblioteca municipal')).toBeNull();
    expect(emparejarLugar('MOVA')).toBeNull();
    expect(emparejarLugar('Aulas de clase')).toBeNull();
    expect(emparejarLugar('Sede Finca')).toBeNull();
    expect(emparejarLugar('Aula 1 sede GRI y Aula 1 sede La Finca')).toBeNull();
    expect(emparejarLugar(undefined)).toBeNull();
    expect(emparejarLugar('')).toBeNull();
  });

  it('sede principal explícita sí se resuelve', () => {
    // "Sede Principal" no debe rechazarse solo por contener "sede".
    expect(emparejarLugar('Biblioteca sede principal')).toBe('biblioteca');
  });
});

describe('horaABloques', () => {
  it('sin hora o con texto no interpretable devuelve los 6 bloques', () => {
    expect(horaABloques(undefined)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(horaABloques('Durante la jornada')).toEqual([1, 2, 3, 4, 5, 6]);
    expect(horaABloques('Por confirmar')).toEqual([1, 2, 3, 4, 5, 6]);
    expect(horaABloques('Todo el día')).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('una hora puntual de la mañana cae en un solo bloque', () => {
    expect(horaABloques('6:00 am')).toEqual([1]);
    expect(horaABloques('8:30 am')).toEqual([3]);
  });

  it('un rango explícito cubre varios bloques de mañana', () => {
    expect(horaABloques('8:00 am a 12:00 m')).toEqual([3, 4, 5, 6]);
  });

  it('un rango de la tarde cae en los bloques de tarde', () => {
    expect(horaABloques('2:25 pm a 4:15 pm')).toEqual([3, 4]);
    expect(horaABloques('1:10 pm')).toEqual([2]);
  });

  it('rango sin espacio con meridiano al final (10:10-11:05am)', () => {
    expect(horaABloques('10:10-11:05am')).toEqual([5]);
  });
});

// ── construirPlanReservasAgenda ──────────────────────────────────────────────

function agendaBase(): AgendaSemanal {
  return {
    semana: 3,
    periodo: 3,
    desde: '2026-09-07',
    hasta: '2026-09-11',
    publicadaPor: 'Equipo Técnico Institucional',
    dias: [
      {
        fecha: '2026-09-07',
        dia: 'lunes',
        actividades: [
          { hora: '8:00 am a 9:00 am', actividad: 'Reunión de coordinación', lugar: 'Aula 3' },
          { hora: 'Durante la jornada', actividad: 'Montaje evento', lugar: 'Auditorio' },
          { hora: '10:00 am', actividad: 'Visita', lugar: 'Cancha' },
          { hora: '11:00 am', actividad: 'Reunión sin lugar' },
        ],
      },
    ],
  };
}

describe('construirPlanReservasAgenda', () => {
  it('crea reservas para lugares reconocidos y libres, y lista los no reconocidos', () => {
    const plan = construirPlanReservasAgenda(agendaBase(), { reservasExistentes: [] });

    // Aula 3, 8-9am → bloque 3 (08:10-09:05, solapa con 8:00-9:00)
    expect(plan.crear.find(c => c.recurso === 'aula_3' && c.bloque === 3)).toBeTruthy();
    // Auditorio "durante la jornada" → 6 bloques
    const auditorio = plan.crear.filter(c => c.recurso === 'auditorio');
    expect(auditorio.map(c => c.bloque).sort()).toEqual([1, 2, 3, 4, 5, 6]);

    expect(plan.noReconocidos).toHaveLength(1);
    expect(plan.noReconocidos[0].lugar).toBe('Cancha');
    expect(plan.crear.every(c => c.motivo.startsWith(MARCA_AGENDA))).toBe(true);
    expect(plan.liberar).toHaveLength(0);
  });

  it('no pisa un espacio ya reservado por otra persona: lo reporta como choque', () => {
    const reservasExistentes: ReservaExistente[] = [
      { id: 'r1', recurso: 'aula_3', fecha: '2026-09-07', bloque: 3, estado: 'aprobada', solicitante: 'johana' },
    ];
    const plan = construirPlanReservasAgenda(agendaBase(), { reservasExistentes });

    expect(plan.crear.find(c => c.recurso === 'aula_3' && c.bloque === 3)).toBeUndefined();
    expect(plan.choques.some(c => c.recurso === 'aula_3' && c.bloque === 3 && c.ocupante.includes('johana'))).toBe(true);
  });

  it('reporta choque con clase regular del horario base', () => {
    const plan = construirPlanReservasAgenda(agendaBase(), {
      reservasExistentes: [],
      ocupantesClaseRegular: [
        { recursoId: 'aula_3', fecha: '2026-09-07', bloque: 3, descripcion: 'Claudia · Grado 11.3' },
      ],
    });
    expect(plan.crear.find(c => c.recurso === 'aula_3' && c.bloque === 3)).toBeUndefined();
    expect(plan.choques.some(c => c.ocupante === 'Claudia · Grado 11.3')).toBe(true);
  });

  it('es idempotente: republicar la misma agenda no duplica reservas ya creadas por ella', () => {
    const primero = construirPlanReservasAgenda(agendaBase(), { reservasExistentes: [] });
    // Simula que ya se ejecutó el plan: cada `crear` se convirtió en una reserva activa.
    const reservasExistentes: ReservaExistente[] = primero.crear.map((c, i) => ({
      id: `auto-${i}`, recurso: c.recurso, fecha: c.fecha, bloque: c.bloque,
      motivo: c.motivo, estado: 'aprobada', solicitante: 'rectora',
    }));

    const segundo = construirPlanReservasAgenda(agendaBase(), { reservasExistentes });
    expect(segundo.crear).toHaveLength(0);
    expect(segundo.liberar).toHaveLength(0);
    expect(segundo.choques).toHaveLength(0);
  });

  it('libera una reserva automática cuando la actividad cambia de lugar al republicar', () => {
    const primero = construirPlanReservasAgenda(agendaBase(), { reservasExistentes: [] });
    const reservasExistentes: ReservaExistente[] = primero.crear.map((c, i) => ({
      id: `auto-${i}`, recurso: c.recurso, fecha: c.fecha, bloque: c.bloque,
      motivo: c.motivo, estado: 'aprobada', solicitante: 'rectora',
    }));

    const agendaModificada = agendaBase();
    // La reunión de coordinación se mueve de Aula 3 a Aula 4.
    agendaModificada.dias[0].actividades[0].lugar = 'Aula 4';

    const segundo = construirPlanReservasAgenda(agendaModificada, { reservasExistentes });
    expect(segundo.crear.some(c => c.recurso === 'aula_4' && c.bloque === 3)).toBe(true);
    expect(segundo.liberar.some(l => l.recurso === 'aula_3' && l.bloque === 3)).toBe(true);
  });

  it('no reserva actividades sin lugar y no las reporta como no reconocidas', () => {
    const plan = construirPlanReservasAgenda(agendaBase(), { reservasExistentes: [] });
    expect(plan.noReconocidos.some(n => n.actividad === 'Reunión sin lugar')).toBe(false);
    expect(plan.crear.some(c => c.actividad === 'Reunión sin lugar')).toBe(false);
  });
});

describe('ajustes tras simular la agenda real', () => {
  test('«Aula innovación» y «sede ppal.» se reconocen', () => {
    expect(emparejarLugar('Aula innovación')).toBe('lab_innovacion');
    expect(emparejarLugar('Aula innovación sede ppal.')).toBe('lab_innovacion');
  });
  test('dos actividades de la agenda en el mismo espacio y bloque: la segunda es choque', () => {
    const agenda = { periodo: 3, semana: 5, dias: [{ dia: 'Viernes', fecha: '2026-09-25', actividades: [
      { actividad: 'A', lugar: 'Auditorio', hora: '6:00 am' },
      { actividad: 'B', lugar: 'Auditorio', hora: '6:10 am' },
    ] }] } as any;
    const p = construirPlanReservasAgenda(agenda, { reservasExistentes: [] });
    expect(p.crear.map(c => c.actividad)).toEqual(['A']);
    expect(p.choques.map(c => c.actividad)).toEqual(['B']);
  });
});
